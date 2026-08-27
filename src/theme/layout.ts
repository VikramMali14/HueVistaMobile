/**
 * Spacing, shape and elevation.
 *
 * The scale is a 4pt grid with two extra rungs at the top, because a phone
 * needs fine control between elements and coarse control between sections.
 */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/**
 * Shape.
 *
 * Radii are 12–28, above the web's flat 10, because iOS and Android both draw
 * their own chrome that round and a squarer app reads as a web page in a
 * wrapper. The spread matters more than the numbers: chrome stays tight,
 * content panes go generous, so a card and the button inside it are visibly
 * different kinds of object rather than the same object at two sizes.
 */
export const radius = {
  card: 20, // content panes — the floating sheet look
  cardTight: 14, // dense rows and thumbnails inside a card
  button: 16,
  input: 14,
  sheet: 28, // bottom sheets
  well: 24, // inset wells (photo frames, orb backdrops)
  chip: 12, // swatches and small tiles
  pill: 999,
} as const;

export const hairline = 1;

/**
 * Elevation. RN splits shadow across platforms, so each level ships both the
 * iOS shadow triplet and an Android elevation; spread them with `...elevation.x`.
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
 * Coloured glow, for elements that should look lit rather than lifted.
 *
 * Rationed like the serif: at most ONE lit object per screen, and it is always
 * the single action the screen exists to get the user to take. The first pass
 * of this design put a violet corner-wash and a gradient hairline on every card
 * on every screen — six identical decorations per screen, none of them pointing
 * at anything — which is most of why it read as machine-made. A glow that is
 * everywhere says nothing.
 *
 * iOS renders the tint; Android has no coloured shadow below API 28, where it
 * degrades to a plain lift.
 */
export const glow = (color: string, opacity = 0.45, radius = 20) => ({
  shadowColor: color,
  shadowOpacity: opacity,
  shadowRadius: radius,
  shadowOffset: { width: 0, height: 8 },
  elevation: 8,
});

/** Height of the floating tab bar, and the room screens must leave under it. */
export const tabBar = {
  height: 64,
  inset: 14, // gap from the screen's side and bottom edges
} as const;

/**
 * Minimum tap target. Anything interactive is at least this tall, or carries
 * `hitSlop` to make up the difference — a swatch may be 44 wide and look like a
 * chip, but the finger hitting it is not smaller for that.
 */
export const TAP_TARGET = 44;

export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radius;
export type ElevationToken = keyof typeof elevation;
