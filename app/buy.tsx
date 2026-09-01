import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  Screen,
  Text,
  Card,
  Button,
  BackLink,
  EmptyState,
  PressableScale,
} from '../src/components';
import { colors, spacing, radius, hairline } from '../src/theme';
import { formatPaise, webUrl, buyProject, buyAiCredits, userMessage } from '../src/api';
import { useAiCredits, useProjectPrice } from '../src/account/queries';
import { haptics } from '../src/haptics';

type What = 'room' | 'credits';

/**
 * Buying, in the app.
 *
 * This screen used to quote a price and then hand the customer to the website
 * with `Linking.openURL`. That was a signpost, not a checkout: the browser it
 * opened carried no session, so someone who had just signed in on their phone
 * was asked to sign in again on a website to pay — at the one moment in the
 * product where a extra step costs real money — and nothing came back, so the
 * app never learned whether the payment had happened.
 *
 * It pays here now. The order is created against the app's own session and
 * priced server-side, Razorpay runs in a browser session that closes itself the
 * moment it is done, and the result is verified before this screen returns. What
 * was bought is on the account by the time the customer is looking at it.
 *
 * The card sheet is still a web page, and that is on purpose: Checkout is a web
 * library, and the alternative is a payment SDK holding card data on the
 * handset. Nothing about the card touches this app either way — which is what
 * the notice below has always promised, and now finally describes.
 */
export default function Buy() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ what?: string }>();
  const what: What = params.what === 'credits' ? 'credits' : 'room';

  const credits = useAiCredits().data;
  const room = useProjectPrice();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const isRoom = what === 'room';

  // A credit top-up has a floor, and it is the server's to set. Quoting the
  // per-image price while charging for the minimum would be the screen naming a
  // number the checkout then disagreed with.
  const min = Math.max(1, credits?.minPurchase ?? 1);
  const max = Math.max(min, credits?.maxPurchase ?? min);
  const [qty, setQty] = useState(min);
  const count = Math.min(Math.max(qty, min), max);

  const unitPaise = isRoom ? room.pricePaise : (credits?.pricePaise ?? 0);
  const totalPaise = isRoom ? unitPaise : unitPaise * count;
  const known = unitPaise > 0;

  // The sheet is a page on the website. With no web origin in the build there is
  // nowhere to open it, and saying so beats a dead link at the moment of payment.
  const canCheckout = webUrl('/pay/mobile') !== null;

  async function pay() {
    if (busy || !known) return;
    setError(null);
    setBusy(true);
    try {
      const outcome = isRoom ? await buyProject(1) : await buyAiCredits(count);
      if (outcome.status === 'cancelled') return;
      haptics.success();
      setDone(true);
      // What was bought is on the account now, so every counter reading from the
      // wallet, the plan or the project list is one payment out of date.
      await queryClient.invalidateQueries({ queryKey: ['billing'] });
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
    } catch (err) {
      haptics.error();
      setError(userMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!canCheckout) {
    return (
      <Screen scroll contentStyle={styles.content}>
        <BackLink />
        <EmptyState
          icon="card-outline"
          eyebrow="Not available here"
          title="Buying happens on the website."
          body="This build has no website address configured, so it can’t open checkout. Your paint shop can add a room to your code at the counter instead."
        >
          <Button label="Back" variant="secondary" fullWidth onPress={() => router.back()} />
        </EmptyState>
      </Screen>
    );
  }

  if (done) {
    return (
      <Screen scroll contentStyle={styles.content}>
        <EmptyState
          icon="checkmark-circle-outline"
          eyebrow="Paid"
          title={isRoom ? 'The room is yours.' : 'The images are on your account.'}
          body={
            isRoom
              ? 'It’s on your account now — start it whenever you have a photo of the room.'
              : `${count === 1 ? 'One image' : `${count} images`} added to your wallet. They never expire.`
          }
        >
          <Button label="Done" fullWidth onPress={() => router.back()} />
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
          label={isRoom ? 'One room' : 'One AI image'}
          value={known ? formatPaise(unitPaise) : '—'}
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

        {!isRoom ? (
          <View style={styles.qty}>
            <Text variant="body" style={styles.lineLabel}>
              How many
            </Text>
            <View style={styles.stepper}>
              <Step icon="remove" disabled={count <= min} onPress={() => setQty(count - 1)} />
              <Text variant="figure" style={styles.qtyValue}>
                {count}
              </Text>
              <Step icon="add" disabled={count >= max} onPress={() => setQty(count + 1)} />
            </View>
          </View>
        ) : null}

        <View style={styles.total}>
          <Text variant="subhead">Total</Text>
          <Text variant="figure">{known ? formatPaise(totalPaise) : '—'}</Text>
        </View>
      </Card>

      {error ? (
        <View style={styles.error}>
          <Ionicons name="alert-circle-outline" size={15} color={colors.dangerSoft} />
          <Text variant="caption" color={colors.dangerSoft} style={styles.noticeText}>
            {error}
          </Text>
        </View>
      ) : null}

      <View style={styles.notice}>
        <Ionicons name="lock-closed-outline" size={15} color={colors.fgMute} />
        <Text variant="caption" style={styles.noticeText}>
          Payment is handled by Razorpay, in a secure window. Nothing about your card touches this
          app. You stay signed in, and what you buy is on your account the moment it&apos;s done.
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          label={known ? `Pay ${formatPaise(totalPaise)}` : 'Open checkout'}
          size="lg"
          fullWidth
          loading={busy}
          disabled={!known}
          onPress={pay}
        />
        <Button label="Not now" variant="secondary" fullWidth onPress={() => router.back()} />
      </View>

      <Text variant="caption">Prices include GST and are read live from your account.</Text>
    </Screen>
  );
}

function Step({
  icon,
  disabled,
  onPress,
}: {
  icon: 'add' | 'remove';
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic="tap"
      activeScale={0.9}
      accessibilityRole="button"
      accessibilityLabel={icon === 'add' ? 'One more' : 'One fewer'}
      style={[styles.step, disabled && styles.stepOff]}
    >
      <Ionicons name={icon} size={18} color={disabled ? colors.fgMute : colors.fg} />
    </PressableScale>
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
  qty: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  qtyValue: { minWidth: 40, textAlign: 'center' },
  step: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: hairline,
    borderColor: colors.glassEdgeSoft,
    backgroundColor: colors.glass,
  },
  stepOff: { opacity: 0.4 },
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
  error: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  noticeText: { flex: 1 },
  actions: { gap: spacing.sm },
});
