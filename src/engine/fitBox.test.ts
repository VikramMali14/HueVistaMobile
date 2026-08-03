import { fitBox } from './fitBox';

describe('fitBox', () => {
  it('keeps the photo’s aspect ratio, so nothing is cropped', () => {
    const box = fitBox(3000, 4000, { maxWidth: 360 });
    expect(box.width / box.height).toBeCloseTo(3000 / 4000, 2);
  });

  it('fills the available width for an ordinary photo', () => {
    expect(fitBox(4032, 3024, { maxWidth: 360 })).toEqual({ width: 360, height: 270 });
  });

  it('gives a portrait photo the height it needs', () => {
    // The regression this whole module exists for: 3:4 in a 4:3 box lost a
    // quarter of its height to the crop.
    expect(fitBox(3024, 4032, { maxWidth: 360 })).toEqual({ width: 360, height: 480 });
  });

  it('narrows rather than crops when a photo is taller than the ceiling', () => {
    const box = fitBox(1080, 1920, { maxWidth: 360, maxHeight: 500 });
    expect(box.height).toBe(500);
    expect(box.width).toBeLessThan(360);
    expect(box.width / box.height).toBeCloseTo(1080 / 1920, 2);
  });

  it('falls back to 4:3 until the photo’s size is known', () => {
    expect(fitBox(null, null, { maxWidth: 360 })).toEqual({ width: 360, height: 270 });
    expect(fitBox(0, 0, { maxWidth: 360 })).toEqual({ width: 360, height: 270 });
  });
});
