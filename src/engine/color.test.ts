import { hexToRgb01, lrvCorrectedRgb01, luminance01, paintTarget } from './color';
import { lrvFromHex } from '../shades/colorScience';

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

/**
 * These are the website's own tests for `lrvCorrectedRgb01`
 * (HueVistaFrontEnd/src/lib/__tests__/color-science.test.ts), run against the
 * phone's port with the same inputs and the same expected numbers. That is the
 * point of having them here: the two implementations agreeing in prose is not
 * worth anything, and this is the arithmetic that decides what colour a wall is.
 */
describe('lrvCorrectedRgb01', () => {
  // Linear luminance of 0..1 sRGB components — the quantity LRV measures.
  const lumaOf = ([r, g, b]: [number, number, number]) => {
    const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };

  it('returns the plain hex when no LRV is given or it is out of range', () => {
    expect(lrvCorrectedRgb01('#8080ff')).toEqual([128 / 255, 128 / 255, 1]);
    expect(lrvCorrectedRgb01('#8080ff', 0)).toEqual([128 / 255, 128 / 255, 1]);
    expect(lrvCorrectedRgb01('#8080ff', 120)).toEqual([128 / 255, 128 / 255, 1]);
    expect(lrvCorrectedRgb01('#8080ff', Number.NaN)).toEqual([128 / 255, 128 / 255, 1]);
  });

  it('leaves a hex alone when its luminance already matches the LRV', () => {
    const hex = '#c98a96';
    expect(lrvCorrectedRgb01(hex, lrvFromHex(hex))).toEqual([201 / 255, 138 / 255, 150 / 255]);
  });

  it("lands the corrected colour's luminance on the measured LRV", () => {
    // Hex implies ~LRV 20; the brand measured 35 — the paint is lighter.
    expect(lumaOf(lrvCorrectedRgb01('#a47148', 35))).toBeCloseTo(0.35, 2);
    // And the darker direction too.
    expect(lumaOf(lrvCorrectedRgb01('#a47148', 12))).toBeCloseTo(0.12, 2);
  });

  it('preserves the channel proportions (hue) while moving brightness', () => {
    const [r, g, b] = lrvCorrectedRgb01('#a47148', 35);
    // Still a warm terracotta ordering: red > green > blue.
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
  });

  it('guards near-black hexes and clamps runaway corrections', () => {
    // Near-black: nothing sane to scale — plain conversion.
    expect(lrvCorrectedRgb01('#010101', 50)).toEqual([1 / 255, 1 / 255, 1 / 255]);
    // Mid-grey (~LRV 22) with an absurd catalogue LRV of 90: the 2x clamp keeps
    // the result well below the unclamped target.
    const clamped = lrvCorrectedRgb01('#808080', 90);
    expect(lumaOf(clamped)).toBeLessThan(0.5);
    clamped.forEach((c) => expect(c).toBeLessThanOrEqual(1));
  });
});

describe('paintTarget', () => {
  it('paints the raw hex for a colour nobody measured', () => {
    // A colour lifted out of a photo or picked off a wheel. Correcting it would
    // mean inventing a measurement for it.
    expect(paintTarget('#a47148')).toEqual(hexToRgb01('#a47148'));
    expect(paintTarget('#a47148', null)).toEqual(hexToRgb01('#a47148'));
  });

  it('paints the measured colour for a catalogue shade', () => {
    expect(paintTarget('#a47148', 35)).toEqual(lrvCorrectedRgb01('#a47148', 35));
  });

  it('actually moves the colour — this is the bug it exists to close', () => {
    // The phone used to paint the left-hand side of this for a shade the
    // catalogue measured at LRV 35. On a wall that is a visibly darker paint
    // than the site put there, not a rounding difference.
    const raw = hexToRgb01('#a47148');
    const painted = paintTarget('#a47148', 35);
    expect(painted[0]).toBeGreaterThan(raw[0] + 0.05);
  });
});
