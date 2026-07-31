import { StyleSheet, ScrollView } from 'react-native';
import { Screen, Text, Card } from '../../src/components';
import { spacing } from '../../src/theme';
import { AccountPanel } from '../../src/account/AccountPanel';
import { useMyOrg } from '../../src/account/roleQueries';

/** The distributor's own account, plus which territory org this is. */
export default function DistributorAccount() {
  const org = useMyOrg();

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="title">Account</Text>
        <AccountPanel>
          <Card>
            <Text variant="label">Distributorship</Text>
            <Text variant="heading" style={{ marginTop: spacing.xs }}>
              {org.data?.name ?? '—'}
            </Text>
          </Card>
        </AccountPanel>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
});
