import { StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { colors, radius, spacing, hairline, elevation, alpha } from '../theme';
import { PressableScale } from './PressableScale';

export type CardTone = 'glass' | 'raised' | 'quiet' | 'feature';

export interface CardProps extends ViewProps {
  onPress?: () => void;
  padded?: boolean;
  /**
   * `glass`   — translucent pane, lets the aurora through (the default look)
   * `raised`  — opaque, for content that sits above another card
   * `quiet`   — no fill, hairline only; grouping without adding weight
   * `feature` — the one lit card on a screen. See the note below.
   */
  tone?: CardTone;
  /** Tints the card's edge and glow, e.g. to the shade it is showing. */
  accent?: string | null;
  style?: ViewStyle;
}

/**
 * Base surface for content blocks.
 *
 * Four tones, and the difference between them is VALUE — how much light the
 * surface carries — not decoration. That is a deliberate correction. The design
 * this app was built from gave every card the same treatment: a radial violet
 * wash in the top-left corner and a gradient hairline running off the top edge,
 * repeated identically on the home CTA, the redeem card, the empty-state card
 * and four more. Six identical flourishes on a screen point at nothing; they
 * just make the screen look like it was generated, which it was.
 *
 * So the flourish survives on exactly one tone. `feature` is the single card on
 * a screen that IS the screen's purpose — Start a room, Redeem a code — and
 * being the only lit thing is what makes it read as the way forward. Everything
 * else is plain glass and gets its hierarchy from the type inside it.
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
        : tone === 'feature'
          ? { backgroundColor: colors.glassStrong, ...elevation.low }
          : { backgroundColor: colors.glass, ...elevation.low };

  const edge: ViewStyle = accent
    ? { borderColor: alpha(accent, 0.34), shadowColor: accent, shadowOpacity: 0.28 }
    : {
        borderColor:
          tone === 'quiet' ? colors.rule : tone === 'feature' ? colors.glassEdge : colors.glassEdgeSoft,
      };

  const content = (
    <View style={[styles.card, surface, edge, padded && styles.padded, style]} {...rest}>
      {tone === 'feature' ? (
        <>
          {/* The wash and the lit top edge. One card per screen — see above. */}
          <View
            pointerEvents="none"
            style={[styles.wash, { backgroundColor: alpha(accent ?? colors.accent, 0.1) }]}
          />
          <View
            pointerEvents="none"
            style={[styles.topEdge, { backgroundColor: alpha(accent ?? colors.accent, 0.55) }]}
          />
        </>
      ) : null}
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
    overflow: 'hidden',
  },
  padded: {
    padding: spacing.lg,
  },
  /**
   * RN has no radial gradient without a native dependency, so the wash is a
   * soft-cornered rectangle bled off two edges — at 10% alpha behind content it
   * reads as a glow rather than as a shape.
   */
  wash: {
    position: 'absolute',
    top: -70,
    left: -60,
    width: 240,
    height: 160,
    borderRadius: 120,
  },
  topEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 120,
    height: 1,
  },
});
