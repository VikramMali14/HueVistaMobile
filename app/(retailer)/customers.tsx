import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Screen, Text, Button, Card, StatusPill, Meter } from '../../src/components';
import { colors, spacing } from '../../src/theme';
import { useGrantProject, useMyOrg, useShopCustomers } from '../../src/account/roleQueries';
import { expiryText } from '../../src/account/EntitlementCard';

/**
 * The customers this shop is responsible for.
 *
 * Includes anyone still holding a code the shop issued, not only those it
 * currently "manages" — a customer who later redeemed a second shop's code used
 * to vanish from the first shop's list, taking with them the projects that shop
 * had already paid for.
 *
 * The one action here is granting another project, which spends one of the
 * shop's own. It is the other half of the customer's "Ask my shop" button: the
 * request arrives, and this is where it is answered.
 */
export default function CustomersScreen() {
  const org = useMyOrg();
  const orgId = org.data?.id;
  const customers = useShopCustomers(orgId);
  const grant = useGrantProject(orgId);

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">Customers</Text>
        <Text variant="bodySoft">
          {customers.data?.length ?? 0} on your codes
        </Text>
      </View>

      <FlatList
        data={customers.data ?? []}
        keyExtractor={(c) => c.customerId}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={customers.isRefetching}
            onRefresh={() => customers.refetch()}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          customers.isLoading ? (
            <Text variant="caption">Loading…</Text>
          ) : (
            <Card>
              <Text variant="bodySoft">
                Nobody has redeemed a code yet. Once they do, their projects and access window show
                up here.
              </Text>
            </Card>
          )
        }
        renderItem={({ item }) => {
          const out = item.projectsRemaining <= 0;
          return (
            <Card style={styles.row}>
              <View style={styles.rowHead}>
                <Text variant="heading" numberOfLines={1} style={styles.name}>
                  {item.customerName ?? 'Customer'}
                </Text>
                <StatusPill
                  label={item.expired ? 'Access ended' : out ? 'All used' : `${item.projectsRemaining} left`}
                  tone={item.expired ? 'expired' : out ? 'progress' : 'done'}
                />
              </View>

              <Meter
                value={Math.min(item.projectsCreated, item.projectAllowance)}
                max={Math.max(item.projectAllowance, 1)}
                showCount={false}
                style={styles.meter}
              />
              <Text variant="caption">
                {item.projectsCreated} of {item.projectAllowance} used
                {item.accessExpiresAt ? ` · access ends ${expiryText(item.accessExpiresAt)}` : ''}
              </Text>

              <Button
                label="Give another project"
                variant="secondary"
                fullWidth
                style={styles.grant}
                loading={grant.isPending && grant.variables === item.customerId}
                onPress={() => grant.mutate(item.customerId)}
              />
            </Card>
          );
        }}
      />

      {grant.isError ? (
        <Text variant="caption" color={colors.danger} style={styles.err}>
          Couldn&apos;t add that project. Your plan may be out for this month.
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.xs },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  row: { gap: spacing.xs },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  name: { flexShrink: 1 },
  meter: { marginTop: spacing.xs },
  grant: { marginTop: spacing.sm },
  err: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
});
