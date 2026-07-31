import { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Screen, Text, Card, Button, Input, SheetModal, StatTile } from '../../src/components';
import { colors, spacing } from '../../src/theme';
import { AccountPanel } from '../../src/account/AccountPanel';
import { usePainterProfile, usePainterRetailers } from '../../src/account/roleQueries';
import { decimal, painterApi, userMessage } from '../../src/api';
import { useQueryClient } from '@tanstack/react-query';

/**
 * The painter's account: their trade details, the shops they work with, and the
 * shared account panel.
 *
 * Linking to another shop happens here because an invitation code is the only
 * way a painter joins one — there is no directory to browse, by design: the
 * relationship starts at the shop's counter.
 */
export default function PainterAccount() {
  const queryClient = useQueryClient();
  const profile = usePainterProfile();
  const retailers = usePainterRetailers();
  const p = profile.data;

  const [linkOpen, setLinkOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linked, setLinked] = useState<string | null>(null);

  async function redeem() {
    setBusy(true);
    setError(null);
    try {
      const link = await painterApi.redeemInvitation(code);
      setLinked(link.retailerName ?? 'the shop');
      setCode('');
      await queryClient.invalidateQueries({ queryKey: ['painter'] });
    } catch (err) {
      setError(userMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const rate = decimal(p?.dayRateInr);
  const rating = decimal(p?.rating);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="title">Account</Text>

        <AccountPanel>
          <View style={styles.tiles}>
            <StatTile
              label="Jobs done"
              value={p?.jobsCompleted ?? 0}
              tone="success"
              style={styles.tile}
            />
            <StatTile
              label="Rating"
              value={rating != null ? rating.toFixed(1) : '—'}
              hint={rating == null ? 'after your first job' : undefined}
              style={styles.tile}
            />
          </View>

          <Card>
            <Text variant="label">Your trade</Text>
            <Text variant="bodySoft" style={{ marginTop: spacing.xs }}>
              {p?.specialties?.length ? p.specialties.join(', ') : 'No specialities set'}
              {p?.yearsExperience ? ` · ${p.yearsExperience} years` : ''}
              {rate != null ? ` · ₹${rate.toLocaleString('en-IN')}/day` : ''}
            </Text>
            {p?.serviceAreas?.length ? (
              <Text variant="caption" style={{ marginTop: spacing.xs }}>
                Works in {p.serviceAreas.join(', ')}
              </Text>
            ) : null}
          </Card>

          <Card>
            <Text variant="label">Shops you work with</Text>
            {retailers.isLoading ? (
              <Text variant="caption" style={{ marginTop: spacing.xs }}>
                Loading…
              </Text>
            ) : (retailers.data ?? []).length === 0 ? (
              <Text variant="bodySoft" style={{ marginTop: spacing.xs }}>
                None yet. A shop gives you an invitation code — redeem it here and their jobs start
                arriving.
              </Text>
            ) : (
              (retailers.data ?? []).map((r) => (
                <Text key={r.id} variant="body" style={{ marginTop: spacing.xs }}>
                  {r.retailerName ?? 'Shop'}
                  {r.status && r.status !== 'ACCEPTED' ? ` · ${r.status.toLowerCase()}` : ''}
                </Text>
              ))
            )}
            <Button
              label="Add a shop's code"
              variant="secondary"
              fullWidth
              style={styles.action}
              onPress={() => setLinkOpen(true)}
            />
          </Card>
        </AccountPanel>
      </ScrollView>

      <SheetModal
        visible={linkOpen}
        onClose={() => {
          setLinkOpen(false);
          setLinked(null);
          setError(null);
        }}
        title="Join a shop"
      >
        {linked ? (
          <View style={styles.sheet}>
            <Text variant="body" color={colors.success}>
              You&apos;re linked to {linked} ✓
            </Text>
            <Button
              label="Done"
              fullWidth
              onPress={() => {
                setLinkOpen(false);
                setLinked(null);
              }}
            />
          </View>
        ) : (
          <View style={styles.sheet}>
            <Input
              label="Invitation code"
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              placeholder="From the shop's counter"
            />
            {error ? (
              <Text variant="body" color={colors.danger}>
                {error}
              </Text>
            ) : null}
            <Button
              label="Join"
              fullWidth
              loading={busy}
              disabled={!code.trim()}
              onPress={redeem}
            />
          </View>
        )}
      </SheetModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  tiles: { flexDirection: 'row', gap: spacing.sm },
  tile: { flex: 1 },
  action: { marginTop: spacing.md },
  sheet: { gap: spacing.md },
});
