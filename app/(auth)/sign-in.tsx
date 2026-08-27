import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Text, Button, Input, BackLink, PressableScale } from '../../src/components';
import { colors, spacing } from '../../src/theme';
import { useSession } from '../../src/auth';
import { userMessage } from '../../src/api';
import { haptics } from '../../src/haptics';

/**
 * Sign in with an e-mail and a password.
 *
 * The design this came from offered three ways in from this screen: a password,
 * "email me a code instead", and Continue with Google. Two of those are not
 * things this product can do. There is no passwordless e-mail login for a
 * customer — `/auth/login/otp` exists but is the second factor on an ADMIN
 * sign-in — and Google needs an OAuth client and a redirect the app has never
 * been configured with, so the button was a promise the build could not keep.
 *
 * What the product DOES have is better than either for the case that screen was
 * imagining ("it works on a borrowed handset at the shop"): a shop code
 * provisions an account and returns a session in one step, with no password to
 * invent at a counter. So that is the alternative offered here, and it is real.
 */
export default function SignIn() {
  const router = useRouter();
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  async function onSubmit() {
    if (!canSubmit) return;
    setError(null);
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      // On success the root auth gate redirects to /home automatically.
      haptics.success();
    } catch (err) {
      // A wrong password is the one moment in the app where the answer is
      // "no" — worth feeling, since the error text sits below the fold on a
      // small screen once the keyboard is up.
      haptics.error();
      setError(userMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll contentStyle={styles.content}>
      <BackLink />

      <Text variant="display">Welcome back.</Text>

      <View style={styles.form}>
        <Input
          label="Email"
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            setError(null);
          }}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
        />
        <Input
          label="Password"
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            setError(null);
          }}
          placeholder="Your password"
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={onSubmit}
          error={error ?? undefined}
        />
        <PressableScale
          onPress={() => router.push('/forgot-password')}
          haptic="tap"
          activeScale={0.95}
          accessibilityRole="button"
          style={styles.forgot}
        >
          <Text variant="label" color={colors.accentSoft}>
            Forgot your password?
          </Text>
        </PressableScale>

        <Button label="Sign in" size="lg" fullWidth loading={busy} disabled={!canSubmit} onPress={onSubmit} />
      </View>

      <View style={styles.divider}>
        <View style={styles.rule} />
        <Text variant="eyebrow">or</Text>
        <View style={styles.rule} />
      </View>

      <Button
        label="Use a code from my shop"
        variant="secondary"
        size="lg"
        fullWidth
        onPress={() => router.push('/redeem-code')}
      />

      <View style={styles.footer}>
        <Text variant="bodySoft">New here? </Text>
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
  form: { gap: spacing.lg },
  forgot: { alignSelf: 'flex-start' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rule: { flex: 1, height: 1, backgroundColor: colors.rule },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
});
