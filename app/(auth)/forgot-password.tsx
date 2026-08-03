import { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Text, Button, Input, Card, BackLink } from '../../src/components';
import { colors, spacing } from '../../src/theme';
import { authApi, userMessage } from '../../src/api';

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setError(null);
    setBusy(true);
    try {
      // Backend always 200s (no account enumeration) — show the returned line.
      const message = await authApi.forgotPassword(email.trim());
      setSent(message);
    } catch (err) {
      setError(userMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll contentStyle={styles.content}>
      <BackLink />

      <View style={styles.header}>
        <Text variant="title">Reset your password</Text>
        <Text variant="bodySoft">Enter your email and we&apos;ll send a reset code.</Text>
      </View>

      {sent ? (
        <Card>
          <Text variant="body">{sent}</Text>
        </Card>
      ) : (
        <View style={styles.form}>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          {error ? (
            <Text variant="body" color={colors.danger}>
              {error}
            </Text>
          ) : null}
          <Button
            label="Send reset code"
            size="lg"
            fullWidth
            loading={busy}
            disabled={email.trim().length === 0 || busy}
            onPress={onSubmit}
          />
        </View>
      )}

      <View style={styles.footer}>
        <Pressable onPress={() => router.replace('/sign-in')} hitSlop={8}>
          <Text variant="label" color={colors.accentSoft}>
            Back to sign in
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingTop: spacing.xl },
  header: { gap: spacing.xs },
  form: { gap: spacing.md },
  footer: { flexDirection: 'row', justifyContent: 'center' },
});
