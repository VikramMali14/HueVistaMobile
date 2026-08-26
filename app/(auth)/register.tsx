import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Text, Button, Input, BackLink, PressableScale } from '../../src/components';
import { colors, spacing } from '../../src/theme';
import { useSession } from '../../src/auth';
import { userMessage } from '../../src/api';
import { haptics } from '../../src/haptics';

/**
 * Customer account creation. Retailers self-provision from the website with shop
 * details; the mobile signup path creates a CUSTOMER account (accountType).
 */
export default function Register() {
  const router = useRouter();
  const { signUp } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const passwordOk = password.length >= 8 && /\p{L}/u.test(password) && /\d/.test(password);
  const canSubmit = name.trim().length > 0 && email.trim().length > 0 && passwordOk && !busy;

  async function onSubmit() {
    if (!canSubmit) return;
    setError(null);
    setBusy(true);
    try {
      await signUp({ name: name.trim(), email: email.trim(), password, accountType: 'customer' });
      haptics.success();
      // Root auth gate redirects to the customer home on success.
    } catch (err) {
      haptics.error();
      setError(userMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll contentStyle={styles.content}>
      <BackLink />

      <View style={styles.header}>
        <Text variant="display">A name, and a way back in.</Text>
        <Text variant="bodySoft">
          So your rooms, your boards and your shades are still here next time.
        </Text>
      </View>

      <View style={styles.form}>
        <Input
          label="Full name"
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
        />
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
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
          onChangeText={setPassword}
          placeholder="At least 8 characters"
          secureTextEntry
          hint="8+ characters, with a letter and a number."
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={onSubmit}
          error={password.length > 0 && !passwordOk ? 'Use 8+ characters, a letter and a number.' : undefined}
        />

        {error ? (
          <Text variant="caption" color={colors.dangerSoft}>
            {error}
          </Text>
        ) : null}

        <Button label="Create account" size="lg" fullWidth loading={busy} disabled={!canSubmit} onPress={onSubmit} />
      </View>

      <View style={styles.footer}>
        <Text variant="bodySoft">Already have an account? </Text>
        <PressableScale
          onPress={() => router.replace('/sign-in')}
          haptic="tap"
          activeScale={0.95}
          accessibilityRole="button"
        >
          <Text variant="label" color={colors.accentSoft}>
            Sign in
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
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
});
