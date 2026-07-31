import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Text, Button, Card, StatTile, Meter, StatusPill } from '../../src/components';
import { colors, spacing } from '../../src/theme';
import {
  useAccessCodes,
  useMyOrg,
  useRewardPoints,
  useShopCustomers,
  useSubscription,
} from '../../src/account/roleQueries';
import { useSession } from '../../src/auth';
import { UNLIMITED, planStanding, spendableProjects } from '../../src/billing/plan';

/**
 * The shop's counter: what the plan has left, what the kiosk has earned, and the
 * two things a walk-in needs — a code, or a room on screen.
 *
 * The quota meter is the whole point of this screen. A shop's month is a fixed
 * number of projects, and every code issued reserves one before the customer
 * ever arrives; putting that number where the shop stands means the ceiling is
 * met at the counter rather than with a customer already waiting on a photo.
 */
export default function CounterDashboard() {
  const router = useRouter();
  const { user } = useSession();
  const org = useMyOrg();
  const sub = useSubscription();
  const points = useRewardPoints();
  const codes = useAccessCodes(org.data?.id);
  const customers = useShopCustomers(org.data?.id);

  const s = sub.data;
  const standing = planStanding(s);
  const spendable = spendableProjects(s);

  const liveCodes = (codes.data ?? []).filter((c) => !c.used && !c.expired && !c.revoked);
  const redeemed = (codes.data ?? []).filter((c) => c.used);

  const refreshing =
    sub.isRefetching || codes.isRefetching || customers.isRefetching || points.isRefetching;

  function refreshAll() {
    sub.refetch();
    codes.refetch();
    customers.refetch();
    points.refetch();
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={colors.accent} />
        }
      >
        <View style={styles.header}>
          <Text variant="title">{org.data?.name ?? 'Your shop'}</Text>
          <Text variant="bodySoft">{user?.name ? `Signed in as ${user.name}` : 'Counter'}</Text>
        </View>

        {/* The plan in force, and what is left of this month's projects. */}
        <Card>
          <View style={styles.planHead}>
            <Text variant="label">{s?.planDisplayName ?? 'No plan'}</Text>
            {standing.label ? (
              <StatusPill label={standing.label} tone={standing.tone} />
            ) : null}
          </View>

          {s && standing.entitles ? (
            <>
              <Meter
                value={s.projectsUsed}
                max={spendable === UNLIMITED ? Math.max(s.projectsUsed, 1) : Math.max(spendable, 1)}
                showCount={false}
                style={styles.meter}
              />
              <Text variant="caption">
                {s.projectsUsed} of {spendable === UNLIMITED ? '∞' : spendable} projects used
                {standing.daysLeft != null
                  ? ` · ${standing.daysLeft === 0 ? 'ends today' : `${standing.daysLeft} day${standing.daysLeft === 1 ? '' : 's'} left`}`
                  : ''}
              </Text>
              {/* Reserved projects are already paid for but spoken for, so they are
                  named separately rather than folded into "used" or "left". */}
              {s.reservedProjects > 0 ? (
                <Text variant="caption" color={colors.fgSoft}>
                  {s.reservedProjects} held behind codes not yet redeemed
                </Text>
              ) : null}
              {s.carriedProjectCredits > 0 ? (
                <Text variant="caption" color={colors.warning}>
                  {s.carriedProjectCredits} carried over · expire when this cycle renews
                </Text>
              ) : null}
            </>
          ) : (
            <Text variant="bodySoft" style={{ marginTop: spacing.xs }}>
              {sub.isLoading
                ? 'Checking your plan…'
                : 'No plan is covering this shop right now. Subscribing turns the counter back on.'}
            </Text>
          )}

          <Button
            label="See the plan"
            variant="secondary"
            fullWidth
            style={styles.planBtn}
            onPress={() => router.push('/plan')}
          />
        </Card>

        {/* The two actions a walk-in actually needs. */}
        <View style={styles.actions}>
          <Button
            label="New walk-in"
            size="lg"
            icon={<Ionicons name="camera" size={18} color="#fff" />}
            onPress={() => router.push('/new-project')}
            style={styles.action}
          />
          <Button
            label="Issue a code"
            variant="secondary"
            size="lg"
            icon={<Ionicons name="ticket" size={18} color={colors.fg} />}
            onPress={() => router.push('/codes')}
            style={styles.action}
          />
        </View>

        <View style={styles.tiles}>
          <StatTile
            label="Active codes"
            value={liveCodes.length}
            hint="issued, not yet redeemed"
            tone="accent"
            style={styles.tile}
          />
          <StatTile
            label="Customers"
            value={customers.data?.length ?? 0}
            hint="on your codes"
            style={styles.tile}
          />
          <StatTile
            label="Redeemed"
            value={redeemed.length}
            hint="codes used"
            tone="success"
            style={styles.tile}
          />
          <StatTile
            label="Points"
            value={points.data?.balance ?? '—'}
            hint={
              points.data ? `${points.data.pointsPerSale} per kiosk sale` : 'kiosk rewards'
            }
            tone="warning"
            style={styles.tile}
          />
        </View>

        {/* Today's activity: the codes most recently issued, newest first. */}
        <View style={styles.block}>
          <Text variant="label">Recent codes</Text>
          {codes.isLoading ? (
            <Text variant="caption">Loading…</Text>
          ) : (codes.data ?? []).length === 0 ? (
            <Card>
              <Text variant="bodySoft">
                No codes yet. Issue one for a walk-in and they can visualise a room on their own
                phone before they leave.
              </Text>
            </Card>
          ) : (
            (codes.data ?? []).slice(0, 5).map((c) => (
              <Card key={c.id ?? c.code} style={styles.codeRow}>
                <View style={styles.codeHead}>
                  <Text variant="mono">{c.code}</Text>
                  <StatusPill
                    label={c.revoked ? 'Revoked' : c.expired ? 'Expired' : c.used ? 'Redeemed' : 'Active'}
                    tone={c.revoked || c.expired ? 'expired' : c.used ? 'done' : 'progress'}
                  />
                </View>
                <Text variant="caption">
                  {c.customerName ?? 'Walk-in'} · {c.projectsRemaining ?? 0} of {c.projectQuota ?? 0}{' '}
                  projects left
                </Text>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  header: { gap: spacing.xs },
  planHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meter: { marginTop: spacing.sm, marginBottom: spacing.xs },
  planBtn: { marginTop: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { flexBasis: '47%', flexGrow: 1 },
  block: { gap: spacing.sm },
  codeRow: { gap: spacing.xs },
  codeHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
