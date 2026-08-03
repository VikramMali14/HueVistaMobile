/**
 * How big to draw a photo so all of it is on screen.
 *
 * The editor used to draw every room into a fixed 4:3 landscape box with Skia's
 * `fit="cover"`, which scales the image until it fills the box on both axes and
 * crops whatever hangs over. Phone cameras shoot 3:4 portrait, so the common
 * case was a photo with roughly a quarter of its height cut away — including,
 * often, the top of the wall being painted. Taller shots (9:16) lost more.
 *
 * The fix is to stop choosing the box: derive it from the photo, so the drawn
 * image and its frame are the same shape and nothing is cropped at all.
 */

export interface FittedBox {
  width: number;
  height: number;
}

export interface FitOptions {
  /** Width available to the canvas (dp) — usually the content width. */
  maxWidth: number;
  /**
   * Ceiling on height (dp). A hard cap would reintroduce cropping, so this is a
   * *soft* one: when a photo is taller than this, the box narrows to keep the
   * aspect ratio exact and the whole photo visible, rather than filling the
   * width and cutting the ends off.
   */
  maxHeight?: number;
  /** Fallback aspect (w/h) used until the photo's own size is known. */
  fallbackAspect?: number;
}

/**
 * The box a photo of `photoWidth × photoHeight` should be drawn into.
 *
 * Always returns a box with the photo's own aspect ratio, so `fit="contain"`
 * and `fit="cover"` agree and neither letterboxes nor crops.
 */
export function fitBox(
  photoWidth: number | null | undefined,
  photoHeight: number | null | undefined,
  { maxWidth, maxHeight, fallbackAspect = 4 / 3 }: FitOptions,
): FittedBox {
  const w = photoWidth && photoWidth > 0 ? photoWidth : null;
  const h = photoHeight && photoHeight > 0 ? photoHeight : null;
  const aspect = w && h ? w / h : fallbackAspect;

  let width = maxWidth;
  let height = maxWidth / aspect;

  if (maxHeight && maxHeight > 0 && height > maxHeight) {
    height = maxHeight;
    width = maxHeight * aspect;
  }

  return { width: Math.round(width), height: Math.round(height) };
}
