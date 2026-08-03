/**
 * Type system. Headings/display use Space Grotesk (loaded via expo-font in the
 * root layout); shade codes, access codes and prices use a mono face; body uses
 * the platform default (fastest, most legible for long text).
 *
 * Instrument Serif italic is the accent face. It never sets a whole line — it
 * carries one or two emphasised words inside a Space Grotesk headline
 * ("What are we *painting* today?"). That single contrast is what stops a
 * screen of one geometric sans from reading as a template.
 *
 * The `fonts` keys here MUST match the keys registered in src/theme/fonts.ts.
 */
export const fonts = {
  display: 'SpaceGrotesk_600SemiBold',
  displayBold: 'SpaceGrotesk_700Bold',
  heading: 'SpaceGrotesk_500Medium',
  serif: 'InstrumentSerif_400Regular',
  serifItalic: 'InstrumentSerif_400Regular_Italic',
  body: undefined as string | undefined, // platform default
  mono: undefined as string | undefined, // platform mono (Platform-resolved in Text)
} as const;

/**
 * Font sizes (dp). `display` and `hero` are the aurora screens' headline sizes.
 */
export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 30,
  display: 38,
  hero: 46,
} as const;

/**
 * The serif accent runs slightly larger than the sans it sits beside:
 * Instrument Serif has a smaller x-height, so matching by nominal size makes it
 * look shrunken. This scale matches them optically instead.
 */
export const SERIF_OPTICAL_SCALE = 1.12;

export const lineHeight = {
  tight: 1.1,
  snug: 1.25,
  normal: 1.45,
} as const;

export type FontToken = keyof typeof fonts;
export type FontSizeToken = keyof typeof fontSize;
