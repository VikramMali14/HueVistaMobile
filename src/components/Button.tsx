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
 * A filled button's ground is `accentDeep`, not `accent`.
 *
 * White on #7c5cff is 4.35:1 — under AA at the 15pt a button label runs. The
 * deep cut is 6.96:1. The web's own stylesheet worked this out and left the
 * note; the phone had been using the bright cut and failing the same check.
 */
const bg: Record<Variant, string> = {
  primary: colors.accentDeep,
  secondary: colors.glassStrong,
  ghost: 'transparent',
  danger: colors.warmFill,
  outline: 'transparent',
};

const fg: Record<Variant, string> = {
  primary: colors.onFill,
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
          ? glow(variant === 'danger' ? colors.warmFill : colors.accent, 0.4, 18)
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
