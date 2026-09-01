import { useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Aurora, Text } from '../../src/components';
import { colors, spacing } from '../../src/theme';
import { useSession } from '../../src/auth';

/** How long to wait for the exchange before deciding it is not coming. */
const GIVE_UP_MS = 8000;

/**
 * Where a Google sign-in lands, on the platforms that route it through the app.
 *
 * On iOS the redirect is caught by the authentication session itself and never
 * becomes a navigation, so this screen is never seen. On Android the custom tab
 * hands `huevista://sign-in/callback#code=…` back through the deep-link handler,
 * and without a route of that name expo-router would flash "Unmatched Route" at
 * the exact moment the sign-in was working.
 *
 * It reads no code of its own: `signInWithGoogle` already has one from the
 * browser result and is exchanging it, and the root auth gate replaces this with
 * the app the moment that lands. All this owns is the other ending — a sign-in
 * that never resolves (the app was killed and relaunched by the deep link, so
 * nothing is waiting on the other side) must not leave someone watching a
 * spinner forever.
 */
export default function GoogleCallback() {
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status !== 'unauthenticated') return;
    const timer = setTimeout(() => router.replace('/welcome'), GIVE_UP_MS);
    return () => clearTimeout(timer);
  }, [status, router]);

  return (
    <View style={styles.root}>
      <Aurora intensity={1.1} />
      <View style={styles.body}>
        <ActivityIndicator color={colors.accentSoft} />
        <Text variant="bodySoft">Signing you in…</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
});
