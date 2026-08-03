import { useState } from 'react';
import { StyleSheet, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { colors, radius, spacing, fontSize, hairline } from '../theme';
import { Text } from './Text';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  hint?: string;
  mono?: boolean;
  containerStyle?: ViewStyle;
}

/**
 * Labeled text field. `mono` is for codes (access codes `HV-XXXXXX`, shade
 * codes) where a monospace face + letter spacing reads better.
 */
export function Input({ label, error, hint, mono, containerStyle, onFocus, onBlur, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.accent : colors.glassEdge;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text variant="label" style={styles.label}>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.fgMute}
        selectionColor={colors.accentSoft}
        style={[styles.input, mono && styles.mono, { borderColor }]}
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
      {error ? (
        <Text variant="caption" color={colors.danger} style={styles.helper}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" style={styles.helper}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    marginLeft: 2,
  },
  input: {
    height: 54,
    borderRadius: radius.input,
    borderWidth: hairline,
    backgroundColor: colors.glass,
    paddingHorizontal: spacing.lg,
    color: colors.fg,
    fontSize: fontSize.base,
  },
  mono: {
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  helper: {
    marginLeft: 2,
  },
});
