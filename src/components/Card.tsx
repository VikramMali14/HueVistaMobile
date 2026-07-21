import { Pressable, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { colors, radius, spacing, hairline } from '../theme';

export interface CardProps extends ViewProps {
  onPress?: () => void;
  padded?: boolean;
  elevated?: boolean;
  style?: ViewStyle;
}

/**
 * Base surface for content blocks. `elevated` uses the sheet surface color for
 * things that sit above cards (bottom sheets reuse SheetModal, not this).
 */
export function Card({ children, onPress, padded = true, elevated, style, ...rest }: CardProps) {
  const content = (
    <View
      style={[
        styles.card,
        { backgroundColor: elevated ? colors.surface2 : colors.surface },
        padded && styles.padded,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: hairline,
    borderColor: colors.rule,
  },
  padded: {
    padding: spacing.lg,
  },
});
