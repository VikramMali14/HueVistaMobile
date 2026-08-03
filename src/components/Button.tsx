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

const bg: Record<Variant, string> = {
  primary: colors.accent,
  secondary: colors.glassStrong,
  ghost: 'transparent',
  danger: colors.danger,
  outline: 'transparent',
};

const fg: Record<Variant, string> = {
  primary: '#ffffff',
  secondary: colors.fg,
  ghost: colors.accentSoft,
  danger: '#ffffff',
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
 * The app's action. Primary carries a coloured glow so the one thing worth
 * tapping on a screen actually looks lit; `outline` is the quiet
 * dashed-adjacent variant used on the aurora hero screens, where a filled
 * button would sit on the gradient like a sticker.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  icon,
  fullWidth,
  style,
  accessibilityLabel,
  haptic,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const height = size === 'lg' ? 56 : 48;
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
      activeScale={0.96}
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
          ? glow(variant === 'danger' ? colors.danger : colors.accent, 0.45, 18)
          : variant === 'secondary'
            ? elevation.low
            : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg[variant]} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text
            style={{
              fontFamily: fonts.heading,
              fontSize: size === 'lg' ? fontSize.md : fontSize.base,
              letterSpacing: -0.2,
            }}
            color={fg[variant]}
          >
            {label}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.button,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
