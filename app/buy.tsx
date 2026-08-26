import { useState } from 'react';
import { View, StyleSheet, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Text, Card, Button, BackLink, EmptyState } from '../src/components';
import { colors, spacing, radius, hairline } from '../src/theme';
import { formatPaise, webUrl } from '../src/api';
import { useAiCredits, useProjectPrice } from '../src/account/queries';

type What = 'room' | 'credits';

/**
 * Buying, honestly.
 *
 * Payment is a Razorpay Checkout web flow. The app carries no payment SDK and
 * adding one would mean owning card data on the handset, so this screen quotes
 * the real, server-held price and hands the browser the checkout — which is
 * exactly what the design's own copy promised ("Payment happens on Razorpay. You
 * come straight back here").
 *
 * Nothing here prints a number the server did not say. The room price is read
 * off the free tier (the rate an account with no plan actually pays) and the
 * image price off the wallet, discount included. A build with no website
 * configured says so and points at the counter rather than opening a guessed
 * URL — a dead link at the moment of payment is worse than no button.
 */
export default function Buy() {
  const router = useRouter();
  const params = useLocalSearchParams<{ what?: string }>();
  const what: What = params.what === 'credits' ? 'credits' : 'room';

  const credits = useAiCredits().data;
  const room = useProjectPrice();
  const [opening, setOpening] = useState(false);

  const isRoom = what === 'room';
  const pricePaise = isRoom ? room.pricePaise : (credits?.pricePaise ?? 0);
  const checkout = webUrl(isRoom ? '/pricing' : '/account?buy=ai-credits');
  const known = pricePaise > 0;

  async function pay() {
    if (!checkout) return;
    setOpening(true);
    try {
      await Linking.openURL(checkout);
    } finally {
      setOpening(false);
    }
  }

  if (!checkout) {
    return (
      <Screen scroll contentStyle={styles.content}>
        <BackLink />
        <EmptyState
          icon="card-outline"
          eyebrow="Not available here"
          title="Buying happens on the website."
          body="This build has no website address configured, so it can’t send you to checkout. Your paint shop can add a room to your code at the counter instead."
        >
          <Button label="Back" variant="secondary" fullWidth onPress={() => router.back()} />
        </EmptyState>
      </Screen>
    );
  }

  return (
    <Screen scroll contentStyle={styles.content}>
      <BackLink />

      <View style={styles.head}>
        <Text variant="eyebrow">Checkout</Text>
        <Text variant="display">{isRoom ? 'Buy one room.' : 'Buy AI images.'}</Text>
      </View>

      <Card>
        <Line
          label={isRoom ? 'One room' : `One AI image${credits?.renderCost === 1 ? '' : 's'}`}
          value={known ? formatPaise(pricePaise) : '—'}
        />
        <Line
          label={isRoom ? 'One colour board to take away' : 'One credit, one image'}
          value="Included"
          quiet
        />
        {isRoom ? <Line label="AI images" value="Bought separately" quiet /> : null}
        {!isRoom && credits && credits.discountPercent > 0 ? (
          <Line
            label={`Launch discount (${credits.discountPercent}%)`}
            value={`was ${formatPaise(credits.listPricePaise)}`}
            quiet
          />
        ) : null}
        <View style={styles.total}>
          <Text variant="subhead">
            {isRoom
              ? 'Total'
              : `Total per image${credits && credits.minPurchase > 1 ? `, min ${credits.minPurchase}` : ''}`}
          </Text>
          <Text variant="figure">{known ? formatPaise(pricePaise) : '—'}</Text>
        </View>
      </Card>

      <View style={styles.notice}>
        <Ionicons name="lock-closed-outline" size={15} color={colors.fgMute} />
        <Text variant="caption" style={styles.noticeText}>
          Payment happens on razorpay.com through the HueVista website, in your browser. Nothing about
          your card touches this app. Come back here when it&apos;s done — what you bought will be on
          your account.
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          label={known ? `Pay ${formatPaise(pricePaise)} on the website` : 'Open checkout'}
          size="lg"
          fullWidth
          loading={opening}
          onPress={pay}
        />
        <Button label="Not now" variant="secondary" fullWidth onPress={() => router.back()} />
      </View>

      <Text variant="caption">Prices include GST and are read live from your account.</Text>
    </Screen>
  );
}

function Line({ label, value, quiet }: { label: string; value: string; quiet?: boolean }) {
  return (
    <View style={styles.line}>
      <Text variant={quiet ? 'caption' : 'body'} style={styles.lineLabel}>
        {label}
      </Text>
      <Text variant={quiet ? 'caption' : 'code'} color={quiet ? colors.fgMute : colors.fg}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingTop: spacing.lg },
  head: { gap: spacing.sm },
  line: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  lineLabel: { flex: 1 },
  total: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: hairline,
    borderTopColor: colors.rule,
  },
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.cardTight,
    borderWidth: hairline,
    borderColor: colors.glassEdgeSoft,
    backgroundColor: colors.glass,
  },
  noticeText: { flex: 1 },
  actions: { gap: spacing.sm },
});
