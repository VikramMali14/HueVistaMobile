import { View, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Text, Card, Button, StatTile, Meter, StatusPill } from '../../src/components';
import { colors, spacing, radius } from '../../src/theme';
import { useSession } from '../../src/auth';
import {
  useAdminAiUsage,
  useAdminRecentUsers,
  useAdminRevenue,
  useAdminStats,
} from '../../src/admin/queries';
import type { AdminUser } from '../../src/api';

/** "₹1,20,000" — Indian grouping, no paise. The endpoint already divides by 100. */
function rupees(amount: number): string {
  const rounded = Math.round(amount);
  try {
    return `₹${rounded.toLocaleString('en-IN')}`;
  } catch {
    return `₹${rounded}`;
  }
}

/** "3 Aug" / "" — short enough for a list row. */
function shortDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch {
    return d.toDateString();
  }
}

/**
 * The admin's dashboard: what the platform is doing, right now.
 *
 * Read-only by design (see the group layout) — every figure here comes from a
 * GET, and nothing on this screen changes anything. Its job is the question an
 * admin actually asks away from the desk: is the thing healthy, is anyone
 * signing up, and is the AI pipeline failing.
 *
 * Wall detection gets its own block rather than a tile, because "failed" is the
 * only number here that means something is broken rather than merely small.
 */
export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useSession();
  const stats = useAdminStats();
  const revenue = useAdminRevenue();
  const aiUsage = useAdminAiUsage();
  const recent = useAdminRecentUsers();

  const s = stats.data;
  const r = revenue.data;
  const ai = aiUsage.data;

  const refreshing =
    stats.isRefetching || revenue.isRefetching || aiUsage.isRefetching || recent.isRefetching;

  function refreshAll() {
    stats.refetch();
    revenue.refetch();
    aiUsage.refetch();
    recent.refetch();
  }

  // Only projects that finished one way or the other say anything about the
  // pipeline's health — the ones still queued or segmenting are not yet a verdict.
  const settled = s ? s.segmentedProjects + s.failedProjects : 0;
  const failureRate = settled > 0 ? (s!.failedProjects / settled) * 100 : 0;

  const planRows = r ? Object.entries(r.activeSubscriptionsByPlan) : [];

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={colors.accent} />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text variant="title">Dashboard</Text>
            <StatusPill label="Admin" tone="done" />
          </View>
          <Text variant="bodySoft">
            {user?.name ? `Signed in as ${user.name}` : 'HueVista platform'}
          </Text>
        </View>

        {stats.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : stats.isError ? (
          <Card>
            <Text variant="label" color={colors.danger}>
              Couldn&apos;t load the platform figures
            </Text>
            <Text variant="bodySoft" style={{ marginTop: spacing.xs }}>
              Check your connection and pull down to try again.
            </Text>
          </Card>
        ) : (
          <>
            <View style={styles.tiles}>
              <StatTile
                label="Users"
                value={s?.totalUsers ?? 0}
                hint={`+${s?.newUsersLast30Days ?? 0} in 30 days`}
                tone="accent"
              />
              <StatTile label="Shops & distributors" value={s?.totalOrganizations ?? 0} />
              <StatTile
                label="Active plans"
                value={s?.activeSubscriptions ?? 0}
                hint={`${s?.totalSubscriptions ?? 0} ever`}
                tone="success"
              />
              <StatTile
                label="Rooms created"
                value={s?.totalProjects ?? 0}
                hint={`${s?.segmentedProjects ?? 0} painted`}
              />
            </View>

            {/* The one number that means something is broken. */}
            <Card>
              <View style={styles.blockHead}>
                <Text variant="label">Wall detection</Text>
                {settled === 0 ? (
                  <StatusPill label="No runs yet" tone="neutral" />
                ) : (
                  <StatusPill
                    label={`${failureRate.toFixed(0)}% failing`}
                    tone={failureRate >= 20 ? 'expired' : failureRate >= 5 ? 'progress' : 'done'}
                  />
                )}
              </View>
              <Meter
                value={s?.segmentedProjects ?? 0}
                max={Math.max(settled, 1)}
                showCount={false}
                style={styles.meter}
              />
              <Text variant="caption">
                {s?.segmentedProjects ?? 0} succeeded · {s?.failedProjects ?? 0} failed
                {settled < (s?.totalProjects ?? 0)
                  ? ` · ${(s?.totalProjects ?? 0) - settled} not run yet`
                  : ''}
              </Text>
            </Card>
          </>
        )}

        {/* Revenue is retailer subscriptions only — say so, because it is the
            figure most likely to be read as "everything the platform earns". */}
        <Card>
          <View style={styles.blockHead}>
            <Text variant="label">Subscription revenue</Text>
            {revenue.isError ? <StatusPill label="Unavailable" tone="expired" /> : null}
          </View>
          {revenue.isLoading ? (
            <ActivityIndicator color={colors.accent} style={styles.inlineSpinner} />
          ) : revenue.isError ? (
            <Text variant="bodySoft" style={{ marginTop: spacing.xs }}>
              Couldn&apos;t load the revenue breakdown.
            </Text>
          ) : (
            <>
              <Text variant="display" color={colors.accentSoft} style={styles.bigNumber}>
                {rupees(r?.totalEstimatedMonthlyRevenueInRupees ?? 0)}
              </Text>
              <Text variant="caption">
                Estimated per month, from active plans at their list price.
              </Text>
              {planRows.length === 0 ? (
                <Text variant="bodySoft" style={{ marginTop: spacing.md }}>
                  No active plans yet.
                </Text>
              ) : (
                planRows.map(([plan, count]) => (
                  <View key={plan} style={styles.planRow}>
                    <Text variant="body" numberOfLines={1} style={styles.planName}>
                      {plan}
                    </Text>
                    <Text variant="mono" color={colors.fgSoft}>
                      {count} · {rupees(r?.monthlyRevenueByPlanInRupees[plan] ?? 0)}
                    </Text>
                  </View>
                ))
              )}
            </>
          )}
        </Card>

        {/* What the paying accounts are actually spending their quota on. */}
        {ai ? (
          <Card>
            <Text variant="label">AI usage this cycle</Text>
            <View style={styles.usageRow}>
              <View style={styles.usageCell}>
                <Text variant="heading">{ai.totalProjectsUsedThisCycle}</Text>
                <Text variant="caption">projects used</Text>
              </View>
              <View style={styles.usageCell}>
                <Text variant="heading">{ai.avgProjectsPerActiveSubscription}</Text>
                <Text variant="caption">avg per active plan</Text>
              </View>
            </View>
          </Card>
        ) : null}

        {/* Newest accounts — the fastest read on whether signups are moving. */}
        <Card>
          <Text variant="label">Newest accounts</Text>
          {recent.isLoading ? (
            <ActivityIndicator color={colors.accent} style={styles.inlineSpinner} />
          ) : recent.isError ? (
            <Text variant="bodySoft" style={{ marginTop: spacing.xs }}>
              Couldn&apos;t load recent signups.
            </Text>
          ) : (recent.data ?? []).length === 0 ? (
            <Text variant="bodySoft" style={{ marginTop: spacing.xs }}>
              No accounts yet.
            </Text>
          ) : (
            (recent.data ?? []).map((u: AdminUser) => (
              <View key={u.id} style={styles.userRow}>
                <View style={styles.userMeta}>
                  <Text variant="body" numberOfLines={1}>
                    {u.name ?? 'Unnamed account'}
                  </Text>
                  {/* Code-provisioned accounts carry a synthetic .local address
                      nobody can reach, so it is not shown as a contact. */}
                  {u.email && !u.email.endsWith('.local') ? (
                    <Text variant="caption" numberOfLines={1}>
                      {u.email}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.userTail}>
                  <StatusPill label={u.role} tone={u.role === 'ADMIN' ? 'done' : 'neutral'} />
                  {shortDate(u.createdAt) ? (
                    <Text variant="caption">{shortDate(u.createdAt)}</Text>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </Card>

        <Card>
          <View style={styles.ctaRow}>
            <View style={styles.ctaIcon}>
              <Ionicons name="sparkles" size={20} color={colors.accentSoft} />
            </View>
            <View style={styles.ctaText}>
              <Text variant="heading">Try the studio</Text>
              <Text variant="bodySoft">
                Paint a real room the way a customer would — the quickest check that the pipeline
                works end to end.
              </Text>
            </View>
          </View>
          <Button
            label="Start a room"
            variant="secondary"
            fullWidth
            style={styles.ctaButton}
            onPress={() => router.push('/new-project')}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  header: { gap: spacing.xs },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  center: { paddingVertical: spacing.xxxl, alignItems: 'center' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  blockHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meter: { marginTop: spacing.md, marginBottom: spacing.sm },
  inlineSpinner: { alignSelf: 'flex-start', marginTop: spacing.md },
  bigNumber: { marginTop: spacing.sm },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  planName: { flexShrink: 1 },
  usageRow: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.md },
  usageCell: { gap: 2 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  userMeta: { flex: 1, gap: 2 },
  userTail: { alignItems: 'flex-end', gap: 2 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ctaIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.button,
    backgroundColor: colors.accentGhost,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { flex: 1, gap: 2 },
  ctaButton: { marginTop: spacing.md },
});
