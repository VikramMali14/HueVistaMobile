import { Text as RNText, TextProps as RNTextProps, StyleSheet, Platform } from 'react-native';
import { colors, fonts, fontSize } from '../theme';

type Variant =
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'bodySoft'
  | 'label'
  | 'caption'
  | 'mono';

export interface TextProps extends RNTextProps {
  variant?: Variant;
  color?: string;
  center?: boolean;
}

const monoFamily = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

const variants = StyleSheet.create({
  display: { fontFamily: fonts.displayBold, fontSize: fontSize.display, color: colors.fg, letterSpacing: -0.5 },
  title: { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.fg, letterSpacing: -0.3 },
  heading: { fontFamily: fonts.heading, fontSize: fontSize.md, color: colors.fg },
  body: { fontSize: fontSize.base, color: colors.fg, lineHeight: fontSize.base * 1.45 },
  bodySoft: { fontSize: fontSize.base, color: colors.fgSoft, lineHeight: fontSize.base * 1.45 },
  label: { fontFamily: fonts.heading, fontSize: fontSize.sm, color: colors.fgSoft },
  caption: { fontSize: fontSize.xs, color: colors.fgMute },
  mono: { fontFamily: monoFamily, fontSize: fontSize.sm, color: colors.fg, letterSpacing: 0.5 },
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
