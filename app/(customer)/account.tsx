import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import { Screen, Text, Card, Button, StatusPill } from '../../src/components';
import { colors, spacing, radius } from '../../src/theme';
import { useSession } from '../../src/auth';
import { API_ORIGIN } from '../../src/api';

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

  async function onSignOut() {
    setBusy(true);
    try {
      await signOut(); // auth gate routes back to /welcome
    } finally {
      setBusy(false);
    }
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
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.md },
  rowValue: { flexShrink: 1, textAlign: 'right' },
  divider: { height: 1, backgroundColor: colors.rule },
});
