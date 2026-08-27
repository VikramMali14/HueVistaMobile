import { useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Screen,
  Text,
  Card,
  Button,
  Segmented,
  StatusPill,
  AuthedImage,
  EmptyState,
  Swatch,
  Reveal,
  PressableScale,
} from '../../src/components';
import { colors, spacing, radius, hairline } from '../../src/theme';
import { useProjects } from '../../src/projects/queries';
import { useMyRenders, useShadeCodeScheme } from '../../src/account/queries';
import { useSavedShades, shadeKey } from '../../src/shades/savedShades';
import { shadeDisplay } from '../../src/shades/shadeCodes';
import { stepOfProject, STEP_INDEX, STEP_TOTAL } from '../../src/studio/roomStep';
import type { ProjectSummary } from '../../src/api';

type Shelf = 'rooms' | 'images' | 'shades';

const SHELVES: readonly { value: Shelf; label: string }[] = [
  { value: 'rooms', label: 'Rooms' },
  { value: 'images', label: 'AI images' },
  { value: 'shades', label: 'Saved' },
];

function when(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/**
 * Everything the customer has made.
 *
 * The design split this into "Boards" and "Saved shades". Two of the three
 * things a customer actually accumulates were missing from that: the rooms
 * themselves (a room outlives the board it produced, and is where a second board
 * comes from) and the AI images, which the design scattered across Home and the
 * board screen with no shelf of their own — so the only way back to an image you
 * made last week was to remember which room it came from.
 */
export default function Library() {
  const router = useRouter();
  const [shelf, setShelf] = useState<Shelf>('rooms');

  const projectsQuery = useProjects();
  const rendersQuery = useMyRenders();
  const { saved, loading: savedLoading, remove } = useSavedShades();
  const scheme = useShadeCodeScheme().data;

  const projects = projectsQuery.data ?? [];
  const renders = rendersQuery.data ?? [];

  const count =
    shelf === 'rooms' ? projects.length : shelf === 'images' ? renders.length : saved.length;

  return (
    <Screen scroll contentStyle={styles.content}>
      <Reveal>
        <View style={styles.head}>
          <Text variant="eyebrow">Library</Text>
          <Text variant="display">Everything you&apos;ve kept.</Text>
        </View>
      </Reveal>

      <Reveal index={1}>
        <View style={styles.tabs}>
          <Segmented
            options={SHELVES}
            value={shelf}
            onChange={setShelf}
            accessibilityLabel="What to show"
          />
          <Text variant="code" style={styles.count}>
            {count}
          </Text>
        </View>
      </Reveal>

      {shelf === 'rooms' ? (
        projectsQuery.isLoading ? (
          <Loading />
        ) : projects.length === 0 ? (
          <EmptyState
            icon="images-outline"
            title="No rooms yet."
            body="Photograph a wall and try a shade on it — every room you start is kept here."
          >
            <Button label="Start a room" fullWidth onPress={() => router.push('/studio/new')} />
          </EmptyState>
        ) : (
          <View style={styles.list}>
            {projects.map((p) => (
              <RoomRow key={p.id} project={p} onPress={() => router.push(`/studio/${p.id}`)} />
            ))}
          </View>
        )
      ) : shelf === 'images' ? (
        rendersQuery.isLoading ? (
          <Loading />
        ) : renders.length === 0 ? (
          <EmptyState
            icon="sparkles-outline"
            title="No AI images yet."
            body="Once a room has a colour board, you can have the scheme painted into a photorealistic picture of the room."
          >
            <Button
              label="Open a room"
              variant="secondary"
              fullWidth
              onPress={() => setShelf('rooms')}
            />
          </EmptyState>
        ) : (
          <View style={styles.list}>
            {renders.map((r) => (
              <Card
                key={r.id}
                padded={false}
                onPress={() => router.push(`/ai/${r.projectId}?render=${r.id}`)}
                style={styles.renderRow}
              >
                <AuthedImage
                  url={r.imageUrl}
                  style={styles.renderThumb}
                  contentFit="cover"
                  transition={150}
                />
                <View style={styles.renderBody}>
                  <Text variant="subhead" numberOfLines={1}>
                    {r.projectName ?? 'Your room'}
                  </Text>
                  <Text variant="caption" numberOfLines={1}>
                    {r.comboTitle ?? r.shades[0]?.shadeName ?? 'AI preview'}
                  </Text>
                  <View style={styles.swatchRow}>
                    {r.shades.slice(0, 4).map((s, i) => (
                      <View key={`${r.id}-${i}`} style={[styles.mini, { backgroundColor: s.hex }]} />
                    ))}
                    <Text variant="caption" style={styles.when}>
                      {when(r.completedAt ?? r.createdAt)}
                    </Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )
      ) : savedLoading ? (
        <Loading />
      ) : saved.length === 0 ? (
        <EmptyState
          icon="bookmark-outline"
          title="Nothing saved yet."
          body="Tap the bookmark on any shade to keep it here. Saved shades live on this phone, so they work with no signal at the counter."
        >
          <Button
            label="Browse the catalogue"
            variant="secondary"
            fullWidth
            onPress={() => router.push('/shades')}
          />
        </EmptyState>
      ) : (
        <>
          <View style={styles.grid}>
            {saved.map((s) => (
              <Swatch
                key={shadeKey(s)}
                hex={s.hex}
                label={scheme?.showNames === false ? undefined : s.name}
                code={shadeDisplay(scheme, { code: s.code, name: s.name }).label}
                size="lg"
                showScience
                style={styles.gridItem}
                onPress={() =>
                  router.push({
                    pathname: '/shade/[code]',
                    params: {
                      code: s.code,
                      name: s.name,
                      hex: s.hex,
                      brand: s.brand,
                      brandSlug: s.brandSlug ?? '',
                      family: s.family,
                    },
                  })
                }
                onLongPress={() => remove(s)}
              />
            ))}
          </View>
          <Text variant="caption">
            Kept on this phone. Press and hold a shade to remove it.
          </Text>
        </>
      )}
    </Screen>
  );
}

function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

function RoomRow({ project, onPress }: { project: ProjectSummary; onPress: () => void }) {
  const step = stepOfProject(project);
  const done = project.readOnly;
  return (
    <PressableScale
      onPress={onPress}
      haptic="tap"
      activeScale={0.98}
      accessibilityRole="button"
      accessibilityLabel={project.name ?? 'Untitled room'}
      style={styles.roomRow}
    >
      <AuthedImage
        url={project.cleanedImageUrl ?? project.imageUrl}
        style={styles.roomThumb}
        contentFit="cover"
        transition={150}
      />
      <View style={styles.roomBody}>
        <View style={styles.roomHead}>
          <Text variant="subhead" numberOfLines={1} style={styles.roomName}>
            {project.name ?? 'Untitled room'}
          </Text>
          {done ? (
            <StatusPill label="Finished" tone="done" />
          ) : (
            <Text variant="caption" color={colors.accentSoft}>
              Step {STEP_INDEX[step] + 1}/{STEP_TOTAL}
            </Text>
          )}
        </View>
        <Text variant="caption">
          {project.regionCount} {project.regionCount === 1 ? 'surface' : 'surfaces'}
          {when(project.updatedAt) ? ` · ${when(project.updatedAt)}` : ''}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: spacing.lg },
  head: { gap: spacing.sm },
  tabs: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  count: { minWidth: 20, textAlign: 'right' },
  loading: { paddingVertical: spacing.xxxl, alignItems: 'center' },
  list: { gap: spacing.sm },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.cardTight,
    borderWidth: hairline,
    borderColor: colors.glassEdgeSoft,
    backgroundColor: colors.glass,
  },
  roomThumb: {
    width: 92,
    height: 68,
    borderRadius: radius.chip,
    backgroundColor: colors.surface2,
  },
  roomBody: { flex: 1, gap: 3, paddingRight: spacing.sm },
  roomHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  roomName: { flex: 1 },
  renderRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.sm, gap: spacing.md },
  renderThumb: {
    width: 92,
    height: 68,
    borderRadius: radius.chip,
    backgroundColor: colors.surface2,
  },
  renderBody: { flex: 1, gap: 3, paddingRight: spacing.sm },
  swatchRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  mini: { width: 14, height: 14, borderRadius: 4 },
  when: { marginLeft: 'auto' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  gridItem: { width: '30%' },
});
