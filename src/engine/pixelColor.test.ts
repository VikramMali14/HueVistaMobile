import { averageHex } from './pixelColor';

/** Build an RGBA byte run from [r,g,b,a] tuples. */
function rgba(...pixels: [number, number, number, number][]): Uint8Array {
  return Uint8Array.from(pixels.flat());
}

describe('averageHex', () => {
  it('reads a single flat colour back exactly', () => {
    expect(averageHex(rgba([124, 92, 255, 255], [124, 92, 255, 255]))).toBe('#7c5cff');
  });

  it('averages the patch rather than trusting one pixel', () => {
    // A speck of grout in the middle of a wall must not decide the shade.
    expect(averageHex(rgba([100, 100, 100, 255], [200, 200, 200, 255]))).toBe('#969696');
  });

  it('ignores transparent pixels instead of averaging them as black', () => {
    expect(averageHex(rgba([255, 255, 255, 255], [0, 0, 0, 0]))).toBe('#ffffff');
  });

  it('returns null when there is nothing opaque to read', () => {
    expect(averageHex(rgba([12, 34, 56, 0]))).toBeNull();
    expect(averageHex(new Uint8Array())).toBeNull();
  });

  it('clamps to a valid six-digit hex', () => {
    const hex = averageHex(rgba([0, 0, 0, 255], [255, 255, 255, 255]));
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });
});
