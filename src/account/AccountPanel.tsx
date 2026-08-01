import { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Text, Card, Button, StatusPill, Input, SheetModal } from '../components';
import { colors, spacing } from '../theme';
import { useSession } from '../auth';
import { API_ORIGIN, authApi, userMessage } from '../api';
import { useMyProfile } from './queries';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="label">{label}</Text>
      <Text variant="body" numberOfLines={1} style={styles.rowValue}>
        {value}
      </Text>
    </View>
  );
}

/**
 * The parts of "Account" that are the same whoever is signed in: who you are,
 * whether your e-mail and phone are verified, changing your password, support,
 * signing out, and deleting the account.
 *
 * Shared rather than copied per role because these are properties of the
 * ACCOUNT, not of the shop or the job — and because "delete my account" drifting
 * between four screens is exactly the kind of divergence that ends with one of
 * them missing its confirmation.
 */
export function AccountPanel({ children }: { children?: React.ReactNode }) {
  const { user, role } = useSession();
  const p = useMyProfile().data;

  return (
    <>
      <Card>
        <Row label="Name" value={user?.name ?? '—'} />
        {/* A code-provisioned account has no real inbox; its synthetic address is
            not a contact anyone could reach, so it is not shown as one. */}
        {p?.email && !p.email.endsWith('.local') ? <Row label="Email" value={p.email} /> : null}
        {p?.phoneNumber ? <Row label="Phone" value={p.phoneNumber} /> : null}
        <Row label="Role" value={role ?? '—'} />
      </Card>

      {children}

      <AccountActions />
    </>
  );
}

/**
 * Verification, password, support, sign-out and deletion — the actions every
 * role has, without the profile card above them.
 *
 * Split out so the customer's Account screen (which has its own richer header:
 * avatar, shop, entitlement) can reuse the actions without rendering a second
 * identity block.
 */
export function AccountActions() {
  const { signOut } = useSession();
  const router = useRouter();
  const profile = useMyProfile();
  const [busy, setBusy] = useState(false);

  const [pwOpen, setPwOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwDone, setPwDone] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);

  const p = profile.data;
  /**
   * An account provisioned from a shop code has a synthetic address and no
   * password — offering "change password" there would open a form that cannot
   * succeed, so both it and the verify prompt stay hidden.
   */
  const passwordless = p?.provider != null && p.provider !== 'LOCAL';

  async function changePassword() {
    setPwBusy(true);
    setPwError(null);
    try {
      await authApi.changePassword(current, next);
      setPwDone(true);
      setCurrent('');
      setNext('');
    } catch (err) {
      setPwError(userMessage(err));
    } finally {
      setPwBusy(false);
    }
  }

  /**
   * Deleting is irreversible and takes the projects with it, so it asks first
   * and names what goes — a second tap on a red button is not consent.
   */
  function confirmDelete() {
    Alert.alert(
      'Delete your account?',
      'Your rooms, saved colours and history are removed for good. This cannot be undone.',
      [
        { text: 'Keep my account', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await authApi.deleteAccount();
              await signOut();
            } catch (err) {
              Alert.alert('Could not delete', userMessage(err));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  return (
    <>
      {/* Verification. Shown only when the e-mail is actually unverified — a
          green tick nobody asked for is noise, but an unverified e-mail is the
          thing that will refuse a project later. Phone is not asked about: there
          is no SMS sender wired up, so it can never be answered. */}
      {p && !passwordless && !p.emailVerified ? (
        <Card>
          <View style={styles.head}>
            <Text variant="label">Verification</Text>
            <StatusPill label="Incomplete" tone="progress" />
          </View>
          <Text variant="bodySoft" style={{ marginTop: spacing.xs }}>
            Your email address is not verified yet. Some actions ask for it first.
          </Text>
          <Button
            label="Verify now"
            variant="secondary"
            fullWidth
            style={styles.action}
            onPress={() => router.push('/verify')}
          />
        </Card>
      ) : null}

      <Card>
        <Text variant="label">Support</Text>
        <Text variant="bodySoft" style={{ marginTop: spacing.xs }}>
          Ask a question and get an answer in the app — a person takes over if you need one.
        </Text>
        <Button
          label="Open support"
          variant="secondary"
          fullWidth
          style={styles.action}
          onPress={() => router.push('/support')}
        />
      </Card>

      <View style={styles.actions}>
        {!passwordless ? (
          <Button
            label="Change password"
            variant="secondary"
            fullWidth
            onPress={() => setPwOpen(true)}
          />
        ) : null}
        <Button label="Sign out" variant="secondary" fullWidth loading={busy} onPress={signOut} />
        <Button label="Delete account" variant="ghost" fullWidth onPress={confirmDelete} />
      </View>

      <Text variant="caption" style={styles.build}>
        HueVista {Constants.expoConfig?.version ?? ''} · {API_ORIGIN}
      </Text>

      <SheetModal
        visible={pwOpen}
        onClose={() => {
          setPwOpen(false);
          setPwDone(false);
          setPwError(null);
        }}
        title="Change password"
      >
        {pwDone ? (
          <View style={styles.sheet}>
            <Text variant="body" color={colors.success}>
              Password changed ✓
            </Text>
            <Button
              label="Done"
              fullWidth
              onPress={() => {
                setPwOpen(false);
                setPwDone(false);
              }}
            />
          </View>
        ) : (
          <View style={styles.sheet}>
            <Input
              label="Current password"
              value={current}
              onChangeText={setCurrent}
              secureTextEntry
            />
            <Input label="New password" value={next} onChangeText={setNext} secureTextEntry />
            {pwError ? (
              <Text variant="body" color={colors.danger}>
                {pwError}
              </Text>
            ) : null}
            <Button
              label="Change it"
              fullWidth
              loading={pwBusy}
              disabled={!current || next.length < 8}
              onPress={changePassword}
            />
            <Text variant="caption">At least 8 characters.</Text>
          </View>
        )}
      </SheetModal>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 4 },
  rowValue: { flexShrink: 1, textAlign: 'right' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  action: { marginTop: spacing.md },
  actions: { gap: spacing.sm },
  build: { textAlign: 'center', marginTop: spacing.md },
  sheet: { gap: spacing.md },
});
