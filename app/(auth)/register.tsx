import { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Text, Button, Input } from '../../src/components';
import { colors, spacing } from '../../src/theme';
import { useSession } from '../../src/auth';
import { userMessage } from '../../src/api';

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
    setError(null);
    setBusy(true);
    try {
      await signUp({ name: name.trim(), email: email.trim(), password, accountType: 'customer' });
      // Root auth gate redirects to the customer home on success.
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
        <Text variant="title">Create your account</Text>
        <Text variant="bodySoft">Save your rooms, try shades and share looks.</Text>
      </View>

      <View style={styles.form}>
        <Input label="Name" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" />
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="At least 8 characters"
          secureTextEntry
          hint="8+ characters, with a letter and a number."
          error={password.length > 0 && !passwordOk ? 'Use 8+ characters, a letter and a number.' : undefined}
        />

        {error ? (
          <Text variant="body" color={colors.danger}>
            {error}
          </Text>
        ) : null}

        <Button label="Create account" size="lg" fullWidth loading={busy} disabled={!canSubmit} onPress={onSubmit} />
      </View>

      <View style={styles.footer}>
        <Text variant="bodySoft">Already have an account? </Text>
        <Pressable onPress={() => router.replace('/sign-in')} hitSlop={8}>
          <Text variant="label" color={colors.accentSoft}>
            Sign in
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
});
