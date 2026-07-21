/**
 * Spacing scale and shape language (PLAN.md §4).
 * cards radius 13 · buttons radius 11 · pills fully rounded.
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  card: 13,
  button: 11,
  input: 11,
  sheet: 22,
  pill: 999,
} as const;

export const hairline = 1;

export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radius;
