import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Text, Card, StatusPill, AuthedImage } from '../../src/components';
import { colors, spacing, radius } from '../../src/theme';
import { useSession } from '../../src/auth';
import { SAMPLE_SHADES } from '../../src/shades/sampleShades';
import { usePopularShades } from '../../src/shades/queries';
import { summaryToShade, Shade } from '../../src/shades/types';
import { useProjects } from '../../src/projects/queries';
import { EntitlementCard } from '../../src/account';
import { useShadeCodeScheme } from '../../src/account/queries';
import { shadeDisplay } from '../../src/shades/shadeCodes';

export default function Home() {
  const router = useRouter();
  const { user } = useSession();
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  // How this shop wants colours labelled (its own codes; names hidden or not).
  const scheme = useShadeCodeScheme().data;

  // The three most recently touched rooms — resuming beats starting over.
  const recent = (useProjects().data ?? []).slice(0, 3);

  // Live popular shades, with the local sample as a first-load / offline fallback.
  const popularQuery = usePopularShades(10);
  const livePopular = (popularQuery.data ?? [])
    .map(summaryToShade)
    .filter((s): s is Shade => s !== null);
  const usingSample = livePopular.length === 0;
  const popular = usingSample ? SAMPLE_SHADES.slice(0, 8) : livePopular.slice(0, 10);

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.greeting}>
        <Text variant="bodySoft">Hi {firstName} 👋</Text>
        <Text variant="title">What are we painting today?</Text>
      </View>

      {/* What the shop assigned: projects left, access window, ask-for-more. */}
      <EntitlementCard />

      {/* Primary CTA — the core loop starts here. */}
      <Pressable onPress={() => router.push('/new-project')} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}>
        <Card style={styles.cta}>
          <View style={styles.ctaIcon}>
            <Ionicons name="sparkles" size={22} color={colors.accentSoft} />
          </View>
          <View style={styles.ctaText}>
            <Text variant="heading">Visualize a room</Text>
            <Text variant="bodySoft">Take a photo and try real shades on your walls.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.fgMute} />
        </Card>
      </Pressable>

      {/* Recent projects — resume where the last visit left off. */}
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text variant="label">Recent projects</Text>
          {recent.length > 0 ? (
            <Pressable onPress={() => router.push('/projects')} hitSlop={8}>
              <Text variant="label" color={colors.accentSoft}>
                See all
              </Text>
            </Pressable>
          ) : null}
        </View>
        {recent.length === 0 ? (
          <Card>
            <Text variant="bodySoft">Your saved rooms will show up here once you create one.</Text>
          </Card>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
            {recent.map((p) => (
              <Pressable key={p.id} onPress={() => router.push(`/project/${p.id}`)} style={styles.recentCard}>
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
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Popular shades strip — taps into the visualizer. */}
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text variant="label">Popular shades</Text>
          {usingSample ? <StatusPill label="Sample" tone="neutral" /> : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {popular.map((shade) => (
            <Pressable
              key={`${shade.brandSlug ?? ''}-${shade.code}`}
              onPress={() =>
                router.push({
                  pathname: '/visualize',
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
              style={styles.chip}
            >
              <View style={[styles.swatch, { backgroundColor: shade.hex }]} />
              <Text variant="caption" numberOfLines={1} style={styles.chipLabel}>
                {shadeDisplay(scheme, { code: shade.code, name: shade.name }).label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingTop: spacing.xl },
  greeting: { gap: spacing.xs },
  cta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ctaIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.button,
    backgroundColor: colors.accentGhost,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { flex: 1, gap: 2 },
  section: { gap: spacing.sm },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  strip: { gap: spacing.md, paddingVertical: spacing.xs },
  chip: { width: 84, gap: spacing.xs },
  recentCard: { width: 150, gap: spacing.xs },
  recentThumb: {
    width: 150,
    aspectRatio: 4 / 3,
    borderRadius: radius.card,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  swatch: { width: 84, height: 60, borderRadius: radius.card, borderWidth: 1, borderColor: colors.rule },
  chipLabel: { textAlign: 'center' },
});
