import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View, ViewStyle } from 'react-native';
import { colors, radius, spacing, fonts, fontSize, hairline, alpha } from '../theme';
import { Text } from './Text';
import { codeEntry, type CodeMode } from './codeEntry';
import { haptics } from '../haptics';

export interface CodeInputProps {
  value: string;
  onChangeText: (next: string) => void;
  /** How many characters the code has. Six everywhere in this product. */
  length?: number;
  /** Letters and digits (a shop code) or digits only (an emailed code). */
  mode?: CodeMode;
  /** Paints every box red — a code the server refused. */
  invalid?: boolean;
  /**
   * Fired once the last character lands, with the finished code.
   *
   * It carries the value on purpose. The obvious spelling — a bare
   * `onSubmitEditing()` that lets the handler read the parent's state — fires
   * in the same tick as `onChangeText`, before React has committed it, so the
   * handler sees five characters of a six-character code and every guard of the
   * form `if (code.length < 6) return` silently swallows the auto-submit.
   */
  onComplete?: (code: string) => void;
  autoFocus?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

/**
 * The boxed code field.
 *
 * One transparent `TextInput` stretched over a row of drawn boxes: the OS
 * keyboard, autofill and one-time-code suggestion all work because there is
 * exactly one real field, while the boxes give the count and the progress. Six
 * separate inputs — the obvious build — breaks paste, breaks SMS autofill, and
 * makes backspace jump unpredictably between fields.
 *
 * Three flows need this and each of them had something different before: the
 * shop code was a plain text field, e-mail verification was a plain text field,
 * and the password reset had no code entry at all — it sent a code and then
 * stopped, which meant nobody could ever finish resetting a password from the
 * phone.
 */
export function CodeInput({
  value,
  onChangeText,
  length = 6,
  mode = 'alphanumeric',
  invalid,
  onComplete,
  autoFocus,
  style,
  accessibilityLabel = 'Code',
}: CodeInputProps) {
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  const handle = (raw: string) => {
    const { value: next, complete } = codeEntry(raw, mode, length);
    // One detent per character, and only when a character actually lands —
    // deleting should not feel like typing.
    if (next.length > value.length) haptics.select();
    onChangeText(next);
    if (complete) onComplete?.(next);
  };

  const boxes = Array.from({ length }, (_, i) => {
    const char = value[i] ?? '';
    const active = focused && i === Math.min(value.length, length - 1);
    return (
      <View
        key={i}
        style={[
          styles.box,
          char ? styles.boxFilled : null,
          active ? styles.boxActive : null,
          invalid ? styles.boxInvalid : null,
        ]}
      >
        <Text style={styles.char}>{char}</Text>
      </View>
    );
  });

  return (
    <Pressable
      onPress={() => input.current?.focus()}
      accessibilityRole="none"
      style={[styles.row, style]}
    >
      {boxes}
      <TextInput
        ref={input}
        value={value}
        onChangeText={handle}
        maxLength={length}
        autoFocus={autoFocus}
        autoCapitalize={mode === 'numeric' ? 'none' : 'characters'}
        autoCorrect={false}
        spellCheck={false}
        keyboardType={mode === 'numeric' ? 'number-pad' : 'default'}
        // iOS reads the code straight out of the notification; Android needs the
        // SMS retriever, so this is a no-op there rather than a wrong promise.
        textContentType={Platform.OS === 'ios' ? 'oneTimeCode' : 'none'}
        autoComplete="one-time-code"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onSubmitEditing={() => {
          if (value.length === length) onComplete?.(value);
        }}
        accessibilityLabel={accessibilityLabel}
        style={styles.hidden}
        caretHidden
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  box: {
    flex: 1,
    aspectRatio: 0.82,
    maxHeight: 62,
    borderRadius: radius.input,
    borderWidth: hairline,
    borderColor: colors.glassEdge,
    backgroundColor: colors.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: {
    borderColor: alpha(colors.fg, 0.24),
    backgroundColor: colors.glassStrong,
  },
  boxActive: {
    borderColor: colors.accent,
  },
  boxInvalid: {
    borderColor: colors.danger,
  },
  char: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSize.xl,
    color: colors.fg,
    fontVariant: ['tabular-nums'],
  },
  /**
   * Stretched over the boxes rather than hidden with `display: none` — a field
   * with no layout cannot take focus on Android, and an off-screen one makes
   * the keyboard scroll the page to chase it.
   */
  hidden: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    color: 'transparent',
    fontSize: fontSize.xl,
  },
});
