import { View, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Serif, Text, Card, Button } from '../../src/components';
import { spacing, fontSize } from '../../src/theme';
import { AccountPanel } from '../../src/account/AccountPanel';
import { useMyAccess, useMyOrg } from '../../src/account/roleQueries';

/**
 * The shop's own account.
 *
 * Beyond the shared panel it names two things only a shop has: which
 * organisation this is, and what its distributor has granted it — the paint
 * companies it may work with, and the pages it may reach. Both are decided
 * upstream, so they are stated here rather than offered as settings.
 */
export default function ShopAccount() {
  const router = useRouter();
  const org = useMyOrg();
  const access = useMyAccess().data;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="display">
        <Serif size={fontSize.display}>Account</Serif>
      </Text>

        <AccountPanel>
          <Card>
            <Text variant="label">Shop</Text>
            <Text variant="heading" style={{ marginTop: spacing.xs }}>
              {org.data?.name ?? '—'}
            </Text>

            <View style={styles.grant}>
              <Text variant="caption">
                {access?.brandsRestricted
                  ? `Paint companies: ${access.allowedBrands.join(', ') || 'none assigned yet'}`
                  : 'Paint companies: every brand in the catalogue'}
              </Text>
              <Text variant="caption">
                {access?.featuresRestricted
                  ? `Pages: ${access.allowedFeatures.join(', ') || 'none assigned yet'}`
                  : 'Pages: all of them'}
              </Text>
              {access?.brandsRestricted || access?.featuresRestricted ? (
                <Text variant="caption">
                  Your distributor decides these. Ask them to change what your shop can reach.
                </Text>
              ) : null}
            </View>
          </Card>

          <Card>
            <Text variant="label">Painters</Text>
            <Text variant="bodySoft" style={{ marginTop: spacing.xs }}>
              Invite a painter and they get their own login, with the jobs you assign them.
            </Text>
            <Button
              label="Manage painters"
              variant="secondary"
              fullWidth
              style={styles.action}
              onPress={() => router.push('/painters')}
            />
          </Card>
        </AccountPanel>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  grant: { marginTop: spacing.sm, gap: 2 },
  action: { marginTop: spacing.md },
});
