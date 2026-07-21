import { ActivityIndicator, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, spacing, fonts, fontSize } from '../theme';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
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
}

const bg: Record<Variant, string> = {
  primary: colors.accent,
  secondary: colors.surface2,
  ghost: 'transparent',
  danger: colors.danger,
};

const fg: Record<Variant, string> = {
  primary: '#ffffff',
  secondary: colors.fg,
  ghost: colors.accentSoft,
  danger: '#ffffff',
};

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
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const height = size === 'lg' ? 54 : 46;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        {
          height,
          backgroundColor: bg[variant],
          borderColor: variant === 'ghost' ? colors.rule : 'transparent',
          borderWidth: variant === 'ghost' ? 1 : 0,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? 'stretch' : 'auto',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg[variant]} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text
            style={{ fontFamily: fonts.heading, fontSize: size === 'lg' ? fontSize.md : fontSize.base }}
            color={fg[variant]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
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
});
