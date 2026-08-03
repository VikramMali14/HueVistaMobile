import { Text as RNText, TextProps as RNTextProps, StyleSheet, Platform } from 'react-native';
import { colors, fonts, fontSize, SERIF_OPTICAL_SCALE } from '../theme';

type Variant =
  | 'hero'
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'bodySoft'
  | 'label'
  | 'caption'
  | 'mono'
  | 'overline';

export interface TextProps extends RNTextProps {
  variant?: Variant;
  color?: string;
  center?: boolean;
}

const monoFamily = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

const variants = StyleSheet.create({
  hero: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.hero,
    color: colors.fg,
    letterSpacing: -1.4,
    lineHeight: fontSize.hero * 1.04,
  },
  display: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.display,
    color: colors.fg,
    letterSpacing: -1,
    lineHeight: fontSize.display * 1.06,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.xl,
    color: colors.fg,
    letterSpacing: -0.5,
    lineHeight: fontSize.xl * 1.18,
  },
  heading: { fontFamily: fonts.heading, fontSize: fontSize.md, color: colors.fg, letterSpacing: -0.2 },
  body: { fontSize: fontSize.base, color: colors.fg, lineHeight: fontSize.base * 1.45 },
  bodySoft: { fontSize: fontSize.base, color: colors.fgSoft, lineHeight: fontSize.base * 1.45 },
  label: { fontFamily: fonts.heading, fontSize: fontSize.sm, color: colors.fgSoft },
  caption: { fontSize: fontSize.xs, color: colors.fgMute },
  mono: { fontFamily: monoFamily, fontSize: fontSize.sm, color: colors.fg, letterSpacing: 0.5 },
  /** Small uppercase section marker — replaces bare `label` above a group. */
  overline: {
    fontFamily: fonts.heading,
    fontSize: fontSize.xs,
    color: colors.fgMute,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
});

/**
 * Themed text. Defaults to body. Use `variant` for the type ramp and `color`
 * to override the token color (e.g. a status color on a pill).
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
 *   <Text variant="display">What are we <Serif>painting</Serif> today?</Text>
 *
 * One or two words only. Setting a whole line in it loses the contrast that
 * makes it worth having, and Instrument Serif is a display face — it gets
 * thin and hard to read below about 20pt.
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
