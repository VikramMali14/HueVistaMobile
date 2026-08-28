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
import { colors, spacing, radius, alpha, hairline, elevation, useElapsedSeconds } from '../theme';
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
import { shadeDisplay } from '../shades/shadeCodes';
import { isCatalogueShade, type Shade } from '../shades/types';
import { useRequestMoreProjects, useShadeCodeScheme } from '../account/queries';
import { expiryText } from '../account/expiry';
import { RoomPhoto, type CanvasMode } from './RoomPhoto';
import { BeforeAfter } from './BeforeAfter';
import { ColourPanel } from './ColourPanel';
import { SuggestPanel } from './SuggestPanel';
import { FinderPanel } from './FinderPanel';
import { MaskStudioSheet } from './MaskStudioSheet';
import { StepRail, type StepId } from './StepRail';
import { stepOfProject } from './roomStep';
import { summariseSurfaces } from './surfaceGroups';

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
  const [maskTarget, setMaskTarget] = useState<{
    id: number;
    label: string;
    category?: string | null;
  } | null>(null);
  const [wallMenuOpen, setWallMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  const [recs, setRecs] = useState<RecommendationResponse | null>(null);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recsError, setRecsError] = useState<string | null>(null);

  const askShop = useRequestMoreProjects();
  const shotRef = useRef<View>(null);
  // The shop's own numbering, so the code on the dock is the code at the
  // counter rather than the manufacturer's.
  const scheme = useShadeCodeScheme().data;

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

  /**
   * What is on a surface right now — the swatch just tapped, or what the server
   * holds for it.
   *
   * The persisted branch used to return the hex alone and drop the region's
   * `appliedShadeCode` on the floor; the one caller that wanted a code worked
   * around it by passing no region at all. So a room reopened the next day knew
   * which colour was on the wall but not which shade it was: nothing was ringed
   * in the catalogue, and the customer had to hunt down their own colour again
   * to be sure it was still the one they picked.
   */
  function appliedColor(region: Region | null | undefined): Applied | null {
    if (!region) return null;
    const override = overrides[region.id];
    if (override) return override;
    if (!region.appliedHexCode) return null;
    return { hex: region.appliedHexCode, code: region.appliedShadeCode ?? undefined };
  }

  const layers: PaintLayer[] = regions
    .map((r) => {
      const c = appliedColor(r);
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
    // A palette suggestion the model matched to no product is a hex and nothing
    // more. It goes on the wall like any other colour, but it is not a shade
    // code — sending one invents a product, and "Recently used" is a way back
    // to a shade, which a colour with no catalogue entry is not.
    const catalogue = isCatalogueShade(shade);
    if (catalogue) remember(shade);
    setOverrides((prev) => ({
      ...prev,
      [selectedRegionId]: { hex: shade.hex, code: catalogue ? shade.code : undefined },
    }));
    try {
      await projectsApi.updateRegionColors(id, [
        { regionId: selectedRegionId, shadeCode: catalogue ? shade.code : null, hexCode: shade.hex },
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

  const selectedColour = appliedColor(selectedRegion);

  const canvasMode: CanvasMode = picking ? 'pick' : 'idle';
  /**
   * The screen sits in the light of whatever colour is in play — the paint on
   * the selected surface, or the colour just lifted out of the photo. It is the
   * one place in the app where the background knows what the user is doing.
   */
  const tint = pickedHex ?? selectedColour?.hex ?? null;

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
            auto
            title="Find them for me"
            cost="about a minute"
            body="The model marks every wall, ceiling and trim it can see. Anything it gets wrong is redrawn on the next step."
            primary
            disabled={starting}
            onPress={() => startSegmentation('AUTO')}
          />
          <Choice
            title="I'll mark them myself"
            cost="a few minutes"
            body="Trace round each surface with a finger, or drop a corner at a time. Slower, exact, and it always works."
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
        const c = appliedColor(r);
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
            <SurfaceSwatch hex={c?.hex ?? null} />
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
          style={[styles.chip, styles.chipGhost]}
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
            {summariseSurfaces(regions, appliedColor).map((row) => (
              <View key={row.label} style={styles.summaryRow}>
                <Text variant="label">{row.label}</Text>
                {/* A leader rule to the count, the way a contents page runs one
                    to a page number. What used to sit here was a coloured dot
                    per category — violet for walls, warm for the ceiling, sage
                    for trim — three colours this product uses for other things
                    entirely, standing in for nothing. */}
                <View style={styles.summaryLead} />
                {row.hexes.length > 0 ? (
                  <View style={styles.summarySwatches}>
                    {row.hexes.map((hex, i) => (
                      <View
                        key={`${hex}-${i}`}
                        style={[styles.summarySwatch, { backgroundColor: hex }]}
                      />
                    ))}
                  </View>
                ) : null}
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
                icon={<Ionicons name="color-palette-outline" size={18} color={colors.onFill} />}
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
            {/* What is being painted, and what is on it — the one line the three
                pickers below all act on. It used to be a grey caption under the
                tabs saying "Painting Main wall", which put the target of every
                tap in the smallest type on the screen. */}
            <View style={styles.dockHead}>
              <SurfaceSwatch hex={selectedColour?.hex ?? null} />
              <Text variant="label" numberOfLines={1} color={colors.fg} style={styles.dockTarget}>
                {selectedRegion
                  ? (selectedRegion.label ?? selectedRegion.category ?? 'Selected surface')
                  : 'No surface chosen'}
              </Text>
              <Text variant="code">
                {selectedColour
                  ? selectedColour.code
                    ? shadeDisplay(scheme, { code: selectedColour.code }).code
                    : selectedColour.hex.toUpperCase()
                  : 'bare'}
              </Text>
            </View>

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

            {!readOnly && !selectedRegion ? (
              <Text variant="caption">Choose a surface above, then a colour.</Text>
            ) : null}

            {dock === 'shades' ? (
              <ColourPanel
                onPick={applyShade}
                selectedCode={selectedColour?.code ?? null}
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
              icon={<Ionicons name="document-text-outline" size={18} color={colors.onFill} />}
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
              const c = appliedColor(r);
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
                    <SurfaceSwatch hex={c?.hex ?? null} />
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
                      // The category travels with the target so replacing an
                      // outline cannot reclassify the surface it belongs to.
                      setMaskTarget({ id: r.id, label, category: r.category });
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

/**
 * The colour on one surface, as a chip.
 *
 * A bare surface is struck through rather than filled with a dark grey, which
 * is what it used to be — and a dark grey dot on a dark row reads as a colour
 * that happens to be nearly black, not as nothing.
 */
function SurfaceSwatch({ hex }: { hex: string | null }) {
  return (
    <View
      style={[
        styles.chipSwatch,
        hex ? { backgroundColor: hex, borderColor: alpha(hex, 0.65) } : styles.chipSwatchBare,
      ]}
    >
      {hex ? null : <View style={styles.chipSwatchStrike} />}
    </View>
  );
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

/**
 * The two ways to find a wall, each showing what it produces.
 *
 * This was a pair of rows built the way every generated list row is built — a
 * rounded tile with an icon in it, a title, a grey line, a chevron — and the
 * icon doing the explaining was `sparkles`, which in this product means
 * nothing at all beyond "AI happened here". The two options are not two menu
 * entries; they are two different results, and a customer choosing between
 * them is choosing between an outline a model drew and an outline they draw.
 * So each one shows its own outline instead of an icon, and says what it
 * costs in time rather than being ranked by a chevron.
 */
function Choice({
  auto,
  title,
  cost,
  body,
  primary,
  disabled,
  onPress,
}: {
  /** Draw the surface as the model finds it — filled — rather than as a trace. */
  auto?: boolean;
  title: string;
  /** How long it takes, in words. Set beside the title, not buried in the body. */
  cost: string;
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
      accessibilityLabel={`${title}, ${cost}. ${body}`}
      style={StyleSheet.flatten([styles.choice, primary ? styles.choicePrimary : null])}
    >
      <WallGlyph auto={auto} />
      <View style={styles.choiceText}>
        <View style={styles.choiceTitle}>
          <Text variant="subhead">{title}</Text>
          <Text variant="caption" color={colors.fgMute}>
            {cost}
          </Text>
        </View>
        <Text variant="caption">{body}</Text>
      </View>
    </PressableScale>
  );
}

/**
 * A room, four centimetres wide: back wall, return wall, floor.
 *
 * `auto` washes the back wall the way the mask studio washes a detected
 * surface; without it the wall is a dashed trace with two corner handles, the
 * way it looks while somebody is marking it by hand. Same colours as the real
 * thing, so the picture on the button is a picture of what the button does.
 */
function WallGlyph({ auto }: { auto?: boolean }) {
  return (
    <View style={styles.glyph}>
      <View style={[styles.glyphWall, auto ? styles.glyphWallAuto : styles.glyphWallManual]} />
      {auto ? null : (
        <>
          <View style={[styles.glyphHandle, styles.glyphHandleTL]} />
          <View style={[styles.glyphHandle, styles.glyphHandleBR]} />
        </>
      )}
      <View style={styles.glyphReturn} />
      <View style={styles.glyphFloor} />
    </View>
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
  choiceText: { flex: 1, gap: 3 },
  choiceTitle: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  /* The little room. See `WallGlyph`. */
  glyph: {
    width: 52,
    height: 40,
    borderRadius: radius.chip,
    backgroundColor: alpha(colors.fg, 0.05),
    borderWidth: hairline,
    borderColor: colors.glassEdgeSoft,
  },
  glyphWall: { position: 'absolute', left: 6, top: 6, right: 19, bottom: 12, borderRadius: 2 },
  glyphWallAuto: {
    backgroundColor: alpha(colors.mark, 0.45),
    borderWidth: hairline,
    borderColor: colors.markEdge,
  },
  glyphWallManual: {
    borderWidth: hairline,
    borderStyle: 'dashed',
    borderColor: alpha(colors.fg, 0.55),
    // Square, because Android drops the dashes on a rounded border and the
    // trace would come back as a plain rectangle — which is what the filled
    // one already is.
    borderRadius: 0,
  },
  glyphHandle: { position: 'absolute', width: 4, height: 4, backgroundColor: colors.onPhoto },
  glyphHandleTL: { left: 4, top: 4 },
  glyphHandleBR: { right: 17, bottom: 10 },
  /** The wall that turns the corner — always plain, it is not what is being marked. */
  glyphReturn: {
    position: 'absolute',
    right: 6,
    top: 10,
    width: 10,
    bottom: 12,
    borderRadius: 2,
    backgroundColor: alpha(colors.fg, 0.11),
  },
  glyphFloor: {
    position: 'absolute',
    left: 6,
    right: 6,
    bottom: 6,
    height: 4,
    borderRadius: 2,
    backgroundColor: alpha(colors.fg, 0.08),
  },
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
  /** The "Edit" chip at the end of the strip: an outline, not a surface. */
  chipGhost: { backgroundColor: 'transparent', borderColor: alpha(colors.accentSoft, 0.4) },
  /** A paint chip, not a dot: the corner of a shade card. */
  chipSwatch: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: hairline,
    borderColor: colors.rule,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  chipSwatchBare: { backgroundColor: 'transparent', borderColor: alpha(colors.fg, 0.3) },
  chipSwatchStrike: {
    width: 22,
    height: hairline,
    backgroundColor: alpha(colors.fg, 0.3),
    transform: [{ rotate: '-45deg' }],
  },
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
  /** The run from a label to its count, the way a contents page sets one. */
  summaryLead: { flex: 1, height: hairline, backgroundColor: alpha(colors.fg, 0.12) },
  summarySwatches: { flexDirection: 'row', gap: 3 },
  summarySwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: hairline,
    borderColor: colors.rule,
  },
  actions: { gap: spacing.sm },
  /**
   * The dock reads as one object below the photo, not three loose sections —
   * and as a tool rather than as content.
   *
   * It used to be another 20pt glass card, which is what every other block on
   * every other screen is, so the thing that changes the wall looked like the
   * thing that describes it. This is the app's own panel ground at the tight
   * chrome radius the shape scale reserves for exactly this: a near-solid
   * instrument sitting under the room, lit along its top edge.
   */
  dock: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.cardTight,
    backgroundColor: colors.panel,
    borderWidth: hairline,
    borderColor: colors.glassEdgeSoft,
    borderTopColor: colors.glassEdge,
    ...elevation.low,
  },
  dockHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dockTarget: { flex: 1 },
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
