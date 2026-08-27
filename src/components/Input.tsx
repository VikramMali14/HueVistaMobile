import { useState } from 'react';
import { StyleSheet, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { colors, radius, spacing, fontSize, fonts, hairline, TAP_TARGET } from '../theme';
import { Text } from './Text';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  hint?: string;
  /** Codes and numbers — tabular figures and a little tracking. */
  code?: boolean;
  /** Sits inside the field, before the text. */
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  containerStyle?: ViewStyle;
}

/**
 * A labelled text field.
 *
 * The label is a small tracked-out marker above the field rather than a
 * placeholder, because a placeholder disappears the moment someone types and
 * takes the question with it — which is how a half-filled form ends up
 * unreadable.
 */
export function Input({
  label,
  error,
  hint,
  code,
  leading,
  trailing,
  containerStyle,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.accent : colors.glassEdge;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text variant="eyebrow">{label}</Text> : null}
      <View style={[styles.field, { borderColor }]}>
        {leading ? <View style={styles.affix}>{leading}</View> : null}
        <TextInput
          placeholderTextColor={colors.fgMute}
          selectionColor={colors.accentSoft}
          style={[styles.input, code && styles.code]}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {trailing ? <View style={styles.affix}>{trailing}</View> : null}
      </View>
      {error ? (
        <Text variant="caption" color={colors.dangerSoft}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption">{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderRadius: radius.input,
    borderWidth: hairline,
    backgroundColor: colors.glass,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: TAP_TARGET,
    color: colors.fg,
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    paddingVertical: 0,
  },
  code: {
    fontFamily: fonts.code,
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  affix: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
