/**
 * Where a tap on the canvas lands in the photo.
 *
 * The editor now sizes its canvas from the photo's own aspect ratio, so the
 * drawn image and its frame are the same shape and a tap divides cleanly by the
 * box. That is the `contain` case below, and it is the normal one.
 *
 * `cover` is kept because it is still the honest description of any box that
 * does NOT match the photo — Skia scales the image until it fills both axes and
 * crops the overflow off the longer one, so dividing by the box would put the
 * mark somewhere the user did not touch. Under `contain` the mismatch goes the
 * other way (the photo is letterboxed inside the box) and a tap on the bars
 * belongs to no pixel at all, which is reported as null.
 *
 * The backend wants normalized 0–1 coordinates in the photo's own space and
 * multiplies them by the stored pixel dimensions before handing the point to
 * SAM 2, so this returns the same 0–1 space.
 *
 * Pulled out of the screen so it can be tested: it is the one piece of the
 * marking flow where being subtly wrong produces a mask on the wrong wall
 * rather than an error anyone would notice.
 */

export interface TapPoint {
  /** 0–1 across the photo. */
  x: number;
  /** 0–1 down the photo. */
  y: number;
}

/** How the photo is scaled into the box — matches Skia's `fit` prop. */
export type PhotoFit = 'cover' | 'contain';

export interface TapGeometry {
  /** Tap position relative to the canvas box, in dp. */
  locationX: number;
  locationY: number;
  /** The on-screen box the photo is drawn into. */
  boxWidth: number;
  boxHeight: number;
  /** The photo's own pixel size. Falls back to the box when not yet loaded. */
  photoWidth?: number | null;
  photoHeight?: number | null;
  /** How the photo fills the box. Defaults to 'contain' — see the file header. */
  fit?: PhotoFit;
}

/**
 * Maps a tap to normalized photo coordinates, or null when the tap fell
 * somewhere that is not part of the image: the cropped-away part under `cover`,
 * or the letterbox bars under `contain`. Either way it is a case the caller
 * must report rather than swallow.
 */
export function tapToPhotoPoint(g: TapGeometry): TapPoint | null {
  const { locationX, locationY, boxWidth, boxHeight, fit = 'contain' } = g;
  if (!(boxWidth > 0) || !(boxHeight > 0)) return null;

  const photoW = g.photoWidth && g.photoWidth > 0 ? g.photoWidth : boxWidth;
  const photoH = g.photoHeight && g.photoHeight > 0 ? g.photoHeight : boxHeight;

  // "cover": scale until both axes are covered, so the larger ratio wins and
  // the overflow is cropped. "contain": the smaller ratio wins, so the whole
  // photo fits and the slack becomes bars. When the box already matches the
  // photo's shape — which is what the editor now arranges — the two are equal
  // and neither crops nor letterboxes.
  const scale =
    fit === 'cover'
      ? Math.max(boxWidth / photoW, boxHeight / photoH)
      : Math.min(boxWidth / photoW, boxHeight / photoH);
  const drawnW = photoW * scale;
  const drawnH = photoH * scale;

  // The drawn image is centred, so its top-left sits at a negative offset when
  // it overflows the box and a positive one when it is inset within it.
  const x = (locationX + (drawnW - boxWidth) / 2) / drawnW;
  const y = (locationY + (drawnH - boxHeight) / 2) / drawnH;

  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x, y };
}
