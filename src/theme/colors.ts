/**
 * Midnight Spectrum — HueVista's dark-by-design palette.
 *
 * Source of truth: `HueVistaFrontEnd/src/app/globals.css`. The tokens down to
 * `accentGhost` mirror that file one-for-one so a colour never means one thing
 * on the site and another on the phone; everything below it is mobile-only
 * surface treatment with no web counterpart to drift from.
 *
 * The app ships one theme. The web has a light mode, and the phone deliberately
 * does not: the whole product is a room photograph with paint on it, and a pale
 * chrome throws its own cast over the one thing the user is judging. Dark keeps
 * the wall the brightest object on the screen.
 */
export const colors = {
  bg: '#0a090f', // app background
  bgDeep: '#050409', // deepest background (behind sheets, gradients)
  surface: '#14131c', // cards
  surface2: '#1b1a26', // sheets, elevated surfaces
  fg: '#eae8e3', // primary text
  fgSoft: '#c9c7da', // secondary text
  fgMute: '#8f8da6', // tertiary text — 4.6:1 on the page, still legible
  fgFaint: '#6d6a84', // decorative only: rules, disabled glyphs. Never a word.
  accent: '#7c5cff', // electric purple — fills and rectangles
  accentSoft: '#a080ff', // the accent AS TEXT (4.56:1 is too tight for #7c5cff)
  accentDeep: '#5a3fcc', // filled buttons carrying white labels — 6.96:1
  warm: '#cf7b60', // the warm secondary, as words
  warmFill: '#8a3a2e', // …and as a rectangle under ivory text
  rule: 'rgba(234,232,227,0.09)', // hairline borders
  ruleStrong: 'rgba(234,232,227,0.16)',
  success: '#6fae76', // sage as text
  successFill: '#4e7a52',
  danger: '#c2402a', // errors / destructive
  dangerSoft: '#e07d68', // the same failure, as words on a dark surface
  warning: '#d9b45c', // in progress / expiring
  // translucent overlays
  scrim: 'rgba(5,4,9,0.72)',
  scrimSoft: 'rgba(5,4,9,0.55)',
  accentGhost: 'rgba(124,92,255,0.14)',

  /* ---- Aurora layer ------------------------------------------------------
   * Depth on top of the flat tokens above. Mobile-only.
   */
  // Glass: cards read as lit panes over the aurora rather than solid blocks.
  glass: 'rgba(255,255,255,0.045)',
  glassStrong: 'rgba(255,255,255,0.075)',
  glassEdge: 'rgba(255,255,255,0.10)', // top-lit hairline
  glassEdgeSoft: 'rgba(255,255,255,0.05)',
  // The violet cast the aurora wash blooms toward at the top of a screen.
  auroraDeep: '#0d0a1c',
  auroraMid: '#160f33',
  auroraLift: '#1d1240',
  // Ink for the floating tab bar and other "solid object" chrome.
  ink: '#100e18',
  inkEdge: 'rgba(255,255,255,0.08)',
  /** Panel ground for a sheet that sits over a photograph. */
  panel: 'rgba(10,9,15,0.90)',
  panelSolid: 'rgba(12,11,20,0.97)',

  /* ---- Ink on top of something else --------------------------------------
   * Two near-whites, each with one job, because the app had five: '#fff',
   * '#ffffff', '#f7f5ff', '#eae8e3' and the token `fg`, scattered through the
   * studio with nothing to say which belonged where.
   */
  /** On a filled accent or danger button. Pure white, for the contrast note in Button. */
  onFill: '#ffffff',
  /** Over a photograph or a scrim — the page ivory, lifted so it holds against a lit wall. */
  onPhoto: '#f4f2ee',

  /* ---- Marking a wall ----------------------------------------------------
   * The mask studio draws these on top of a photograph of somebody's room, so
   * they are chosen for separation from what rooms are actually made of —
   * warm neutrals, wood, white — and not from a UI palette.
   *
   * They were '#3b82f6' and '#ef4444': the default blue-500 / red-500 pair,
   * which belongs to no part of this product, fought every other colour on the
   * screen, and is the exact hue pair red-green colour blindness collapses.
   * Violet is the brand's own hue and the one furthest from a room's neutrals;
   * brick is the palette's danger red, and the two stay apart under
   * deuteranopia because they differ in lightness as well as in hue.
   */
  /**
   * The surface being added, as a wash over the photo.
   *
   * Currently the same value as `accentSoft`, and named separately on purpose:
   * one is the accent as words on a dark page, this is a wash over a
   * photograph. They answer to different constraints and either may move
   * without the other.
   */
  mark: '#a080ff',
  /** Its outline — a step brighter, so a 2px edge still reads over a lit wall. */
  markEdge: '#c9b4ff',
  /** The surface being rubbed out. */
  erase: '#c2402a',
} as const;

export type ColorToken = keyof typeof colors;

/** Hex (#rgb/#rrggbb) → `rgba(...)` at `alpha`. Falls back to the input. */
export function alpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (full.length !== 6) return hex;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return hex;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
