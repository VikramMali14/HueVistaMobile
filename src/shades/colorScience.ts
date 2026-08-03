/**
 * The colour facts the catalogue states about a shade: how light it is, which
 * way its undertone leans, and what ink stays readable on top of it.
 *
 * Ported from `HueVistaFrontEnd/src/lib/color-science.ts` and `lib/color.ts`,
 * deliberately keeping the same thresholds and the same words. A customer who
 * reads "peachy" on the website and "warm" in the app is being told two things
 * about one colour, and the one standing at the counter is the one who loses.
 *
 * Everything here is pure and derived from the hex, so it works for shades the
 * bulk-imported catalogues never filled in — which is most of them.
 */

export interface Lab {
  L: number;
  a: number;
  b: number;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function hexToRgb(hex: string): RGB {
  const m = HEX_RE.exec(hex.trim());
  if (!m) return { r: 0, g: 0, b: 0 };
  let h = m[1];
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

/** sRGB → linear, on a 0–255 channel. */
function lin(c: number): number {
  const n = c / 255;
  return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
}

function rgbToXyz({ r, g, b }: RGB): [number, number, number] {
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  return [
    R * 0.4124564 + G * 0.3575761 + B * 0.1804375,
    R * 0.2126729 + G * 0.7151522 + B * 0.072175,
    R * 0.0193339 + G * 0.119192 + B * 0.9503041,
  ];
}

export function rgbToLab(rgb: RGB): Lab {
  const [X, Y, Z] = rgbToXyz(rgb);
  const Xn = 0.95047;
  const Yn = 1.0;
  const Zn = 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X / Xn);
  const fy = f(Y / Yn);
  const fz = f(Z / Zn);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function hexToLab(hex: string): Lab {
  return rgbToLab(hexToRgb(hex));
}

/** Distance from grey. Near zero means undertone talk stops mattering. */
export function chroma(lab: Lab): number {
  return Math.hypot(lab.a, lab.b);
}

/** CIELAB hue angle in [0, 360). Meaningless when chroma is near zero. */
export function labHue(lab: Lab): number {
  const h = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  return (h + 360) % 360;
}

/** Relative luminance (0–1) of a hex. */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Approximate LRV (0–100) from a hex, for the many catalogue rows that carry no
 * measured value. Where the brand did supply one, prefer it — see `lrvOf`.
 */
export function lrvFromHex(hex: string): number {
  return Math.round(luminance(hex) * 100);
}

/**
 * The shade's Light Reflectance Value: the brand's measurement when there is
 * one, otherwise derived from the hex.
 *
 * The wire type is a BigDecimal, which arrives as a number or a string
 * depending on the serializer, so both are accepted.
 */
export function lrvOf(shade: { hexCode?: string | null; lrv?: number | string | null }): number | null {
  if (shade.lrv != null) {
    const n = typeof shade.lrv === 'string' ? Number(shade.lrv) : shade.lrv;
    if (Number.isFinite(n)) return Math.round(n);
  }
  return shade.hexCode ? lrvFromHex(shade.hexCode) : null;
}

// ── Undertones ─────────────────────────────────────────────────────────────

export type Undertone =
  | 'pinkish'
  | 'peachy'
  | 'yellowish'
  | 'greenish'
  | 'bluish'
  | 'violet'
  | 'neutral';

/** Chroma below this reads as grey — no meaningful undertone. */
const NEUTRAL_CHROMA = 4;

export function undertone(hex: string): Undertone {
  const lab = hexToLab(hex);
  if (chroma(lab) < NEUTRAL_CHROMA) return 'neutral';
  // CIELAB hue anchors: red ≈ 40°, orange ≈ 59°, yellow ≈ 102°, green ≈ 136°,
  // cyan ≈ 196°, blue ≈ 306°, magenta ≈ 328° — the cool arc is wide, the warm
  // arc cramped, so these bands are NOT evenly spaced on purpose.
  const h = labHue(lab);
  if (h < 40) return 'pinkish';
  if (h < 75) return 'peachy';
  if (h < 115) return 'yellowish';
  if (h < 175) return 'greenish';
  if (h < 312) return 'bluish';
  if (h < 345) return 'violet';
  return 'pinkish';
}

/** A faint dot of the undertone direction itself, so the word has a face. */
export const UNDERTONE_DOT: Record<Undertone, string> = {
  pinkish: '#c98a96',
  peachy: '#cf9a72',
  yellowish: '#c9b36a',
  greenish: '#8aa882',
  bluish: '#7e96b4',
  violet: '#9c86b0',
  neutral: '#9a968e',
};

// ── Depth ──────────────────────────────────────────────────────────────────

/**
 * How light or dark a shade is, in the three words a customer uses.
 *
 * `dark` is the backend's word for the `tonality` column and therefore the
 * value sent as a filter; the website labels the same bucket "Deep". The API
 * word wins here, because a filter chip that says one thing and queries another
 * is a bug waiting to be reported.
 */
export type Depth = 'light' | 'medium' | 'dark';

/** LRV cut points, matching the website's Depth dropdown. */
const DEPTH_BANDS: readonly { depth: Depth; min: number }[] = [
  { depth: 'light', min: 60 },
  { depth: 'medium', min: 25 },
  { depth: 'dark', min: 0 },
];

export function depthFromLrv(lrv: number): Depth {
  return DEPTH_BANDS.find((b) => lrv >= b.min)?.depth ?? 'dark';
}

/**
 * The shade's depth: the brand's own `tonality` where it exists, otherwise
 * banded from the LRV. Null only when there is no colour to reason about.
 */
export function depthOf(shade: {
  hexCode?: string | null;
  lrv?: number | string | null;
  tonality?: string | null;
}): Depth | null {
  const stated = shade.tonality?.trim().toLowerCase();
  if (stated === 'light' || stated === 'medium' || stated === 'dark') return stated;
  const lrv = lrvOf(shade);
  return lrv == null ? null : depthFromLrv(lrv);
}

export const DEPTH_LABEL: Record<Depth, string> = {
  light: 'Light',
  medium: 'Medium',
  dark: 'Dark',
};

// ── Reading text off a swatch ──────────────────────────────────────────────

/**
 * Is this paint light enough to need dark text on it? LRV 45 is where the
 * website flips, and a swatch grid that switched at a different point would
 * look wrong beside the same grid on a laptop.
 */
export function isLightPaint(hex: string): boolean {
  return lrvFromHex(hex) >= 45;
}

/** Ink that stays readable printed on `hex`. */
export function inkOn(hex: string): { strong: string; soft: string } {
  return isLightPaint(hex)
    ? { strong: 'rgba(26,22,18,0.82)', soft: 'rgba(26,22,18,0.62)' }
    : { strong: 'rgba(255,255,255,0.92)', soft: 'rgba(255,255,255,0.68)' };
}
