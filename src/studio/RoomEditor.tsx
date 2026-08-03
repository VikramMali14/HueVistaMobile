import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import { captureRef } from 'react-native-view-shot';
import {
  BackLink,
  Button,
  Card,
  Input,
  PressableScale,
  Screen,
  Segmented,
  SheetModal,
  StatusPill,
  Text,
} from '../components';
import { colors, spacing, radius, alpha } from '../theme';
import { haptics } from '../haptics';
import { useProject } from '../projects/queries';
import {
  ApiError,
  API_CODES,
  formatPaise,
  formatPoints,
  hasCode,
  projectsApi,
  recommendationsApi,
  regionMaskUrl,
  resolveImageUrl,
  webUrl,
  type Region,
  type RecommendationResponse,
} from '../api';
import { fitBox, samplePhotoHex, useAuthedSkImageState, type PaintLayer } from '../engine';
import { useRecentShades } from '../shades/recentShades';
import type { Shade } from '../shades/types';
import {
  useProjectPurchaseOptions,
  useRequestMoreProjects,
} from '../account/queries';
import { expiryText } from '../account/EntitlementCard';
import { RoomPhoto, type CanvasMode } from './RoomPhoto';
import { ColourPanel } from './ColourPanel';
import { SuggestPanel } from './SuggestPanel';
import { FinderPanel } from './FinderPanel';
import { MaskStudioSheet } from './MaskStudioSheet';

type Applied = { hex: string; code?: string };

/** Which of the three tools is docked under the photo. */
type DockTab = 'colours' | 'suggest' | 'finder';

const DOCK_OPTIONS: readonly { value: DockTab; label: string }[] = [
  { value: 'colours', label: 'Colours' },
  { value: 'suggest', label: 'Suggest' },
  { value: 'finder', label: 'Finder' },
];

/**
 * The room editor.
 *
 * Everything a room needs is now on one screen, in the order it is wanted: the
 * photo at its own shape, the walls in it, and — docked directly underneath —
 * the three ways of choosing a colour. Those three used to be somewhere else
 * entirely: the catalogue took over the whole phone, the palette ideas came up
 * as a sheet over the room, and the colour finder existed only on the website.
 * All of them hid or omitted the wall, which is the one thing a visualizer is
 * for looking at.
 */
export function RoomEditor({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();

  const { data: project, isLoading } = useProject(id);
  const status = project?.status;
  const regions = project?.regions ?? [];

  const photoUrl = resolveImageUrl(project?.cleanedImageUrl ?? project?.imageUrl);
  const { image: photo, status: photoStatus, reload: reloadPhoto } = useAuthedSkImageState(photoUrl);

  const { remember } = useRecentShades();

  const [overrides, setOverrides] = useState<Record<number, Applied>>({});
  const [selectedRegionId, setSelectedRegionId] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [segmentError, setSegmentError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [dock, setDock] = useState<DockTab>('colours');
  const [picking, setPicking] = useState(false);
  const [pickedHex, setPickedHex] = useState<string | null>(null);
  const [canvasNote, setCanvasNote] = useState<string | null>(null);

  const [maskOpen, setMaskOpen] = useState(false);
  const [maskTarget, setMaskTarget] = useState<{ id: number; label: string } | null>(null);
  /**
   * "Mark walls myself" was pressed and the photo clean-up is still running.
   * When it lands, the marking popup opens on its own — the alternative is a
   * ready screen with no obvious next move, which is what made hand-marking
   * look broken even when it worked.
   */
  const [openMaskWhenReady, setOpenMaskWhenReady] = useState(false);

  /**
   * View-only: the room and its last colours are all still here — what has ended
   * is the ability to change them. Stated once, above the canvas, with the way
   * out, rather than as a failure on every swatch the user taps.
   */
  const readOnly = project?.readOnly ?? false;
  /** What a reopen costs in points — the shop rail, and the cheaper one. */
  const reopenPoints = project?.reopenPricePoints ?? 0;
  /**
   * The same reopen paid by card. Flat, unlike a new project, so it does not move
   * with the plan. Only a shop account can read this (points are a shop currency,
   * so the endpoint is retailer-only) — a customer simply gets no second price,
   * which is right: their way back in is their shop, not a checkout.
   */
  const reopenPaise = useProjectPurchaseOptions().data?.reopenPricePaise ?? 0;

  // A shop-onboarded customer who is out of projects asks the shop, not Checkout.
  const askRetailer = useRequestMoreProjects();
  const [blocked, setBlocked] = useState<{ code: string; message: string } | null>(null);

  // AI suggest · Share · Save · Rename.
  const [recs, setRecs] = useState<RecommendationResponse | null>(null);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recsError, setRecsError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [savingImg, setSavingImg] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const shotRef = useRef<View>(null);

  // Select the first region once segmentation lands (guarded one-time set).
  if (selectedRegionId == null && regions.length > 0) {
    setSelectedRegionId(regions[0].id);
  }

  // The photo drives the canvas rather than the other way round: its own aspect
  // ratio, at the content width, so none of the room is cropped away.
  const contentWidth = Math.round(width - spacing.lg * 2);
  const canvas = fitBox(photo?.width(), photo?.height(), { maxWidth: contentWidth });

  const segmented = status === 'SEGMENTED';
  const editable = !readOnly && segmented;

  // Opening the marking popup the moment a hand-marked room finishes cleaning.
  if (openMaskWhenReady && segmented && !maskOpen) {
    setOpenMaskWhenReady(false);
    setMaskTarget(null);
    setMaskOpen(true);
  }

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

  async function applyShade(shade: Shade) {
    if (selectedRegionId == null || readOnly) {
      setSaveError(
        readOnly
          ? null
          : 'Choose a wall first — tap one of the wall chips under the photo.',
      );
      return;
    }
    // The paint lands immediately; the save that follows is silent unless it
    // fails, so a failed autosave gets its own warning buzz rather than only a
    // line of text under a tray the user is still scrolling.
    haptics.press();
    remember(shade);
    setOverrides((prev) => ({ ...prev, [selectedRegionId]: { hex: shade.hex, code: shade.code } }));
    try {
      // Per-swatch autosave (PLAN §5). Backend returns 204.
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
   * Claude's palettes for this exact room. Included in the project now rather
   * than charged per ask, and sized to the room: a photo with one wall marked
   * comes back with one colour, not three the user has nowhere to put. Still
   * fetched only on request, because it is a real model call and a slow one.
   */
  async function askForRecommendations() {
    if (recsLoading) return;
    setRecsLoading(true);
    setRecsError(null);
    try {
      setRecs(await recommendationsApi.get(id));
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        // The only 402 left here: the project's own access window has closed.
        setRecsError('This room’s access has ended. Reopen it to get suggestions.');
      } else {
        setRecsError(err instanceof ApiError ? err.message : 'Couldn’t get suggestions. Please try again.');
      }
    } finally {
      setRecsLoading(false);
    }
  }

  /**
   * Withdraw the public link.
   *
   * Sharing is the one action here that hands a stranger the ability to repaint
   * the room, so the person who sent it needs a way to take that back without
   * deleting the project itself.
   */
  async function doRevokeShare() {
    setActionError(null);
    setActionMsg(null);
    try {
      await projectsApi.revokeShare(id);
      await queryClient.invalidateQueries({ queryKey: ['projects', id] });
      setActionMsg('Link withdrawn — the old address no longer opens.');
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Couldn’t withdraw that link.');
    }
  }

  /** Rename the room. The name is the only thing about it a user can edit here. */
  async function doRename() {
    const name = renameValue.trim();
    if (!name) return;
    setRenaming(true);
    setActionError(null);
    try {
      await projectsApi.update(id, { name });
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      setRenameOpen(false);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Couldn’t rename this room.');
    } finally {
      setRenaming(false);
    }
  }

  /** Delete, with the cost named first — the room and its colours both go. */
  function confirmDelete() {
    Alert.alert(
      'Delete this room?',
      'The photo and every colour you applied are removed for good. This cannot be undone.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await projectsApi.remove(id);
              await queryClient.invalidateQueries({ queryKey: ['projects'] });
              router.back();
            } catch (err) {
              setActionError(err instanceof ApiError ? err.message : 'Couldn’t delete this room.');
            }
          },
        },
      ],
    );
  }

  async function doShare() {
    setSharing(true);
    setActionError(null);
    setActionMsg(null);
    try {
      // 10 days is the ceiling: a share link hands over the same repaint
      // capability a walk-in code does, so the two expire on the same clock.
      const res = await projectsApi.share(id, { days: 10 });
      await queryClient.invalidateQueries({ queryKey: ['projects', id] });
      await Share.share({ message: `See my room in HueVista: ${res.shareUrl}`, url: res.shareUrl });
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Couldn’t create a share link.');
    } finally {
      setSharing(false);
    }
  }

  async function doSaveImage() {
    setActionError(null);
    setActionMsg(null);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        setActionError('Photos permission is needed to save. You can enable it in Settings.');
        return;
      }
      setSavingImg(true);
      const uri = await captureRef(shotRef, { format: 'png', quality: 1 });
      await MediaLibrary.saveToLibraryAsync(uri);
      setActionMsg('Saved to your Photos ✓');
    } catch {
      setActionError('Couldn’t save the image. Please try again.');
    } finally {
      setSavingImg(false);
    }
  }

  /**
   * Start wall detection.
   *
   * AUTO runs AI detection; MANUAL stops after the photo clean-up so the walls
   * are marked by hand. Neither costs anything here any more: the project's
   * credit was taken when the project was CREATED, so by the time this runs the
   * work is already paid for — and a retry after a failure is free too. What
   * separates the two modes now is the result, not the price.
   */
  async function startSegmentation(mode: 'AUTO' | 'MANUAL' = 'AUTO') {
    setStarting(true);
    setSegmentError(null);
    setBlocked(null);
    try {
      await projectsApi.segment(id, mode);
      setOpenMaskWhenReady(mode === 'MANUAL');
      await queryClient.invalidateQueries({ queryKey: ['projects', id] });
    } catch (err) {
      if (hasCode(err, API_CODES.ASK_RETAILER)) {
        setBlocked({ code: API_CODES.ASK_RETAILER, message: (err as ApiError).message });
      } else if (hasCode(err, API_CODES.SUBSCRIPTION_REQUIRED)) {
        setBlocked({ code: API_CODES.SUBSCRIPTION_REQUIRED, message: (err as ApiError).message });
      } else if (hasCode(err, API_CODES.PROJECT_LIMIT_REACHED)) {
        setBlocked({ code: API_CODES.PROJECT_LIMIT_REACHED, message: (err as ApiError).message });
      } else if (err instanceof ApiError && err.status === 402) {
        setSegmentError(err.message || 'This room can’t be worked on right now.');
      } else if (err instanceof ApiError && err.status === 409) {
        await queryClient.invalidateQueries({ queryKey: ['projects', id] }); // already running
      } else {
        setSegmentError(err instanceof ApiError ? err.message : 'Could not start wall detection.');
      }
    } finally {
      setStarting(false);
    }
  }

  /** Remove a wall the user marked by hand. AI-detected ones are protected (400). */
  async function removeRegion(regionId: number) {
    setActionError(null);
    try {
      await projectsApi.deleteRegion(id, regionId);
      setSelectedRegionId(null);
      await queryClient.invalidateQueries({ queryKey: ['projects', id] });
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Couldn’t remove that wall.');
    }
  }

  function openMarking(target: { id: number; label: string } | null) {
    setMaskTarget(target);
    setMaskOpen(true);
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
  // The screen sits in the light of whatever colour is currently in play: the
  // paint on the selected wall, or — while the finder is open — the colour just
  // lifted out of the photo.
  const tint =
    pickedHex ??
    (selectedRegion ? appliedColor(selectedRegion.id, selectedRegion.appliedHexCode)?.hex ?? null : null);
  const busyLabel =
    status === 'SEGMENTING'
      ? 'Detecting walls… this usually takes 30–90 seconds'
      : null;

  return (
    <Screen scroll aurora tint={tint} contentStyle={styles.content}>
      <View style={styles.header}>
        <BackLink />
        {status ? (
          <StatusPill
            label={statusLabel(status)}
            tone={status === 'FAILED' ? 'expired' : segmented ? 'done' : 'progress'}
          />
        ) : null}
      </View>

      <View style={styles.titleRow}>
        <Text variant="title" numberOfLines={1} style={styles.titleText}>
          {project?.name ?? 'Room'}
        </Text>
        {!readOnly ? (
          <View style={styles.titleActions}>
            <Pressable
              onPress={() => {
                setRenameValue(project?.name ?? '');
                setRenameOpen(true);
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Rename this room"
            >
              <Ionicons name="pencil" size={18} color={colors.fgSoft} />
            </Pressable>
            <Pressable
              onPress={confirmDelete}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Delete this room"
            >
              <Ionicons name="trash-outline" size={18} color={colors.fgSoft} />
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* A live share link is a capability someone else is holding, so it is
          stated where the owner can see it — and withdrawn from the same place. */}
      {project?.hasShareLink && !readOnly ? (
        <View style={styles.shareState}>
          <Text variant="caption" color={colors.fgSoft}>
            Shared link is live
            {project.shareExpiresAt ? ` · ends ${expiryText(project.shareExpiresAt)}` : ''}
          </Text>
          <Pressable onPress={doRevokeShare} hitSlop={8} accessibilityRole="button">
            <Text variant="label" color={colors.warning}>
              Withdraw
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* View-only. Said once, above the canvas, with the one action that fixes
          it — not as a failure on every swatch. */}
      {readOnly ? (
        <Card style={styles.viewOnly}>
          <Text variant="label" color={colors.warning}>
            View only
          </Text>
          <Text variant="bodySoft" style={{ marginTop: spacing.xs }}>
            {project?.readOnlyReason ??
              'This project is view-only — you can still see the colours that were last applied.'}
          </Text>
          {reopenPoints > 0 ? (
            <View style={styles.reopen}>
              {/* Both rails, when both are open to this account: points are the
                  cheaper one, so they lead and the card price sits beside them. */}
              <Text variant="body">
                Reopening it costs {formatPoints(reopenPoints)}
                {reopenPaise > 0 ? `, or ${formatPaise(reopenPaise)} by card` : ''}.
              </Text>
              {webUrl('/dashboard') ? (
                <Button
                  label="Reopen on the website"
                  variant="secondary"
                  fullWidth
                  onPress={() => Linking.openURL(webUrl('/dashboard') as string).catch(() => {})}
                />
              ) : (
                <Text variant="caption">
                  Reopening runs on the HueVista website — open your dashboard there to reopen this room.
                </Text>
              )}
            </View>
          ) : null}
        </Card>
      ) : project?.accessExpiresAt && expiryText(project.accessExpiresAt) ? (
        <Text variant="caption">Open until {expiryText(project.accessExpiresAt)}</Text>
      ) : null}

      <RoomPhoto
        ref={shotRef}
        photo={isLoading ? null : photo}
        photoStatus={photoStatus}
        onReload={reloadPhoto}
        layers={segmented ? layers : []}
        width={canvas.width}
        height={canvas.height}
        mode={canvasMode}
        onTap={liftColour}
        onMiss={() => setCanvasNote('That spot is outside the photo. Tap somewhere on the room.')}
        busyLabel={busyLabel}
        hint={picking ? 'Tap the colour you want to match' : null}
      />

      {canvasNote ? (
        <Text variant="caption" color={colors.warning}>
          {canvasNote}
        </Text>
      ) : null}

      {/* A refusal the user can act on: what stopped, and the way through. */}
      {blocked ? (
        <Card>
          <Text variant="label" color={colors.warning}>
            {blocked.code === API_CODES.ASK_RETAILER
              ? 'Your shop adds projects'
              : blocked.code === API_CODES.PROJECT_LIMIT_REACHED
                ? 'This month’s projects are used up'
                : 'Subscription needed'}
          </Text>
          <Text variant="bodySoft" style={{ marginTop: spacing.xs }}>
            {blocked.message}
          </Text>
          {blocked.code === API_CODES.ASK_RETAILER ? (
            askRetailer.isSuccess ? (
              <Text variant="label" color={colors.success} style={styles.gateAction}>
                Asked ✓ — your shop has been notified.
              </Text>
            ) : (
              <Button
                label="Ask my shop"
                variant="secondary"
                fullWidth
                style={styles.gateAction}
                loading={askRetailer.isPending}
                onPress={() => askRetailer.mutate()}
              />
            )
          ) : null}
        </Card>
      ) : null}

      {status === 'CREATED' || status === 'FAILED' ? (
        <View style={styles.block}>
          {status === 'FAILED' ? (
            <Card>
              <Text variant="label" color={colors.danger}>
                Wall detection failed
              </Text>
              <Text variant="bodySoft" style={{ marginTop: spacing.xs }}>
                {project?.failureReason ?? 'Something went wrong during detection.'}
              </Text>
            </Card>
          ) : (
            <Text variant="bodySoft">Detect the walls in this photo so you can paint them.</Text>
          )}
          {segmentError ? (
            <Text variant="body" color={colors.danger}>
              {segmentError}
            </Text>
          ) : null}
          <Button
            label={status === 'FAILED' ? 'Try detection again' : 'Detect walls'}
            size="lg"
            fullWidth
            loading={starting}
            onPress={() => startSegmentation('AUTO')}
          />
          {/* Free on every plan, so it is offered up front rather than kept as
              the consolation prize after a refused AI run. */}
          <Button
            label="Mark walls myself"
            variant="secondary"
            fullWidth
            disabled={starting}
            icon={<Ionicons name="brush-outline" size={16} color={colors.fg} />}
            onPress={() => startSegmentation('MANUAL')}
          />
        </View>
      ) : null}

      {segmented ? (
        <>
          {/* Walls — the chips, and the way to add or fix one. */}
          <View style={styles.block}>
            <View style={styles.blockHead}>
              <Text variant="overline">{regions.length === 1 ? 'Wall' : 'Walls'}</Text>
              {editable ? (
                <PressableScale
                  onPress={() => openMarking(null)}
                  haptic="tap"
                  activeScale={0.94}
                  accessibilityRole="button"
                  accessibilityLabel="Mark another wall"
                  style={styles.headChip}
                >
                  <Ionicons name="add" size={15} color={colors.accentSoft} />
                  <Text variant="label" color={colors.accentSoft}>
                    Mark a wall
                  </Text>
                </PressableScale>
              ) : null}
            </View>

            {regions.length === 0 ? (
              <Card>
                <Text variant="bodySoft">
                  {project?.maskMode === 'MANUAL'
                    ? 'Your photo is ready. Mark each wall you want to paint and we’ll cut it out for you.'
                    : 'No walls were detected automatically — mark them yourself and the room is ready to paint.'}
                </Text>
                {editable ? (
                  <Button
                    label="Mark a wall"
                    fullWidth
                    style={styles.gateAction}
                    icon={<Ionicons name="scan-outline" size={16} color="#fff" />}
                    onPress={() => openMarking(null)}
                  />
                ) : null}
              </Card>
            ) : (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowGap}>
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
                        style={[styles.regionChip, active ? styles.regionChipActive : styles.regionChipIdle]}
                      >
                        <View
                          style={[
                            styles.regionDot,
                            { backgroundColor: c?.hex ?? colors.surface2, borderColor: colors.rule },
                          ]}
                        />
                        <Text variant="label" color={active ? colors.accentSoft : colors.fgSoft}>
                          {r.label ?? r.category ?? `Wall ${i + 1}`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {editable && selectedRegion ? (
                  <View style={styles.regionActions}>
                    {/* Redrawing works on AI-detected walls too — it is how a
                        mask that took half a pillar gets fixed without a second
                        AI run. The old outline is replaced, not edited. */}
                    <Pressable
                      onPress={() =>
                        openMarking({
                          id: selectedRegion.id,
                          label: selectedRegion.label ?? `Wall ${regions.indexOf(selectedRegion) + 1}`,
                        })
                      }
                      hitSlop={8}
                      accessibilityRole="button"
                    >
                      <Text variant="label" color={colors.accentSoft}>
                        Redraw this wall
                      </Text>
                    </Pressable>
                    {selectedRegion.manual ? (
                      <Pressable onPress={() => removeRegion(selectedRegion.id)} hitSlop={8} accessibilityRole="button">
                        <Text variant="label" color={colors.danger}>
                          Remove
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </>
            )}
          </View>

          {/* The dock. Three ways to choose a colour, all of them under the
              photo they change, none of them covering it. */}
          {regions.length > 0 ? (
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
                    ? `Painting ${selectedRegion.label ?? 'the selected wall'}`
                    : 'Choose a wall above, then a colour.'}
                </Text>
              ) : null}

              {dock === 'colours' ? (
                <ColourPanel
                  onPick={applyShade}
                  selectedCode={selectedRegionId != null ? appliedColor(selectedRegionId, null)?.code : null}
                  disabled={readOnly}
                />
              ) : dock === 'suggest' ? (
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
          ) : null}

          {/* Share · Save, under the tools rather than above them: they are what
              you do when the painting is finished. */}
          <View style={styles.actionsRow}>
            <Button
              label="Share"
              variant="secondary"
              loading={sharing}
              icon={<Ionicons name="share-outline" size={16} color={colors.fg} />}
              onPress={doShare}
              style={styles.actionBtn}
            />
            <Button
              label="Save image"
              variant="secondary"
              loading={savingImg}
              icon={<Ionicons name="download-outline" size={16} color={colors.fg} />}
              onPress={doSaveImage}
              style={styles.actionBtn}
            />
          </View>
          {actionError ? (
            <Text variant="caption" color={colors.danger}>
              {actionError}
            </Text>
          ) : actionMsg ? (
            <Text variant="caption" color={colors.success}>
              {actionMsg}
            </Text>
          ) : null}
        </>
      ) : null}

      {status === 'SEGMENTING' ? (
        <View style={styles.centre}>
          <ActivityIndicator color={colors.accent} />
          <Text variant="bodySoft" center style={styles.gateAction}>
            Cleaning the photo and finding the walls. You can leave this screen — it keeps going.
          </Text>
        </View>
      ) : null}

      <MaskStudioSheet
        visible={maskOpen}
        onClose={() => setMaskOpen(false)}
        projectId={id}
        photo={photo}
        regionCount={regions.length}
        editTarget={maskTarget}
        onSaved={onWallSaved}
      />

      <SheetModal visible={renameOpen} onClose={() => setRenameOpen(false)} title="Rename this room">
        <View style={styles.renameSheet}>
          <Input
            label="Name"
            value={renameValue}
            onChangeText={setRenameValue}
            placeholder="Living room, front elevation…"
            autoCapitalize="sentences"
          />
          <Button label="Save" fullWidth loading={renaming} disabled={!renameValue.trim()} onPress={doRename} />
        </View>
      </SheetModal>
    </Screen>
  );
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

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: spacing.xxxl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  titleText: { flexShrink: 1 },
  titleActions: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center' },
  shareState: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  renameSheet: { gap: spacing.md },
  block: { gap: spacing.sm },
  blockHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.accentGhost,
    borderWidth: 1,
    borderColor: alpha(colors.accentSoft, 0.3),
  },
  viewOnly: { borderColor: colors.warning + '55' },
  reopen: { marginTop: spacing.md, gap: spacing.sm },
  gateAction: { marginTop: spacing.md },
  rowGap: { gap: spacing.sm, paddingVertical: spacing.xs },
  regionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  regionChipActive: { backgroundColor: colors.accentGhost, borderColor: colors.accent },
  regionChipIdle: { backgroundColor: colors.surface, borderColor: colors.rule },
  regionDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1 },
  regionActions: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center' },
  // The dock reads as one object below the photo, not three loose sections.
  dock: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassEdge,
  },
  actionsRow: { flexDirection: 'row', gap: spacing.md },
  actionBtn: { flex: 1 },
  centre: { paddingVertical: spacing.xl, alignItems: 'center' },
});
