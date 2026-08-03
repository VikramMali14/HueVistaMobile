import { StyleSheet, View, ViewStyle } from 'react-native';
import { colors, spacing, fonts, fontSize, alpha, radius } from '../theme';
import { Card } from './Card';
import { Text } from './Text';

export interface StatTileProps {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'accent' | 'success' | 'warning' | 'danger';
  style?: ViewStyle;
}

const toneColor = {
  default: colors.fg,
  accent: colors.accentSoft,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
};

/**
 * Dashboard metric tile — walk-ins, active codes, pending orders, week value.
 *
 * The label leads as a small uppercase marker so the figure can have the room,
 * and a short tone-coloured rule under the number gives the grid a rhythm.
 * Before, label and value sat close enough in weight that a wall of tiles read
 * as a wall of text.
 */
export function StatTile({ label, value, hint, tone = 'default', style }: StatTileProps) {
  const c = toneColor[tone];
  return (
    <Card style={StyleSheet.flatten([styles.tile, style])}>
      <Text variant="overline" numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.value} color={c}>
        {value}
      </Text>
      <View style={[styles.underline, { backgroundColor: alpha(c, 0.45) }]} />
      {hint ? (
        <Text variant="caption" numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  tile: {
    gap: spacing.xs,
    minWidth: 140,
    flexGrow: 1,
    flexBasis: '46%',
  },
  value: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xxl,
    letterSpacing: -1,
  },
  underline: {
    width: 26,
    height: 2,
    borderRadius: radius.pill,
    marginTop: 2,
  },
});
