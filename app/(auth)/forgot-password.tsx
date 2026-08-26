import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Screen,
  Text,
  Button,
  Input,
  CodeInput,
  BackLink,
  PressableScale,
} from '../../src/components';
import { colors, spacing, radius } from '../../src/theme';
import { authApi, userMessage } from '../../src/api';
import { haptics } from '../../src/haptics';

const CODE_LENGTH = 6;

type Stage = 'email' | 'code' | 'done';

/**
 * Reset a forgotten password, all the way through.
 *
 * This screen used to stop halfway: it posted to `/auth/forgot-password`, said
 * "a reset code is on its way", and then had nowhere to type the code — the API
 * client did not even carry `resetPassword`. Anyone who forgot their password
 * on the phone could not get back in from the phone.
 *
 * Three stages on one route rather than three routes, because the address never
 * leaves the screen: the second stage needs the e-mail the first one collected,
 * and a stack of separate screens would have to hand it along or ask twice.
 */
export default function ForgotPassword() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const passwordOk = password.length >= 8 && /\p{L}/u.test(password) && /\d/.test(password);

  async function sendCode() {
    if (email.trim().length === 0 || busy) return;
    setError(null);
    setBusy(true);
    try {
      // The backend always answers 200 so a stranger cannot learn which
      // addresses have accounts. Show what it said and move on either way.
      setNotice(await authApi.forgotPassword(email.trim()));
      setStage('code');
    } catch (err) {
      setError(userMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (code.length < CODE_LENGTH || !passwordOk || busy) return;
    setError(null);
    setBusy(true);
    try {
      await authApi.resetPassword(email.trim(), code, password);
      haptics.success();
      setStage('done');
    } catch (err) {
      haptics.error();
      setError(userMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (stage === 'done') {
    return (
      <Screen scroll contentStyle={styles.content}>
        <View style={styles.doneHead}>
          <View style={styles.tick}>
            <Ionicons name="checkmark" size={26} color={colors.success} />
          </View>
          <Text variant="title">Password changed.</Text>
          <Text variant="bodySoft">
            Every device that was signed in has been signed out, including this one. Sign in with the
            new password to carry on.
          </Text>
        </View>
        <Button label="Sign in" size="lg" fullWidth onPress={() => router.replace('/sign-in')} />
      </Screen>
    );
  }

  return (
    <Screen scroll contentStyle={styles.content}>
      <BackLink
        onPress={stage === 'code' ? () => setStage('email') : undefined}
        label={stage === 'code' ? 'Change email' : 'Back'}
      />

      {stage === 'email' ? (
        <>
          <View style={styles.header}>
            <Text variant="display">Reset your password.</Text>
            <Text variant="bodySoft">
              Tell us the address on the account and we&apos;ll send six digits to it.
            </Text>
          </View>

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
              returnKeyType="go"
              onSubmitEditing={sendCode}
              error={error ?? undefined}
            />
            <Button
              label="Send the code"
              size="lg"
              fullWidth
              loading={busy}
              disabled={email.trim().length === 0 || busy}
              onPress={sendCode}
            />
          </View>
        </>
      ) : (
        <>
          <View style={styles.header}>
            <Text variant="display">Check your email.</Text>
            <Text variant="bodySoft">{notice ?? `We sent six digits to ${email.trim()}.`}</Text>
          </View>

          <View style={styles.form}>
            <CodeInput
              value={code}
              onChangeText={(next) => {
                setCode(next);
                setError(null);
              }}
              length={CODE_LENGTH}
              mode="numeric"
              autoFocus
              accessibilityLabel="Reset code"
            />
            <Input
              label="New password"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setError(null);
              }}
              placeholder="At least 8 characters"
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              hint="8+ characters, with a letter and a number."
              error={
                error ??
                (password.length > 0 && !passwordOk
                  ? 'Use 8+ characters, a letter and a number.'
                  : undefined)
              }
              returnKeyType="go"
              onSubmitEditing={reset}
            />
            <Button
              label="Set the new password"
              size="lg"
              fullWidth
              loading={busy}
              disabled={code.length < CODE_LENGTH || !passwordOk || busy}
              onPress={reset}
            />
            <PressableScale
              onPress={sendCode}
              haptic="tap"
              activeScale={0.95}
              accessibilityRole="button"
              style={styles.resend}
            >
              <Text variant="label" color={colors.accentSoft}>
                Didn&apos;t arrive? Send it again
              </Text>
            </PressableScale>
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingTop: spacing.lg },
  header: { gap: spacing.md },
  form: { gap: spacing.lg },
  resend: { alignSelf: 'center', paddingVertical: spacing.sm },
  doneHead: { gap: spacing.md, paddingTop: spacing.xl },
  tick: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.accentGhost,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
