import { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Screen, Text, Card, Button, Input, StatusPill } from '../src/components';
import { colors, spacing } from '../src/theme';
import { verificationApi, userMessage, VerificationStatus } from '../src/api';
import { useMyProfile } from '../src/account/queries';

type Channel = 'email' | 'phone';

/**
 * Confirm the account's e-mail address or phone number.
 *
 * The backend gates project creation behind this when the feature is on and says
 * so with a `VERIFICATION_REQUIRED` refusal — this is where that refusal leads,
 * so it is a way through rather than a dead end. The masked destination comes
 * from the server: it says WHICH address the code went to without reprinting it
 * in full on a screen someone may be standing over.
 */
export default function VerifyScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useMyProfile();
  const p = profile.data;

  const [channel, setChannel] = useState<Channel>('email');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState<VerificationStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const verified = channel === 'email' ? p?.emailVerified : p?.phoneVerified;

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const status =
        channel === 'email'
          ? await verificationApi.sendEmail()
          : await verificationApi.sendPhone(phone.trim() || undefined);
      setSent(status);
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
      if (channel === 'email') await verificationApi.confirmEmail(code);
      else await verificationApi.confirmPhone(code);
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

  function pick(next: Channel) {
    setChannel(next);
    setSent(null);
    setCode('');
    setError(null);
    setDone(false);
  }

  return (
    <Screen scroll contentStyle={styles.content}>
      <Pressable onPress={() => router.back()} hitSlop={12}>
        <Text variant="label" color={colors.fgSoft}>
          ‹ Back
        </Text>
      </Pressable>

      <View style={styles.header}>
        <Text variant="title">Verify your details</Text>
        <Text variant="bodySoft">
          Confirming these keeps your account yours, and unlocks the actions that ask for them.
        </Text>
      </View>

      {/* Channel picker. Both are shown even when one is already done, so a
          verified address reads as settled rather than simply disappearing. */}
      <View style={styles.tabs}>
        {(['email', 'phone'] as const).map((c) => (
          <Pressable
            key={c}
            onPress={() => pick(c)}
            style={[styles.tab, channel === c ? styles.tabOn : styles.tabOff]}
          >
            <Text variant="label" color={channel === c ? colors.accentSoft : colors.fgSoft}>
              {c === 'email' ? 'Email' : 'Phone'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Card>
        <View style={styles.head}>
          <Text variant="label">{channel === 'email' ? 'Email address' : 'Phone number'}</Text>
          <StatusPill
            label={verified ? 'Verified' : 'Not verified'}
            tone={verified ? 'done' : 'progress'}
          />
        </View>

        {verified && !done ? (
          <Text variant="bodySoft" style={{ marginTop: spacing.xs }}>
            {channel === 'email'
              ? `${p?.email ?? 'Your address'} is confirmed. Nothing to do here.`
              : `${p?.phoneNumber ?? 'Your number'} is confirmed. Nothing to do here.`}
          </Text>
        ) : done ? (
          <Text variant="body" color={colors.success} style={{ marginTop: spacing.xs }}>
            Confirmed ✓
          </Text>
        ) : (
          <View style={styles.form}>
            {channel === 'phone' && !p?.phoneNumber ? (
              <Input
                label="Your mobile number"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="10-digit number"
              />
            ) : null}

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
              <Button
                label={channel === 'email' ? 'Email me a code' : 'Text me a code'}
                fullWidth
                loading={busy}
                disabled={channel === 'phone' && !p?.phoneNumber && phone.trim().length < 6}
                onPress={send}
              />
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
  tabs: { flexDirection: 'row', gap: spacing.sm },
  tab: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: 999, borderWidth: 1 },
  tabOn: { borderColor: colors.accent, backgroundColor: colors.surface2 },
  tabOff: { borderColor: colors.rule },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  form: { marginTop: spacing.md, gap: spacing.md },
});
