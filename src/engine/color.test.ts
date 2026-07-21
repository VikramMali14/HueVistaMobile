import { hexToRgb01, luminance01 } from './color';

describe('hexToRgb01', () => {
  it('parses 6-digit hex', () => {
    expect(hexToRgb01('#ffffff')).toEqual([1, 1, 1]);
    expect(hexToRgb01('#000000')).toEqual([0, 0, 0]);
  });

  it('parses without a leading hash and 3-digit shorthand', () => {
    expect(hexToRgb01('f00')).toEqual([1, 0, 0]);
    expect(hexToRgb01('#0f0')).toEqual([0, 1, 0]);
  });

  it('maps a mid channel correctly', () => {
    const [r] = hexToRgb01('#800000');
    expect(r).toBeCloseTo(128 / 255, 5);
  });

  it('falls back to black on invalid input', () => {
    expect(hexToRgb01('nope')).toEqual([0, 0, 0]);
  });
});

describe('luminance01', () => {
  it('is 1 for white and 0 for black', () => {
    expect(luminance01([1, 1, 1])).toBeCloseTo(1, 5);
    expect(luminance01([0, 0, 0])).toBe(0);
  });

  it('weights green most heavily (Rec.709)', () => {
    expect(luminance01([0, 1, 0])).toBeGreaterThan(luminance01([1, 0, 0]));
    expect(luminance01([1, 0, 0])).toBeGreaterThan(luminance01([0, 0, 1]));
  });
});
