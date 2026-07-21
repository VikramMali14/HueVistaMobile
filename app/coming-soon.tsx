import { View, StyleSheet } from 'react-native';
import { Screen, Text, Button, Card, StatusPill } from '../src/components';
import { spacing } from '../src/theme';
import { useSession } from '../src/auth';

const ROLE_COPY: Record<string, { title: string; body: string; phase: string }> = {
  RETAILER: {
    title: 'Counter mode is on the way',
    body: 'Your walk-in visualizer, AI quota meter, access codes and orders arrive in Phase 2.',
    phase: 'Phase 2',
  },
  PAINTER: {
    title: 'Painter jobs are on the way',
    body: 'Your job list with approved shades, litres and site addresses arrives in Phase 3.',
    phase: 'Phase 3',
  },
  DISTRIBUTOR: {
    title: 'Network tools are on the way',
    body: 'Your retailer network, renewals and reports arrive in Phase 3.',
    phase: 'Phase 3',
  },
  ADMIN: {
    title: 'Admins use the web app',
    body: 'Administration stays on the HueVista website. Sign in there for full controls.',
    phase: 'Web',
  },
};

/** Landing for authenticated non-customer roles until their apps ship. */
export default function ComingSoon() {
  const { role, user, signOut } = useSession();
  const copy = (role && ROLE_COPY[role]) || {
    title: 'Coming soon',
    body: 'This experience is on the roadmap.',
    phase: 'Soon',
  };

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.center}>
        <Card>
          <View style={styles.row}>
            <Text variant="label">{role ?? 'Account'}</Text>
            <StatusPill label={copy.phase} tone="progress" />
          </View>
          <Text variant="title" style={styles.title}>
            {copy.title}
          </Text>
          <Text variant="bodySoft" style={styles.body}>
            {copy.body}
          </Text>
          {user?.name ? (
            <Text variant="caption" style={styles.who}>
              Signed in as {user.name}
            </Text>
          ) : null}
        </Card>
      </View>
      <Button label="Sign out" variant="secondary" fullWidth onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'space-between', paddingVertical: spacing.xxl },
  center: { flex: 1, justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { marginTop: spacing.md },
  body: { marginTop: spacing.sm },
  who: { marginTop: spacing.lg },
});
