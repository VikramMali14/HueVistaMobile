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

/**
 * Shape. The original scale (13/11/22) was uniform enough that every element
 * carried the same weight — a card, a button and a thumbnail all looked like
 * the same object at different sizes. The softer, wider spread below gives the
 * hierarchy somewhere to live: chrome stays tight, content panes go generous.
 */
export const radius = {
  card: 20, // content panes — the floating sheet look
  cardTight: 14, // dense rows and thumbnails inside a card
  button: 16,
  input: 14,
  sheet: 30, // bottom sheets
  well: 24, // inset wells (photo frames, orb backdrops)
  pill: 999,
} as const;

export const hairline = 1;

/**
 * Elevation. RN splits shadow across platforms, so each level ships both the
 * iOS shadow triplet and an Android elevation; spread them with `...elevation.x`.
 * Shadows are violet-black rather than neutral so they sit in the aurora
 * instead of greying it out.
 */
export const elevation = {
  none: {},
  /** Resting cards. */
  low: {
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  /** Floating chrome — the tab bar, primary CTA. */
  mid: {
    shadowColor: '#000000',
    shadowOpacity: 0.45,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  /** Sheets and anything over a scrim. */
  high: {
    shadowColor: '#000000',
    shadowOpacity: 0.55,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 16 },
    elevation: 20,
  },
} as const;

/**
 * Coloured glow, for elements that should look lit rather than lifted (the
 * primary button, an active shade swatch). iOS renders the tint; Android has no
 * coloured shadow below API 28, where it degrades to a plain lift.
 */
export const glow = (color: string, opacity = 0.5, radius = 20) => ({
  shadowColor: color,
  shadowOpacity: opacity,
  shadowRadius: radius,
  shadowOffset: { width: 0, height: 8 },
  elevation: 8,
});

/** Height of the floating tab bar, and the room screens must leave under it. */
export const tabBar = {
  height: 62,
  inset: 16, // gap from the screen's side and bottom edges
} as const;

export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radius;
export type ElevationToken = keyof typeof elevation;
