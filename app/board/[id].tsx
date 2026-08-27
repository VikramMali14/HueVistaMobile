import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Share, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import { captureRef } from 'react-native-view-shot';
import {
  Screen,
  Text,
  Serif,
  Card,
  Button,
  BackLink,
  Disclosure,
  EmptyState,
  StatusPill,
  Swatch,
} from '../../src/components';
import { colors, spacing, radius, hairline, fontSize, alpha } from '../../src/theme';
import { useProject } from '../../src/projects/queries';
import { usePdfAllowance, useAiCredits, useShadeCodeScheme } from '../../src/account/queries';
import { shadeDisplay } from '../../src/shades/shadeCodes';
import { boardsApi, ApiError, type BoardPageInput, type ProjectCombo } from '../../src/api';
import { haptics } from '../../src/haptics';

/**
 * The colour board — what the customer actually walks into the shop holding.
 *
 * Two states on one route, because they are two halves of one act: what you are
 * about to commit to, and what you committed to. Confirming records the
 * combination on the server (`POST /colour-boards`), which is the only moment
 * those colours can be captured — the sheet is rendered on the device and the
 * server never sees it. Everything downstream, the AI image included, is built
 * on what gets recorded here.
 *
 * ── Corrected from the design ─────────────────────────────────────────────
 * The design's confirm screen stated flatly that "Downloading closes the
 * project" and showed "Boards for this project: 1 of 1". Neither is fixed: a
 * project gets two boards by default, and it closes when the LAST one is spent.
 * Telling someone their room is about to become read-only when it is not is the
 * kind of wrong that stops people finishing — so the count is read from the
 * server's own allowance and the warning only appears when it is true.
 */
export default function BoardRoute() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const raw = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(raw.id) ? raw.id[0] : raw.id;

  const { data: project, isLoading } = useProject(id);
  const allowance = usePdfAllowance().data;
  const credits = useAiCredits().data;
  const scheme = useShadeCodeScheme().data;

  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [savingImage, setSavingImage] = useState(false);
  const boardRef = useRef<View>(null);

  /**
   * What this room has already handed over. A room reached from the library —
   * finished days ago — opens straight on its board rather than asking the
   * customer to confirm something they already did.
   */
  const combos = useQuery({
    queryKey: ['projects', id, 'combos'],
    queryFn: () => boardsApi.combos(id),
    enabled: !!id,
    retry: false,
  });

  /** The painted surfaces, in the order they sit in the room. */
  const painted = useMemo(
    () =>
      (project?.regions ?? [])
        .filter((r) => r.appliedHexCode)
        .map((r, i) => ({
          regionId: r.id,
          regionLabel: r.label ?? r.category ?? `Surface ${i + 1}`,
          shadeCode: r.appliedShadeCode ?? null,
          shadeName: null as string | null,
          hex: r.appliedHexCode as string,
        })),
    [project],
  );

  const recorded: ProjectCombo | null = combos.data?.[combos.data.length - 1] ?? null;
  const done = !!recorded;

  async function record() {
    if (painted.length === 0 || recording) return;
    setRecording(true);
    setError(null);
    try {
      const pages: BoardPageInput[] = [
        {
          title: project?.name ?? 'Colour board',
          shades: painted.map((p) => ({
            regionId: p.regionId,
            regionLabel: p.regionLabel,
            shadeCode: p.shadeCode,
            hex: p.hex,
          })),
        },
      ];
      await boardsApi.record(id, pages);
      haptics.success();
      await queryClient.invalidateQueries({ queryKey: ['projects', id] });
      await queryClient.invalidateQueries({ queryKey: ['projects', id, 'combos'] });
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      await queryClient.invalidateQueries({ queryKey: ['billing', 'pdf-allowance'] });
    } catch (err) {
      haptics.error();
      if (err instanceof ApiError && err.status === 402) {
        setError('There are no board downloads left on the plan covering this room this month.');
      } else if (err instanceof ApiError && err.status === 409) {
        setError('This room has already spent every board it had.');
      } else {
        setError(err instanceof ApiError ? err.message : 'Couldn’t record the board. Please try again.');
      }
    } finally {
      setRecording(false);
    }
  }

  /**
   * Keep the board.
   *
   * The website builds a PDF in the browser; the phone has no PDF writer and
   * does not need one — what the customer wants at a counter is a picture they
   * can hold up, so the board is captured exactly as drawn and saved to Photos.
   */
  async function saveToPhone() {
    setError(null);
    setSaved(null);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        setError('Photos permission is needed to save. You can turn it on in Settings.');
        return;
      }
      setSavingImage(true);
      const uri = await captureRef(boardRef, { format: 'png', quality: 1 });
      await MediaLibrary.saveToLibraryAsync(uri);
      haptics.success();
      setSaved('Saved to your Photos.');
    } catch {
      setError('Couldn’t save the board. Please try again.');
    } finally {
      setSavingImage(false);
    }
  }

  async function shareBoard() {
    setError(null);
    try {
      const uri = await captureRef(boardRef, { format: 'png', quality: 1 });
      await Share.share({
        url: uri,
        message: `${project?.name ?? 'My room'} — colour board from HueVista`,
      });
    } catch {
      setError('Couldn’t open the share sheet.');
    }
  }

  if (isLoading || combos.isLoading) {
    return (
      <Screen contentStyle={styles.centre}>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  if (!project) {
    return (
      <Screen scroll contentStyle={styles.content}>
        <BackLink />
        <EmptyState tone="error" icon="help-circle-outline" title="That room isn’t here.">
          <Button label="Open my library" fullWidth onPress={() => router.replace('/library')} />
        </EmptyState>
      </Screen>
    );
  }

  if (!done && painted.length === 0) {
    return (
      <Screen scroll contentStyle={styles.content}>
        <BackLink />
        <EmptyState
          icon="color-palette-outline"
          title="Nothing on the walls yet."
          body="A board carries the colours you chose. Paint at least one surface and come back."
        >
          <Button label="Back to the room" fullWidth onPress={() => router.replace(`/studio/${id}`)} />
        </EmptyState>
      </Screen>
    );
  }

  /* ── Before: what you are about to commit to ────────────────────────────── */
  if (!done) {
    const boardsLeft = allowance?.remaining ?? null;
    const lastBoard = boardsLeft != null && allowance!.monthlyLimit > 0 && boardsLeft <= 1;

    return (
      <Screen scroll contentStyle={styles.content}>
        <BackLink label="Back to colours" />

        <View style={styles.head}>
          <Text variant="eyebrow">Colour board</Text>
          <Text variant="display">One board, one download.</Text>
          <Text variant="bodySoft">
            It carries the colours below, on the surfaces you put them on — the list the counter reads
            off to mix your paint.
          </Text>
        </View>

        <Card tone="quiet" padded={false} style={styles.summary}>
          <Line label="Colours on the sheet" value={String(painted.length)} />
          {allowance?.monthlyLimit ? (
            <Line
              label="Boards left this month"
              value={`${allowance.remaining} of ${allowance.monthlyLimit}`}
            />
          ) : null}
          {credits?.eligible ? (
            <Line label="AI images on your account" value={String(credits.balance)} />
          ) : null}
        </Card>

        {lastBoard ? (
          <Card accent={colors.warm}>
            <Text variant="eyebrow" color={colors.warm}>
              This is the last one
            </Text>
            <Text variant="bodySoft" style={styles.cardBody}>
              Taking it finishes this room. You can still open the board and make AI images from it,
              but the walls and their colours stop being editable.
            </Text>
          </Card>
        ) : null}

        <View style={styles.swatchRow}>
          {painted.map((p) => (
            <Swatch
              key={p.regionId}
              hex={p.hex}
              label={p.regionLabel}
              code={shadeDisplay(scheme, { code: p.shadeCode ?? '', name: null }).code || undefined}
              size="lg"
              style={styles.swatchItem}
            />
          ))}
        </View>

        <Disclosure kind="colour" defaultOpen />
        <Disclosure kind="ai" />

        {error ? (
          <Text variant="caption" color={colors.dangerSoft}>
            {error}
          </Text>
        ) : null}

        <Button
          label="Make the board"
          size="lg"
          fullWidth
          loading={recording}
          icon={<Ionicons name="document-text-outline" size={18} color="#fff" />}
          onPress={record}
        />
      </Screen>
    );
  }

  /* ── After: the board itself ────────────────────────────────────────────── */
  const shades = recorded.shades.length > 0 ? recorded.shades : painted;

  return (
    <Screen scroll contentStyle={styles.content}>
      <BackLink label="Done" onPress={() => router.replace('/library')} />

      <View style={styles.head}>
        <Text variant="eyebrow" color={colors.success}>
          Board saved
        </Text>
        {/* One of the three places the serif is spent: the room becoming a
            thing the customer owns. See SERIF_BUDGET in theme/typography.ts. */}
        <Text variant="display">
          Keep your <Serif size={fontSize.display}>colours</Serif>.
        </Text>
      </View>

      {/* The captured artefact. Everything inside this view is what lands in
          Photos, so it carries its own header and the disclaimer, and no chrome. */}
      <View ref={boardRef} collapsable={false} style={styles.board}>
        <View style={styles.boardHead}>
          <Text variant="subhead" numberOfLines={1} style={styles.boardTitle}>
            {project.name ?? 'Colour board'}
          </Text>
          <Text variant="eyebrow">HueVista</Text>
        </View>

        <View style={styles.boardGrid}>
          {shades.map((s, i) => {
            const label = shadeDisplay(scheme, {
              code: s.shadeCode ?? '',
              name: s.shadeName ?? null,
            });
            return (
              <View key={`${s.hex}-${i}`} style={styles.boardCell}>
                <View style={[styles.boardChip, { backgroundColor: s.hex }]} />
                <Text variant="caption" color={colors.fg} numberOfLines={1}>
                  {s.regionLabel ?? `Surface ${i + 1}`}
                </Text>
                <Text variant="code" numberOfLines={1}>
                  {label.code || s.hex.toUpperCase()}
                </Text>
              </View>
            );
          })}
        </View>

        <Text variant="caption" style={styles.boardNote}>
          Shade colours are taken from the paint companies&apos; own shade cards. Screens and lighting
          shift colour — always check the physical shade card at the counter before you buy.
        </Text>
      </View>

      {project.readOnly ? (
        <View style={styles.finished}>
          <StatusPill label="Room finished" tone="done" />
          <Text variant="caption" style={styles.finishedText}>
            The colours are kept. The walls can no longer be changed.
          </Text>
        </View>
      ) : null}

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
          loading={savingImage}
          icon={<Ionicons name="download-outline" size={18} color="#fff" />}
          onPress={saveToPhone}
        />
        <Button
          label="Share"
          variant="secondary"
          fullWidth
          icon={<Ionicons name="share-outline" size={17} color={colors.fg} />}
          onPress={shareBoard}
        />
      </View>

      <Card tone="feature" onPress={() => router.push(`/ai/${id}`)} style={styles.aiCta}>
        <View style={styles.aiText}>
          <Text variant="subhead">Make an AI image</Text>
          <Text variant="caption">
            {credits?.eligible
              ? `A photorealistic picture of the room in this scheme · ${credits.balance} credit${
                  credits.balance === 1 ? '' : 's'
                } left`
              : 'A photorealistic picture of the room in this scheme'}
          </Text>
        </View>
        <Ionicons name="arrow-forward" size={18} color={colors.accentSoft} />
      </Card>
    </Screen>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <Text variant="bodySoft" style={styles.lineLabel}>
        {label}
      </Text>
      <Text variant="code" color={colors.fg}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: spacing.lg },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  head: { gap: spacing.sm },
  summary: { paddingHorizontal: spacing.lg },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: hairline,
    borderBottomColor: colors.rule,
  },
  lineLabel: { flex: 1 },
  cardBody: { marginTop: spacing.xs },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  swatchItem: { width: '30%' },
  board: {
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: hairline,
    borderColor: colors.glassEdge,
    backgroundColor: colors.surface,
  },
  boardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: hairline,
    borderBottomColor: colors.rule,
  },
  boardTitle: { flex: 1 },
  boardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  boardCell: { width: '46%', gap: spacing.xs },
  boardChip: {
    width: '100%',
    height: 76,
    borderRadius: radius.chip,
    borderWidth: hairline,
    borderColor: alpha('#000000', 0.28),
  },
  boardNote: { lineHeight: fontSize.xs * 1.5 },
  finished: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  finishedText: { flex: 1 },
  actions: { gap: spacing.sm },
  aiCta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  aiText: { flex: 1, gap: 3 },
});
