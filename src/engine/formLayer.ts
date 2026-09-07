import { AlphaType, ColorType, Skia, TileMode, rect, type SkImage } from '@shopify/react-native-skia';

/**
 * The two things the recolor shader needs measured off the photograph before it
 * can paint anything: a blurred copy of it, and how light each masked surface is
 * in it.
 *
 * Both are ports of `HueVistaFrontEnd/src/lib/webgl-recolor.ts` — `blurredCopy`
 * and `regionMeanLuma` — and both use the website's own numbers, because a
 * different blur scale or a different mean is a different painted colour.
 */

/**
 * Longest edge sampled when measuring a region's mean luminance.
 *
 * The same 192 the website uses. It is a mean over tens of thousands of pixels;
 * reading the full photo to compute it would cost tens of megabytes of copies on
 * a phone and move the answer by less than a quantisation step.
 */
const SAMPLE_MAX = 192;

/** Mask coverage at or above this counts as inside the region (0–255). */
const INSIDE = 128;

/**
 * Blur radius for the "form" layer, as the website computes it: about 1% of the
 * photo's longest edge, floored at 6px and capped at 28px.
 *
 * This number IS the form/detail split. Everything smoother than it is treated
 * as the scene's light and tints the swatch; everything sharper is treated as
 * the surface's own texture and is carried onto the new colour as a ratio. Move
 * it and a wall stops looking like the same wall.
 *
 * Photos reach this already downscaled to a 1600px longest edge (see
 * DECODE_MAX_EDGE), which lands the formula in its unclamped middle — so the
 * blur is the same *fraction of the frame* the website applies to the same room.
 */
export function formBlurRadius(width: number, height: number): number {
  return Math.min(28, Math.max(6, Math.round(Math.max(width, height) * 0.01)));
}

/**
 * A blurred copy of the photo — the shader's `blur` child.
 *
 * Returns the original image when the device refuses an offscreen surface. That
 * fallback is safe rather than merely tolerable: with blur == image, B equals L,
 * the detail ratio L/B is exactly 1, and the form term degrades to a plain
 * per-pixel luminance multiply. The paint still sits in the photo's light; it
 * just loses the texture transfer.
 */
export function blurredCopy(image: SkImage): SkImage {
  const w = image.width();
  const h = image.height();
  if (!(w > 0 && h > 0)) return image;

  const surface = Skia.Surface.MakeOffscreen(w, h);
  if (!surface) return image;

  const sigma = formBlurRadius(w, h);
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  // Clamp, not decal: a decal blur pulls transparent black in from outside the
  // frame, which darkens the form layer along every edge of the photo and paints
  // a dark border onto any wall that reaches one.
  paint.setImageFilter(Skia.ImageFilter.MakeBlur(sigma, sigma, TileMode.Clamp, null));
  surface.getCanvas().drawImageRect(image, rect(0, 0, w, h), rect(0, 0, w, h), paint);

  return surface.makeImageSnapshot() ?? image;
}

/** Draw `image` into a small offscreen surface and read it back as RGBA bytes. */
function samplePixels(
  image: SkImage,
  width: number,
  height: number,
): Uint8Array | null {
  const surface = Skia.Surface.MakeOffscreen(width, height);
  if (!surface) return null;
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  surface
    .getCanvas()
    .drawImageRect(image, rect(0, 0, image.width(), image.height()), rect(0, 0, width, height), paint);
  const snapshot = surface.makeImageSnapshot();
  if (!snapshot) return null;
  try {
    const pixels = snapshot.readPixels(0, 0, {
      width,
      height,
      colorType: ColorType.RGBA_8888,
      alphaType: AlphaType.Unpremul,
    });
    return pixels instanceof Uint8Array ? pixels : null;
  } catch {
    // Some drivers refuse a CPU read of a texture-backed image.
    return null;
  }
}

/**
 * The mean luminance of the photo inside a mask, 0..1 — the shader's `baseL`.
 *
 * This is the surface's LRV *in this photograph*, and it is what "preserve the
 * light" is measured against: the form term is B/baseL, so a wall whose mean is
 * baseL comes out at exactly the swatch colour, and everything lighter or darker
 * than its own mean scales the paint up or down from there. That is what makes
 * the painted wall average to the colour on the can rather than to whatever the
 * room happened to be lit at.
 *
 * Returns 0 when nothing could be measured — no mask coverage, or a device that
 * refuses the read. The shader treats a zero baseL as "no shading available" and
 * lays down the flat swatch, which is the honest fallback: a wrong mean is a
 * wrong colour, and a flat fill is at least the right one.
 */
export function regionMeanLuma(photo: SkImage, mask: SkImage): number {
  const pw = photo.width();
  const ph = photo.height();
  if (!(pw > 0 && ph > 0)) return 0;

  const scale = Math.min(1, SAMPLE_MAX / Math.max(pw, ph));
  const w = Math.max(1, Math.round(pw * scale));
  const h = Math.max(1, Math.round(ph * scale));

  const src = samplePixels(photo, w, h);
  const msk = samplePixels(mask, w, h);
  if (!src || !msk || src.length !== msk.length) return 0;

  let sum = 0;
  let count = 0;
  for (let i = 0; i + 3 < src.length; i += 4) {
    if (msk[i] < INSIDE) continue; // outside the region
    sum += 0.2126 * src[i] + 0.7152 * src[i + 1] + 0.0722 * src[i + 2];
    count += 1;
  }
  return count === 0 ? 0 : sum / count / 255;
}

/**
 * `regionMeanLuma`, memoised on the two images it measures.
 *
 * The measurement costs two offscreen draws and two pixel reads, and it is asked
 * for on every render of every canvas showing that wall — which, during a wipe,
 * is two canvases showing the same photo through the same masks. Nothing about
 * the answer changes while both images are alive, so it is computed once and
 * held weakly: the entry dies with the photo, and the mask cache already keeps
 * one SkImage per mask URL, so the same wall in the same room always hits.
 */
const meanCache = new WeakMap<SkImage, WeakMap<SkImage, number>>();

export function regionMeanLumaCached(photo: SkImage, mask: SkImage): number {
  let byMask = meanCache.get(photo);
  if (!byMask) {
    byMask = new WeakMap<SkImage, number>();
    meanCache.set(photo, byMask);
  }
  const hit = byMask.get(mask);
  if (hit !== undefined) return hit;
  const mean = regionMeanLuma(photo, mask);
  byMask.set(mask, mean);
  return mean;
}
