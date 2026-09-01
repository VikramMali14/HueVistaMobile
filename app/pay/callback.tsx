import { useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Aurora, Text } from '../../src/components';
import { colors, spacing } from '../../src/theme';

/** How long to wait for the checkout to resolve before deciding it will not. */
const GIVE_UP_MS = 8000;

/**
 * Where a Razorpay checkout lands, on the platforms that route it through the app.
 *
 * Normally this is never seen: `openAuthSessionAsync` catches the redirect to
 * `huevista://pay/callback` itself and hands the URL back to the code that is
 * awaiting it, which is where the verification happens. This route exists for
 * the case where that listener is gone — the OS killed the app behind the
 * browser and the deep link relaunched it — because without a route of this
 * name expo-router would flash "Unmatched Route" at somebody who has just paid.
 *
 * It deliberately reads nothing out of the URL. The signature in that fragment
 * is only worth anything to a verification call the awaiting checkout owns, and
 * a second one made from here would be a replay of a payment that either already
 * landed or is about to. The backend reconciles the charge from Razorpay's
 * webhook regardless, so the honest thing to do here is say so and get out of
 * the way.
 */
export default function PayCallback() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => router.replace('/home'), GIVE_UP_MS);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={styles.root}>
      <Aurora intensity={1.1} />
      <View style={styles.body}>
        <ActivityIndicator color={colors.accentSoft} />
        <Text variant="bodySoft">Finishing your payment…</Text>
        <Text variant="caption" style={styles.note}>
          If you were charged, it will be on your account in a minute.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  note: { textAlign: 'center' },
});
