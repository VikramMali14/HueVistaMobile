/**
 * Where a tap on the canvas lands in the photo.
 *
 * The editor draws the room photo with Skia's `fit="cover"`: the image is
 * scaled until it fills the box on both axes and the overflow is cropped
 * evenly off the longer one. A tap therefore cannot be divided by the box —
 * on any photo whose shape does not match the box, part of the image is off
 * screen, and ignoring that puts the mark somewhere the user did not touch.
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
}

/**
 * Maps a tap to normalized photo coordinates, or null when the tap fell on the
 * cropped-away part of the image — possible near the edges of a photo whose
 * aspect differs from the box, and a case the caller must report rather than
 * swallow.
 */
export function tapToPhotoPoint(g: TapGeometry): TapPoint | null {
  const { locationX, locationY, boxWidth, boxHeight } = g;
  if (!(boxWidth > 0) || !(boxHeight > 0)) return null;

  const photoW = g.photoWidth && g.photoWidth > 0 ? g.photoWidth : boxWidth;
  const photoH = g.photoHeight && g.photoHeight > 0 ? g.photoHeight : boxHeight;

  // "cover": scale until both axes are covered, so the larger ratio wins.
  const scale = Math.max(boxWidth / photoW, boxHeight / photoH);
  const drawnW = photoW * scale;
  const drawnH = photoH * scale;

  // The drawn image is centred, so its top-left sits at a negative offset
  // whenever it overflows the box.
  const x = (locationX + (drawnW - boxWidth) / 2) / drawnW;
  const y = (locationY + (drawnH - boxHeight) / 2) / drawnH;

  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x, y };
}
