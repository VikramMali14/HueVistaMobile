import { StyleSheet, Switch, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, alpha, hairline, TAP_TARGET } from '../theme';
import { Text } from './Text';
import { PressableScale } from './PressableScale';

export interface SettingsRowProps {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  /** Second line — what this does, or the current value. */
  hint?: string;
  /** Right-aligned value shown before the chevron. */
  value?: string;
  onPress?: () => void;
  /** Renders a switch instead of a chevron. `onPress` is ignored. */
  toggle?: { value: boolean; onChange: (next: boolean) => void };
  tone?: 'default' | 'danger';
  style?: ViewStyle;
}

/**
 * One line in a settings list.
 *
 * The account screen used to be a column of cards, each holding a label, a
 * paragraph and a full-width secondary button — seven cards, seven buttons, all
 * the same weight, so "Sign out" and "Delete account" carried exactly as much
 * visual force as "Haptics". A settings list is a list; the weight belongs to
 * the one row that is destructive, and nothing else.
 */
export function SettingsRow({
  icon,
  label,
  hint,
  value,
  onPress,
  toggle,
  tone = 'default',
  style,
}: SettingsRowProps) {
  const tint = tone === 'danger' ? colors.dangerSoft : colors.fgSoft;

  const body = (
    <>
      {icon ? (
        <View style={[styles.icon, tone === 'danger' ? styles.iconDanger : null]}>
          <Ionicons name={icon} size={16} color={tint} />
        </View>
      ) : null}
      <View style={styles.text}>
        <Text variant="subhead" color={tone === 'danger' ? colors.dangerSoft : colors.fg}>
          {label}
        </Text>
        {hint ? <Text variant="caption">{hint}</Text> : null}
      </View>
      {toggle ? (
        <Switch
          value={toggle.value}
          onValueChange={toggle.onChange}
          trackColor={{ false: colors.surface2, true: colors.accentDeep }}
          thumbColor={toggle.value ? colors.accentSoft : colors.fgMute}
          accessibilityLabel={label}
        />
      ) : (
        <>
          {value ? <Text variant="code">{value}</Text> : null}
          {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.fgMute} /> : null}
        </>
      )}
    </>
  );

  if (toggle || !onPress) {
    return <View style={[styles.row, style]}>{body}</View>;
  }

  return (
    <PressableScale
      onPress={onPress}
      haptic="tap"
      activeScale={0.985}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={StyleSheet.flatten([styles.row, style])}
    >
      {body}
    </PressableScale>
  );
}

/** Groups rows into one bordered block with dividers between them. */
export function SettingsGroup({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.group, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  group: {
    borderRadius: radius.card,
    borderWidth: hairline,
    borderColor: colors.glassEdgeSoft,
    backgroundColor: colors.glass,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: TAP_TARGET + 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    // A hairline on every row, with the group clipping the last one's overflow
    // — one rule that never needs an index to know it is last.
    borderBottomWidth: hairline,
    borderBottomColor: colors.rule,
  },
  icon: {
    width: 30,
    height: 30,
    borderRadius: radius.chip,
    backgroundColor: alpha(colors.fg, 0.06),
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDanger: {
    backgroundColor: alpha(colors.danger, 0.14),
  },
  text: { flex: 1, gap: 2 },
});
