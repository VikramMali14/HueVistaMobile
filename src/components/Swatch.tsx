import { StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, alpha, fonts, fontSize, TAP_TARGET } from '../theme';
import { Text } from './Text';
import { PressableScale } from './PressableScale';
import { inkOn, undertone, UNDERTONE_DOT, depthOf, DEPTH_LABEL } from '../shades/colorScience';

export interface SwatchProps {
  hex: string;
  /** What the customer reads under it — already resolved through the shop's scheme. */
  label?: string;
  /** The code, set in tabular figures. */
  code?: string;
  selected?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  size?: 'sm' | 'md' | 'lg';
  /**
   * Print the depth band and undertone on the chip.
   *
   * This is the one piece of the product's own expertise the first design pass
   * buried: depth and undertone appeared once, on the detail screen, as two
   * words in a row of pills. They belong on the grid, because they are what a
   * person is actually scanning for — "something light, on the warm side" — and
   * a wall of unlabelled colour squares makes them guess.
   */
  showScience?: boolean;
  style?: ViewStyle;
}

const BOX = { sm: 44, md: 62, lg: 84 } as const;

/**
 * One paint colour, as an object you can tap.
 *
 * The tick and anything printed on the chip are drawn in ink chosen from the
 * paint's own lightness — a white tick on Chalk White is invisible, and a white
 * tick is what a grid of swatches usually gets.
 */
export function Swatch({
  hex,
  label,
  code,
  selected,
  onPress,
  onLongPress,
  size = 'md',
  showScience,
  style,
}: SwatchProps) {
  const box = BOX[size];
  const ink = inkOn(hex);
  const tone = undertone(hex);
  const depth = depthOf({ hexCode: hex });

  const body = (
    <>
      <View
        style={[
          styles.chip,
          {
            height: box,
            backgroundColor: hex,
            borderColor: selected ? colors.fg : alpha('#000000', 0.28),
            borderWidth: selected ? 2 : 1,
          },
        ]}
      >
        {selected ? <Ionicons name="checkmark" size={box * 0.34} color={ink.strong} /> : null}
        {showScience && !selected && depth ? (
          <Text style={[styles.science, { color: ink.soft }]}>{DEPTH_LABEL[depth]}</Text>
        ) : null}
      </View>
      {label || code ? (
        <View style={styles.caption}>
          {label ? (
            <Text variant="caption" color={colors.fgSoft} numberOfLines={1}>
              {label}
            </Text>
          ) : null}
          {code ? (
            <View style={styles.codeRow}>
              {showScience ? (
                <View style={[styles.toneDot, { backgroundColor: UNDERTONE_DOT[tone] }]} />
              ) : null}
              <Text variant="caption" numberOfLines={1} style={styles.code}>
                {code}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </>
  );

  if (!onPress && !onLongPress) return <View style={[styles.wrap, style]}>{body}</View>;

  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      haptic="select"
      activeScale={0.93}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={
        [label, code, depth ? DEPTH_LABEL[depth] : null, tone === 'neutral' ? null : `${tone} undertone`]
          .filter(Boolean)
          .join(', ') || hex
      }
      // A 44pt chip is a legal target; a 44pt chip in a four-column grid with
      // 8pt gutters is not, because the gutter belongs to nobody.
      hitSlop={size === 'sm' ? 6 : 0}
      style={StyleSheet.flatten([styles.wrap, style])}
    >
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
    minWidth: TAP_TARGET,
  },
  chip: {
    width: '100%',
    borderRadius: radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  science: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.micro,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  caption: {
    gap: 1,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  toneDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  code: {
    fontFamily: fonts.code,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
});
