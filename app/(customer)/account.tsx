import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Text, Card, Button, StatusPill, Input, SheetModal } from '../../src/components';
import { colors, spacing, radius } from '../../src/theme';
import { useSession } from '../../src/auth';
import { API_ORIGIN, accessCodesApi, ApiError, AccessCodeResponse } from '../../src/api';

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

export default function Account() {
  const { user, role, signOut } = useSession();
  const [busy, setBusy] = useState(false);

  // Link a paint shop (redeem an access code).
  const [linkOpen, setLinkOpen] = useState(false);
  const [code, setCode] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linked, setLinked] = useState<AccessCodeResponse | null>(null);

  async function onSignOut() {
    setBusy(true);
    try {
      await signOut(); // auth gate routes back to /welcome
    } finally {
      setBusy(false);
    }
  }

  async function redeem() {
    setLinking(true);
    setLinkError(null);
    try {
      setLinked(await accessCodesApi.redeem(code));
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 400)) {
        setLinkError('That code isn’t valid, or it has expired.');
      } else {
        setLinkError(err instanceof ApiError ? err.message : 'Couldn’t link the shop. Please try again.');
      }
    } finally {
      setLinking(false);
    }
  }

  function closeLink() {
    setLinkOpen(false);
    setCode('');
    setLinkError(null);
    setLinked(null);
  }

  const initial = (user?.name ?? user?.email ?? '?').charAt(0).toUpperCase();

  return (
    <Screen scroll contentStyle={styles.content}>
      <Text variant="title">Account</Text>

      <Card>
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Text variant="display" color={colors.accentSoft} style={styles.avatarText}>
              {initial}
            </Text>
          </View>
          <View style={styles.profileMeta}>
            <Text variant="heading">{user?.name ?? 'Your account'}</Text>
            {user?.email ? <Text variant="bodySoft">{user.email}</Text> : null}
          </View>
          {role ? <StatusPill label={role} tone="done" /> : null}
        </View>
      </Card>

      <Card onPress={() => setLinkOpen(true)}>
        <View style={styles.linkRow}>
          <View style={styles.linkIcon}>
            <Ionicons name="storefront-outline" size={20} color={colors.accentSoft} />
          </View>
          <View style={styles.linkText}>
            <Text variant="heading">Link a paint shop</Text>
            <Text variant="bodySoft">Enter a shop code to connect with your retailer.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.fgMute} />
        </View>
      </Card>

      <Card>
        {user?.email ? <Row label="Email" value={user.email} /> : null}
        <View style={styles.divider} />
        <Row label="Role" value={role ?? '—'} />
        <View style={styles.divider} />
        <Row label="Backend" value={API_ORIGIN} />
        <View style={styles.divider} />
        <Row label="App version" value={String(Constants.expoConfig?.version ?? '0.1.0')} />
      </Card>

      <Button label="Sign out" variant="secondary" fullWidth loading={busy} onPress={onSignOut} />

      <SheetModal visible={linkOpen} onClose={closeLink} title="Link a paint shop">
        {linked ? (
          <View style={styles.sheetBody}>
            <Card>
              <Text variant="label" color={colors.success}>
                Linked
              </Text>
              <Text variant="title" style={{ marginTop: spacing.xs }}>
                {linked.organizationName ?? 'Your shop'}
              </Text>
              {linked.code ? (
                <Text variant="mono" color={colors.fgSoft}>
                  {linked.code}
                </Text>
              ) : null}
            </Card>
            <Button label="Done" size="lg" fullWidth onPress={closeLink} />
          </View>
        ) : (
          <View style={styles.sheetBody}>
            <Input
              label="Shop code"
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              placeholder="HV-XXXXXX"
              autoCapitalize="characters"
              autoCorrect={false}
              mono
              maxLength={10}
            />
            {linkError ? (
              <Text variant="body" color={colors.danger}>
                {linkError}
              </Text>
            ) : null}
            <Button
              label="Link shop"
              size="lg"
              fullWidth
              loading={linking}
              disabled={code.trim().length < 4 || linking}
              onPress={redeem}
            />
          </View>
        )}
      </SheetModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: spacing.xl },
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.accentGhost,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 24, lineHeight: 30 },
  profileMeta: { flex: 1, gap: 2 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  linkIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.button,
    backgroundColor: colors.accentGhost,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.md },
  rowValue: { flexShrink: 1, textAlign: 'right' },
  divider: { height: 1, backgroundColor: colors.rule },
  sheetBody: { gap: spacing.md },
});
