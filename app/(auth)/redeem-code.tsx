import { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Text, Button, Input, Card } from '../../src/components';
import { colors, spacing, radius } from '../../src/theme';
import { useSession } from '../../src/auth';
import { accessCodesApi, ApiError, RedeemAccountResponse } from '../../src/api';

/**
 * Redeem a shop code with no account at all.
 *
 * The backend provisions a passwordless CUSTOMER account in the name the shop
 * entered and hands back a full session, so a walk-in goes from a code on a slip
 * to a signed-in app in one step. Their assigned projects and the products the
 * shop picked are waiting on the other side.
 */
export default function RedeemCode() {
  const router = useRouter();
  const { signInWithSession } = useSession();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<RedeemAccountResponse | null>(null);

  async function redeem() {
    setBusy(true);
    setError(null);
    try {
      setDone(await accessCodesApi.redeemAccount(code));
      // The session is deliberately NOT adopted here: doing so flips the auth
      // gate immediately and this screen is replaced by the customer tabs before
      // the walk-in has read who they are now signed in as. They step through it.
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 400 || err.status === 410)) {
        setError('That code isn’t valid, or it has already been used or expired.');
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
          <Text variant="bodySoft" center>
            You&apos;re signed in{done.shopName ? ` as a customer of ${done.shopName}` : ''}. Your projects
            and the products your shop picked for you are ready.
          </Text>
          {done.validDays ? (
            <Text variant="caption" center>
              Your access runs for {done.validDays} days.
            </Text>
          ) : null}
        </View>
        <View style={styles.form}>
          <Button
            label="Start visualizing"
            size="lg"
            fullWidth
            loading={busy}
            onPress={async () => {
              setBusy(true);
              // Adopting the session is what routes them into the app: the auth
              // gate sends a CUSTOMER to their tabs.
              await signInWithSession(done);
            }}
          />
          <Text variant="caption" center>
            The products your shop picked are under Account → Your products.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll contentStyle={styles.content}>
      <Pressable onPress={() => router.back()} hitSlop={12}>
        <Text variant="label" color={colors.fgSoft}>
          ‹ Back
        </Text>
      </Pressable>

      <View style={styles.header}>
        <Text variant="title">Enter your shop code</Text>
        <Text variant="bodySoft">
          Your paint shop can give you a code to visualize with them — no account, no password. We&apos;ll
          set you up and sign you straight in.
        </Text>
      </View>

      <View style={styles.form}>
        <Input
          label="Access code"
          value={code}
          onChangeText={(t) => {
            setCode(t.toUpperCase().replace(/\s/g, ''));
            setError(null);
          }}
          placeholder="e.g. 7K2NQ9PX"
          autoCapitalize="characters"
          autoCorrect={false}
          mono
          maxLength={12}
        />
        {error ? (
          <Text variant="body" color={colors.danger}>
            {error}
          </Text>
        ) : null}
        <Button
          label="Redeem code"
          size="lg"
          fullWidth
          loading={busy}
          disabled={code.trim().length < 6 || busy}
          onPress={redeem}
        />
        <Card>
          <Text variant="label">What you get</Text>
          <Text variant="bodySoft" style={{ marginTop: spacing.xs }}>
            The projects your shop assigned to the code, the paint companies and products they picked for
            you, and the shade codes their counter reads.
          </Text>
        </Card>
      </View>

      <View style={styles.footer}>
        <Text variant="bodySoft">Don&apos;t have a code? </Text>
        <Pressable onPress={() => router.replace('/register')} hitSlop={8}>
          <Text variant="label" color={colors.accentSoft}>
            Create an account
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
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  successHead: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xxl },
  tick: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.accentGhost,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
});
