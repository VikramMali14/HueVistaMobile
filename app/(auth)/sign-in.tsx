import { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Text, Button, Input } from '../../src/components';
import { colors, spacing } from '../../src/theme';
import { useSession } from '../../src/auth';
import { userMessage } from '../../src/api';

export default function SignIn() {
  const router = useRouter();
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  async function onSubmit() {
    setError(null);
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      // On success the root auth gate redirects to the role home automatically.
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
        <Text variant="title">Welcome back</Text>
        <Text variant="bodySoft">Sign in to your HueVista account.</Text>
      </View>

      <View style={styles.form}>
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Your password"
          secureTextEntry
          autoComplete="password"
          textContentType="password"
        />
        <Pressable onPress={() => router.push('/forgot-password')} hitSlop={8} style={styles.forgot}>
          <Text variant="label" color={colors.accentSoft}>
            Forgot password?
          </Text>
        </Pressable>

        {error ? (
          <Text variant="body" color={colors.danger}>
            {error}
          </Text>
        ) : null}

        <Button label="Sign in" size="lg" fullWidth loading={busy} disabled={!canSubmit} onPress={onSubmit} />
        <Button
          label="Continue with Google"
          variant="secondary"
          fullWidth
          disabled
          onPress={() => {}}
        />
        <Text variant="caption" center>
          Google sign-in arrives with the next update.
        </Text>
      </View>

      <View style={styles.footer}>
        <Text variant="bodySoft">New here? </Text>
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
  forgot: { alignSelf: 'flex-end' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
});
