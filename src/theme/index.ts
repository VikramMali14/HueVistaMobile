import { colors } from './colors';
import { fonts, fontSize } from './typography';
import { spacing, radius } from './layout';

export { colors } from './colors';
export type { ColorToken } from './colors';
export { fonts, fontSize, lineHeight } from './typography';
export type { FontToken, FontSizeToken } from './typography';
export { spacing, radius, hairline } from './layout';
export type { SpacingToken, RadiusToken } from './layout';
export { fontMap } from './fonts';

/** Convenience bundle for consumers that want one import. */
export const theme = {
  colors,
  fonts,
  fontSize,
  spacing,
  radius,
} as const;

export type Theme = typeof theme;
