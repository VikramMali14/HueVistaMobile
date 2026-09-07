import { ActivityIndicator, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, spacing, fonts, fontSize, alpha, elevation, glow } from '../theme';
import { Text } from './Text';
import { PressableScale } from './PressableScale';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  /** Pushed to the far right — a price, a count, a chevron. */
  trailing?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
  /**
   * Haptic on contact. Defaults to `press` for primary/danger (committed
   * actions) and `tap` for the lighter variants — set `none` where the handler
   * fires its own, e.g. a submit that reports success or failure itself.
   */
  haptic?: 'press' | 'tap' | 'select' | 'none';
}

/**
 * A filled brass button carries INK, not white — `.btn-brass` on the website is
 * `background: var(--accent); color: var(--accent-on)`, and this is that rule.
 *
 * Brass is a pale metal, which makes it a LIGHT surface however dark the page
 * behind it is: white on #c08b4e is 2.1:1, unreadable. The phone used to darken
 * the metal to #9a6a33 and put white on it, which passes the check and is
 * exactly the muddy over-darkened cut most gold buttons end up as. Ink on the
 * bright metal is 6.2:1 and keeps the brass looking like brass.
 *
 * Oxblood is the other way round: a genuinely dark ground, so `danger` carries
 * ivory at 7.7:1.
 */
const bg: Record<Variant, string> = {
  primary: colors.accent,
  secondary: colors.glassStrong,
  ghost: 'transparent',
  danger: colors.warmFill,
  outline: 'transparent',
};

const fg: Record<Variant, string> = {
  primary: colors.accentOn,
  secondary: colors.fg,
  ghost: colors.accentSoft,
  danger: colors.onFill,
  outline: colors.fg,
};

const border: Record<Variant, string> = {
  primary: 'transparent',
  secondary: colors.glassEdge,
  ghost: 'transparent',
  danger: 'transparent',
  outline: alpha(colors.fg, 0.22),
};

/**
 * The app's action.
 *
 * Primary carries a coloured glow, and that glow is the reason a screen has at
 * most one of these: it is how the eye finds the single thing the screen exists
 * to get done. Two lit buttons on one screen is two primaries, which is none.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  icon,
  trailing,
  fullWidth,
  style,
  accessibilityLabel,
  haptic,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const height = size === 'lg' ? 54 : 48;
  const lit = variant === 'primary' || variant === 'danger';
  const defaultHaptic = lit ? 'press' : 'tap';

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      haptic={isDisabled ? 'none' : (haptic ?? defaultHaptic)}
      activeScale={0.965}
      style={[
        styles.base,
        {
          height,
          backgroundColor: bg[variant],
          borderColor: border[variant],
          borderWidth: variant === 'secondary' || variant === 'outline' ? 1 : 0,
          opacity: isDisabled ? 0.45 : 1,
          alignSelf: fullWidth ? 'stretch' : 'auto',
        },
        // A glow on a disabled control reads as available, so drop it.
        lit && !isDisabled
          ? glow(variant === 'danger' ? colors.warmFill : colors.accent, 0.32, 18)
          : variant === 'secondary'
            ? elevation.low
            : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg[variant]} />
      ) : (
        <View style={[styles.content, trailing ? styles.spread : null]}>
          <View style={styles.content}>
            {icon}
            <Text
              numberOfLines={1}
              style={{
                fontFamily: lit ? fonts.bodySemi : fonts.bodyMedium,
                fontSize: size === 'lg' ? fontSize.base : fontSize.sm,
                letterSpacing: -0.1,
              }}
              color={fg[variant]}
            >
              {label}
            </Text>
          </View>
          {trailing}
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.button,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  spread: {
    flex: 1,
    justifyContent: 'space-between',
  },
});
