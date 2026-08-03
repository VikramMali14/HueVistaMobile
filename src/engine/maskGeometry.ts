/**
 * The shape maths behind a hand-drawn wall mask.
 *
 * Kept apart from `rasterizeMask`, which reaches into Skia to actually paint
 * the pixels: this half is plain arithmetic and is where the decisions worth
 * testing live.
 */

export interface MaskStroke {
  /** Outline points in 0–1 photo space, in the order they were drawn. */
  points: readonly { x: number; y: number }[];
  /** Whether this stroke adds to the wall or cuts out of it. */
  mode: 'add' | 'erase';
}

/** Longest edge of the rasterized mask. Masks do not need 12 MP of fidelity. */
export const MASK_MAX_EDGE = 1600;

/**
 * The pixel size a mask is rasterized at: the photo's aspect ratio, with the
 * longest edge capped. The aspect ratio is the part that must be exact — the
 * shader stretches the mask over the photo, so a mask of a different shape
 * paints a wall that is subtly the wrong shape.
 */
export function maskOutputSize(
  photoWidth: number,
  photoHeight: number,
  maxEdge = MASK_MAX_EDGE,
): { width: number; height: number } | null {
  if (!(photoWidth > 0) || !(photoHeight > 0)) return null;
  const scale = Math.min(1, maxEdge / Math.max(photoWidth, photoHeight));
  return {
    width: Math.max(1, Math.round(photoWidth * scale)),
    height: Math.max(1, Math.round(photoHeight * scale)),
  };
}

/** A stroke worth rasterizing: a closed area needs at least a triangle. */
export function isDrawnArea(stroke: MaskStroke): boolean {
  return stroke.points.length >= 3;
}

/** Whether anything would actually be painted white by these strokes. */
export function hasPaintedArea(strokes: readonly MaskStroke[]): boolean {
  return strokes.some((s) => s.mode === 'add' && isDrawnArea(s));
}
