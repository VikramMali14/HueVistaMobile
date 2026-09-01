import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import {
  Screen,
  Text,
  Button,
  Card,
  CodeInput,
  BackLink,
  EmptyState,
} from '../src/components';
import { colors, spacing, radius } from '../src/theme';
import { accessCodesApi, ApiError, AccessCodeResponse } from '../src/api';
import { haptics } from '../src/haptics';

/** Every code the counter issues is six characters. */
const CODE_LENGTH = 6;

type Refusal = 'used' | 'unknown' | null;

/**
 * Add a shop code to the account you are already signed in to.
 *
 * This screen used to be a way IN: it lived in the `(auth)` group and called
 * `/access-codes/redeem-account`, which provisioned a passwordless account off a
 * slip of paper and handed back a session. That made a printed six-character
 * code an identity — anyone holding the slip became the customer named on it,
 * with no e-mail, no password and no way to ever prove otherwise or get back in
 * on a second handset.
 *
 * A code is an allowance, not a login, so that is all it does now. You sign in
 * with an e-mail or with Google first, and the code links this account to the
 * shop that issued it and unlocks what the shop assigned — the signed-in
 * `/access-codes/redeem`, which the website has always used.
 *
 * The design gave "code already used" a screen of its own, with the date and
 * the branch it was redeemed at. The API returns neither — 404 for unknown,
 * 400/410 for spent — and a screen that invents "used on 14 August at Shree
 * Ganesh Paints" would be lying to someone standing at a counter. So the
 * refusal is shown in place, with the same two ways out that screen offered and
 * only what the server actually said.
 */
export default function RedeemCode() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<Refusal>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<AccessCodeResponse | null>(null);

  async function redeem(value: string = code) {
    if (value.length < CODE_LENGTH || busy) return;
    setBusy(true);
    setRefusal(null);
    setError(null);
    try {
      const result = await accessCodesApi.redeem(value);
      // The allowance, the shop's brands and its shade codes all change with
      // this one call, and every screen behind it is showing the old answer.
      await queryClient.invalidateQueries();
      setDone(result);
      haptics.success();
    } catch (err) {
      haptics.error();
      if (err instanceof ApiError && (err.status === 400 || err.status === 410)) {
        setRefusal('used');
      } else if (err instanceof ApiError && err.status === 404) {
        setRefusal('unknown');
      } else {
        setError(err instanceof ApiError ? err.message : 'Couldn’t redeem that code. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const rooms = done.projectsRemaining ?? done.projectQuota ?? null;
    return (
      <Screen scroll contentStyle={styles.content}>
        <View style={styles.successHead}>
          <View style={styles.tick}>
            <Ionicons name="checkmark" size={26} color={colors.success} />
          </View>
          <Text variant="title">You&apos;re set up.</Text>
          <Text variant="bodySoft">
            Your account is linked{done.organizationName ? ` to ${done.organizationName}` : ''}. The
            products your shop picked for you are ready.
          </Text>
          {rooms !== null ? (
            <Text variant="caption">
              {rooms === 1 ? '1 room' : `${rooms} rooms`} on this code
              {done.validDays ? `, for ${done.validDays} days` : ''}.
            </Text>
          ) : done.validDays ? (
            <Text variant="caption">Your access runs for {done.validDays} days.</Text>
          ) : null}
        </View>
        <Button label="Start a room" size="lg" fullWidth onPress={() => router.replace('/studio/new')} />
      </Screen>
    );
  }

  if (refusal) {
    return (
      <Screen scroll contentStyle={styles.content}>
        <BackLink onPress={() => setRefusal(null)} label="Try another code" />
        <EmptyState
          tone="error"
          icon="ticket-outline"
          eyebrow={refusal === 'used' ? 'Code already used' : 'Code not found'}
          title={
            refusal === 'used'
              ? 'This code has already been redeemed.'
              : 'We don’t recognise that code.'
          }
          body={
            refusal === 'used'
              ? 'Each code is redeemed once. Ask at the counter for a new one, or buy a room yourself.'
              : 'Check the six characters on your slip — the letter O and the digit 0 are easy to swap. If it still won’t go through, the shop can issue a fresh one.'
          }
        >
          <Button label="Buy a room" onPress={() => router.push('/buy?what=room')} fullWidth />
          <Button
            label="Browse shades instead"
            variant="secondary"
            fullWidth
            onPress={() => router.push('/shades')}
          />
        </EmptyState>
      </Screen>
    );
  }

  return (
    <Screen scroll contentStyle={styles.content}>
      <BackLink />

      <View style={styles.header}>
        <Text variant="display">Enter the code from your shop.</Text>
        <Text variant="bodySoft">
          Six characters from the counter. It adds the rooms your shop assigned to this account.
        </Text>
      </View>

      <View style={styles.form}>
        <CodeInput
          value={code}
          onChangeText={(next) => {
            setCode(next);
            setError(null);
          }}
          length={CODE_LENGTH}
          onComplete={redeem}
          autoFocus
          accessibilityLabel="Shop access code"
        />
        {error ? (
          <Text variant="caption" color={colors.dangerSoft}>
            {error}
          </Text>
        ) : null}
        <Button
          label="Continue"
          size="lg"
          fullWidth
          loading={busy}
          disabled={code.length < CODE_LENGTH || busy}
          onPress={() => redeem()}
        />
      </View>

      <Card tone="quiet">
        <Text variant="label">What the code carries</Text>
        <Text variant="bodySoft" style={styles.cardBody}>
          The rooms your shop assigned to it, the paint companies and products they picked for you,
          and the shade codes their counter reads.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingTop: spacing.lg },
  header: { gap: spacing.md },
  form: { gap: spacing.lg },
  cardBody: { marginTop: spacing.xs },
  successHead: { gap: spacing.md, paddingTop: spacing.xl },
  tick: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.accentGhost,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
