import { View, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Serif, Text, Card, StatTile, StatusPill } from '../../src/components';
import { colors, spacing, fontSize } from '../../src/theme';
import { useNetwork } from '../../src/account/roleQueries';
import type { NetworkNode } from '../../src/api';

/** Flatten the downline to the shops themselves — the level a distributor acts on. */
function shopsOf(roots: NetworkNode[]): NetworkNode[] {
  const out: NetworkNode[] = [];
  const walk = (nodes: NetworkNode[]) => {
    for (const n of nodes) {
      if (n.role === 'RETAILER') out.push(n);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(roots);
  return out;
}

/**
 * The distributor's network: the shops under them, and how each is doing.
 *
 * "Health" here is deliberately just the two numbers a distributor can act on —
 * codes issued and codes redeemed. A shop issuing nothing has stopped using the
 * product; a shop issuing plenty but redeeming few has a counter problem. Both
 * are a phone call, and neither needs a score.
 */
export default function NetworkScreen() {
  const router = useRouter();
  const network = useNetwork();
  const shops = shopsOf(network.data?.roots ?? []);
  const totals = network.data?.totals ?? {};

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={network.isRefetching}
            onRefresh={() => network.refetch()}
            tintColor={colors.accent}
          />
        }
      >
        <Text variant="display">
        <Serif size={fontSize.display}>Network</Serif>
      </Text>

        <View style={styles.tiles}>
          <StatTile label="Shops" value={shops.length} tone="accent" style={styles.tile} />
          <StatTile
            label="Painters"
            value={totals.painters ?? shops.reduce((n, s) => n + s.painterCount, 0)}
            style={styles.tile}
          />
          <StatTile
            label="Codes issued"
            value={shops.reduce((n, s) => n + s.codesIssued, 0)}
            style={styles.tile}
          />
          <StatTile
            label="Redeemed"
            value={shops.reduce((n, s) => n + s.codesRedeemed, 0)}
            tone="success"
            style={styles.tile}
          />
        </View>

        <Text variant="label">Shops</Text>

        {network.isLoading ? (
          <Text variant="caption">Loading…</Text>
        ) : shops.length === 0 ? (
          <Card>
            <Text variant="bodySoft">
              No shops under you yet. Shops are created from the website, and appear here as soon as
              they are.
            </Text>
          </Card>
        ) : (
          shops.map((s) => {
            /* A shop that has issued nothing has stopped using the product; one
               issuing plenty but redeeming little has a counter problem. */
            const idle = s.codesIssued === 0;
            const poorConversion = s.codesIssued >= 5 && s.codesRedeemed / s.codesIssued < 0.4;
            return (
              <Pressable
                key={s.orgId ?? s.userId}
                onPress={() => s.orgId && router.push(`/shop/${s.orgId}`)}
              >
                <Card style={styles.row}>
                  <View style={styles.rowHead}>
                    <Text variant="heading" numberOfLines={1} style={styles.name}>
                      {s.orgName ?? s.name ?? 'Shop'}
                    </Text>
                    <StatusPill
                      label={idle ? 'Idle' : poorConversion ? 'Low uptake' : 'Active'}
                      tone={idle ? 'expired' : poorConversion ? 'progress' : 'done'}
                    />
                  </View>
                  <Text variant="caption" numberOfLines={1}>
                    {[s.city, s.state].filter(Boolean).join(', ') || s.name || '—'}
                  </Text>
                  <Text variant="caption">
                    {s.codesIssued} codes issued · {s.codesRedeemed} redeemed · {s.painterCount}{' '}
                    painter{s.painterCount === 1 ? '' : 's'}
                  </Text>
                  <Text variant="caption" color={colors.fgSoft}>
                    {s.brandsRestricted
                      ? `${s.assignedBrands.length} compan${s.assignedBrands.length === 1 ? 'y' : 'ies'}`
                      : 'All companies'}
                    {' · '}
                    {s.featuresRestricted
                      ? `${s.assignedFeatures.length} page${s.assignedFeatures.length === 1 ? '' : 's'}`
                      : 'All pages'}
                  </Text>
                </Card>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { flexBasis: '47%', flexGrow: 1 },
  row: { gap: spacing.xs },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  name: { flexShrink: 1 },
});
