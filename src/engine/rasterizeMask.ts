import { ImageFormat, PaintStyle, Skia, StrokeCap, StrokeJoin } from '@shopify/react-native-skia';
import { hasPaintedArea, isDrawnArea, maskOutputSize, type MaskStroke } from './maskGeometry';

/**
 * Turning a finger-drawn outline into the white-on-black PNG the backend stores
 * as a region mask.
 *
 * This is what makes marking a wall work when the AI cannot help — no Replicate
 * call, no credit, no round trip beyond the save itself. The phone had no such
 * path: every wall had to come from SAM 2, so a failed or unavailable model call
 * was the end of the road rather than a slower way round it.
 *
 * Strokes arrive in normalized 0–1 photo coordinates, so the same drawing
 * rasterizes correctly whatever size the canvas happened to be on screen.
 */

/**
 * Rasterize lasso strokes into a base64 PNG mask (white = paint this, black =
 * leave it), sized from the photo.
 *
 * Returns null when there is nothing to draw or the device refuses an offscreen
 * surface — the caller reports that rather than sending an empty mask, which
 * the backend would accept and then paint nothing with.
 */
export function rasterizeMask(
  strokes: readonly MaskStroke[],
  photoWidth: number,
  photoHeight: number,
): string | null {
  if (!hasPaintedArea(strokes)) return null;
  const size = maskOutputSize(photoWidth, photoHeight);
  if (!size) return null;

  const surface = Skia.Surface.MakeOffscreen(size.width, size.height);
  if (!surface) return null;

  const canvas = surface.getCanvas();
  // Opaque black everywhere: the backend reads any opaque colour as "paint
  // here", so an unpainted-but-transparent background would be ambiguous.
  canvas.clear(Skia.Color('black'));

  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setStyle(PaintStyle.Fill);
  paint.setStrokeJoin(StrokeJoin.Round);
  paint.setStrokeCap(StrokeCap.Round);

  for (const stroke of strokes) {
    if (!isDrawnArea(stroke)) continue;
    const path = Skia.Path.Make();
    stroke.points.forEach((p, i) => {
      const x = p.x * size.width;
      const y = p.y * size.height;
      if (i === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    });
    // The finger rarely returns to where it started; closing the outline is
    // what turns a squiggle into the wall the user meant to enclose.
    path.close();
    paint.setColor(Skia.Color(stroke.mode === 'add' ? 'white' : 'black'));
    canvas.drawPath(path, paint);
  }

  const image = surface.makeImageSnapshot();
  if (!image) return null;
  return image.encodeToBase64(ImageFormat.PNG, 100);
}
