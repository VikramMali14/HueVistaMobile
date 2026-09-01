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
  /**
   * Content pinned above the scroll area.
   *
   * For screens with one thing the whole page is about — a room photo being
   * painted — where letting it scroll away means the controls underneath act on
   * something the user can no longer see. Only meaningful with `scroll`.
   */
  fixed?: React.ReactNode;
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
  fixed,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  // Non-zero only inside a tab navigator. The floating bar draws over the
  // scene rather than displacing it, so this is the only thing keeping the
  // last row of a screen out from under it.
  const tabBarInset = useTabBarInset();

  /**
   * The screen's own padding, with the notch added ON TOP of whatever the page
   * asked for rather than beside it.
   *
   * `contentStyle` is applied after this in the style array, so a page that set
   * its own `paddingTop` — most of them do, to open a little air above the first
   * line — silently replaced the safe-area inset with a flat 20px. On a notched
   * phone that put the back button and the first heading of every stack screen
   * under the status bar, behind the clock. Folding the two together here is the
   * fix: the page still controls its breathing room, and the inset it cannot
   * know about is always added to it.
   */
  const own = StyleSheet.flatten(contentStyle) ?? {};
  const ownTop = num(own.paddingTop ?? own.paddingVertical);
  const ownBottom = num(own.paddingBottom ?? own.paddingVertical);
  const ownSides = num(own.paddingHorizontal) ?? spacing.lg;

  const pad: ViewStyle = {
    paddingTop: (edges.top ? insets.top : 0) + (ownTop ?? spacing.md),
    paddingBottom:
      (edges.bottom ? insets.bottom : 0) +
      (ownBottom ?? (edges.bottom ? spacing.lg : spacing.xl)) +
      tabBarInset,
    paddingHorizontal: ownSides,
  };

  // With a pinned region the padding splits: the top and sides belong to it, and
  // the scroll area keeps the sides and the bottom. Leaving the top padding on
  // the scroll view too would open a gap under the pinned content.
  const pinnedPad: ViewStyle = {
    paddingTop: pad.paddingTop,
    paddingHorizontal: ownSides,
  };
  const scrollPad: ViewStyle = fixed
    ? { paddingTop: spacing.md, paddingBottom: pad.paddingBottom, paddingHorizontal: ownSides }
    : pad;

  // `pad` already carries everything `contentStyle` said about padding, so it
  // goes last and nothing can put the inset back under the notch.
  const body = scroll ? (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={[contentStyle, scrollPad]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, contentStyle, pad]}>{children}</View>
  );

  return (
    <View style={styles.root}>
      {aurora ? <Aurora tint={tint} intensity={auroraIntensity} /> : null}
      {fixed ? <View style={pinnedPad}>{fixed}</View> : null}
      {body}
    </View>
  );
}

/** Padding values are numbers everywhere in this app; anything else is ignored. */
function num(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
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
