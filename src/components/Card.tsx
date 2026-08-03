import { StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { colors, radius, spacing, hairline, elevation, alpha } from '../theme';
import { PressableScale } from './PressableScale';

export type CardTone = 'glass' | 'raised' | 'quiet';

export interface CardProps extends ViewProps {
  onPress?: () => void;
  padded?: boolean;
  /**
   * `glass`  — translucent pane, lets the aurora through (the default look)
   * `raised` — opaque, for content that sits above another card
   * `quiet`  — no fill, hairline only; for grouping without adding weight
   */
  tone?: CardTone;
  /** Tints the card's edge and glow, e.g. to the shade it is showing. */
  accent?: string | null;
  style?: ViewStyle;
}

/**
 * Base surface for content blocks.
 *
 * Cards used to be opaque #14131c blocks with a hairline — which is why the app
 * looked flat: every card was the same value as every other, so nothing sat in
 * front of anything. They are now translucent panes over the aurora with a
 * top-lit edge and a real shadow, so depth comes from light rather than from
 * more borders.
 *
 * `accent` is the useful one for HueVista: pass a shade's hex and the card
 * picks up that colour in its edge and glow, so a card about a colour is
 * visibly about that colour.
 */
export function Card({
  children,
  onPress,
  padded = true,
  tone = 'glass',
  accent,
  style,
  ...rest
}: CardProps) {
  const surface: ViewStyle =
    tone === 'raised'
      ? { backgroundColor: colors.surface2, ...elevation.low }
      : tone === 'quiet'
        ? { backgroundColor: 'transparent' }
        : { backgroundColor: colors.glass, ...elevation.low };

  const edge: ViewStyle = accent
    ? { borderColor: alpha(accent, 0.34), shadowColor: accent, shadowOpacity: 0.28 }
    : { borderColor: tone === 'quiet' ? colors.rule : colors.glassEdge };

  const content = (
    <View style={[styles.card, surface, edge, padded && styles.padded, style]} {...rest}>
      {children}
    </View>
  );

  if (onPress) {
    return (
      <PressableScale onPress={onPress} activeScale={0.98} haptic="tap">
        {content}
      </PressableScale>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: hairline,
  },
  padded: {
    padding: spacing.lg,
  },
});
