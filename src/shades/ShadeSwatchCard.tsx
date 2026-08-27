import { StyleSheet, View, ViewStyle } from 'react-native';
import { Text, PressableScale } from '../components';
import { colors, spacing, radius, alpha } from '../theme';
import { shadeDisplay } from './shadeCodes';
import type { ShadeCodeScheme } from '../api/accountSchemas';
import { depthOf, inkOn, lrvOf, undertone, DEPTH_LABEL, UNDERTONE_DOT } from './colorScience';
import type { ShadeSummary } from '../api';

export interface ShadeSwatchCardProps {
  shade: ShadeSummary;
  /** The shop's code pattern; decides whether the paint name is shown at all. */
  scheme?: ShadeCodeScheme | null;
  onPress?: () => void;
  /** Ring the card as chosen — used by the Studio picker, not the catalogue. */
  selected?: boolean;
  style?: ViewStyle;
}

/**
 * One shade in a grid: the colour, its code printed on it, and the two facts
 * the website puts under every swatch — which way the undertone leans and how
 * light it is.
 *
 * Those two matter more than they look. "Is it warm or cool?" and "is it too
 * dark for this room?" are the questions asked across a counter, and the app
 * previously answered neither: it showed a colour, a name and a code, so a
 * customer had to hold two swatches side by side to learn what a word would
 * have told them.
 *
 * The code sits *on* the swatch in ink chosen from its own lightness, which is
 * how a physical shade card is printed and how the website renders it.
 */
export function ShadeSwatchCard({ shade, scheme, onPress, selected, style }: ShadeSwatchCardProps) {
  const hex = shade.hexCode ?? undefined;
  const display = shadeDisplay(scheme, { code: shade.shadeCode, name: shade.name });
  const ink = hex ? inkOn(hex) : { strong: colors.fg, soft: colors.fgSoft };
  const depth = depthOf(shade);
  const lrv = lrvOf(shade);
  const tone = hex ? undertone(hex) : null;

  return (
    <PressableScale
      onPress={onPress}
      haptic="tap"
      activeScale={0.95}
      accessibilityRole="button"
      accessibilityLabel={[
        display.label,
        display.code,
        depth ? `${DEPTH_LABEL[depth]} shade` : null,
        tone && tone !== 'neutral' ? `${tone} undertone` : null,
      ]
        .filter(Boolean)
        .join(', ')}
      style={StyleSheet.flatten([styles.card, style])}
    >
      <View
        style={[
          styles.swatch,
          {
            backgroundColor: hex ?? colors.surface2,
            shadowColor: hex ?? colors.bgDeep,
            borderColor: selected ? colors.fg : hex ? alpha(hex, 0.5) : colors.rule,
            borderWidth: selected ? 2 : 1,
          },
        ]}
      >
        <Text variant="code" style={styles.swatchCode} color={ink.strong} numberOfLines={1}>
          {display.code}
        </Text>
        {lrv != null ? (
          <Text variant="caption" style={styles.swatchLrv} color={ink.soft}>
            LRV {lrv}
          </Text>
        ) : null}
      </View>

      <Text variant="subhead" numberOfLines={1}>
        {display.label}
      </Text>

      <View style={styles.facts}>
        {depth ? (
          <Text variant="caption" color={colors.fgSoft}>
            {DEPTH_LABEL[depth]}
          </Text>
        ) : null}
        {depth && tone && tone !== 'neutral' ? <Text variant="caption">·</Text> : null}
        {tone && tone !== 'neutral' ? (
          <>
            <View style={[styles.toneDot, { backgroundColor: UNDERTONE_DOT[tone] }]} />
            <Text variant="caption" color={colors.fgSoft} numberOfLines={1}>
              {tone}
            </Text>
          </>
        ) : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { gap: 3 },
  swatch: {
    width: '100%',
    aspectRatio: 1 / 1.05,
    borderRadius: radius.card,
    marginBottom: spacing.sm,
    padding: spacing.md,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  swatchCode: { fontSize: 11, letterSpacing: 0.8 },
  swatchLrv: { fontSize: 10 },
  facts: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  toneDot: { width: 7, height: 7, borderRadius: 4 },
});
