import { useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useImage } from '@shopify/react-native-skia';
import { Ionicons } from '@expo/vector-icons';
import {
  Screen,
  Text,
  Serif,
  Card,
  Button,
  StatusPill,
  AuthedImage,
  Reveal,
  PressableScale,
  SectionHeader,
} from '../components';
import { useRecentShades } from '../shades/recentShades';
import { depthOf, DEPTH_LABEL } from '../shades/colorScience';
import type { StatusTone } from '../components';
import { colors, spacing, radius, alpha, fontSize } from '../theme';
import { haptics } from '../haptics';
import { fitBox, RecolorCanvas } from '../engine';
import { SAMPLE_SHADES } from '../shades/sampleShades';
import { Shade } from '../shades/types';
import { shadeDisplay } from '../shades/shadeCodes';
import { useShadeCodeScheme } from '../account/queries';
import { EntitlementCard } from '../account';
import { useProjects } from '../projects/queries';
import type { ProjectSummary } from '../api';
import { ColourPanel } from './ColourPanel';

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
  const { remember } = useRecentShades();

  // Colours read the way this shop presents them: its own code pattern, and the
  // paint name only when the shop shows names.
  const scheme = useShadeCodeScheme().data;
  const display = shadeDisplay(scheme, { code: shade.code, name: shade.name });
  // The tray Shade carries no tonality, so this is banded from the hex.
  const shadeDepth = depthOf({ hexCode: shade.hex });

  // Sync when a new shade is passed via params, by adjusting state during render
  // (React's recommended pattern), while still letting the dock override locally.
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

  // The sample room drives its own canvas, like every other photo in the app.
  const canvas = fitBox(photo?.width(), photo?.height(), {
    maxWidth: Math.round(width - spacing.lg * 2),
  });
  const ready = !!photo && !!mask;

  function selectShade(next: Shade) {
    haptics.select();
    setShade(next);
    remember(next);
  }

  const startRoom = (
    <PressableScale onPress={() => router.push('/new-project')} haptic="press" activeScale={0.975}>
      <Card accent={colors.accent} style={styles.cta}>
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
    </PressableScale>
  );

  const samplePreview = (
    <View style={styles.section}>
      <SectionHeader
        title={arrivedWithShade ? 'Trying this shade' : 'Try a shade on a sample wall'}
        trailing={<StatusPill label="Sample room" tone="neutral" />}
      />

      <View style={[styles.canvasFrame, { width: canvas.width, height: canvas.height }]}>
        {ready ? (
          <RecolorCanvas
            photo={photo}
            mask={mask}
            color={shade.hex}
            strength={comparing ? 0 : 1}
            width={canvas.width}
            height={canvas.height}
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

      {/* What is on the wall right now. The colours that change it are directly
          below, in the dock — they used to be behind a button that opened the
          catalogue full-screen, which hid the very wall being painted. */}
      <Card accent={shade.hex}>
        <View style={styles.shadeRow}>
          <View
            style={[
              styles.selectedSwatch,
              { backgroundColor: shade.hex, shadowColor: shade.hex, borderColor: alpha(shade.hex, 0.5) },
            ]}
          />
          <View style={styles.shadeMeta}>
            <Text variant="heading" numberOfLines={1}>
              {display.label}
            </Text>
            <Text variant="mono" color={colors.fgSoft} numberOfLines={1}>
              {display.name ? `${shade.brand} · ` : ''}
              {display.code}
            </Text>
          </View>
        </View>

        <View style={styles.shadeFacts}>
          {shadeDepth ? <StatusPill label={DEPTH_LABEL[shadeDepth]} tone="neutral" /> : null}
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

      {/* The catalogue, docked under the wall it paints. */}
      <View style={styles.dock}>
        <ColourPanel onPick={selectShade} selectedCode={shade.code} />
      </View>
    </View>
  );

  const yourRooms = (
    <View style={styles.section}>
      <SectionHeader title="Your rooms" />
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
    // The background takes the shade currently on the sample wall, so the whole
    // screen sits in the light of the colour being considered.
    <Screen scroll contentStyle={styles.content} tint={shade.hex}>
      <Reveal style={styles.head}>
        <Text variant="display">
          <Serif size={fontSize.display}>Studio</Serif>
        </Text>
        <Text variant="bodySoft">Put real paint on your own walls — on-device, with the shadows kept.</Text>
      </Reveal>

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
    alignSelf: 'center',
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
  selectedSwatch: {
    width: 52,
    height: 52,
    borderRadius: radius.button,
    borderWidth: 1,
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  shadeMeta: { flex: 1, gap: 2 },
  shadeFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  sampleCta: { marginTop: spacing.md },
  dock: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassEdge,
  },
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
