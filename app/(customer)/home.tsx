import { useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Screen,
  Text,
  Card,
  AuthedImage,
  Reveal,
  PressableScale,
  SectionHeader,
  Swatch,
} from '../../src/components';
import { colors, spacing, radius, hairline } from '../../src/theme';
import { useSession } from '../../src/auth';
import { usePopularShades } from '../../src/shades/queries';
import { summaryToShade, Shade } from '../../src/shades/types';
import { useProjects } from '../../src/projects/queries';
import {
  useMyEntitlement,
  useShadeCodeScheme,
  useAiCredits,
  useMyRenders,
} from '../../src/account/queries';
import { shadeDisplay } from '../../src/shades/shadeCodes';
import { expiryText } from '../../src/account';
import { stepOfProject, STEP_INDEX, STEP_TOTAL } from '../../src/studio/roomStep';
import type { ProjectSummary } from '../../src/api';

/** "Good evening" reads oddly at 4pm; three bands is as far as a clock can honestly go. */
function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Home() {
  const router = useRouter();
  const { user } = useSession();
  const firstName = user?.name?.trim().split(' ')[0] ?? 'there';

  // How this shop wants colours labelled (its own codes; names hidden or not).
  const scheme = useShadeCodeScheme().data;

  const entitlement = useMyEntitlement().data;
  const credits = useAiCredits().data;
  const projectsQuery = useProjects();
  const projects = projectsQuery.data;
  const renders = useMyRenders().data ?? [];

  /**
   * Rooms still being worked on lead; finished ones live in the Library. A room
   * is "in progress" until its last board is spent, which is what `readOnly`
   * marks — so this is the list of things the customer can still change.
   */
  const inProgress = useMemo(
    () => (projects ?? []).filter((p) => !p.readOnly).slice(0, 6),
    [projects],
  );
  const latestRender = renders[0];

  /**
   * Popular shades, from the catalogue and nowhere else.
   *
   * This strip used to fall back to a dozen invented colours — "Morning Glow",
   * "Terracotta Rise" — carrying real brand names and codes that exist in no
   * catalogue. On a slow first launch that is what a customer saw, and tapping
   * one opened a shade detail page for a colour their shop cannot sell and their
   * counter cannot look up. A "Sample" pill on the header does not fix that: the
   * chips were still the wrong answer to "what can I paint this wall".
   *
   * So there is no fallback. Until the catalogue answers, the strip is simply
   * not on the screen, and everything in it is a shade someone can buy.
   */
  const popularQuery = usePopularShades(10);
  const popular = (popularQuery.data ?? [])
    .map(summaryToShade)
    .filter((s): s is Shade => s !== null)
    .slice(0, 10);

  /**
   * Nothing to work with: no shop allowance and nothing bought. This is a
   * different screen, not a smaller one — the job is to explain the two ways in,
   * not to show an empty shelf where the rooms would be.
   */
  const hasNothing = !entitlement && (projects?.length ?? 0) === 0;
  const expiry = expiryText(entitlement?.accessExpiresAt);
  const outOfProjects = (entitlement?.projectsRemaining ?? 0) <= 0 && !!entitlement;

  return (
    <Screen scroll contentStyle={styles.content}>
      <Reveal>
        <View style={styles.head}>
          {entitlement?.customerName || expiry ? (
            <Text variant="eyebrow">
              {[entitlement?.expired ? 'Access ended' : expiry ? `Access ends ${expiry}` : null]
                .filter(Boolean)
                .join(' · ') || 'Your account'}
            </Text>
          ) : (
            <Text variant="eyebrow">{hasNothing ? 'No shop linked' : 'Your account'}</Text>
          )}
          <Text variant="display">
            {greeting()}, {firstName}.
          </Text>
        </View>
      </Reveal>

      {/* Two numbers, and only when either means something. A pair of zeroes
          under a greeting is a worse welcome than no numbers at all. */}
      {entitlement || (credits?.balance ?? 0) > 0 ? (
        <Reveal index={1}>
          <View style={styles.stats}>
            <Stat
              value={entitlement ? entitlement.projectsRemaining : '—'}
              label="Rooms left"
              muted={outOfProjects}
              onPress={() => router.push('/credits')}
            />
            <Stat
              value={credits?.balance ?? 0}
              label="AI images"
              muted={(credits?.balance ?? 0) === 0}
              onPress={() => router.push('/credits')}
            />
          </View>
        </Reveal>
      ) : null}

      {/* The one lit card on the screen. Which offer it makes depends on
          whether they can actually start a room right now. */}
      <Reveal index={2}>
        {hasNothing || outOfProjects || entitlement?.expired ? (
          <Card
            tone="feature"
            onPress={() => router.push(entitlement ? '/credits' : '/redeem-code')}
            style={styles.cta}
          >
            <View style={styles.ctaText}>
              <Text variant="heading">
                {entitlement ? 'Get another room' : 'Redeem a shop code'}
              </Text>
              <Text variant="caption">
                {entitlement
                  ? entitlement.expired
                    ? 'Your access window has closed'
                    : `All ${entitlement.projectAllowance} rooms on your code are used`
                  : 'The six characters from the counter'}
              </Text>
            </View>
            <View style={styles.ctaGo}>
              <Ionicons name="arrow-forward" size={19} color={colors.onFill} />
            </View>
          </Card>
        ) : (
          <Card tone="feature" onPress={() => router.push('/studio/new')} style={styles.cta}>
            <View style={styles.ctaText}>
              <Text variant="heading">Start a room</Text>
              <Text variant="caption">Photograph a wall, pick a shade</Text>
            </View>
            <View style={styles.ctaGo}>
              <Ionicons name="arrow-forward" size={19} color={colors.onFill} />
            </View>
          </Card>
        )}
      </Reveal>

      {hasNothing ? (
        <Reveal index={3}>
          <Card onPress={() => router.push('/buy')} style={styles.buyRow}>
            <View style={styles.ctaText}>
              <Text variant="subhead">Buy a room</Text>
              <Text variant="caption">One room, one colour board</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.fgMute} />
          </Card>
        </Reveal>
      ) : null}

      {inProgress.length > 0 ? (
        <Reveal index={3} style={styles.section}>
          <SectionHeader
            title="Rooms in progress"
            trailing={<Text variant="code">{inProgress.length}</Text>}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.strip}
          >
            {inProgress.map((p) => (
              <RoomCard key={p.id} project={p} onPress={() => router.push(`/studio/${p.id}`)} />
            ))}
          </ScrollView>
        </Reveal>
      ) : null}

      {latestRender?.imageUrl ? (
        <Reveal index={4} style={styles.section}>
          <SectionHeader title="Your latest AI image" />
          <Card
            padded={false}
            onPress={() => router.push('/library')}
            style={styles.renderRow}
          >
            <AuthedImage
              url={latestRender.imageUrl}
              style={styles.renderThumb}
              contentFit="cover"
              transition={150}
            />
            <View style={styles.renderText}>
              <Text variant="subhead" numberOfLines={1}>
                {latestRender.projectName ?? 'Your room'}
              </Text>
              <Text variant="caption" numberOfLines={1}>
                {latestRender.comboTitle ?? latestRender.shades[0]?.shadeName ?? 'AI preview'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.fgMute} style={styles.renderGo} />
          </Card>
        </Reveal>
      ) : null}

      {popular.length > 0 ? (
      <Reveal index={5} style={styles.section}>
        <SectionHeader title="Popular shades" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {popular.map((shade) => (
            <Swatch
              key={`${shade.brandSlug ?? ''}-${shade.code}`}
              hex={shade.hex}
              code={shadeDisplay(scheme, { code: shade.code, name: shade.name }).label}
              size="lg"
              showScience
              style={styles.popularChip}
              onPress={() =>
                router.push({
                  pathname: '/shade/[code]',
                  params: {
                    code: shade.code,
                    name: shade.name,
                    hex: shade.hex,
                    brand: shade.brand,
                    brandSlug: shade.brandSlug ?? '',
                    family: shade.family,
                  },
                })
              }
            />
          ))}
        </ScrollView>
      </Reveal>
      ) : null}
    </Screen>
  );
}

/** One of the two figures under the greeting. */
function Stat({
  value,
  label,
  muted,
  onPress,
}: {
  value: number | string;
  label: string;
  muted?: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      haptic="tap"
      activeScale={0.97}
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
      style={styles.stat}
    >
      <Text variant="figure" color={muted ? colors.fgMute : colors.fg}>
        {value}
      </Text>
      <Text variant="eyebrow">{label}</Text>
    </PressableScale>
  );
}

/** A room in progress, with how far through the pipeline it is. */
function RoomCard({ project, onPress }: { project: ProjectSummary; onPress: () => void }) {
  const step = stepOfProject(project);
  return (
    <PressableScale
      onPress={onPress}
      haptic="tap"
      activeScale={0.96}
      accessibilityRole="button"
      accessibilityLabel={`${project.name ?? 'Untitled room'}, step ${STEP_INDEX[step] + 1} of ${STEP_TOTAL}`}
      style={styles.roomCard}
    >
      <AuthedImage
        url={project.cleanedImageUrl ?? project.imageUrl}
        style={styles.roomThumb}
        contentFit="cover"
        transition={150}
      />
      <View style={styles.roomBody}>
        <Text variant="subhead" numberOfLines={1}>
          {project.name ?? 'Untitled room'}
        </Text>
        <Text variant="caption" color={colors.accentSoft}>
          Step {STEP_INDEX[step] + 1} of {STEP_TOTAL}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingTop: spacing.lg },
  head: { gap: spacing.sm },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.cardTight,
    borderWidth: hairline,
    borderColor: colors.glassEdgeSoft,
    backgroundColor: colors.glass,
  },
  cta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ctaText: { flex: 1, gap: 3 },
  ctaGo: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  section: { gap: spacing.md },
  strip: { gap: spacing.md, paddingVertical: spacing.xs },
  roomCard: {
    width: 154,
    borderRadius: radius.cardTight,
    borderWidth: hairline,
    borderColor: colors.glassEdgeSoft,
    backgroundColor: colors.glass,
    overflow: 'hidden',
  },
  roomThumb: {
    width: '100%',
    height: 100,
    backgroundColor: colors.surface2,
  },
  roomBody: { padding: spacing.md, gap: 3 },
  renderRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.sm, gap: spacing.md },
  renderThumb: {
    width: 100,
    height: 64,
    borderRadius: radius.chip,
    backgroundColor: colors.surface2,
  },
  renderText: { flex: 1, gap: 3 },
  renderGo: { marginRight: spacing.sm },
  popularChip: { width: 92 },
});
