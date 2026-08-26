import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  BackLink,
  Button,
  Card,
  Disclosure,
  EmptyState,
  Input,
  PressableScale,
  Screen,
  Segmented,
  SheetModal,
  Text,
  WorkCard,
} from '../components';
import { colors, spacing, radius, alpha, hairline, useElapsedSeconds } from '../theme';
import { haptics } from '../haptics';
import { useProject } from '../projects/queries';
import {
  ApiError,
  API_CODES,
  hasCode,
  projectsApi,
  regionMaskUrl,
  resolveImageUrl,
  type Region,
  type RecommendationResponse,
} from '../api';
import { recommendationsApi } from '../api';
import { fitBox, samplePhotoHex, useAuthedSkImageState, type PaintLayer } from '../engine';
import { useRecentShades } from '../shades/recentShades';
import type { Shade } from '../shades/types';
import { useRequestMoreProjects } from '../account/queries';
import { expiryText } from '../account/expiry';
import { RoomPhoto, type CanvasMode } from './RoomPhoto';
import { BeforeAfter } from './BeforeAfter';
import { ColourPanel } from './ColourPanel';
import { SuggestPanel } from './SuggestPanel';
import { FinderPanel } from './FinderPanel';
import { MaskStudioSheet } from './MaskStudioSheet';
import { StepRail, type StepId } from './StepRail';
import { stepOfProject } from './roomStep';

type Applied = { hex: string; code?: string };

/** Which of the three ways of choosing a colour is open. */
type DockTab = 'shades' | 'palettes' | 'finder';

const DOCK_OPTIONS: readonly { value: DockTab; label: string }[] = [
  { value: 'shades', label: 'Shades' },
  { value: 'palettes', label: 'Palettes' },
  { value: 'finder', label: 'Finder' },
];

/** How long each server step usually takes, for pacing the progress bar. */
const SEGMENT_SECONDS = 60;

export interface RoomFlowProps {
  id: string;
  /** A shade handed in from the catalogue — applied to the first wall on arrival. */
  incoming?: Shade | null;
}

/**
 * One room, from a bare photograph to a scheme worth taking to a counter.
 *
 * ── Why this is one screen and five steps ──────────────────────────────────
 * The pipeline is real: a photo is cleaned, its surfaces are found, those are
 * corrected by hand where the model got them wrong, and then they are painted.
 * The old editor showed all of that at once — a status pill, a detect button, a
 * wall menu and a colour dock stacked down one page — so a customer landing on a
 * fresh room saw four controls and no order to them.
 *
 * The step it opens on is derived from the project, never from a counter this
 * screen keeps (see `stepOfProject`). That is what makes a half-finished room
 * resumable: closing the app on step 4 and coming back tomorrow, on another
 * phone, lands on step 4, because the project itself is the only thing that
 * knows.
 *
 * ── What changed from the design ──────────────────────────────────────────
 * Step 2 was drawn as three checkboxes — remove furniture, remove wall art,
 * straighten the photo. None of those exist: the backend runs one clean-up pass
 * and takes no options. What it DOES take is `maskMode`, and that choice is the
 * real fork in this flow — let the model find the walls, or mark them by hand —
 * so it is what step 2 asks. It is also the honest answer to "what if the AI is
 * wrong about my room", which the checkbox version had no room for.
 */
export function RoomFlow({ id, incoming }: RoomFlowProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width, height: windowHeight } = useWindowDimensions();

  const { data: project, isLoading } = useProject(id);
  const status = project?.status;
  const regions = useMemo(() => project?.regions ?? [], [project]);

  const photoUrl = resolveImageUrl(project?.cleanedImageUrl ?? project?.imageUrl);
  const { image: photo, status: photoStatus, reload: reloadPhoto } = useAuthedSkImageState(photoUrl);
  const { remember } = useRecentShades();

  const [overrides, setOverrides] = useState<Record<number, Applied>>({});
  const [selectedRegionId, setSelectedRegionId] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [segmentError, setSegmentError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<{ code: string; message: string } | null>(null);

  const [dock, setDock] = useState<DockTab>('shades');
  const [picking, setPicking] = useState(false);
  const [pickedHex, setPickedHex] = useState<string | null>(null);
  const [canvasNote, setCanvasNote] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);

  const [maskOpen, setMaskOpen] = useState(false);
  const [maskTarget, setMaskTarget] = useState<{ id: number; label: string } | null>(null);
  const [wallMenuOpen, setWallMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  const [recs, setRecs] = useState<RecommendationResponse | null>(null);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recsError, setRecsError] = useState<string | null>(null);

  const askShop = useRequestMoreProjects();
  const shotRef = useRef<View>(null);

  const readOnly = project?.readOnly ?? false;
  const segmented = status === 'SEGMENTED';
  const editable = !readOnly && segmented;

  /**
   * Where the project says we are, and where the customer has stepped to.
   *
   * The project is the floor; the override is a walk forward or back within
   * what it allows. The override carries the status it was set under and is
   * ignored the moment that changes, so a segmentation finishing always wins
   * over a stale local step — and it does so by derivation rather than by an
   * effect racing the render that reads it.
   */
  const derivedStep: StepId = project ? stepOfProject(project) : 'prepare';
  const [override, setOverride] = useState<{ step: StepId; forStatus: string } | null>(null);
  const setStepOverride = (next: StepId) => setOverride({ step: next, forStatus: status ?? '' });

  const step: StepId =
    override && override.forStatus === status
      ? override.step
      : // Arriving from the catalogue with a colour in hand: the room is ready
        // and the customer has already chosen, so skip the review step they
        // would otherwise have to tap past to use it.
        incoming?.hex && derivedStep === 'adjust'
        ? 'colour'
        : derivedStep;

  // Select the first surface once segmentation lands.
  if (selectedRegionId == null && regions.length > 0) {
    setSelectedRegionId(regions[0].id);
  }

  /**
   * A shade handed in from the catalogue lands on the selected wall once, on
   * arrival. Guarded by a ref rather than by a dependency list: the params do
   * not change, so an effect keyed on them would re-apply on every re-render
   * that recreated the object.
   */
  const appliedIncoming = useRef(false);
  useEffect(() => {
    if (appliedIncoming.current) return;
    if (!incoming?.hex || !editable || selectedRegionId == null) return;
    appliedIncoming.current = true;
    applyShade(incoming);
    // applyShade is stable enough for this one-shot; see the note above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming, editable, selectedRegionId]);

  // The photo drives the canvas: its own aspect ratio at the content width, so
  // none of the room is cropped away. The height ceiling keeps the wall and the
  // tools that change it in the same glance on a portrait photo.
  const contentWidth = Math.round(width - spacing.lg * 2);
  const canvas = fitBox(photo?.width(), photo?.height(), {
    maxWidth: contentWidth,
    maxHeight: Math.round(windowHeight * (step === 'colour' ? 0.42 : 0.55)),
  });

  function appliedColor(regionId: number, persistedHex?: string | null): Applied | null {
    if (overrides[regionId]) return overrides[regionId];
    return persistedHex ? { hex: persistedHex } : null;
  }

  const layers: PaintLayer[] = regions
    .map((r) => {
      const c = appliedColor(r.id, r.appliedHexCode);
      return c ? { key: `r${r.id}-${c.hex}`, maskUrl: regionMaskUrl(id, r.id), color: c.hex } : null;
    })
    .filter((l): l is PaintLayer => l !== null);

  const selectedRegion = regions.find((r) => r.id === selectedRegionId) ?? null;
  const paintedCount = layers.length;

  async function applyShade(shade: Shade) {
    if (selectedRegionId == null || readOnly) {
      if (!readOnly) setSaveError('Choose a surface first — tap one of the chips under the photo.');
      return;
    }
    // The paint lands immediately; the save that follows is silent unless it
    // fails, so a failed autosave gets its own warning buzz rather than only a
    // line of text under a tray the user is still scrolling.
    haptics.press();
    remember(shade);
    setOverrides((prev) => ({ ...prev, [selectedRegionId]: { hex: shade.hex, code: shade.code } }));
    try {
      await projectsApi.updateRegionColors(id, [
        { regionId: selectedRegionId, shadeCode: shade.code, hexCode: shade.hex },
      ]);
      setSaveError(null);
    } catch {
      haptics.warning();
      setSaveError('Couldn’t save that colour — it shows here but may not persist.');
    }
  }

  /**
   * Hand over to the board.
   *
   * The colours are autosaved one swatch at a time and the cached project is
   * NOT refetched on each one — refetching a room per tap would make painting
   * feel like waiting. That leaves the cache a few colours behind by the time
   * anyone leaves this screen, and the board reads its shades from exactly that
   * cache: without this the board could open on a room it thinks is bare and
   * offer to send the customer back to paint walls they have already painted.
   *
   * Awaited rather than fired off, so the board mounts on fresh regions instead
   * of flashing the empty state first.
   */
  async function openBoard() {
    setSaveError(null);
    try {
      await queryClient.invalidateQueries({ queryKey: ['projects', id] });
    } catch {
      // A failed refetch is not a reason to block the board — it will render
      // from whatever the cache holds and refetch again on its own mount.
    }
    router.push(`/board/${id}`);
  }

  /**
   * Start the pipeline.
   *
   * AUTO cleans the photo and finds the surfaces; MANUAL cleans and stops, so
   * they are marked by hand. Neither costs anything here: the room's credit was
   * taken when it was created, so this run — and any retry of it — is already
   * paid for. What separates the two is the result, not the price.
   */
  async function startSegmentation(mode: 'AUTO' | 'MANUAL') {
    setStarting(true);
    setSegmentError(null);
    setBlocked(null);
    try {
      await projectsApi.segment(id, mode);
      await queryClient.invalidateQueries({ queryKey: ['projects', id] });
    } catch (err) {
      if (
        hasCode(err, API_CODES.ASK_RETAILER) ||
        hasCode(err, API_CODES.SUBSCRIPTION_REQUIRED) ||
        hasCode(err, API_CODES.PROJECT_LIMIT_REACHED)
      ) {
        setBlocked({ code: (err as ApiError).code as string, message: (err as ApiError).message });
      } else if (err instanceof ApiError && err.status === 409) {
        // Already running — the poll will pick it up.
        await queryClient.invalidateQueries({ queryKey: ['projects', id] });
      } else {
        setSegmentError(
          err instanceof ApiError ? err.message : 'Could not start. Check your connection and try again.',
        );
      }
    } finally {
      setStarting(false);
    }
  }

  /**
   * Claude's palettes for this exact room. Included in the room rather than
   * charged per ask, and sized to it: a photo with one wall marked comes back
   * with one colour, not three the customer has nowhere to put.
   */
  async function askForRecommendations() {
    if (recsLoading) return;
    setRecsLoading(true);
    setRecsError(null);
    try {
      setRecs(await recommendationsApi.get(id));
    } catch (err) {
      setRecsError(
        err instanceof ApiError && err.status === 402
          ? 'This room’s access has ended. It needs reopening before we can suggest anything.'
          : err instanceof ApiError
            ? err.message
            : 'Couldn’t get suggestions. Please try again.',
      );
    } finally {
      setRecsLoading(false);
    }
  }

  async function removeRegion(regionId: number) {
    try {
      await projectsApi.deleteRegion(id, regionId);
      setSelectedRegionId(null);
      await queryClient.invalidateQueries({ queryKey: ['projects', id] });
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Couldn’t remove that surface.');
    }
  }

  async function doRename() {
    const name = renameValue.trim();
    if (!name) return;
    setRenaming(true);
    try {
      await projectsApi.update(id, { name });
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      await queryClient.invalidateQueries({ queryKey: ['projects', id] });
      setRenameOpen(false);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Couldn’t rename this room.');
    } finally {
      setRenaming(false);
    }
  }

  async function onWallSaved(region: Region) {
    setSelectedRegionId(region.id);
    await queryClient.invalidateQueries({ queryKey: ['projects', id] });
  }

  /** The eyedropper: a tap lifts the colour under it out of the photo. */
  function liftColour(point: { x: number; y: number }) {
    if (!photo) return;
    const hex = samplePhotoHex(photo, point.x, point.y);
    if (!hex) {
      setCanvasNote('Couldn’t read the colour there. Try a flatter, better-lit part of the photo.');
      return;
    }
    haptics.select();
    setPickedHex(hex);
    setPicking(false);
    setCanvasNote(null);
  }

  const canvasMode: CanvasMode = picking ? 'pick' : 'idle';
  /**
   * The screen sits in the light of whatever colour is in play — the paint on
   * the selected surface, or the colour just lifted out of the photo. It is the
   * one place in the app where the background knows what the user is doing.
   */
  const tint =
    pickedHex ??
    (selectedRegion ? (appliedColor(selectedRegion.id, selectedRegion.appliedHexCode)?.hex ?? null) : null);

  const title = project?.name ?? 'Untitled room';

  /* ── Chrome shared by every step ────────────────────────────────────────── */
  const header = (
    <View style={styles.header}>
      <BackLink label="Rooms" onPress={() => router.back()} />
      <StepRail current={step} busy={status === 'SEGMENTING' ? 'walls' : null} />
      <PressableScale
        onPress={() => {
          setRenameValue(project?.name ?? '');
          setRenameOpen(true);
        }}
        disabled={readOnly}
        haptic="tap"
        activeScale={0.9}
        accessibilityRole="button"
        accessibilityLabel="Rename this room"
        style={styles.iconButton}
      >
        <Ionicons name="pencil" size={15} color={colors.fgSoft} />
      </PressableScale>
    </View>
  );

  if (isLoading) {
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
        <EmptyState
          tone="error"
          icon="help-circle-outline"
          eyebrow="Not found"
          title="That room isn’t here."
          body="It may have been deleted, or it belongs to another account."
        >
          <Button label="Open my library" fullWidth onPress={() => router.replace('/library')} />
        </EmptyState>
      </Screen>
    );
  }

  /* ── Step 2 · Prepare ───────────────────────────────────────────────────── */
  if (step === 'prepare') {
    return (
      <Screen scroll contentStyle={styles.content} tint={tint}>
        {header}

        <View style={styles.photoWrap}>
          <RoomPhoto
            photo={photo}
            photoStatus={photoStatus}
            onReload={reloadPhoto}
            layers={[]}
            width={canvas.width}
            height={canvas.height}
            mode="idle"
            onTap={() => {}}
          />
        </View>

        <View style={styles.head}>
          <Text variant="eyebrow" color={colors.accentSoft}>
            Step 2 · Prepare
          </Text>
          <Text variant="title">How should we find the walls?</Text>
          <Text variant="bodySoft">
            Either way we clean the photo first — furniture, wall art and clutter come off the surfaces
            so the colour has a clean edge to sit against.
          </Text>
        </View>

        {blocked ? <Blocked blocked={blocked} ask={askShop} /> : null}
        {segmentError ? (
          <Text variant="caption" color={colors.dangerSoft}>
            {segmentError}
          </Text>
        ) : null}

        <View style={styles.choices}>
          <Choice
            icon="sparkles-outline"
            title="Find them for me"
            body="The model marks every wall, ceiling and trim it can see. About a minute."
            primary
            disabled={starting}
            onPress={() => startSegmentation('AUTO')}
          />
          <Choice
            icon="brush-outline"
            title="I'll mark them myself"
            body="Draw round each surface with a finger. Slower, exact, and it always works."
            disabled={starting}
            onPress={() => startSegmentation('MANUAL')}
          />
        </View>

        <Disclosure kind="ai" />
      </Screen>
    );
  }

  /* ── Step 3 · Walls ─────────────────────────────────────────────────────── */
  if (step === 'walls') {
    if (status === 'SEGMENTING') {
      return (
        <Screen scroll contentStyle={styles.content} tint={tint}>
          {header}
          <View style={styles.photoWrap}>
            <RoomPhoto
              photo={photo}
              photoStatus={photoStatus}
              onReload={reloadPhoto}
              layers={[]}
              width={canvas.width}
              height={canvas.height}
              mode="idle"
              onTap={() => {}}
            />
          </View>
          <SegmentingCard onLeave={() => router.back()} />
        </Screen>
      );
    }

    const failed = status === 'FAILED';
    return (
      <Screen scroll contentStyle={styles.content} tint={tint}>
        {header}
        <View style={styles.photoWrap}>
          <RoomPhoto
            photo={photo}
            photoStatus={photoStatus}
            onReload={reloadPhoto}
            layers={[]}
            width={canvas.width}
            height={canvas.height}
            mode="idle"
            onTap={() => {}}
          />
        </View>

        <EmptyState
          tone={failed ? 'error' : 'neutral'}
          eyebrow={failed ? 'Detection failed' : 'Nothing found'}
          title={failed ? 'That didn’t work out.' : 'We couldn’t find a surface in this one.'}
          body={
            failed
              ? (project.failureReason ??
                'Something went wrong while the model was working. Nothing was charged for the attempt.')
              : 'The room may be too dark, or too little of a wall is in frame. You can try again, or mark the walls yourself — that always works.'
          }
        >
          {segmentError ? (
            <Text variant="caption" color={colors.dangerSoft}>
              {segmentError}
            </Text>
          ) : null}
          <Button
            label="Try detection again"
            fullWidth
            loading={starting}
            onPress={() => startSegmentation('AUTO')}
          />
          <Button
            label="Mark the walls myself"
            variant="secondary"
            fullWidth
            disabled={starting}
            icon={<Ionicons name="brush-outline" size={16} color={colors.fg} />}
            onPress={() => {
              setMaskTarget(null);
              setMaskOpen(true);
            }}
          />
          <Button
            label="Use a different photo"
            variant="secondary"
            fullWidth
            onPress={() => router.replace('/studio/new')}
          />
        </EmptyState>

        <MaskStudioSheet
          visible={maskOpen}
          onClose={() => setMaskOpen(false)}
          projectId={id}
          photo={photo}
          regionCount={regions.length}
          editTarget={maskTarget}
          onSaved={onWallSaved}
        />
      </Screen>
    );
  }

  /* ── Steps 4 and 5 · Adjust and Colour ──────────────────────────────────── */
  const surfaceChips = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {regions.map((r, i) => {
        const c = appliedColor(r.id, r.appliedHexCode);
        const active = r.id === selectedRegionId;
        return (
          <Pressable
            key={r.id}
            onPress={() => {
              haptics.select();
              setSelectedRegionId(r.id);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${r.label ?? r.category ?? `Surface ${i + 1}`}${c ? ', painted' : ', bare'}`}
            style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
          >
            <View
              style={[styles.chipDot, { backgroundColor: c?.hex ?? colors.surface2 }]}
            />
            <Text variant="label" color={active ? colors.accentSoft : colors.fgSoft}>
              {r.label ?? r.category ?? `Surface ${i + 1}`}
            </Text>
          </Pressable>
        );
      })}
      {editable ? (
        <Pressable
          onPress={() => setWallMenuOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Edit a surface, or add a new one"
          style={[styles.chip, styles.chipDashed]}
        >
          <Ionicons name="options-outline" size={14} color={colors.accentSoft} />
          <Text variant="label" color={colors.accentSoft}>
            Edit
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );

  return (
    <Screen
      scroll
      tint={tint}
      contentStyle={styles.content}
      /* Chrome, the room, and the surfaces stay put. Everything that changes
         the walls scrolls beneath them, so the photo is always in view while
         it is being painted — picking a colour must never scroll the room off
         the top of the screen. */
      fixed={
        <View style={styles.pinned}>
          {header}
          <View style={styles.titleRow}>
            <Text variant="heading" numberOfLines={1} style={styles.title}>
              {title}
            </Text>
            {paintedCount > 0 ? (
              <PressableScale
                onPress={() => setComparing((c) => !c)}
                haptic="tap"
                activeScale={0.94}
                accessibilityRole="button"
                accessibilityState={{ selected: comparing }}
                accessibilityLabel="Compare before and after"
                style={StyleSheet.flatten([styles.compare, comparing ? styles.compareOn : null])}
              >
                <Ionicons
                  name="git-compare-outline"
                  size={14}
                  color={comparing ? colors.accentSoft : colors.fgSoft}
                />
                <Text variant="label" color={comparing ? colors.accentSoft : colors.fgSoft}>
                  Compare
                </Text>
              </PressableScale>
            ) : null}
          </View>

          {comparing && paintedCount > 0 ? (
            <BeforeAfter photo={photo} layers={layers} width={canvas.width} height={canvas.height} />
          ) : (
            <RoomPhoto
              ref={shotRef}
              photo={photo}
              photoStatus={photoStatus}
              onReload={reloadPhoto}
              layers={layers}
              width={canvas.width}
              height={canvas.height}
              mode={canvasMode}
              onTap={liftColour}
              onMiss={() => setCanvasNote('That spot is outside the photo. Tap somewhere on the room.')}
              hint={picking ? 'Tap the colour you want to match' : null}
            />
          )}

          {regions.length > 0 ? surfaceChips : null}
        </View>
      }
    >
      {readOnly ? (
        <Card accent={colors.warm}>
          <Text variant="eyebrow" color={colors.warm}>
            Finished
          </Text>
          <Text variant="bodySoft" style={styles.cardBody}>
            {project.readOnlyReason ??
              'This room’s board has been taken. The colours on it are kept, but they can’t be changed.'}
          </Text>
          <Button
            label="See the board"
            variant="secondary"
            fullWidth
            style={styles.cardAction}
            onPress={() => router.push(`/board/${id}`)}
          />
        </Card>
      ) : project.accessExpiresAt && expiryText(project.accessExpiresAt) ? (
        <Text variant="caption">Open until {expiryText(project.accessExpiresAt)}.</Text>
      ) : null}

      {canvasNote ? (
        <Text variant="caption" color={colors.warning}>
          {canvasNote}
        </Text>
      ) : null}

      {step === 'adjust' ? (
        <>
          <View style={styles.head}>
            <Text variant="eyebrow" color={colors.accentSoft}>
              Step 4 · Adjust
            </Text>
            <Text variant="title">
              {regions.length} {regions.length === 1 ? 'surface' : 'surfaces'} found.
            </Text>
            <Text variant="bodySoft">
              Tap a chip above to see which is which. Anything the model got wrong can be redrawn, and
              anything it missed can be added — do it now, before the colour goes on.
            </Text>
          </View>

          <View style={styles.summary}>
            {summarise(regions).map((row) => (
              <View key={row.label} style={styles.summaryRow}>
                <View style={[styles.summaryDot, { backgroundColor: row.colour }]} />
                <Text variant="label" style={styles.summaryLabel}>
                  {row.label}
                </Text>
                <Text variant="code">{row.count}</Text>
              </View>
            ))}
          </View>

          {editable ? (
            <View style={styles.actions}>
              <Button
                label="Pick colours"
                size="lg"
                fullWidth
                icon={<Ionicons name="color-palette-outline" size={18} color="#fff" />}
                onPress={() => setStepOverride('colour')}
              />
              <Button
                label="Fix a surface"
                variant="secondary"
                fullWidth
                onPress={() => setWallMenuOpen(true)}
              />
            </View>
          ) : (
            <Button label="See the colours" size="lg" fullWidth onPress={() => setStepOverride('colour')} />
          )}
        </>
      ) : (
        <>
          <View style={styles.dock}>
            <Segmented
              options={DOCK_OPTIONS}
              value={dock}
              onChange={(t) => {
                setDock(t);
                // Leaving the finder disarms it — an armed canvas under the
                // colour grid would eat the next tap on the photo.
                if (t !== 'finder') setPicking(false);
              }}
              accessibilityLabel="How to choose a colour"
            />

            {!readOnly ? (
              <Text variant="caption">
                {selectedRegion
                  ? `Painting ${selectedRegion.label ?? 'the selected surface'}`
                  : 'Choose a surface above, then a colour.'}
              </Text>
            ) : null}

            {dock === 'shades' ? (
              <ColourPanel
                onPick={applyShade}
                selectedCode={selectedRegionId != null ? appliedColor(selectedRegionId, null)?.code : null}
                disabled={readOnly}
              />
            ) : dock === 'palettes' ? (
              <SuggestPanel
                loading={recsLoading}
                error={recsError}
                data={recs}
                onAsk={askForRecommendations}
                onApply={applyShade}
                disabled={readOnly}
              />
            ) : (
              <FinderPanel
                picking={picking}
                onTogglePicking={() => {
                  setCanvasNote(null);
                  setPicking((p) => !p);
                }}
                pickedHex={pickedHex}
                onApply={applyShade}
                disabled={readOnly}
              />
            )}

            {saveError ? (
              <Text variant="caption" color={colors.warning}>
                {saveError}
              </Text>
            ) : null}
          </View>

          <View style={styles.actions}>
            <Button
              label={readOnly ? 'See the board' : 'Make the board'}
              size="lg"
              fullWidth
              disabled={!readOnly && paintedCount === 0}
              icon={<Ionicons name="document-text-outline" size={18} color="#fff" />}
              onPress={openBoard}
            />
            {!readOnly && paintedCount === 0 ? (
              <Text variant="caption" center>
                Paint at least one surface first — a board with nothing on it has nothing to take to the
                counter.
              </Text>
            ) : null}
            <Button
              label="Back to the surfaces"
              variant="secondary"
              fullWidth
              onPress={() => setStepOverride('adjust')}
            />
          </View>

          <Disclosure kind="colour" />
        </>
      )}

      <MaskStudioSheet
        visible={maskOpen}
        onClose={() => setMaskOpen(false)}
        projectId={id}
        photo={photo}
        regionCount={regions.length}
        editTarget={maskTarget}
        onSaved={onWallSaved}
      />

      <SheetModal visible={renameOpen} onClose={() => setRenameOpen(false)} title="Name this room">
        <View style={styles.sheet}>
          <Input
            label="Name"
            value={renameValue}
            onChangeText={setRenameValue}
            placeholder="Drawing room, front elevation…"
            autoCapitalize="sentences"
          />
          <Button label="Save" fullWidth loading={renaming} disabled={!renameValue.trim()} onPress={doRename} />
        </View>
      </SheetModal>

      {/* Picking a surface and deciding what to do with it are the same gesture
          here. They used to be two: chips along the top to select, loose text
          underneath to redraw, and a plus in the header to add — so which
          surface "redraw" meant was only knowable by looking back at which chip
          was lit. */}
      <SheetModal visible={wallMenuOpen} onClose={() => setWallMenuOpen(false)} title="Surfaces in this room">
        <View style={styles.sheet}>
          {regions.length === 0 ? (
            <Text variant="bodySoft">Nothing marked yet. Add the first surface below.</Text>
          ) : (
            regions.map((r, i) => {
              const c = appliedColor(r.id, r.appliedHexCode);
              const label = r.label ?? r.category ?? `Surface ${i + 1}`;
              return (
                <View key={r.id} style={styles.wallRow}>
                  <Pressable
                    onPress={() => {
                      haptics.select();
                      setSelectedRegionId(r.id);
                      setWallMenuOpen(false);
                    }}
                    style={styles.wallPick}
                    accessibilityRole="button"
                    accessibilityState={{ selected: r.id === selectedRegionId }}
                    accessibilityLabel={`Paint ${label}`}
                  >
                    <View style={[styles.chipDot, { backgroundColor: c?.hex ?? colors.surface2 }]} />
                    <Text
                      variant="body"
                      numberOfLines={1}
                      color={r.id === selectedRegionId ? colors.accentSoft : colors.fg}
                      style={styles.wallName}
                    >
                      {label}
                    </Text>
                    {r.id === selectedRegionId ? (
                      <Ionicons name="checkmark" size={16} color={colors.accentSoft} />
                    ) : null}
                  </Pressable>

                  <IconButton
                    icon="brush-outline"
                    label={`Redraw ${label}`}
                    onPress={() => {
                      setWallMenuOpen(false);
                      setMaskTarget({ id: r.id, label });
                      setMaskOpen(true);
                    }}
                  />
                  {/* Only hand-marked surfaces can go. An AI-detected one is
                      part of the detection result and the API refuses it. */}
                  {r.manual ? (
                    <IconButton
                      icon="trash-outline"
                      label={`Remove ${label}`}
                      onPress={() => {
                        setWallMenuOpen(false);
                        removeRegion(r.id);
                      }}
                    />
                  ) : null}
                </View>
              );
            })
          )}

          <Button
            label="Add a surface"
            variant="secondary"
            fullWidth
            icon={<Ionicons name="add" size={16} color={colors.fg} />}
            onPress={() => {
              setWallMenuOpen(false);
              setMaskTarget(null);
              setMaskOpen(true);
            }}
          />
        </View>
      </SheetModal>
    </Screen>
  );
}

/**
 * The wait while the model works.
 *
 * A component of its own so it can own the clock: it mounts when segmentation
 * starts and unmounts when it ends, which is what makes the elapsed count
 * correct with no effect resetting it and no counter to keep in sync.
 */
function SegmentingCard({ onLeave }: { onLeave: () => void }) {
  const elapsed = useElapsedSeconds();
  return (
    <WorkCard
      title="Finding the walls"
      subtitle="Cleaning the photo, then marking every surface"
      elapsedSeconds={elapsed}
      expectedSeconds={SEGMENT_SECONDS}
      note="You can leave this screen — it keeps going without you."
      cancelLabel="Leave it running"
      onCancel={onLeave}
    />
  );
}

/** Group the surfaces by what they are, for the step-4 summary. */
function summarise(regions: Region[]): { label: string; count: number; colour: string }[] {
  const buckets: Record<string, { label: string; colour: string }> = {
    MAIN_WALL: { label: 'Walls', colour: colors.accent },
    ACCENT_WALL: { label: 'Walls', colour: colors.accent },
    OTHER_WALL: { label: 'Walls', colour: colors.accent },
    CEILING: { label: 'Ceiling', colour: colors.warm },
    TRIM: { label: 'Trim', colour: colors.success },
    MANUAL: { label: 'Marked by hand', colour: colors.accentSoft },
  };
  const counts = new Map<string, { label: string; count: number; colour: string }>();
  regions.forEach((r) => {
    const key = (r.category ?? 'MANUAL').toUpperCase();
    const bucket = buckets[key] ?? { label: 'Other', colour: colors.fgMute };
    const found = counts.get(bucket.label);
    if (found) found.count += 1;
    else counts.set(bucket.label, { label: bucket.label, count: 1, colour: bucket.colour });
  });
  return [...counts.values()];
}

function Blocked({
  blocked,
  ask,
}: {
  blocked: { code: string; message: string };
  ask: ReturnType<typeof useRequestMoreProjects>;
}) {
  return (
    <Card accent={colors.warm}>
      <Text variant="eyebrow" color={colors.warm}>
        {blocked.code === API_CODES.ASK_RETAILER
          ? 'Your shop adds rooms'
          : blocked.code === API_CODES.PROJECT_LIMIT_REACHED
            ? 'This month’s rooms are used up'
            : 'A plan is needed'}
      </Text>
      <Text variant="bodySoft" style={styles.cardBody}>
        {blocked.message}
      </Text>
      {blocked.code === API_CODES.ASK_RETAILER ? (
        ask.isSuccess ? (
          <Text variant="label" color={colors.success} style={styles.cardAction}>
            Asked — your shop has been notified.
          </Text>
        ) : (
          <Button
            label="Ask my shop"
            variant="secondary"
            fullWidth
            style={styles.cardAction}
            loading={ask.isPending}
            onPress={() => ask.mutate()}
          />
        )
      ) : null}
    </Card>
  );
}

function Choice({
  icon,
  title,
  body,
  primary,
  disabled,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  primary?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic="press"
      activeScale={0.98}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}`}
      style={StyleSheet.flatten([styles.choice, primary ? styles.choicePrimary : null])}
    >
      <View style={[styles.choiceIcon, primary ? styles.choiceIconPrimary : null]}>
        <Ionicons name={icon} size={19} color={primary ? '#f7f5ff' : colors.fgSoft} />
      </View>
      <View style={styles.choiceText}>
        <Text variant="subhead">{title}</Text>
        <Text variant="caption">{body}</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={colors.fgMute} />
    </PressableScale>
  );
}

function IconButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      haptic="tap"
      activeScale={0.9}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.iconButton}
    >
      <Ionicons name={icon} size={16} color={colors.fgSoft} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: spacing.xxxl },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: hairline,
    borderColor: colors.glassEdge,
    backgroundColor: colors.glass,
  },
  pinned: { gap: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { flex: 1 },
  compare: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 32,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: hairline,
    borderColor: colors.glassEdge,
    backgroundColor: colors.glass,
  },
  compareOn: { borderColor: alpha(colors.accent, 0.5), backgroundColor: colors.accentGhost },
  photoWrap: { alignItems: 'center' },
  head: { gap: spacing.sm },
  choices: { gap: spacing.sm },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: hairline,
    borderColor: colors.glassEdgeSoft,
    backgroundColor: colors.glass,
  },
  choicePrimary: { borderColor: alpha(colors.accent, 0.45), backgroundColor: colors.glassStrong },
  choiceIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(colors.fg, 0.06),
  },
  choiceIconPrimary: { backgroundColor: colors.accent },
  choiceText: { flex: 1, gap: 3 },
  chipRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: hairline,
  },
  chipActive: { backgroundColor: colors.accentGhost, borderColor: colors.accent },
  chipIdle: { backgroundColor: colors.glass, borderColor: colors.glassEdgeSoft },
  chipDashed: { backgroundColor: 'transparent', borderColor: alpha(colors.accentSoft, 0.4) },
  chipDot: { width: 14, height: 14, borderRadius: 7, borderWidth: hairline, borderColor: colors.rule },
  summary: { gap: spacing.xs },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.cardTight,
    borderWidth: hairline,
    borderColor: colors.glassEdgeSoft,
    backgroundColor: colors.glass,
  },
  summaryDot: { width: 10, height: 10, borderRadius: 5 },
  summaryLabel: { flex: 1 },
  actions: { gap: spacing.sm },
  // The dock reads as one object below the photo, not three loose sections.
  dock: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.glass,
    borderWidth: hairline,
    borderColor: colors.glassEdgeSoft,
  },
  cardBody: { marginTop: spacing.xs },
  cardAction: { marginTop: spacing.md },
  sheet: { gap: spacing.sm },
  wallRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  wallPick: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    backgroundColor: colors.glass,
    borderWidth: hairline,
    borderColor: colors.glassEdgeSoft,
  },
  wallName: { flex: 1 },
});
