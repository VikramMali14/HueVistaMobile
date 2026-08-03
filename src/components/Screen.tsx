import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';
import { Aurora } from './Aurora';
import { useTabBarInset } from './FloatingTabBar';

export interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  /** Apply top safe-area inset (screens without a header should). */
  edges?: { top?: boolean; bottom?: boolean };
  contentStyle?: ViewStyle;
  /**
   * Ambient background. `false` gives a flat app background — use it where
   * content owns the colour (a full-bleed room photo, the recolor canvas).
   */
  aurora?: boolean;
  /** Bias the aurora toward a colour, e.g. the shade currently on the wall. */
  tint?: string | null;
  /** 0–1 presence. Hero screens go to ~1.2, dense lists sit around 0.6. */
  auroraIntensity?: number;
}

/** Standard page frame: aurora background + safe-area padding + optional scroll. */
export function Screen({
  children,
  scroll,
  edges = { top: true },
  contentStyle,
  aurora = true,
  tint,
  auroraIntensity = 1,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  // Non-zero only inside a tab navigator. The floating bar draws over the
  // scene rather than displacing it, so this is the only thing keeping the
  // last row of a screen out from under it.
  const tabBarInset = useTabBarInset();

  const pad: ViewStyle = {
    paddingTop: edges.top ? insets.top + spacing.md : spacing.md,
    paddingBottom: (edges.bottom ? insets.bottom + spacing.lg : spacing.xl) + tabBarInset,
    paddingHorizontal: spacing.lg,
  };

  const body = scroll ? (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={[pad, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, pad, contentStyle]}>{children}</View>
  );

  return (
    <View style={styles.root}>
      {aurora ? <Aurora tint={tint} intensity={auroraIntensity} /> : null}
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  fill: {
    flex: 1,
  },
});
