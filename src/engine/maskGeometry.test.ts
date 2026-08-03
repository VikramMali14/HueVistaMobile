import { hasPaintedArea, isDrawnArea, maskOutputSize, type MaskStroke } from './maskGeometry';

const triangle = (mode: MaskStroke['mode'] = 'add'): MaskStroke => ({
  mode,
  points: [
    { x: 0.1, y: 0.1 },
    { x: 0.9, y: 0.1 },
    { x: 0.5, y: 0.9 },
  ],
});

describe('maskOutputSize', () => {
  it('keeps the photo’s aspect ratio — a mask of another shape paints the wrong wall', () => {
    const size = maskOutputSize(4032, 3024)!;
    expect(size.width / size.height).toBeCloseTo(4032 / 3024, 2);
  });

  it('caps the longest edge', () => {
    expect(maskOutputSize(4032, 3024)!.width).toBe(1600);
    expect(maskOutputSize(3024, 4032)!.height).toBe(1600);
  });

  it('leaves an already-small photo alone rather than upscaling it', () => {
    expect(maskOutputSize(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('refuses a photo with no size', () => {
    expect(maskOutputSize(0, 600)).toBeNull();
    expect(maskOutputSize(800, -1)).toBeNull();
  });
});

describe('isDrawnArea', () => {
  it('needs at least three points to enclose anything', () => {
    expect(isDrawnArea(triangle())).toBe(true);
    expect(isDrawnArea({ mode: 'add', points: [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }] })).toBe(false);
    expect(isDrawnArea({ mode: 'add', points: [] })).toBe(false);
  });
});

describe('hasPaintedArea', () => {
  it('is true once something has been added', () => {
    expect(hasPaintedArea([triangle()])).toBe(true);
  });

  it('is false for erase-only strokes — there would be nothing to save', () => {
    expect(hasPaintedArea([triangle('erase')])).toBe(false);
    expect(hasPaintedArea([])).toBe(false);
  });
});
