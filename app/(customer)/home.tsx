import { View, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Screen,
  Text,
  Serif,
  Card,
  StatusPill,
  AuthedImage,
  AuraOrb,
  Reveal,
  PressableScale,
  SectionHeader,
} from '../../src/components';
import { colors, spacing, radius, alpha, fontSize } from '../../src/theme';
import { useSession } from '../../src/auth';
import { SAMPLE_SHADES } from '../../src/shades/sampleShades';
import { usePopularShades } from '../../src/shades/queries';
import { summaryToShade, Shade } from '../../src/shades/types';
import { useProjects } from '../../src/projects/queries';
import { EntitlementCard } from '../../src/account';
import { useMyEntitlement, useShadeCodeScheme } from '../../src/account/queries';
import { shadeDisplay } from '../../src/shades/shadeCodes';

export default function Home() {
  const router = useRouter();
  const { user } = useSession();
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  // How this shop wants colours labelled (its own codes; names hidden or not).
  const scheme = useShadeCodeScheme().data;

  // The three most recently touched rooms — resuming beats starting over.
  const recent = (useProjects().data ?? []).slice(0, 3);

  /**
   * A shop-managed customer has an allowance worth leading with, so it becomes
   * the screen's hero figure. A self-serve customer has none, and gets the
   * headline alone rather than an orb reading "0 of 0".
   */
  const entitlement = useMyEntitlement().data;

  // Live popular shades, with the local sample as a first-load / offline fallback.
  const popularQuery = usePopularShades(10);
  const livePopular = (popularQuery.data ?? [])
    .map(summaryToShade)
    .filter((s): s is Shade => s !== null);
  const usingSample = livePopular.length === 0;
  const popular = usingSample ? SAMPLE_SHADES.slice(0, 8) : livePopular.slice(0, 10);

  return (
    <Screen scroll contentStyle={styles.content}>
      <Reveal>
        <Text variant="bodySoft">Hi {firstName}</Text>
        <Text variant="display" style={styles.greeting}>
          What are we <Serif size={fontSize.display}>painting</Serif> today?
        </Text>
      </Reveal>

      {entitlement ? (
        <Reveal index={1} style={styles.orbWrap}>
          <AuraOrb
            size={200}
            progress={
              entitlement.projectAllowance > 0
                ? entitlement.projectsRemaining / entitlement.projectAllowance
                : 0
            }
            value={entitlement.projectsRemaining}
            label="Projects left"
            caption={`of ${entitlement.projectAllowance} on your code`}
            color={entitlement.expired ? colors.danger : colors.accent}
          />
        </Reveal>
      ) : null}

      {/* Primary CTA — the core loop starts here. */}
      <Reveal index={2}>
        <PressableScale onPress={() => router.push('/new-project')} haptic="press" activeScale={0.975}>
          <Card accent={colors.accent} style={styles.cta}>
            <View style={styles.ctaIcon}>
              <Ionicons name="sparkles" size={22} color={colors.accentSoft} />
            </View>
            <View style={styles.ctaText}>
              <Text variant="heading">Visualize a room</Text>
              <Text variant="bodySoft">Take a photo and try real shades on your walls.</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.fgMute} />
          </Card>
        </PressableScale>
      </Reveal>

      {/* What the shop assigned: access window, and the ask when it runs out.
          The orb above already carries the count, so this sits under the CTA. */}
      <Reveal index={3}>
        <EntitlementCard />
      </Reveal>

      {/* Recent projects — resume where the last visit left off. */}
      <Reveal index={4} style={styles.section}>
        <SectionHeader
          title="Recent projects"
          actionLabel={recent.length > 0 ? 'See all' : undefined}
          onAction={recent.length > 0 ? () => router.push('/projects') : undefined}
        />
        {recent.length === 0 ? (
          <Card>
            <Text variant="bodySoft">Your saved rooms will show up here once you create one.</Text>
          </Card>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
            {recent.map((p) => (
              <PressableScale
                key={p.id}
                onPress={() => router.push(`/project/${p.id}`)}
                haptic="tap"
                activeScale={0.95}
                style={styles.recentCard}
              >
                {/* Masks align to the cleaned photo, so that is the truer thumbnail. */}
                <AuthedImage
                  url={p.cleanedImageUrl ?? p.imageUrl}
                  style={styles.recentThumb}
                  contentFit="cover"
                  transition={150}
                />
                <Text variant="label" numberOfLines={1}>
                  {p.name ?? 'Untitled room'}
                </Text>
                {p.readOnly ? <StatusPill label="View only" tone="expired" /> : null}
              </PressableScale>
            ))}
          </ScrollView>
        )}
      </Reveal>

      {/* Popular shades strip — taps into the visualizer. */}
      <Reveal index={5} style={styles.section}>
        <SectionHeader
          title="Popular shades"
          trailing={usingSample ? <StatusPill label="Sample" tone="neutral" /> : undefined}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {popular.map((shade) => (
            <PressableScale
              key={`${shade.brandSlug ?? ''}-${shade.code}`}
              onPress={() =>
                router.push({
                  pathname: '/studio',
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
              haptic="select"
              activeScale={0.93}
              style={styles.chip}
            >
              <View
                style={[
                  styles.swatch,
                  {
                    backgroundColor: shade.hex,
                    shadowColor: shade.hex,
                    borderColor: alpha(shade.hex, 0.5),
                  },
                ]}
              />
              <Text variant="caption" numberOfLines={1} style={styles.chipLabel}>
                {shadeDisplay(scheme, { code: shade.code, name: shade.name }).label}
              </Text>
            </PressableScale>
          ))}
        </ScrollView>
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingTop: spacing.xl },
  greeting: { marginTop: spacing.xs },
  orbWrap: { alignItems: 'center', paddingVertical: spacing.sm },
  cta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ctaIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.button,
    backgroundColor: colors.accentGhost,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { flex: 1, gap: 2 },
  section: { gap: spacing.md },
  strip: { gap: spacing.md, paddingVertical: spacing.xs },
  chip: { width: 88, gap: spacing.xs },
  recentCard: { width: 156, gap: spacing.xs },
  recentThumb: {
    width: 156,
    aspectRatio: 4 / 3,
    borderRadius: radius.card,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.glassEdge,
    marginBottom: spacing.xs,
  },
  swatch: {
    width: 88,
    height: 68,
    borderRadius: radius.cardTight,
    borderWidth: 1,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  chipLabel: { textAlign: 'center' },
});
