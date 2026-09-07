/** Color helpers for the recolor engine. */

/** Parse `#rgb` or `#rrggbb` into normalized [r, g, b] in 0..1 for shader uniforms. */
export function hexToRgb01(hex: string): [number, number, number] {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  if (full.length !== 6 || Number.isNaN(n)) return [0, 0, 0];
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
}

/** Rec.709 relative luminance of a 0..1 rgb triple — matches the shader's weights. */
export function luminance01([r, g, b]: [number, number, number]): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// sRGB transfer functions on 0..1 components.
const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const linearToSrgb = (c: number) =>
  c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

/**
 * The colour the renderer should PAINT for a catalogue shade: the hex's hue and
 * saturation with its brightness corrected to the shade's measured LRV.
 * Returned as 0..1 sRGB components, ready for the shader's `targetColor`.
 *
 * Ported line for line from `HueVistaFrontEnd/src/lib/color-science.ts`, because
 * this is the single biggest reason a shade looked one way on the site and
 * another in the app: the website has painted the LRV-corrected colour since the
 * visualizer was written, and the phone painted the raw hex. On a shade whose
 * catalogue hex disagrees with its measured LRV — which is most of the deep ones,
 * where a screen approximation always comes out too light — that is a visibly
 * different colour on the wall, not a subtle one.
 *
 * Catalogue hexes are screen approximations; the LRV (Light Reflectance Value,
 * 0–100) is the brand's MEASURED fraction of light the real paint reflects —
 * LRV 60 means CIE Y = 0.60. When the hex's implied luminance disagrees with the
 * measured LRV, trust the measurement: scale the linear-RGB channels so the
 * painted colour's luminance lands on LRV/100. Chromaticity (hue/saturation)
 * stays put; only brightness moves.
 *
 * Guard rails, each falling back to the plain hex: no/invalid LRV, a near-black
 * hex (nothing to scale), or a disagreement under 3% (screen noise, not data).
 * The correction is clamped to [0.5, 2]x so one bad catalogue row can't blow a
 * colour out, and channels that would exceed 1 are clipped — an extreme lift
 * slightly desaturates instead of wrapping.
 */
export function lrvCorrectedRgb01(hex: string, lrv?: number | null): [number, number, number] {
  const plain = hexToRgb01(hex);
  if (lrv == null || !Number.isFinite(lrv) || lrv <= 0 || lrv > 100) return plain;

  const lr = srgbToLinear(plain[0]);
  const lg = srgbToLinear(plain[1]);
  const lb = srgbToLinear(plain[2]);
  const y = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
  if (y < 0.005) return plain;

  let ratio = lrv / 100 / y;
  if (Math.abs(ratio - 1) < 0.03) return plain;
  ratio = Math.max(0.5, Math.min(2, ratio));

  return [
    linearToSrgb(Math.min(1, lr * ratio)),
    linearToSrgb(Math.min(1, lg * ratio)),
    linearToSrgb(Math.min(1, lb * ratio)),
  ];
}

/**
 * The colour to paint for a shade: LRV-corrected when the catalogue measured
 * one, the raw hex otherwise.
 *
 * The same call the website's visualizer makes per region
 * (`r.shade ? lrvCorrectedRgb01(r.hex, r.shade.lrv) : hexToRgb01(r.hex)`), kept
 * as one function so no caller can accidentally take the uncorrected path — a
 * colour lifted out of a photo or picked off a wheel has no LRV and correctly
 * paints its hex unchanged.
 */
export function paintTarget(hex: string, lrv?: number | null): [number, number, number] {
  return lrv == null ? hexToRgb01(hex) : lrvCorrectedRgb01(hex, lrv);
}
