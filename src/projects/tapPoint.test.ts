import { tapToPhotoPoint } from './tapPoint';
import { fitBox } from '../engine/fitBox';

/** The editor's box: full width minus the screen padding, at 4:3. */
const BOX = { boxWidth: 360, boxHeight: 270 };
/** The old behaviour, kept for boxes that do not match the photo. */
const COVER = { fit: 'cover' } as const;

describe('a photo shaped like the box', () => {
  const photo = { photoWidth: 4000, photoHeight: 3000 };

  it('maps the centre to the centre', () => {
    const p = tapToPhotoPoint({ locationX: 180, locationY: 135, ...BOX, ...photo });
    expect(p!.x).toBeCloseTo(0.5, 5);
    expect(p!.y).toBeCloseTo(0.5, 5);
  });

  it('maps the corners to the corners', () => {
    expect(tapToPhotoPoint({ locationX: 0, locationY: 0, ...BOX, ...photo })).toEqual({ x: 0, y: 0 });
    const br = tapToPhotoPoint({ locationX: 360, locationY: 270, ...BOX, ...photo })!;
    expect(br.x).toBeCloseTo(1, 5);
    expect(br.y).toBeCloseTo(1, 5);
  });

  it('reads the same under either fit — there is nothing to crop or letterbox', () => {
    const tap = { locationX: 90, locationY: 200, ...BOX, ...photo };
    expect(tapToPhotoPoint(tap)).toEqual(tapToPhotoPoint({ ...tap, ...COVER }));
  });
});

/**
 * The whole point of `fitBox`: whatever shape the photo is, the box it gets is
 * the same shape, so the mapping is a plain division and every pixel of the
 * photo is both visible and reachable.
 */
describe('a box derived from the photo', () => {
  it.each([
    ['portrait phone photo', 3000, 4000],
    ['landscape phone photo', 4032, 3024],
    ['very tall photo', 1080, 1920],
    ['panorama', 4000, 1000],
  ])('%s: corners map to corners', (_label, photoWidth, photoHeight) => {
    const box = fitBox(photoWidth, photoHeight, { maxWidth: 360 });
    const geometry = {
      boxWidth: box.width,
      boxHeight: box.height,
      photoWidth,
      photoHeight,
    };

    const topLeft = tapToPhotoPoint({ locationX: 0, locationY: 0, ...geometry })!;
    expect(topLeft.x).toBeCloseTo(0, 2);
    expect(topLeft.y).toBeCloseTo(0, 2);

    const bottomRight = tapToPhotoPoint({
      locationX: box.width,
      locationY: box.height,
      ...geometry,
    })!;
    expect(bottomRight.x).toBeCloseTo(1, 2);
    expect(bottomRight.y).toBeCloseTo(1, 2);
  });
});

/**
 * The case the naive `locationX / boxWidth` gets wrong: a portrait photo in a
 * landscape box is cropped top and bottom, so the top of the box is already
 * some way down the photo.
 */
describe('a portrait photo in a landscape box, covering it', () => {
  // 3000×4000 in a 360×270 box: scale = max(360/3000, 270/4000) = 0.12,
  // drawn 360×480, so 105dp is cropped off each of top and bottom.
  const photo = { photoWidth: 3000, photoHeight: 4000 };

  it('puts the top of the box below the top of the photo', () => {
    const p = tapToPhotoPoint({ locationX: 180, locationY: 0, ...BOX, ...photo, ...COVER })!;
    expect(p.y).toBeCloseTo(105 / 480, 5);
    expect(p.y).toBeGreaterThan(0.2);
  });

  it('still centres the centre', () => {
    const p = tapToPhotoPoint({ locationX: 180, locationY: 135, ...BOX, ...photo, ...COVER })!;
    expect(p.x).toBeCloseTo(0.5, 5);
    expect(p.y).toBeCloseTo(0.5, 5);
  });

  it('leaves the horizontal axis alone — nothing is cropped there', () => {
    expect(tapToPhotoPoint({ locationX: 0, locationY: 135, ...BOX, ...photo, ...COVER })!.x).toBeCloseTo(0, 5);
    expect(tapToPhotoPoint({ locationX: 360, locationY: 135, ...BOX, ...photo, ...COVER })!.x).toBeCloseTo(1, 5);
  });
});

describe('a very wide photo in the box, covering it', () => {
  // 4000×1000 in 360×270: scale = max(0.09, 0.27) = 0.27, drawn 1080×270,
  // so 360dp is cropped off each side.
  const photo = { photoWidth: 4000, photoHeight: 1000 };

  it('puts the left edge of the box a third into the photo', () => {
    const p = tapToPhotoPoint({ locationX: 0, locationY: 135, ...BOX, ...photo, ...COVER })!;
    expect(p.x).toBeCloseTo(360 / 1080, 5);
  });

  it('leaves the vertical axis alone', () => {
    expect(tapToPhotoPoint({ locationX: 180, locationY: 0, ...BOX, ...photo, ...COVER })!.y).toBeCloseTo(0, 5);
  });
});

describe('a portrait photo contained in a landscape box', () => {
  // 3000×4000 in 360×270: scale = min(0.12, 0.0675) = 0.0675, drawn 202.5×270,
  // so 78.75dp of bar sits on each side.
  const photo = { photoWidth: 3000, photoHeight: 4000 };

  it('shows the whole photo — the top of the box IS the top of the photo', () => {
    const p = tapToPhotoPoint({ locationX: 180, locationY: 0, ...BOX, ...photo })!;
    expect(p.y).toBeCloseTo(0, 5);
  });

  it('rejects a tap on the letterbox bar beside the photo', () => {
    expect(tapToPhotoPoint({ locationX: 10, locationY: 135, ...BOX, ...photo })).toBeNull();
  });
});

describe('taps that are not on the photo', () => {
  it('returns null past the edge of the box', () => {
    const photo = { photoWidth: 4000, photoHeight: 3000 };
    expect(tapToPhotoPoint({ locationX: -5, locationY: 135, ...BOX, ...photo })).toBeNull();
    expect(tapToPhotoPoint({ locationX: 180, locationY: 400, ...BOX, ...photo })).toBeNull();
  });
});

describe('before the photo has loaded', () => {
  it('falls back to the box, so an early tap is still in range', () => {
    const p = tapToPhotoPoint({ locationX: 90, locationY: 135, ...BOX })!;
    expect(p.x).toBeCloseTo(0.25, 5);
    expect(p.y).toBeCloseTo(0.5, 5);
  });

  it('treats a zero-sized box as unmappable rather than dividing by it', () => {
    expect(tapToPhotoPoint({ locationX: 0, locationY: 0, boxWidth: 0, boxHeight: 0 })).toBeNull();
  });
});
