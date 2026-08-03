import { colors } from './colors';
import { fonts, fontSize } from './typography';
import { spacing, radius, elevation } from './layout';
import { duration, easing } from './motion';

export { colors, alpha } from './colors';
export type { ColorToken } from './colors';
export { fonts, fontSize, lineHeight, SERIF_OPTICAL_SCALE } from './typography';
export type { FontToken, FontSizeToken } from './typography';
export { spacing, radius, hairline, elevation, glow, tabBar } from './layout';
export type { SpacingToken, RadiusToken, ElevationToken } from './layout';
export { duration, easing, spring, revealOffset, stagger, useAnimatedValue } from './motion';
export type { DurationToken } from './motion';
export { fontMap } from './fonts';

/** Convenience bundle for consumers that want one import. */
export const theme = {
  colors,
  fonts,
  fontSize,
  spacing,
  radius,
  elevation,
  duration,
  easing,
} as const;

export type Theme = typeof theme;
