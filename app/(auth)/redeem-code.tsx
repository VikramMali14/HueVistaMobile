import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Screen,
  Text,
  Button,
  Card,
  CodeInput,
  BackLink,
  PressableScale,
  EmptyState,
} from '../../src/components';
import { colors, spacing, radius } from '../../src/theme';
import { useSession } from '../../src/auth';
import { accessCodesApi, ApiError, RedeemAccountResponse } from '../../src/api';
import { haptics } from '../../src/haptics';

/** Every code the counter issues is six characters. */
const CODE_LENGTH = 6;

type Refusal = 'used' | 'unknown' | null;

/**
 * Redeem a shop code with no account at all.
 *
 * The backend provisions a passwordless CUSTOMER account in the name the shop
 * entered and hands back a full session, so a walk-in goes from a code on a
 * slip to a signed-in app in one step. Their assigned projects and the products
 * the shop picked are waiting on the other side.
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
  const { signInWithSession } = useSession();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<Refusal>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<RedeemAccountResponse | null>(null);

  async function redeem(value: string = code) {
    if (value.length < CODE_LENGTH || busy) return;
    setBusy(true);
    setRefusal(null);
    setError(null);
    try {
      setDone(await accessCodesApi.redeemAccount(value));
      haptics.success();
      // The session is deliberately NOT adopted here: doing so flips the auth
      // gate immediately and this screen is replaced by the customer tabs before
      // the walk-in has read who they are now signed in as. They step through it.
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
    const firstName = (done.customerName ?? done.user?.name ?? 'there').split(' ')[0];
    return (
      <Screen scroll contentStyle={styles.content}>
        <View style={styles.successHead}>
          <View style={styles.tick}>
            <Ionicons name="checkmark" size={26} color={colors.success} />
          </View>
          <Text variant="title">Welcome, {firstName}.</Text>
          <Text variant="bodySoft">
            You&apos;re signed in{done.shopName ? ` as a customer of ${done.shopName}` : ''}. Your projects
            and the products your shop picked for you are ready.
          </Text>
          {done.validDays ? (
            <Text variant="caption">Your access runs for {done.validDays} days.</Text>
          ) : null}
        </View>
        <Button
          label="Start a room"
          size="lg"
          fullWidth
          loading={busy}
          onPress={async () => {
            setBusy(true);
            // Adopting the session is what routes them into the app.
            await signInWithSession(done);
          }}
        />
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
              ? 'Each code opens one account, once. Ask at the counter for a new one, or buy a project yourself.'
              : 'Check the six characters on your slip — the letter O and the digit 0 are easy to swap. If it still won’t go through, the shop can issue a fresh one.'
          }
        >
          <Button label="Buy a project" onPress={() => router.push('/buy')} fullWidth />
          <Button
            label="Browse shades instead"
            variant="secondary"
            fullWidth
            onPress={() => router.push('/browse-shades')}
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
          Six characters from the counter. No account and no password — we&apos;ll set you up and sign
          you straight in.
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
          The projects your shop assigned to it, the paint companies and products they picked for you,
          and the shade codes their counter reads.
        </Text>
      </Card>

      <View style={styles.footer}>
        <Text variant="bodySoft">No code? </Text>
        <PressableScale
          onPress={() => router.replace('/register')}
          haptic="tap"
          activeScale={0.95}
          accessibilityRole="button"
        >
          <Text variant="label" color={colors.accentSoft}>
            Create an account
          </Text>
        </PressableScale>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingTop: spacing.lg },
  header: { gap: spacing.md },
  form: { gap: spacing.lg },
  cardBody: { marginTop: spacing.xs },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
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
