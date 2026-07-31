import { useState } from 'react';
import { View, StyleSheet, Pressable, Linking, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, Text, Card, Button, StatusPill, Input, SheetModal } from '../../src/components';
import { colors, spacing } from '../../src/theme';
import { useJob, useJobAction } from '../../src/account/roleQueries';
import { decimal, userMessage } from '../../src/api';
import { jobLabel, jobTone } from '../(painter)/jobs';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="label">{label}</Text>
      <Text variant="body" style={styles.rowValue}>
        {value}
      </Text>
    </View>
  );
}

/**
 * One job, and the move that is available from where it stands.
 *
 * Each transition is its own backend endpoint, so this screen offers the ONE
 * that is legal now rather than a row of buttons that mostly 409. Declining asks
 * for a reason, because a job that comes back without one leaves the shop with
 * nothing to tell the customer.
 */
export default function JobDetail() {
  const raw = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(raw.id) ? raw.id[0] : raw.id;
  const router = useRouter();

  const { data: job, isLoading } = useJob(id);
  const act = useJobAction(id);

  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const litres = decimal(job?.estimatedPaintLiters);
  const area = decimal(job?.estimatedAreaSqft);
  const quote = decimal(job?.quotedAmountInr);

  async function run(type: 'accept' | 'start' | 'complete') {
    setError(null);
    try {
      await act.mutateAsync({ type });
    } catch (err) {
      setError(userMessage(err));
    }
  }

  async function decline() {
    setError(null);
    try {
      await act.mutateAsync({ type: 'decline', reason: reason.trim() || 'Not available' });
      setDeclineOpen(false);
      setReason('');
    } catch (err) {
      setError(userMessage(err));
    }
  }

  /** Open the site in whichever maps app the phone has. */
  function navigate(address: string) {
    const q = encodeURIComponent(address);
    const url = Platform.select({
      ios: `maps://?q=${q}`,
      default: `geo:0,0?q=${q}`,
    });
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://maps.google.com/?q=${q}`).catch(() => {}),
    );
  }

  return (
    <Screen scroll contentStyle={styles.content}>
      <Pressable onPress={() => router.back()} hitSlop={12}>
        <Text variant="label" color={colors.fgSoft}>
          ‹ Jobs
        </Text>
      </Pressable>

      {isLoading || !job ? (
        <Text variant="caption">Loading…</Text>
      ) : (
        <>
          <View style={styles.head}>
            <Text variant="title" numberOfLines={2}>
              {job.projectName ?? 'Paint job'}
            </Text>
            <StatusPill label={jobLabel(job.status)} tone={jobTone(job.status)} />
          </View>

          <Card>
            <Row label="Shop" value={job.retailerName ?? '—'} />
            {job.customerName ? <Row label="Customer" value={job.customerName} /> : null}
            {area != null ? <Row label="Area" value={`${area} sq ft`} /> : null}
            {litres != null ? <Row label="Paint" value={`${litres} litres`} /> : null}
            {quote != null ? <Row label="Quote" value={`₹${quote.toLocaleString('en-IN')}`} /> : null}
            {job.estimatedDays ? <Row label="Estimate" value={`${job.estimatedDays} days`} /> : null}
          </Card>

          {job.siteAddress ? (
            <Card>
              <Text variant="label">Site</Text>
              <Text variant="body" style={{ marginTop: spacing.xs }}>
                {job.siteAddress}
              </Text>
              <Button
                label="Open in maps"
                variant="secondary"
                fullWidth
                style={styles.action}
                onPress={() => navigate(job.siteAddress as string)}
              />
            </Card>
          ) : null}

          {/* The approved colours live on the project, so the room itself is one
              tap away — a painter standing on site needs the shades, not a list. */}
          {job.projectId ? (
            <Button
              label="See the room and its colours"
              variant="secondary"
              fullWidth
              onPress={() => router.push(`/project/${job.projectId}`)}
            />
          ) : null}

          {job.notes ? (
            <Card>
              <Text variant="label">Notes</Text>
              <Text variant="bodySoft" style={{ marginTop: spacing.xs }}>
                {job.notes}
              </Text>
            </Card>
          ) : null}

          {job.declineReason ? (
            <Card>
              <Text variant="label" color={colors.danger}>
                Declined
              </Text>
              <Text variant="bodySoft" style={{ marginTop: spacing.xs }}>
                {job.declineReason}
              </Text>
            </Card>
          ) : null}

          {error ? (
            <Text variant="body" color={colors.danger}>
              {error}
            </Text>
          ) : null}

          {/* Exactly the move that is legal from here. */}
          {job.status === 'PENDING' ? (
            <View style={styles.actions}>
              <Button
                label="Accept this job"
                size="lg"
                fullWidth
                loading={act.isPending}
                onPress={() => run('accept')}
              />
              <Button
                label="Decline"
                variant="secondary"
                fullWidth
                onPress={() => setDeclineOpen(true)}
              />
            </View>
          ) : job.status === 'ACCEPTED' ? (
            <Button
              label="Start work"
              size="lg"
              fullWidth
              loading={act.isPending}
              onPress={() => run('start')}
            />
          ) : job.status === 'IN_PROGRESS' ? (
            <Button
              label="Mark complete"
              size="lg"
              fullWidth
              loading={act.isPending}
              onPress={() => run('complete')}
            />
          ) : null}
        </>
      )}

      <SheetModal
        visible={declineOpen}
        onClose={() => setDeclineOpen(false)}
        title="Decline this job"
      >
        <View style={styles.sheet}>
          <Text variant="bodySoft">
            The shop passes your reason on to the customer, so a line about why helps them far more
            than a bare refusal.
          </Text>
          <Input
            label="Reason"
            value={reason}
            onChangeText={setReason}
            placeholder="Booked that week, too far, …"
            multiline
          />
          <Button label="Decline" fullWidth loading={act.isPending} onPress={decline} />
        </View>
      </SheetModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 4 },
  rowValue: { flexShrink: 1, textAlign: 'right' },
  action: { marginTop: spacing.md },
  actions: { gap: spacing.sm },
  sheet: { gap: spacing.md },
});
