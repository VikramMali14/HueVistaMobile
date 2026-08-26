import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Screen,
  Text,
  Card,
  Button,
  BackLink,
  SettingsGroup,
  SettingsRow,
  Reveal,
  StatusPill,
} from '../src/components';
import { colors, spacing, radius, hairline } from '../src/theme';
import {
  useMyEntitlement,
  useAiCredits,
  usePdfAllowance,
  useRequestMoreProjects,
} from '../src/account/queries';
import { expiryText } from '../src/account';
import { formatPaise } from '../src/api';

/**
 * What you have, and how to get more.
 *
 * Which offer this screen makes depends on who is paying. A customer their shop
 * onboarded had their rooms assigned out of that shop's own quota — the shop can
 * add another in one click — so selling them a room direct would charge them for
 * something the shop already owns. They get an ask; everyone else gets a buy.
 *
 * The design listed three fixed products at ₹99, ₹249 and ₹29. Every one of
 * those is a real number the server holds and can change (the free-tier project
 * price, the AI credit price with its launch discount), so all of them are read
 * rather than printed. A hard-coded price is a promise the counter has to keep.
 */
export default function Credits() {
  const router = useRouter();
  const entitlement = useMyEntitlement().data;
  const credits = useAiCredits().data;
  const boards = usePdfAllowance().data;
  const ask = useRequestMoreProjects();

  const expiry = expiryText(entitlement?.accessExpiresAt);
  const shopManaged = !!entitlement;

  return (
    <Screen scroll contentStyle={styles.content}>
      <BackLink />

      <Reveal>
        <View style={styles.head}>
          <Text variant="eyebrow">Your account</Text>
          <Text variant="display">What you have.</Text>
        </View>
      </Reveal>

      <Reveal index={1}>
        <View style={styles.stats}>
          <Figure
            value={entitlement ? entitlement.projectsRemaining : '—'}
            label="Rooms left"
            note={
              entitlement
                ? `of ${entitlement.projectAllowance} on your code`
                : 'no shop allowance'
            }
          />
          <Figure
            value={credits?.balance ?? 0}
            label="AI images"
            note={credits ? `${credits.renderCost} credit per image` : undefined}
          />
        </View>
      </Reveal>

      {entitlement?.expired ? (
        <Reveal index={2}>
          <Card tone="feature" accent={colors.warm}>
            <View style={styles.warnHead}>
              <Ionicons name="time-outline" size={17} color={colors.warm} />
              <Text variant="subhead">Your access window has closed</Text>
            </View>
            <Text variant="bodySoft" style={styles.warnBody}>
              Your rooms are still here to look at, but they cannot be changed until your shop opens a
              new window.
            </Text>
          </Card>
        </Reveal>
      ) : expiry ? (
        <Reveal index={2}>
          <Text variant="caption">Your access runs out {expiry}.</Text>
        </Reveal>
      ) : null}

      <Reveal index={3} style={styles.section}>
        <Text variant="eyebrow">Get more</Text>

        {shopManaged ? (
          /* The shop assigned and paid for these rooms out of its own quota, so
             the honest button is "ask them", not "pay us again". */
          <Card>
            <Text variant="subhead">Ask {entitlement?.retailerOrgId ? 'your shop' : 'your shop'} for another room</Text>
            <Text variant="bodySoft" style={styles.cardBody}>
              They can add one to your code from the counter. You&apos;ll see it here as soon as they do.
            </Text>
            {ask.isSuccess ? (
              <View style={styles.asked}>
                <Ionicons name="checkmark-circle" size={17} color={colors.success} />
                <Text variant="label" color={colors.success}>
                  Asked — your shop has been notified.
                </Text>
              </View>
            ) : (
              <Button
                label="Ask my shop"
                variant="secondary"
                fullWidth
                style={styles.cardAction}
                loading={ask.isPending}
                onPress={() => ask.mutate()}
              />
            )}
          </Card>
        ) : null}

        <SettingsGroup>
          <SettingsRow
            icon="cube-outline"
            label="One room"
            hint="A photo, its walls, and one colour board"
            onPress={() => router.push('/buy?what=room')}
          />
          {credits?.eligible ? (
            <SettingsRow
              icon="sparkles-outline"
              label="AI images"
              hint={
                credits.discountPercent > 0
                  ? `${formatPaise(credits.pricePaise)} each — ${credits.discountPercent}% off at launch`
                  : `${formatPaise(credits.pricePaise)} each`
              }
              onPress={() => router.push('/buy?what=credits')}
            />
          ) : null}
        </SettingsGroup>

        <Text variant="caption">
          Nothing renews on its own — you buy a room when you need one. Prices include GST.
        </Text>
      </Reveal>

      {boards && boards.monthlyLimit > 0 ? (
        <Reveal index={4} style={styles.section}>
          <Text variant="eyebrow">Colour boards</Text>
          <Card tone="quiet">
            <View style={styles.boardRow}>
              <Text variant="bodySoft">Downloads left this month</Text>
              <StatusPill
                label={`${boards.remaining} of ${boards.monthlyLimit}`}
                tone={boards.remaining > 0 ? 'done' : 'progress'}
              />
            </View>
            <Text variant="caption" style={styles.cardBody}>
              Each board carries up to {boards.imagesPerPdf} combinations.
            </Text>
          </Card>
        </Reveal>
      ) : null}
    </Screen>
  );
}

function Figure({
  value,
  label,
  note,
}: {
  value: number | string;
  label: string;
  note?: string;
}) {
  return (
    <View style={styles.figure}>
      <Text variant="figure">{value}</Text>
      <Text variant="eyebrow">{label}</Text>
      {note ? <Text variant="caption">{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingTop: spacing.lg },
  head: { gap: spacing.sm },
  stats: { flexDirection: 'row', gap: spacing.sm },
  figure: {
    flex: 1,
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.cardTight,
    borderWidth: hairline,
    borderColor: colors.glassEdgeSoft,
    backgroundColor: colors.glass,
  },
  section: { gap: spacing.md },
  cardBody: { marginTop: spacing.xs },
  cardAction: { marginTop: spacing.md },
  asked: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  warnHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  warnBody: { marginTop: spacing.xs },
  boardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
});
