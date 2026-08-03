import { AlphaType, ColorType, type SkImage } from '@shopify/react-native-skia';
import { averageHex, patchAround } from './pixelColor';

/**
 * Lifting a colour out of the room photo — the eyedropper behind the colour
 * finder.
 *
 * The website has had this for a while: upload a photograph, click any colour in
 * it, get the nearest catalogue shade codes. On the phone the photo is already
 * loaded and decoded for the canvas, so the same thing is a pixel read away —
 * and it is the one place a customer can point at the colour they actually want
 * ("that blue, on that wall") instead of hunting for it in a grid of thousands.
 */

/** Side of the square averaged around the tap, in photo pixels. */
const PATCH = 9;

/**
 * The colour of the photo at normalized (0–1) coordinates, averaged over a
 * small patch. Returns null when the point is outside the photo or the read
 * fails.
 */
export function samplePhotoHex(image: SkImage, nx: number, ny: number): string | null {
  const region = patchAround(nx, ny, image.width(), image.height(), PATCH);
  if (!region) return null;

  try {
    const pixels = image.readPixels(region.x, region.y, {
      width: region.size,
      height: region.size,
      colorType: ColorType.RGBA_8888,
      alphaType: AlphaType.Unpremul,
    });
    if (!pixels || pixels.length < 4) return null;
    return averageHex(pixels);
  } catch {
    // A texture-backed image can refuse a CPU read on some devices; the finder
    // reports that as "couldn't read that spot" rather than crashing the editor.
    return null;
  }
}
