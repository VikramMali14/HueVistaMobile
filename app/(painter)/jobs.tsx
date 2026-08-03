import { View, StyleSheet, FlatList, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Serif, Text, Card, StatusPill } from '../../src/components';
import { colors, spacing, fontSize } from '../../src/theme';
import { usePainterJobs } from '../../src/account/roleQueries';
import { decimal, PaintJob } from '../../src/api';
import type { StatusTone } from '../../src/components';

/** A job's status as a pill: what it is, and how urgent it looks. */
export function jobTone(status: string): StatusTone {
  switch (status) {
    case 'PENDING':
      return 'new';
    case 'ACCEPTED':
    case 'IN_PROGRESS':
      return 'progress';
    case 'COMPLETED':
      return 'done';
    default:
      return 'expired';
  }
}

/** "IN_PROGRESS" → "In progress" — the backend's enum, said the way people do. */
export function jobLabel(status: string): string {
  const words = status.replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Pending first: a job waiting on an answer is the only one that is blocked. */
const ORDER = ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'DECLINED', 'CANCELLED'];
export function sortJobs(jobs: PaintJob[]): PaintJob[] {
  return [...jobs].sort((a, b) => {
    const rank = ORDER.indexOf(a.status) - ORDER.indexOf(b.status);
    if (rank !== 0) return rank;
    return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
  });
}

/**
 * The painter's job list.
 *
 * A job carries the room, the shades the customer approved, the litres, the site
 * address and the quote — everything needed to turn up and start. The list leads
 * with what is waiting on the painter, because that is the only thing here they
 * are blocking.
 */
export default function JobsScreen() {
  const router = useRouter();
  const jobs = usePainterJobs();
  const rows = sortJobs(jobs.data ?? []);

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="display">
        <Serif size={fontSize.display}>Jobs</Serif>
      </Text>
        <Text variant="bodySoft">
          {rows.filter((j) => j.status === 'PENDING').length} waiting on you
        </Text>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(j) => j.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={jobs.isRefetching}
            onRefresh={() => jobs.refetch()}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          jobs.isLoading ? (
            <Text variant="caption">Loading…</Text>
          ) : (
            <Card>
              <Text variant="bodySoft">
                No jobs yet. Once a shop you work with assigns you one, it shows up here with the
                approved colours and the site address.
              </Text>
            </Card>
          )
        }
        renderItem={({ item }) => {
          const litres = decimal(item.estimatedPaintLiters);
          const quote = decimal(item.quotedAmountInr);
          return (
            <Pressable onPress={() => router.push(`/job/${item.id}`)}>
              <Card style={styles.row}>
                <View style={styles.rowHead}>
                  <Text variant="heading" numberOfLines={1} style={styles.title}>
                    {item.projectName ?? 'Paint job'}
                  </Text>
                  <StatusPill label={jobLabel(item.status)} tone={jobTone(item.status)} />
                </View>
                <Text variant="caption" numberOfLines={1}>
                  {item.retailerName ?? 'Shop'}
                  {item.customerName ? ` · for ${item.customerName}` : ''}
                </Text>
                {item.siteAddress ? (
                  <Text variant="caption" numberOfLines={1} color={colors.fgSoft}>
                    {item.siteAddress}
                  </Text>
                ) : null}
                <Text variant="caption">
                  {litres != null ? `${litres} L` : '—'}
                  {quote != null ? ` · ₹${quote.toLocaleString('en-IN')}` : ''}
                  {item.estimatedDays ? ` · ${item.estimatedDays} days` : ''}
                </Text>
              </Card>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.xs },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  row: { gap: spacing.xs },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  title: { flexShrink: 1 },
});
