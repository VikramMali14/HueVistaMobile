import { StyleSheet, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, alpha } from '../theme';
import { Text } from './Text';
import { PressableScale } from './PressableScale';

export interface BackLinkProps {
  /** Defaults to `router.back()`. */
  onPress?: () => void;
  label?: string;
  style?: ViewStyle;
}

/**
 * The back affordance. Ten screens each built their own `<Pressable>` around a
 * "‹ Back" string, with three different hit slops and no press feedback on any
 * of them — so the most-tapped control in the app was also the least
 * responsive. This is a real target: a bordered circular chevron that dips and
 * taps back.
 */
export function BackLink({ onPress, label = 'Back', style }: BackLinkProps) {
  const router = useRouter();
  return (
    <PressableScale
      onPress={onPress ?? (() => router.back())}
      haptic="tap"
      activeScale={0.92}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      style={StyleSheet.flatten([styles.wrap, style])}
    >
      <Ionicons name="chevron-back" size={16} color={colors.fgSoft} />
      <Text variant="label" color={colors.fgSoft}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
    height: 36,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassEdge,
    backgroundColor: alpha(colors.fg, 0.04),
  },
});
