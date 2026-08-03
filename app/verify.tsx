import { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Screen, Text, Card, Button, Input, StatusPill } from '../src/components';
import { colors, spacing } from '../src/theme';
import { verificationApi, userMessage, VerificationStatus } from '../src/api';
import { useMyProfile } from '../src/account/queries';

/**
 * Confirm the account's e-mail address.
 *
 * The backend gates project creation behind this when the feature is on and says
 * so with a `VERIFICATION_REQUIRED` refusal — this is where that refusal leads,
 * so it is a way through rather than a dead end. The masked destination comes
 * from the server: it says WHICH address the code went to without reprinting it
 * in full on a screen someone may be standing over.
 *
 * E-mail is the only channel offered. No SMS provider is wired up yet, so a
 * "text me a code" button would promise a message that never arrives — worse
 * than not offering it. The phone endpoints still exist on the backend; restore
 * the channel picker from git history once SMS is actually sending.
 */
export default function VerifyScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useMyProfile();
  const p = profile.data;

  const [code, setCode] = useState('');
  const [sent, setSent] = useState<VerificationStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const verified = p?.emailVerified ?? false;

  async function send() {
    setBusy(true);
    setError(null);
    try {
      setSent(await verificationApi.sendEmail());
    } catch (err) {
      setError(userMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await verificationApi.confirmEmail(code);
      setDone(true);
      setCode('');
      // The profile's verified flags — and anything gated on them — are stale now.
      await queryClient.invalidateQueries({ queryKey: ['account'] });
    } catch (err) {
      setError(userMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll contentStyle={styles.content}>
      <Pressable onPress={() => router.back()} hitSlop={12}>
        <Text variant="label" color={colors.fgSoft}>
          ‹ Back
        </Text>
      </Pressable>

      <View style={styles.header}>
        <Text variant="title">Verify your email</Text>
        <Text variant="bodySoft">
          Confirming your address keeps your account yours, and unlocks the actions that ask for
          it.
        </Text>
      </View>

      <Card>
        <View style={styles.head}>
          <Text variant="label">Email address</Text>
          <StatusPill
            label={verified ? 'Verified' : 'Not verified'}
            tone={verified ? 'done' : 'progress'}
          />
        </View>

        {verified && !done ? (
          <Text variant="bodySoft" style={{ marginTop: spacing.xs }}>
            {`${p?.email ?? 'Your address'} is confirmed. Nothing to do here.`}
          </Text>
        ) : done ? (
          <Text variant="body" color={colors.success} style={{ marginTop: spacing.xs }}>
            Confirmed ✓
          </Text>
        ) : (
          <View style={styles.form}>
            {sent ? (
              <>
                <Text variant="bodySoft">
                  We sent a code to {sent.destination ?? 'you'}. It lasts about{' '}
                  {Math.max(1, Math.round(sent.expiresInSeconds / 60))} minutes.
                </Text>
                <Input
                  label="The code"
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  placeholder="6 digits"
                />
                <Button
                  label="Confirm"
                  fullWidth
                  loading={busy}
                  disabled={code.trim().length < 4}
                  onPress={confirm}
                />
                <Button label="Send another" variant="ghost" fullWidth loading={busy} onPress={send} />
              </>
            ) : (
              <Button label="Email me a code" fullWidth loading={busy} onPress={send} />
            )}

            {error ? (
              <Text variant="body" color={colors.danger}>
                {error}
              </Text>
            ) : null}
          </View>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg },
  header: { gap: spacing.xs },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  form: { marginTop: spacing.md, gap: spacing.md },
});
