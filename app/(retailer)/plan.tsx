import { View, StyleSheet, ScrollView, Linking, RefreshControl } from 'react-native';
import { Screen, Serif, Text, Button, Card, StatusPill, Meter, StatTile } from '../../src/components';
import { colors, spacing, fontSize } from '../../src/theme';
import {
  useBuyProjectWithPoints,
  useRewardPoints,
  useSubscription,
} from '../../src/account/roleQueries';
import { useProjectPurchaseOptions } from '../../src/account/queries';
import { formatPaise, formatPoints, userMessage, webUrl } from '../../src/api';
import { UNLIMITED, planStanding, spendableProjects } from '../../src/billing/plan';
import { expiryText } from '../../src/account/EntitlementCard';

/**
 * The shop's plan and its reward points.
 *
 * Read-only by design: subscribing, upgrading and buying points are Razorpay
 * Checkout flows, which is a web journey the app has no SDK for. So this screen
 * states the real numbers and links out, rather than inventing a purchase path
 * that would fail at the last step.
 *
 * Spending points is different — that is a balance debit with no gateway in it,
 * so buying a project with points happens right here.
 */
export default function PlanScreen() {
  const sub = useSubscription();
  const points = useRewardPoints();
  const options = useProjectPurchaseOptions();
  const buy = useBuyProjectWithPoints();

  const s = sub.data;
  const standing = planStanding(s);
  const spendable = spendableProjects(s);
  const pts = points.data;

  const canAffordProject =
    pts != null && options.data != null && pts.balance >= options.data.projectPricePoints;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={sub.isRefetching || points.isRefetching}
            onRefresh={() => {
              sub.refetch();
              points.refetch();
              options.refetch();
            }}
            tintColor={colors.accent}
          />
        }
      >
        <Text variant="display">
        <Serif size={fontSize.display}>Plan</Serif>
      </Text>

        <Card>
          <View style={styles.head}>
            <Text variant="heading">{s?.planDisplayName ?? 'No plan'}</Text>
            {standing.label ? <StatusPill label={standing.label} tone={standing.tone} /> : null}
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
                {s.projectsUsed} of {spendable === UNLIMITED ? '∞' : spendable} projects this cycle
              </Text>
              {s.currentPeriodEnd ? (
                <Text variant="caption" color={colors.fgSoft}>
                  {standing.windingDown ? 'Access ends' : 'Renews'}{' '}
                  {expiryText(s.currentPeriodEnd)}
                </Text>
              ) : null}

              <View style={styles.breakdown}>
                {s.purchasedProjectCredits > 0 ? (
                  <Text variant="caption">
                    {s.purchasedProjectCredits} bought · never expire
                  </Text>
                ) : null}
                {s.carriedProjectCredits > 0 ? (
                  <Text variant="caption" color={colors.warning}>
                    {s.carriedProjectCredits} carried over · expire when this cycle renews
                  </Text>
                ) : null}
                {s.reservedProjects > 0 ? (
                  <Text variant="caption" color={colors.fgSoft}>
                    {s.reservedProjects} held behind codes not yet redeemed
                  </Text>
                ) : null}
              </View>

              {s.pdfDownloadsLimit > 0 ? (
                <Text variant="caption" style={styles.pdf}>
                  Colour boards: {s.pdfDownloadsUsed} of{' '}
                  {s.pdfDownloadsLimit >= UNLIMITED ? '∞' : s.pdfDownloadsLimit} this month ·{' '}
                  {s.pdfImageLimit} rooms per board
                </Text>
              ) : null}
            </>
          ) : (
            <Text variant="bodySoft" style={{ marginTop: spacing.xs }}>
              {sub.isLoading
                ? 'Checking your plan…'
                : standing.label === 'Payment failed'
                  ? 'Your last payment did not go through, so the counter is paused. Updating the card on the website turns it straight back on.'
                  : 'No plan is covering this shop. Subscribing turns the counter back on and gives you a monthly project allowance.'}
            </Text>
          )}

          {webUrl('/subscription') ? (
            <Button
              label={standing.entitles ? 'Manage on the website' : 'Subscribe on the website'}
              variant={standing.entitles ? 'secondary' : 'primary'}
              fullWidth
              style={styles.cta}
              onPress={() => Linking.openURL(webUrl('/subscription') as string).catch(() => {})}
            />
          ) : (
            <Text variant="caption" style={styles.cta}>
              Plans are managed on the HueVista website.
            </Text>
          )}
        </Card>

        {/* Reward points: earned at the kiosk, bought at ₹1 each, spent here. */}
        <Text variant="label">Reward points</Text>
        {points.isLoading ? (
          <Text variant="caption">Loading…</Text>
        ) : pts ? (
          <>
            <View style={styles.tiles}>
              <StatTile label="Balance" value={pts.balance} tone="accent" style={styles.tile} />
              <StatTile
                label="Per kiosk sale"
                value={pts.pointsPerSale}
                hint={`₹${pts.rupeesPerPoint} per point to buy`}
                style={styles.tile}
              />
            </View>

            {pts.nextExpiringPoints != null && pts.nextExpiryAt ? (
              <Text variant="caption" color={colors.warning}>
                {pts.nextExpiringPoints} points expire {expiryText(pts.nextExpiryAt)} — points last{' '}
                {Math.round(pts.validityDays / 365)} year
                {pts.validityDays >= 730 ? 's' : ''} from the day they arrive.
              </Text>
            ) : null}

            <Card>
              <Text variant="label">One extra project</Text>
              <Text variant="bodySoft" style={{ marginTop: spacing.xs }}>
                {options.data
                  ? `${formatPoints(options.data.projectPricePoints)}, or ${formatPaise(
                      options.data.projectPricePaise,
                    )} by card. Points are the cheaper rail on every tier.`
                  : `${formatPoints(pts.projectPrice)} at your plan's rate.`}
              </Text>
              {buy.isSuccess ? (
                <Text variant="label" color={colors.success} style={styles.cta}>
                  Done ✓ — the project is on your allowance.
                </Text>
              ) : (
                <Button
                  label={
                    canAffordProject && options.data
                      ? `Spend ${formatPoints(options.data.projectPricePoints)}`
                      : 'Not enough points'
                  }
                  variant="secondary"
                  fullWidth
                  style={styles.cta}
                  disabled={!canAffordProject}
                  loading={buy.isPending}
                  onPress={() => buy.mutate()}
                />
              )}
              {buy.isError ? (
                <Text variant="caption" color={colors.danger}>
                  {userMessage(buy.error)}
                </Text>
              ) : null}
            </Card>
          </>
        ) : (
          <Card>
            <Text variant="bodySoft">
              Reward points are earned through your in-store kiosk link. Ask your distributor to set
              one up for your shop.
            </Text>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meter: { marginTop: spacing.sm, marginBottom: spacing.xs },
  breakdown: { marginTop: spacing.xs, gap: 2 },
  pdf: { marginTop: spacing.sm },
  cta: { marginTop: spacing.md },
  tiles: { flexDirection: 'row', gap: spacing.sm },
  tile: { flex: 1 },
});
