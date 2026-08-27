import { Text as RNText, TextProps as RNTextProps, StyleSheet } from 'react-native';
import { colors, fonts, fontSize, lineHeight, DISPLAY_TRACKING, SERIF_OPTICAL_SCALE } from '../theme';

type Variant =
  | 'display'
  | 'title'
  | 'heading'
  | 'subhead'
  | 'body'
  | 'bodySoft'
  | 'label'
  | 'caption'
  | 'code'
  | 'figure'
  | 'eyebrow';

export interface TextProps extends RNTextProps {
  variant?: Variant;
  color?: string;
  center?: boolean;
}

/** Display tracking scales with size, so 32pt and 20pt tighten proportionally. */
const track = (size: number) => size * DISPLAY_TRACKING;

const variants = StyleSheet.create({
  /** The one biggest thing on a screen. Never two on the same screen. */
  display: {
    fontFamily: fonts.display,
    fontSize: fontSize.display,
    color: colors.fg,
    letterSpacing: track(fontSize.display),
    lineHeight: fontSize.display * lineHeight.tight,
  },
  /** A sheet's headline, or a screen with something above it. */
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.xxl,
    color: colors.fg,
    letterSpacing: track(fontSize.xxl),
    lineHeight: fontSize.xxl * 1.14,
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: fontSize.lg,
    color: colors.fg,
    letterSpacing: track(fontSize.lg),
    lineHeight: fontSize.lg * 1.18,
  },
  /** A row's own title — Inter, because it sits in a list and not on a page. */
  subhead: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.base,
    color: colors.fg,
    lineHeight: fontSize.base * 1.3,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: fontSize.base,
    color: colors.fg,
    lineHeight: fontSize.base * lineHeight.normal,
  },
  bodySoft: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.fgSoft,
    lineHeight: fontSize.sm * lineHeight.normal,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.fgSoft,
    lineHeight: fontSize.sm * 1.3,
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.fgMute,
    lineHeight: fontSize.xs * 1.4,
  },
  /**
   * Shade codes, prices, counts. Inter with tabular figures rather than a mono
   * face — see the note in theme/typography.ts about the dotted zero.
   */
  code: {
    fontFamily: fonts.code,
    fontSize: fontSize.sm,
    color: colors.fgSoft,
    fontVariant: ['tabular-nums'],
  },
  /** A number that IS the content — a count, a balance, a price. */
  figure: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSize.xl,
    color: colors.fg,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.4,
  },
  /**
   * The small tracked-out uppercase marker.
   *
   * Rationed on purpose. The first pass of this design put one above every
   * group on every screen — nine per screen in places — until the device that
   * was supposed to mark a section marked nothing, because everything was
   * marked. One per screen region, and only where a group would otherwise be
   * ambiguous.
   */
  eyebrow: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.fgMute,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    lineHeight: fontSize.xs * 1.2,
  },
});

/**
 * Themed text. Defaults to body. Use `variant` for the type ramp and `color`
 * to override the token colour (e.g. a status colour on a pill).
 */
export function Text({ variant = 'body', color, center, style, ...rest }: TextProps) {
  return (
    <RNText
      style={[variants[variant], color ? { color } : null, center ? { textAlign: 'center' } : null, style]}
      {...rest}
    />
  );
}

export interface SerifProps extends RNTextProps {
  children: React.ReactNode;
  /**
   * Nominal size of the sans it sits beside — it renders slightly larger to
   * match optically. Defaults to the display size.
   */
  size?: number;
  color?: string;
  /** Upright rather than italic. Italic is the house style; upright is rare. */
  upright?: boolean;
}

/**
 * The italic serif accent, nested inside a sans headline:
 *
 *   <Text variant="display">See your walls in your <Serif>chosen</Serif> colour</Text>
 *
 * Spend it three times in the whole app — see `SERIF_BUDGET` in
 * theme/typography.ts for which three and why. One or two words only: setting a
 * whole line in it loses the contrast that makes it worth having, and
 * Instrument Serif is a display face that gets thin below about 20pt.
 *
 * Note the explicit `lineHeight: undefined`: a nested Text inheriting the
 * parent's line height clips the serif's descenders on Android, because the
 * larger optical size no longer fits the box the parent reserved.
 */
export function Serif({ children, size = fontSize.display, color, upright, style, ...rest }: SerifProps) {
  return (
    <RNText
      style={[
        {
          fontFamily: upright ? fonts.serif : fonts.serifItalic,
          fontSize: size * SERIF_OPTICAL_SCALE,
          color: color ?? colors.fg,
          letterSpacing: 0,
          lineHeight: undefined,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
}
