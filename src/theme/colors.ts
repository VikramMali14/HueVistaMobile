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
} as const;

export type ColorToken = keyof typeof colors;
