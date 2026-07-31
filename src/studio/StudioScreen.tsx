import { useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useImage } from '@shopify/react-native-skia';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Screen, Text, Card, Button, StatusPill, AuthedImage } from '../components';
import type { StatusTone } from '../components';
import { colors, spacing, radius } from '../theme';
import { RecolorCanvas } from '../engine';
import { SAMPLE_SHADES } from '../shades/sampleShades';
import { Shade } from '../shades/types';
import { shadeDisplay } from '../shades/shadeCodes';
import { useShadeCodeScheme } from '../account/queries';
import { EntitlementCard } from '../account';
import { useProjects } from '../projects/queries';
import type { ProjectSummary } from '../api';

function statusTone(status: string): StatusTone {
  switch (status) {
    case 'SEGMENTED':
      return 'done';
    case 'SEGMENTING':
      return 'progress';
    case 'FAILED':
      return 'expired';
    default:
      return 'neutral';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'CREATED':
      return 'Ready to detect';
    case 'SEGMENTING':
      return 'Detecting walls';
    case 'SEGMENTED':
      return 'Ready to paint';
    case 'FAILED':
      return 'Failed';
    default:
      return status;
  }
}

/**
 * The Studio: the one place in the app where a room is painted.
 *
 * It replaces the Phase-1 engine spike, which showed a bundled sample room and
 * nothing else — a screen that proved the renderer but was a dead end for the
 * person holding the phone, because it had no way to reach their own walls.
 *
 * Three things live here, in the order they are wanted:
 *   1. the shade someone just tapped "Try on wall" for, previewed at once on a
 *      sample wall (no upload, no waiting) with the way through to a real room;
 *   2. starting a room — the camera flow;
 *   3. the rooms already saved, because reopening one beats starting over.
 *
 * Shared by every role that paints (customer, admin) so the two can't drift.
 */
export function StudioScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{
    code?: string;
    name?: string;
    hex?: string;
    brand?: string;
    brandSlug?: string;
    family?: string;
  }>();

  const photo = useImage(require('../../assets/spike/sample-room.png'));
  const mask = useImage(require('../../assets/spike/sample-mask.png'));

  // "Try on wall" passes a full shade (hex + meta); the older sample path passes
  // just a code. Build a Shade from whichever we got.
  function shadeFromParams(): Shade | null {
    if (params.code && params.hex) {
      return {
        code: params.code,
        name: params.name || params.code,
        hex: params.hex,
        brand: params.brand || '',
        family: params.family || '',
        brandSlug: params.brandSlug || undefined,
      };
    }
    if (params.code) return SAMPLE_SHADES.find((s) => s.code === params.code) ?? null;
    return null;
  }

  const [shade, setShade] = useState<Shade>(() => shadeFromParams() ?? SAMPLE_SHADES[5]);
  const [comparing, setComparing] = useState(false);

  // Colours read the way this shop presents them: its own code pattern, and the
  // paint name only when the shop shows names.
  const scheme = useShadeCodeScheme().data;
  const display = shadeDisplay(scheme, { code: shade.code, name: shade.name });

  // Sync when a new shade is passed via params, by adjusting state during render
  // (React's recommended pattern), while still letting the tray override locally.
  const paramKey = `${params.code ?? ''}:${params.hex ?? ''}`;
  const [lastKey, setLastKey] = useState(paramKey);
  if (params.code && paramKey !== lastKey) {
    setLastKey(paramKey);
    const next = shadeFromParams();
    if (next) setShade(next);
  }

  // Arriving WITH a shade means the sample wall is what was asked for, so it
  // leads. Arriving without one, the user's own rooms matter more than a demo.
  const arrivedWithShade = Boolean(params.code);

  const { data: projects, isLoading, isError } = useProjects();
  const rooms = projects ?? [];

  const canvasWidth = Math.round(width - spacing.lg * 2);
  const canvasHeight = Math.round((canvasWidth * 600) / 800);
  const ready = !!photo && !!mask;

  function selectShade(next: Shade) {
    Haptics.selectionAsync().catch(() => {});
    setShade(next);
  }

  const startRoom = (
    <Pressable onPress={() => router.push('/new-project')} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}>
      <Card style={styles.cta}>
        <View style={styles.ctaIcon}>
          <Ionicons name="camera" size={22} color={colors.accentSoft} />
        </View>
        <View style={styles.ctaText}>
          <Text variant="heading">Start a new room</Text>
          <Text variant="bodySoft">
            Photograph the walls, or pick a photo. We&apos;ll detect the walls, then you paint them.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.fgMute} />
      </Card>
    </Pressable>
  );

  const samplePreview = (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text variant="label">{arrivedWithShade ? 'Trying this shade' : 'Try a shade on a sample wall'}</Text>
        <StatusPill label="Sample room" tone="neutral" />
      </View>

      <View style={[styles.canvasFrame, { height: canvasHeight }]}>
        {ready ? (
          <RecolorCanvas
            photo={photo}
            mask={mask}
            color={shade.hex}
            strength={comparing ? 0 : 1}
            width={canvasWidth}
            height={canvasHeight}
          />
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
            <Text variant="caption" style={{ marginTop: spacing.sm }}>
              Loading sample room…
            </Text>
          </View>
        )}
      </View>

      <Pressable
        onPressIn={() => setComparing(true)}
        onPressOut={() => setComparing(false)}
        style={({ pressed }) => [styles.compare, pressed && { borderColor: colors.accent }]}
      >
        <Text variant="label" color={comparing ? colors.accentSoft : colors.fgSoft}>
          {comparing ? 'Showing original — release to paint' : 'Hold to compare with original'}
        </Text>
      </Pressable>

      <Card>
        <View style={styles.shadeRow}>
          <View style={[styles.selectedSwatch, { backgroundColor: shade.hex }]} />
          <View style={styles.shadeMeta}>
            <Text variant="heading">{display.label}</Text>
            <Text variant="mono" color={colors.fgSoft}>
              {display.name ? `${shade.brand} · ` : ''}
              {display.code}
            </Text>
          </View>
          {shade.family ? <StatusPill label={shade.family} tone="neutral" /> : null}
        </View>
        {/* The sample wall is a preview, not the product — say where the real
            thing is rather than leaving this as the end of the road. */}
        <Button
          label="See it on your own wall"
          variant="secondary"
          fullWidth
          style={styles.sampleCta}
          onPress={() => router.push('/new-project')}
        />
      </Card>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tray}>
        {SAMPLE_SHADES.map((s) => {
          const active = s.code === shade.code;
          return (
            <Pressable key={s.code} onPress={() => selectShade(s)} style={styles.swatchButton}>
              <View
                style={[
                  styles.traySwatch,
                  {
                    backgroundColor: s.hex,
                    borderColor: active ? colors.accent : colors.rule,
                    borderWidth: active ? 3 : 1,
                  },
                ]}
              />
              <Text variant="caption" numberOfLines={1} style={styles.trayLabel}>
                {shadeDisplay(scheme, { code: s.code, name: s.name }).code}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const yourRooms = (
    <View style={styles.section}>
      <Text variant="label">Your rooms</Text>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : isError ? (
        <Card>
          <Text variant="bodySoft">Couldn&apos;t load your rooms. Check your connection and try again.</Text>
        </Card>
      ) : rooms.length === 0 ? (
        <Card>
          <Text variant="bodySoft">
            Nothing here yet. The room you photograph next shows up here, ready to reopen.
          </Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {rooms.map((p: ProjectSummary) => (
            <Card key={p.id} padded={false} onPress={() => router.push(`/project/${p.id}`)}>
              {/* Masks align to the cleaned photo, so that is the truer thumbnail. */}
              <AuthedImage
                url={p.cleanedImageUrl ?? p.imageUrl}
                style={styles.thumb}
                contentFit="cover"
                transition={150}
              />
              <View style={styles.cardBody}>
                <View style={styles.cardRow}>
                  <Text variant="heading" numberOfLines={1} style={styles.cardName}>
                    {p.name ?? 'Untitled room'}
                  </Text>
                  <StatusPill label={statusLabel(p.status)} tone={statusTone(p.status)} />
                </View>
                <View style={styles.badgeRow}>
                  <Text variant="caption">
                    {p.regionCount} {p.regionCount === 1 ? 'wall' : 'walls'}
                  </Text>
                  {p.readOnly ? <StatusPill label="View only" tone="expired" /> : null}
                </View>
              </View>
            </Card>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.head}>
        <Text variant="title">Studio</Text>
        <Text variant="bodySoft">Put real paint on your own walls — on-device, with the shadows kept.</Text>
      </View>

      {/* What the shop assigned: projects left, access window, ask-for-more.
          Renders nothing when no shop manages this account. */}
      <EntitlementCard />

      {arrivedWithShade ? (
        <>
          {samplePreview}
          {startRoom}
          {yourRooms}
        </>
      ) : (
        <>
          {startRoom}
          {yourRooms}
          {samplePreview}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingTop: spacing.xl },
  head: { gap: spacing.xs },
  section: { gap: spacing.sm },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
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
  canvasFrame: {
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  compare: {
    height: 46,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  selectedSwatch: { width: 48, height: 48, borderRadius: radius.button, borderWidth: 1, borderColor: colors.rule },
  shadeMeta: { flex: 1, gap: 2 },
  sampleCta: { marginTop: spacing.md },
  tray: { gap: spacing.md, paddingVertical: spacing.xs },
  swatchButton: { width: 64, gap: spacing.xs, alignItems: 'center' },
  traySwatch: { width: 64, height: 64, borderRadius: radius.card },
  trayLabel: { textAlign: 'center' },
  center: { paddingVertical: spacing.xxl, alignItems: 'center' },
  list: { gap: spacing.md },
  thumb: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: colors.surface2,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
  },
  cardBody: { padding: spacing.md, gap: spacing.xs },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  cardName: { flex: 1 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
});
