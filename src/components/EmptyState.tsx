import { StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, alpha } from '../theme';
import { Text } from './Text';

export interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  /** The small tracked line above the headline — what happened, in three words. */
  eyebrow?: string;
  title: string;
  body?: string;
  /** Tone of the eyebrow and the icon well. */
  tone?: 'neutral' | 'error';
  /** Buttons. The first should be the way forward, not the way back. */
  children?: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Nothing here, or something went wrong.
 *
 * Every empty and failed state in the app goes through this, so they share a
 * shape: what happened, what it means, and — always — a way onward. An empty
 * state with no action is a dead end, and this app had several of them.
 */
export function EmptyState({
  icon,
  eyebrow,
  title,
  body,
  tone = 'neutral',
  children,
  style,
}: EmptyStateProps) {
  const accent = tone === 'error' ? colors.dangerSoft : colors.accentSoft;
  return (
    <View style={[styles.wrap, style]}>
      {icon ? (
        <View style={[styles.well, { backgroundColor: alpha(accent, 0.12) }]}>
          <Ionicons name={icon} size={24} color={accent} />
        </View>
      ) : null}
      {eyebrow ? (
        <Text variant="eyebrow" color={accent}>
          {eyebrow}
        </Text>
      ) : null}
      <Text variant="title">{title}</Text>
      {body ? <Text variant="bodySoft">{body}</Text> : null}
      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  well: {
    width: 52,
    height: 52,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
