import { useState } from 'react';
import { View, StyleSheet, ScrollView, Share, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Screen,
  Text,
  Button,
  Card,
  SheetModal,
  Segmented,
  StatusPill,
  StatTile,
  BackLink,
} from '../src/components';
import { colors, spacing } from '../src/theme';
import {
  useCreateStoreLink,
  useMyOrg,
  useStoreLinks,
  useUpdateStoreLink,
  useWallet,
} from '../src/account/roleQueries';
import { formatPaise, formatPoints, userMessage, webUrl, type StoreLink } from '../src/api';

/**
 * The shop's kiosk link, and what it has earned.
 *
 * A kiosk link is the one way a shop takes money without anyone standing at the
 * counter: a walk-in opens the public URL, pays, and gets a code back. The app
 * already had the read calls for this in `retailApi` and no screen ever used
 * them, so the whole feature existed on the website only.
 *
 * The shop does not set the price, and there is deliberately no field for it
 * here: the kiosk price is one platform-wide setting and the payment is
 * HueVista's, with the shop rewarded in points per sale. What the shop chooses
 * is how long a purchased code lasts, and whether the link is live at all.
 */

const VALIDITY = [
  { value: '3', label: '3 days' },
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
];

export default function KioskScreen() {
  const org = useMyOrg();
  const orgId = org.data?.id;
  const links = useStoreLinks(orgId);
  const wallet = useWallet(orgId);
  const create = useCreateStoreLink(orgId);
  const update = useUpdateStoreLink(orgId);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [validDays, setValidDays] = useState('3');
  const [error, setError] = useState<string | null>(null);

  const rows = links.data ?? [];
  const w = wallet.data;

  /** The public URL a customer opens — the website's own kiosk route. */
  const publicUrl = (link: StoreLink) => webUrl(`/store/${link.slug}`);

  async function shareLink(link: StoreLink) {
    await Share.share({
      message:
        `Visualise your room with ${link.organizationName ?? 'us'} on HueVista.\n` +
        `${publicUrl(link)}\n` +
        `Pay once, and your code lasts ${link.validDays} days.`,
    }).catch(() => {});
  }

  async function submit() {
    setError(null);
    try {
      await create.mutateAsync(Number(validDays) || 3);
      setSheetOpen(false);
    } catch (err) {
      setError(userMessage(err));
    }
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={links.isRefetching || wallet.isRefetching}
            onRefresh={() => {
              links.refetch();
              wallet.refetch();
            }}
            tintColor={colors.accent}
          />
        }
      >
        <BackLink />

        <View style={styles.header}>
          <Text variant="title">Kiosk</Text>
          <Text variant="bodySoft">
            A public link anyone can buy a code from, without taking up your counter.
          </Text>
        </View>

        {w ? (
          <View style={styles.tiles}>
            <StatTile label="Points balance" value={formatPoints(w.pointsBalance)} />
            <StatTile label="Earned lifetime" value={formatPoints(w.lifetimePointsEarned)} />
          </View>
        ) : null}

        {w ? (
          <Card tone="quiet">
            <Text variant="caption">
              A walk-in pays {formatPaise(w.kioskPricePaise)} and you earn{' '}
              {formatPoints(w.pointsPerSale)} points on every sale. Points buy projects inside
              HueVista — they are spending power in the product, not a payout.
            </Text>
          </Card>
        ) : null}

        {links.isLoading ? (
          <Text variant="caption">Loading…</Text>
        ) : links.isError ? (
          <Card>
            <Text variant="body" color={colors.danger}>
              {userMessage(links.error)}
            </Text>
          </Card>
        ) : rows.length === 0 ? (
          <Card>
            <Text variant="bodySoft">
              No kiosk link yet. Publish one and you can put it on a poster, a bill or your shop&apos;s
              WhatsApp — customers buy their own code and you earn points on each one.
            </Text>
            <Button
              label="Publish a link"
              fullWidth
              style={styles.cta}
              onPress={() => setSheetOpen(true)}
            />
          </Card>
        ) : (
          rows.map((link) => (
            <Card key={link.id} style={styles.link}>
              <View style={styles.linkHead}>
                <Text variant="mono" numberOfLines={1} style={styles.slug}>
                  /store/{link.slug}
                </Text>
                <StatusPill
                  label={link.active ? 'Live' : 'Paused'}
                  tone={link.active ? 'done' : 'expired'}
                />
              </View>
              <Text variant="caption">
                {formatPaise(link.pricePaise)} per code · lasts {link.validDays} days ·{' '}
                {formatPoints(link.bonusPoints)} points to you per sale
              </Text>
              <View style={styles.linkActions}>
                <Button
                  label="Share"
                  variant="ghost"
                  icon={<Ionicons name="share-outline" size={16} color={colors.fg} />}
                  onPress={() => shareLink(link)}
                />
                <Button
                  label={link.active ? 'Pause' : 'Resume'}
                  variant="ghost"
                  loading={update.isPending}
                  onPress={() => update.mutate({ linkId: link.id, active: !link.active })}
                />
              </View>
            </Card>
          ))
        )}

        {w && w.recentPayments.length > 0 ? (
          <>
            <Text variant="label">Recent sales</Text>
            {w.recentPayments.map((p) => (
              <Card key={p.id} tone="quiet" style={styles.sale}>
                <View style={styles.saleHead}>
                  <Text variant="mono">{p.code ?? '—'}</Text>
                  <Text variant="caption" color={p.reversed ? colors.danger : colors.fgSoft}>
                    {p.reversed ? 'Refunded' : `+${formatPoints(p.bonusPoints)} pts`}
                  </Text>
                </View>
                <Text variant="caption">{formatPaise(p.amountPaise)}</Text>
              </Card>
            ))}
          </>
        ) : null}
      </ScrollView>

      <SheetModal visible={sheetOpen} onClose={() => setSheetOpen(false)} title="Publish a kiosk link">
        <View style={styles.sheet}>
          <Text variant="bodySoft">
            How long should a purchased code last? The price is set by HueVista and is the same for
            every shop — you earn points on each sale instead of a share of it.
          </Text>
          <Segmented
            options={VALIDITY}
            value={validDays}
            onChange={setValidDays}
            accessibilityLabel="How long a purchased code lasts"
          />
          {error ? (
            <Text variant="body" color={colors.danger}>
              {error}
            </Text>
          ) : null}
          <Button label="Publish" fullWidth loading={create.isPending} onPress={submit} />
        </View>
      </SheetModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  header: { gap: spacing.xs },
  tiles: { flexDirection: 'row', gap: spacing.md },
  cta: { marginTop: spacing.md },
  link: { gap: spacing.xs },
  linkHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  slug: { flex: 1 },
  linkActions: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  sale: { gap: 2 },
  saleHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheet: { gap: spacing.md },
});
