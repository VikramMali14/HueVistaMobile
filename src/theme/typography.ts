/**
 * Type system. Headings/display use Space Grotesk (loaded via expo-font in the
 * root layout); shade codes, access codes and prices use a mono face; body uses
 * the platform default (fastest, most legible for long text).
 *
 * The `fonts` keys here MUST match the keys registered in src/theme/fonts.ts.
 */
export const fonts = {
  display: 'SpaceGrotesk_600SemiBold',
  displayBold: 'SpaceGrotesk_700Bold',
  heading: 'SpaceGrotesk_500Medium',
  body: undefined as string | undefined, // platform default
  mono: undefined as string | undefined, // platform mono (Platform-resolved in Text)
} as const;

/** Font sizes (dp). */
export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 30,
  display: 38,
} as const;

export const lineHeight = {
  tight: 1.1,
  snug: 1.25,
  normal: 1.45,
} as const;

export type FontToken = keyof typeof fonts;
export type FontSizeToken = keyof typeof fontSize;
