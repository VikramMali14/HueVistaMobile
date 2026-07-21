import { StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, fonts, fontSize } from '../theme';
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

/** Dashboard metric tile — walk-ins, active codes, pending orders, week value. */
export function StatTile({ label, value, hint, tone = 'default', style }: StatTileProps) {
  return (
    <Card style={StyleSheet.flatten([styles.tile, style])}>
      <Text variant="label" numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.value} color={toneColor[tone]}>
        {value}
      </Text>
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
  },
});
