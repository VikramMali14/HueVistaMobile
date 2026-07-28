import { View, StyleSheet } from 'react-native';
import { Text, Card, Button, StatusPill, Meter } from '../components';
import { colors, spacing } from '../theme';
import { useMyEntitlement, useRequestMoreProjects } from './queries';

/** "in 4 days" / "today" / "expired" for an access window. */
export function expiryText(iso?: string | null): string | null {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return null;
  const days = Math.ceil((end - Date.now()) / 86_400_000);
  if (days < 0) return 'expired';
  if (days === 0) return 'today';
  return `in ${days} day${days === 1 ? '' : 's'}`;
}

/**
 * The customer's standing with their shop: projects left of what was assigned,
 * and when the access window closes.
 *
 * When the projects run out this offers to ASK the shop rather than to buy. A
 * shop-onboarded customer's projects were assigned by that shop and paid for out
 * of its quota — the shop can add another in one click, and selling the customer
 * a project direct would charge them for something the shop already owns.
 *
 * Renders nothing when no shop manages this account: a self-serve customer has
 * no allowance to report.
 */
export function EntitlementCard() {
  const { data: entitlement } = useMyEntitlement();
  const ask = useRequestMoreProjects();

  if (!entitlement) return null;

  const { projectAllowance, projectsCreated, projectsRemaining, accessExpiresAt, expired } = entitlement;
  const outOfProjects = projectsRemaining <= 0;
  const expiry = expiryText(accessExpiresAt);

  return (
    <Card>
      <View style={styles.head}>
        <Text variant="label">Your projects</Text>
        {expired ? (
          <StatusPill label="Access ended" tone="expired" />
        ) : outOfProjects ? (
          <StatusPill label="All used" tone="progress" />
        ) : (
          <StatusPill label={`${projectsRemaining} left`} tone="done" />
        )}
      </View>

      <Meter
        value={Math.min(projectsCreated, projectAllowance)}
        max={Math.max(projectAllowance, 1)}
        showCount={false}
        style={styles.meter}
      />
      <Text variant="caption">
        {projectsCreated} of {projectAllowance} used
        {expiry ? ` · access ends ${expiry}` : ''}
      </Text>

      {expired ? (
        <Text variant="bodySoft" style={styles.note}>
          Your access has ended. Ask your shop for a new code to carry on.
        </Text>
      ) : outOfProjects ? (
        <View style={styles.askBlock}>
          <Text variant="bodySoft">
            You&apos;ve used every project on your code. Your shop can add another from their counter.
          </Text>
          {ask.isSuccess ? (
            <Text variant="label" color={colors.success}>
              Asked ✓ — your shop has been notified.
            </Text>
          ) : (
            <>
              <Button
                label="Ask my shop for another"
                variant="secondary"
                fullWidth
                loading={ask.isPending}
                onPress={() => ask.mutate()}
              />
              {ask.isError ? (
                <Text variant="caption" color={colors.danger}>
                  Couldn&apos;t reach your shop just now. Please try again.
                </Text>
              ) : null}
            </>
          )}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  meter: { marginBottom: spacing.xs },
  note: { marginTop: spacing.sm },
  askBlock: { marginTop: spacing.md, gap: spacing.sm },
});
