/**
 * Reducing a patch of photo pixels to one colour.
 *
 * Kept apart from `samplePixel`, which reaches into Skia: this half is plain
 * arithmetic and is where the behaviour worth testing lives.
 */

/** Two hex digits for a 0–255 byte. */
function byte(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
}

/**
 * Mean colour of an RGBA byte run, as `#rrggbb`.
 *
 * Fully transparent pixels are skipped rather than averaged as black — a photo
 * with an alpha edge would otherwise drag the reading toward black at exactly
 * the edges people aim at. Returns null when nothing was opaque enough to read.
 */
export function averageHex(pixels: ArrayLike<number>, opaqueThreshold = 8): string | null {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const a = pixels[i + 3];
    if (a <= opaqueThreshold) continue;
    r += pixels[i];
    g += pixels[i + 1];
    b += pixels[i + 2];
    count += 1;
  }
  if (count === 0) return null;
  return `#${byte(r / count)}${byte(g / count)}${byte(b / count)}`;
}

/**
 * The top-left corner and side of the square to read around a normalized tap,
 * clamped so the patch stays inside the image.
 *
 * Averaging a patch rather than trusting one pixel is what stops a speck of
 * grout or a JPEG artefact from deciding which paint gets recommended.
 */
export function patchAround(
  nx: number,
  ny: number,
  imageWidth: number,
  imageHeight: number,
  patch: number,
): { x: number; y: number; size: number } | null {
  if (!(nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1)) return null;
  if (!(imageWidth > 0) || !(imageHeight > 0)) return null;

  const size = Math.max(1, Math.min(patch, imageWidth, imageHeight));
  const half = Math.floor(size / 2);
  return {
    x: Math.max(0, Math.min(imageWidth - size, Math.round(nx * (imageWidth - 1)) - half)),
    y: Math.max(0, Math.min(imageHeight - size, Math.round(ny * (imageHeight - 1)) - half)),
    size,
  };
}
