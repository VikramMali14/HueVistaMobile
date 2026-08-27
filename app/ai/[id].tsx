import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import {
  Screen,
  Text,
  Card,
  Button,
  BackLink,
  Chip,
  Disclosure,
  EmptyState,
  AuthedImage,
  WorkCard,
  PressableScale,
} from '../../src/components';
import { colors, spacing, radius, hairline, alpha, useElapsedSeconds } from '../../src/theme';
import { useProject } from '../../src/projects/queries';
import { useAiCredits } from '../../src/account/queries';
import {
  boardsApi,
  formatPaise,
  resolveImageUrl,
  ApiError,
  type CreateRenderInput,
  type ProjectCombo,
  type ProjectRender,
} from '../../src/api';
import { haptics } from '../../src/haptics';

/** How long an image usually takes, for pacing the progress bar. */
const RENDER_SECONDS = 45;

/**
 * The five things the model is actually told, exactly as the API defines them.
 *
 * The design drew this as five rows of unnamed pills. These are the real enums
 * from `ProjectRender` — a pill that does not map to one is a control that
 * cannot do anything, and the customer is paying a credit for the result.
 */
const OPTIONS = [
  {
    key: 'timeOfDay' as const,
    label: 'Light',
    choices: [
      { value: 'DAY', label: 'Daylight' },
      { value: 'NIGHT', label: 'Evening' },
    ],
  },
  {
    key: 'lighting' as const,
    label: 'Mood',
    choices: [
      { value: 'NATURAL', label: 'Natural' },
      { value: 'WARM', label: 'Warm' },
      { value: 'COOL', label: 'Cool' },
      { value: 'DRAMATIC', label: 'Dramatic' },
    ],
  },
  {
    key: 'furnishing' as const,
    label: 'Furniture',
    choices: [
      { value: 'KEEP', label: 'As it is' },
      { value: 'STAGED', label: 'Styled' },
      { value: 'EMPTY', label: 'Empty room' },
    ],
  },
  {
    key: 'style' as const,
    label: 'Look',
    choices: [
      { value: 'MODERN', label: 'Modern' },
      { value: 'MINIMAL', label: 'Minimal' },
      { value: 'TRADITIONAL', label: 'Traditional' },
      { value: 'HERITAGE', label: 'Heritage' },
      { value: 'LUXE', label: 'Luxe' },
    ],
  },
  {
    key: 'borderMode' as const,
    label: 'Borders and trim',
    choices: [
      { value: 'KEEP_ORIGINAL', label: 'Keep mine' },
      { value: 'AI_SUGGESTED', label: 'Let AI choose' },
    ],
  },
] as const;

type OptionState = Pick<
  CreateRenderInput,
  'timeOfDay' | 'lighting' | 'furnishing' | 'style' | 'borderMode'
>;

const DEFAULTS: OptionState = {
  timeOfDay: 'DAY',
  lighting: 'NATURAL',
  furnishing: 'KEEP',
  style: 'MODERN',
  borderMode: 'KEEP_ORIGINAL',
};

/**
 * An AI image of one combination the room handed over.
 *
 * Three states on one route — choose, wait, look — because they are one act
 * with one credit riding on it, and splitting them across routes means the back
 * button lands somewhere that no longer makes sense mid-render.
 *
 * A render can only be made from a combination that went onto a colour board:
 * the picture shows a scheme the customer committed to on paper, not a
 * speculative one. If the room has no board yet, this screen says so and sends
 * them to make one rather than showing an empty picker.
 */
export default function AiRoute() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const raw = useLocalSearchParams<{ id: string; render?: string }>();
  const id = Array.isArray(raw.id) ? raw.id[0] : raw.id;
  const openRenderId = Array.isArray(raw.render) ? raw.render[0] : raw.render;

  const { data: project } = useProject(id);
  const credits = useAiCredits().data;

  const combos = useQuery({
    queryKey: ['projects', id, 'combos'],
    queryFn: () => boardsApi.combos(id),
    enabled: !!id,
    retry: false,
  });

  const [comboId, setComboId] = useState<string | null>(null);
  const [options, setOptions] = useState<OptionState>(DEFAULTS);
  /** An image this screen started. Null until one is asked for. */
  const [started, setStarted] = useState<ProjectRender | null>(null);
  /** "Make another" — stops the deep-linked image from coming straight back. */
  const [dismissedOpened, setDismissedOpened] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const comboList = useMemo(() => combos.data ?? [], [combos.data]);

  /** Opened from the library with a specific image in mind. */
  const existing = useQuery({
    queryKey: ['projects', id, 'renders'],
    queryFn: () => boardsApi.renders(id),
    enabled: !!id && !!openRenderId,
    retry: false,
  });

  /**
   * Which image this screen is about, derived rather than copied into state.
   * An effect that mirrored the deep-linked render into local state would run a
   * render behind the query and fight "Make another" for ownership of it.
   */
  const opened = dismissedOpened
    ? null
    : (existing.data?.find((r) => r.id === openRenderId) ?? null);
  const render: ProjectRender | null = started ?? opened;

  const selectedCombo: ProjectCombo | null =
    comboList.find((c) => c.id === (comboId ?? render?.comboId)) ?? comboList[0] ?? null;

  const working = render?.status === 'QUEUED' || render?.status === 'RUNNING';

  /**
   * Poll while the model works.
   *
   * The backend answers 202 and then nothing until the image exists, so this is
   * the only way to learn it finished. It stops the moment the status leaves the
   * working pair, and the interval is cleared on unmount so leaving the screen
   * mid-render does not leave a timer behind.
   */
  const renderId = render?.id;
  useEffect(() => {
    if (!working || !renderId) return;
    const poll = setInterval(async () => {
      try {
        const next = await boardsApi.render(id, renderId);
        setStarted(next);
        if (next.status === 'READY') {
          haptics.success();
          queryClient.invalidateQueries({ queryKey: ['account', 'renders'] });
          queryClient.invalidateQueries({ queryKey: ['billing', 'ai-credits'] });
        }
      } catch {
        // A dropped poll is not a failed render — the next tick tries again.
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [working, renderId, id, queryClient]);

  async function requestRender() {
    if (!selectedCombo || requesting) return;
    setRequesting(true);
    setError(null);
    try {
      const created = await boardsApi.requestRender(id, {
        comboId: selectedCombo.id,
        ...options,
      });
      haptics.press();
      setStarted(created);
      queryClient.invalidateQueries({ queryKey: ['billing', 'ai-credits'] });
    } catch (err) {
      haptics.error();
      if (err instanceof ApiError && err.status === 402) {
        setError('short-on-credits');
      } else {
        setError(err instanceof ApiError ? err.message : 'Couldn’t start the image. Please try again.');
      }
    } finally {
      setRequesting(false);
    }
  }

  async function saveImage() {
    const url = resolveImageUrl(render?.imageUrl);
    if (!url) return;
    setSaved(null);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        setError('Photos permission is needed to save. You can turn it on in Settings.');
        return;
      }
      await MediaLibrary.saveToLibraryAsync(url);
      haptics.success();
      setSaved('Saved to your Photos.');
    } catch {
      setError('Couldn’t save that image. Please try again.');
    }
  }

  /* ── No board, nothing to render from ───────────────────────────────────── */
  if (combos.isLoading) {
    return (
      <Screen contentStyle={styles.centre}>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  if (comboList.length === 0) {
    return (
      <Screen scroll contentStyle={styles.content}>
        <BackLink />
        <EmptyState
          icon="sparkles-outline"
          title="Make a colour board first."
          body="An AI image is painted in a scheme you committed to on a board — that is what keeps the picture and the paint you buy the same thing."
        >
          <Button label="Go to the board" fullWidth onPress={() => router.replace(`/board/${id}`)} />
        </EmptyState>
      </Screen>
    );
  }

  /* ── Working ────────────────────────────────────────────────────────────── */
  if (working) {
    return (
      <Screen scroll contentStyle={styles.content}>
        <BackLink label="Leave it running" onPress={() => router.back()} />
        <View style={styles.head}>
          <Text variant="eyebrow" color={colors.accentSoft}>
            Making your image
          </Text>
          <Text variant="display">Painting the room.</Text>
        </View>
        <RenderingCard
          subtitle={`${project?.name ?? 'Your room'} · ${selectedCombo?.title ?? 'your scheme'}`}
          onLeave={() => router.back()}
        />
        <Disclosure kind="ai" />
      </Screen>
    );
  }

  /* ── Failed ─────────────────────────────────────────────────────────────── */
  if (render?.status === 'FAILED') {
    return (
      <Screen scroll contentStyle={styles.content}>
        <BackLink />
        <EmptyState
          tone="error"
          icon="cloud-offline-outline"
          eyebrow="The image didn’t finish"
          title="That one didn’t come out."
          body={`${render.failureReason ?? 'The model couldn’t complete the picture.'} Your credit has been returned — you still have ${credits?.balance ?? 0}.`}
        >
          <Button
            label="Try again"
            fullWidth
            onPress={() => {
              setStarted(null);
              setDismissedOpened(true);
            }}
          />
          <Button
            label="Back to the board"
            variant="secondary"
            fullWidth
            onPress={() => router.replace(`/board/${id}`)}
          />
        </EmptyState>
      </Screen>
    );
  }

  /* ── Result ─────────────────────────────────────────────────────────────── */
  if (render?.status === 'READY' && render.imageUrl) {
    return (
      <Screen scroll contentStyle={styles.content}>
        <BackLink label="Done" onPress={() => router.replace('/library')} />

        <View style={styles.head}>
          <Text variant="eyebrow" color={colors.success}>
            Your AI image
          </Text>
          <Text variant="title" numberOfLines={2}>
            {project?.name ?? 'Your room'}
            {selectedCombo?.title ? ` in ${selectedCombo.title}` : ''}
          </Text>
        </View>

        <AuthedImage url={render.imageUrl} style={styles.result} contentFit="cover" transition={200} />

        {selectedCombo ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {selectedCombo.shades.map((s, i) => (
              <View key={`${s.hex}-${i}`} style={styles.shadeTag}>
                <View style={[styles.shadeDot, { backgroundColor: s.hex }]} />
                <Text variant="caption">{s.shadeName ?? s.shadeCode ?? s.hex.toUpperCase()}</Text>
              </View>
            ))}
          </ScrollView>
        ) : null}

        <Disclosure kind="ai" defaultOpen />

        {error ? (
          <Text variant="caption" color={colors.dangerSoft}>
            {error}
          </Text>
        ) : saved ? (
          <Text variant="caption" color={colors.success}>
            {saved}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <Button
            label="Save to phone"
            size="lg"
            fullWidth
            icon={<Ionicons name="download-outline" size={18} color="#fff" />}
            onPress={saveImage}
          />
          <Button
            label="Share"
            variant="secondary"
            fullWidth
            icon={<Ionicons name="share-outline" size={17} color={colors.fg} />}
            onPress={() =>
              Share.share({
                message: `${project?.name ?? 'My room'} — an AI preview from HueVista`,
                url: resolveImageUrl(render.imageUrl) ?? undefined,
              }).catch(() => {})
            }
          />
          <Button
            label="Make another"
            variant="secondary"
            fullWidth
            onPress={() => {
              setStarted(null);
              setDismissedOpened(true);
              setSaved(null);
              setError(null);
            }}
          />
        </View>
      </Screen>
    );
  }

  /* ── Choose ─────────────────────────────────────────────────────────────── */
  const short = error === 'short-on-credits' || (credits?.eligible && credits.balance < credits.renderCost);

  return (
    <Screen scroll contentStyle={styles.content}>
      <BackLink />

      <View style={styles.head}>
        <Text variant="eyebrow">AI image</Text>
        <Text variant="display">Pick one combination.</Text>
        <Text variant="bodySoft">
          The model repaints your own photograph in the scheme you choose. It uses the cleaned photo,
          so the furniture and the light are yours — only the colour changes.
        </Text>
      </View>

      <View style={styles.group}>
        <Text variant="eyebrow">From your boards</Text>
        {comboList.map((c) => {
          const on = c.id === (selectedCombo?.id ?? null);
          return (
            <PressableScale
              key={c.id}
              onPress={() => setComboId(c.id)}
              haptic="select"
              activeScale={0.98}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={c.title ?? `Board ${c.boardIndex + 1}`}
              style={StyleSheet.flatten([styles.combo, on ? styles.comboOn : null])}
            >
              <View style={styles.comboSwatches}>
                {c.shades.slice(0, 4).map((s, i) => (
                  <View key={`${c.id}-${i}`} style={[styles.comboChip, { backgroundColor: s.hex }]} />
                ))}
              </View>
              <View style={styles.comboText}>
                <Text variant="subhead" numberOfLines={1}>
                  {c.title ?? `Board ${c.boardIndex + 1}`}
                </Text>
                <Text variant="caption">
                  {c.shades.length} colour{c.shades.length === 1 ? '' : 's'}
                  {c.rendered ? ' · already rendered once' : ''}
                </Text>
              </View>
              {on ? <Ionicons name="checkmark-circle" size={20} color={colors.accentSoft} /> : null}
            </PressableScale>
          );
        })}
      </View>

      {OPTIONS.map((group) => (
        <View key={group.key} style={styles.group}>
          <Text variant="eyebrow">{group.label}</Text>
          <View style={styles.pills}>
            {group.choices.map((choice) => (
              <Chip
                key={choice.value}
                label={choice.label}
                selected={options[group.key] === choice.value}
                onPress={() =>
                  setOptions((prev) => ({ ...prev, [group.key]: choice.value }) as OptionState)
                }
              />
            ))}
          </View>
        </View>
      ))}

      <Disclosure kind="ai" />

      {short ? (
        <Card accent={colors.warm}>
          <Text variant="eyebrow" color={colors.warm}>
            Not enough credits
          </Text>
          <Text variant="bodySoft" style={styles.cardBody}>
            An image costs {credits?.renderCost ?? 1} credit
            {(credits?.renderCost ?? 1) === 1 ? '' : 's'} and you have {credits?.balance ?? 0}.
          </Text>
          <Button
            label={credits?.pricePaise ? `Buy credits — ${formatPaise(credits.pricePaise)} each` : 'Buy credits'}
            variant="secondary"
            fullWidth
            style={styles.cardAction}
            onPress={() => router.push('/buy?what=credits')}
          />
        </Card>
      ) : null}

      {error && error !== 'short-on-credits' ? (
        <Text variant="caption" color={colors.dangerSoft}>
          {error}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Button
          label="Make the image"
          size="lg"
          fullWidth
          loading={requesting}
          disabled={!selectedCombo || short || requesting}
          icon={<Ionicons name="sparkles" size={18} color="#fff" />}
          onPress={requestRender}
        />
        {credits?.eligible ? (
          <Text variant="caption" center>
            Uses {credits.renderCost} of your {credits.balance} credit
            {credits.balance === 1 ? '' : 's'}. Returned in full if the image can&apos;t be made.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

/**
 * The wait while the model paints.
 *
 * Its own component so it owns the clock: it mounts when the render starts and
 * unmounts when it lands, which is what keeps the elapsed count honest with no
 * effect resetting it.
 */
function RenderingCard({ subtitle, onLeave }: { subtitle: string; onLeave: () => void }) {
  const elapsed = useElapsedSeconds();
  return (
    <WorkCard
      title="Rendering"
      subtitle={subtitle}
      elapsedSeconds={elapsed}
      expectedSeconds={RENDER_SECONDS}
      note="Your credit is returned in full if the image can’t be made."
      cancelLabel="Leave it running"
      onCancel={onLeave}
    />
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: spacing.lg },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  head: { gap: spacing.sm },
  group: { gap: spacing.sm },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  combo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.cardTight,
    borderWidth: hairline,
    borderColor: colors.glassEdgeSoft,
    backgroundColor: colors.glass,
  },
  comboOn: { borderColor: alpha(colors.accent, 0.5), backgroundColor: colors.accentGhost },
  comboSwatches: { flexDirection: 'row', gap: 3 },
  comboChip: { width: 18, height: 34, borderRadius: 5 },
  comboText: { flex: 1, gap: 2 },
  result: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.card,
    backgroundColor: colors.surface2,
  },
  chipRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  shadeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: hairline,
    borderColor: colors.glassEdgeSoft,
    backgroundColor: colors.glass,
  },
  shadeDot: { width: 12, height: 12, borderRadius: 6 },
  cardBody: { marginTop: spacing.xs },
  cardAction: { marginTop: spacing.md },
  actions: { gap: spacing.sm },
});
