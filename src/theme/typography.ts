/**
 * Type system.
 *
 * Space Grotesk sets headlines, Inter sets everything else, and Instrument
 * Serif italic is the accent face. That pairing is the web's, and matching it
 * is the point: a customer who saw the room on the site and opens the app is
 * looking at the same product.
 *
 * ── On the serif ──────────────────────────────────────────────────────────
 * One italic word inside a sans headline is a good device. Used on every
 * headline it stops being a device and becomes a template — which is exactly
 * how the first pass of this design read, with "Welcome *back*.", "Check your
 * *email*.", "Clear the walls *first*." and eighteen more, all identically
 * constructed. So it is rationed: `SERIF_BUDGET` names the only three places
 * that spend it, and every other headline is plain, tightly-tracked Space
 * Grotesk. Scarcity is what makes it read as a voice rather than a formula.
 *
 * ── On shade codes ────────────────────────────────────────────────────────
 * Codes are set in Inter with tabular figures, NOT in a mono face. JetBrains
 * Mono (the web's `--mono`) draws a dotted zero, and at caption size the dot
 * closes the counter and the digit reads as an 8 — the one confusion a shade
 * code cannot afford, because the code IS the order at the counter. The web
 * carved out `--code` for exactly this reason; this is that variable.
 *
 * The `fonts` keys here MUST match the keys registered in src/theme/fonts.ts.
 */
export const fonts = {
  display: 'SpaceGrotesk_600SemiBold',
  displayBold: 'SpaceGrotesk_700Bold',
  heading: 'SpaceGrotesk_500Medium',
  serif: 'InstrumentSerif_400Regular',
  serifItalic: 'InstrumentSerif_400Regular_Italic',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  /** Shade codes, prices, counts. Inter with tabular figures — see above. */
  code: 'Inter_500Medium',
} as const;

/**
 * The three screens allowed to spend the serif, and the word each spends it on.
 *
 * Not enforced by the type system — it is a budget, not a lock — but written
 * down so the next screen to want one has to argue with a list rather than with
 * nobody.
 */
export const SERIF_BUDGET = {
  /** The first thing anyone sees. */
  welcome: 'chosen',
  /** The moment the room becomes a thing they own. */
  board: 'colours',
  /** The one refusal that has to sound human rather than transactional. */
  outOfProjects: 'both',
} as const;

/**
 * Font sizes (dp).
 *
 * The old scale topped out at 46 for `hero`, which no 390pt phone ever had room
 * for — a two-line hero at 46 ate a third of the screen. The ramp now peaks
 * where a headline actually sets: 32 for the biggest thing on a screen.
 */
export const fontSize = {
  micro: 9,
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 23,
  xxl: 27,
  display: 32,
} as const;

/**
 * The serif accent runs slightly larger than the sans it sits beside:
 * Instrument Serif has a smaller x-height, so matching by nominal size makes it
 * look shrunken. This scale matches them optically instead.
 */
export const SERIF_OPTICAL_SCALE = 1.14;

export const lineHeight = {
  tight: 1.1,
  snug: 1.25,
  normal: 1.5,
} as const;

/**
 * Letter-spacing for the display face, as a fraction of the size.
 *
 * Space Grotesk is drawn loose; at headline sizes it needs pulling in or the
 * words drift apart. Applied as `size * DISPLAY_TRACKING` rather than a flat dp
 * value, so a 32pt headline and a 20pt one tighten by the same proportion.
 */
export const DISPLAY_TRACKING = -0.03;

export type FontToken = keyof typeof fonts;
export type FontSizeToken = keyof typeof fontSize;
