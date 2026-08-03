/**
 * Midnight Spectrum palette — HueVista's single, dark-by-design theme.
 * Source of truth: HueVistaFrontEnd/src/app/globals.css (see PLAN.md §4).
 * The app ships one theme; there is no light mode at launch.
 */
export const colors = {
  bg: '#0a090f', // app background
  bgDeep: '#050409', // deepest background (behind sheets, gradients)
  surface: '#14131c', // cards
  surface2: '#1b1a26', // sheets, elevated surfaces
  fg: '#eae8e3', // primary text
  fgSoft: '#a7a4bb', // secondary text
  fgMute: '#6d6a84', // tertiary / disabled text
  accent: '#7c5cff', // electric purple — primary actions
  accentSoft: '#a080ff',
  accentDeep: '#5a3fcc',
  rule: 'rgba(234,232,227,0.09)', // hairline borders
  success: '#7fae84', // sage — DONE / ACTIVE
  danger: '#d0654c', // terracotta — EXPIRED / OVERDUE
  warning: '#d9b45c', // IN PROGRESS / EXPIRING
  // translucent overlays
  scrim: 'rgba(5,4,9,0.72)',
  accentGhost: 'rgba(124,92,255,0.14)',

  /* ---- Aurora layer ------------------------------------------------------
   * Depth on top of the flat tokens above. The tokens up to here still mirror
   * globals.css one-for-one; everything below is mobile-only surface treatment
   * and has no web counterpart to drift from.
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
