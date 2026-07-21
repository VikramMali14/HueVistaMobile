import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

export interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  /** Apply top safe-area inset (screens without a header should). */
  edges?: { top?: boolean; bottom?: boolean };
  contentStyle?: ViewStyle;
}

/** Standard page frame: app background + safe-area padding + optional scroll. */
export function Screen({ children, scroll, edges = { top: true }, contentStyle }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const pad: ViewStyle = {
    paddingTop: edges.top ? insets.top + spacing.md : spacing.md,
    paddingBottom: edges.bottom ? insets.bottom + spacing.lg : spacing.xl,
    paddingHorizontal: spacing.lg,
  };

  if (scroll) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={[pad, contentStyle]} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    );
  }
  return <View style={[styles.root, pad, contentStyle]}>{children}</View>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
