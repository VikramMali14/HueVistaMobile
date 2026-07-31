import { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  Share,
  Linking,
  type GestureResponderEvent,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library';
import { captureRef } from 'react-native-view-shot';
import { Text, Button, Card, StatusPill } from '../../src/components';
import { colors, spacing, radius } from '../../src/theme';
import { useProject } from '../../src/projects/queries';
import {
  projectsApi,
  regionMaskUrl,
  resolveImageUrl,
  recommendationsApi,
  ApiError,
  API_CODES,
  hasCode,
  formatPaise,
  formatPoints,
  webUrl,
  RecommendationResponse,
} from '../../src/api';
import { useAuthedSkImage, PaintedPhoto, PaintLayer } from '../../src/engine';
import { usePopularShades } from '../../src/shades/queries';
import { summaryToShade, Shade } from '../../src/shades/types';
import { SAMPLE_SHADES } from '../../src/shades/sampleShades';
import { shadeDisplay } from '../../src/shades/shadeCodes';
import { RecommendationsSheet } from '../../src/projects/RecommendationsSheet';
import {
  useProjectPurchaseOptions,
  useRequestMoreProjects,
  useShadeCodeScheme,
} from '../../src/account/queries';
import { expiryText } from '../../src/account/EntitlementCard';

type Applied = { hex: string; code?: string };

/** How wall detection was asked for: AI, or by hand (free on every plan). */
type MaskMode = 'AUTO' | 'MANUAL';

export default function ProjectEditor() {
  const raw = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(raw.id) ? raw.id[0] : raw.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();

  const { data: project, isLoading } = useProject(id);
  const status = project?.status;
  const regions = project?.regions ?? [];

  const photoUrl = resolveImageUrl(project?.cleanedImageUrl ?? project?.imageUrl);
  const photo = useAuthedSkImage(photoUrl);

  // How this shop labels a colour: its own code pattern, names shown or hidden.
  const scheme = useShadeCodeScheme().data;

  // Shade tray: live popular shades, sample as offline fallback.
  const popular = (usePopularShades(12).data ?? []).map(summaryToShade).filter((s): s is Shade => s !== null);
  const tray = popular.length > 0 ? popular : SAMPLE_SHADES;

  const [overrides, setOverrides] = useState<Record<number, Applied>>({});
  const [selectedRegionId, setSelectedRegionId] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [segmentError, setSegmentError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  // Marking walls by hand: free on every plan, and the way through when AI
  // wall-detection isn't available. A tap on the photo segments that surface.
  const [marking, setMarking] = useState(false);
  const [markBusy, setMarkBusy] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);

  // A shop-onboarded customer who is out of projects asks the shop, not Checkout.
  const askRetailer = useRequestMoreProjects();
  const [blocked, setBlocked] = useState<{ code: string; message: string } | null>(null);

  // AI suggest + Share.
  const [recsOpen, setRecsOpen] = useState(false);
  const [recs, setRecs] = useState<RecommendationResponse | null>(null);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recsError, setRecsError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [savingImg, setSavingImg] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const shotRef = useRef<View>(null);

  // Select the first region once segmentation lands (guarded one-time set).
  if (selectedRegionId == null && regions.length > 0) {
    setSelectedRegionId(regions[0].id);
  }

  const canvasW = Math.round(width - spacing.lg * 2);
  const canvasH = Math.round((canvasW * 3) / 4);

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

  async function applyShade(shade: Shade) {
    if (selectedRegionId == null || readOnly) return;
    Haptics.selectionAsync().catch(() => {});
    setOverrides((prev) => ({ ...prev, [selectedRegionId]: { hex: shade.hex, code: shade.code } }));
    try {
      // Per-swatch autosave (PLAN §5). Backend returns 204.
      await projectsApi.updateRegionColors(id, [
        { regionId: selectedRegionId, shadeCode: shade.code, hexCode: shade.hex },
      ]);
      setSaveError(null);
    } catch {
      setSaveError('Couldn’t save that colour — it shows here but may not persist.');
    }
  }

  /**
   * Claude's palettes for this exact room. Included in the project now rather
   * than charged per ask, and sized to the room: a photo with one wall marked
   * comes back with one colour, not three the user has nowhere to put. Still
   * fetched only on request, because it is a real model call and a slow one.
   */
  async function openRecommendations() {
    setRecsOpen(true);
    if (recs || recsLoading) return; // one call per visit — it takes a few seconds
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

  async function doShare() {
    setSharing(true);
    setActionError(null);
    setActionMsg(null);
    try {
      // 10 days is the ceiling: a share link hands over the same repaint
      // capability a walk-in code does, so the two expire on the same clock.
      const res = await projectsApi.share(id, { days: 10 });
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
  async function startSegmentation(mode: MaskMode = 'AUTO') {
    setStarting(true);
    setSegmentError(null);
    setBlocked(null);
    try {
      await projectsApi.segment(id, mode);
      setMarking(mode === 'MANUAL');
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

  /**
   * Mark a wall by tapping it. The tap's position on the canvas becomes
   * normalized (0–1) image coordinates and SAM 2 segments that surface.
   *
   * The canvas draws the photo with `fit="cover"`, so the on-screen box may crop
   * the image; the tap is mapped back through the same fit, otherwise every tap
   * on a non-matching aspect ratio would land on the wrong part of the photo.
   */
  async function markWallAt(event: GestureResponderEvent) {
    if (!marking || markBusy || readOnly) return;
    const { locationX, locationY } = event.nativeEvent;
    const photoAspect = photo ? photo.width() / photo.height() : canvasW / canvasH;
    const boxAspect = canvasW / canvasH;
    // "cover": the image fills the box and overflows on the longer axis.
    const drawnW = photoAspect > boxAspect ? canvasH * photoAspect : canvasW;
    const drawnH = photoAspect > boxAspect ? canvasH : canvasW / photoAspect;
    const x = (locationX + (drawnW - canvasW) / 2) / drawnW;
    const y = (locationY + (drawnH - canvasH) / 2) / drawnH;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;

    setMarkBusy(true);
    setMarkError(null);
    Haptics.selectionAsync().catch(() => {});
    try {
      const region = await projectsApi.segmentPoint(id, x, y, `Wall ${regions.length + 1}`);
      await queryClient.invalidateQueries({ queryKey: ['projects', id] });
      setSelectedRegionId(region.id);
    } catch (err) {
      setMarkError(
        err instanceof ApiError ? err.message : 'Couldn’t mark that wall. Try tapping its middle.',
      );
    } finally {
      setMarkBusy(false);
    }
  }

  /** Remove a wall the user marked by hand. AI-detected ones are protected (400). */
  async function removeRegion(regionId: number) {
    setMarkError(null);
    try {
      await projectsApi.deleteRegion(id, regionId);
      setSelectedRegionId(null);
      await queryClient.invalidateQueries({ queryKey: ['projects', id] });
    } catch (err) {
      setMarkError(err instanceof ApiError ? err.message : 'Couldn’t remove that wall.');
    }
  }

  const insetsTop = spacing.xxl;

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingTop: insetsTop }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text variant="label" color={colors.fgSoft}>
            ‹ Back
          </Text>
        </Pressable>
        {status ? <StatusPill label={status} tone={status === 'FAILED' ? 'expired' : status === 'SEGMENTED' ? 'done' : 'progress'} /> : null}
      </View>

      <Text variant="title" numberOfLines={1}>
        {project?.name ?? 'Room'}
      </Text>

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

      {/* Canvas. In marking mode a tap segments the wall under the finger. */}
      <Pressable
        onPress={markWallAt}
        disabled={!marking || markBusy || readOnly}
        style={[styles.canvasFrame, { height: canvasH }]}
      >
        <View ref={shotRef} collapsable={false} style={StyleSheet.absoluteFill}>
          {isLoading || !photo ? (
            <View style={styles.canvasCenter}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : (
            <PaintedPhoto photo={photo} layers={status === 'SEGMENTED' ? layers : []} width={canvasW} height={canvasH} />
          )}
        </View>
        {status === 'SEGMENTING' ? (
          <View style={styles.canvasOverlay}>
            <ActivityIndicator color="#fff" />
            <Text variant="label" color="#fff" style={{ marginTop: spacing.sm }}>
              Detecting walls…
            </Text>
            <Text variant="caption" color="#fff">
              This usually takes 30–90 seconds
            </Text>
          </View>
        ) : null}
        {markBusy ? (
          <View style={styles.canvasOverlay}>
            <ActivityIndicator color="#fff" />
            <Text variant="label" color="#fff" style={{ marginTop: spacing.sm }}>
              Marking that wall…
            </Text>
          </View>
        ) : marking && !readOnly ? (
          <View style={styles.markHint} pointerEvents="none">
            <Text variant="caption" color="#fff">
              Tap the middle of a wall to mark it
            </Text>
          </View>
        ) : null}
      </Pressable>

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

      {/* Status-driven controls */}
      {status === 'CREATED' ? (
        <View style={styles.block}>
          <Text variant="bodySoft">Detect the walls in this photo so you can paint them.</Text>
          {segmentError ? (
            <Text variant="body" color={colors.danger}>
              {segmentError}
            </Text>
          ) : null}
          <Button label="Detect walls" size="lg" fullWidth loading={starting} onPress={() => startSegmentation('AUTO')} />
          {/* Free on every plan, so it is offered up front rather than kept as
              the consolation prize after a refused AI run. */}
          <Button
            label="Mark walls myself"
            variant="secondary"
            fullWidth
            disabled={starting}
            onPress={() => startSegmentation('MANUAL')}
          />
        </View>
      ) : null}

      {status === 'FAILED' ? (
        <View style={styles.block}>
          <Card>
            <Text variant="label" color={colors.danger}>
              Wall detection failed
            </Text>
            <Text variant="bodySoft" style={{ marginTop: spacing.xs }}>
              {project?.failureReason ?? 'Something went wrong during detection.'}
            </Text>
          </Card>
          <Button label="Try again" size="lg" fullWidth loading={starting} onPress={() => startSegmentation('AUTO')} />
          <Button
            label="Mark walls myself"
            variant="secondary"
            fullWidth
            disabled={starting}
            onPress={() => startSegmentation('MANUAL')}
          />
        </View>
      ) : null}

      {status === 'SEGMENTED' && regions.length === 0 && !readOnly ? (
        <View style={styles.block}>
          <Card>
            <Text variant="bodySoft">
              {project?.maskMode === 'MANUAL'
                ? 'Your photo is ready. Tap each wall you want to paint and we’ll cut it out for you.'
                : 'No walls were detected automatically. You can mark them yourself — tap a wall and we’ll cut it out.'}
            </Text>
          </Card>
          <Button
            label={marking ? 'Done marking' : 'Mark walls by tapping'}
            size="lg"
            fullWidth
            onPress={() => setMarking((m) => !m)}
          />
          {markError ? (
            <Text variant="body" color={colors.danger}>
              {markError}
            </Text>
          ) : null}
        </View>
      ) : null}

      {status === 'SEGMENTED' && regions.length > 0 ? (
        <>
          {/* AI suggest · Share · Save */}
          <View style={styles.actionsRow}>
            <Button
              label="Suggest"
              variant="secondary"
              // Suggestions exist to be applied; on a view-only room there is
              // nothing to apply them to, and the backend refuses anyway.
              disabled={readOnly}
              icon={<Ionicons name="sparkles" size={16} color={colors.fg} />}
              onPress={openRecommendations}
              style={styles.actionBtn}
            />
            <Button
              label="Share"
              variant="secondary"
              loading={sharing}
              icon={<Ionicons name="share-social" size={16} color={colors.fg} />}
              onPress={doShare}
              style={styles.actionBtn}
            />
            <Button
              label="Save"
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

          {/* Region chips */}
          <View style={styles.block}>
            <View style={styles.blockHead}>
              <Text variant="label">Wall</Text>
              {!readOnly ? (
                <Pressable onPress={() => setMarking((m) => !m)} hitSlop={8}>
                  <Text variant="label" color={marking ? colors.accentSoft : colors.fgSoft}>
                    {marking ? 'Done marking' : '+ Mark another wall'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowGap}>
              {regions.map((r, i) => {
                const c = appliedColor(r.id, r.appliedHexCode);
                const active = r.id === selectedRegionId;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => setSelectedRegionId(r.id)}
                    style={[styles.regionChip, active ? styles.regionChipActive : styles.regionChipIdle]}
                  >
                    <View style={[styles.regionDot, { backgroundColor: c?.hex ?? colors.surface2, borderColor: colors.rule }]} />
                    <Text variant="label" color={active ? colors.accentSoft : colors.fgSoft}>
                      {r.label ?? r.category ?? `Wall ${i + 1}`}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {markError ? (
              <Text variant="caption" color={colors.danger}>
                {markError}
              </Text>
            ) : null}
            {/* Only hand-marked walls can be removed; AI ones are protected. */}
            {!readOnly && selectedRegionId != null && regions.find((r) => r.id === selectedRegionId)?.manual ? (
              <Pressable onPress={() => removeRegion(selectedRegionId)} hitSlop={8}>
                <Text variant="label" color={colors.danger}>
                  Remove this wall
                </Text>
              </Pressable>
            ) : null}
          </View>

          {/* Shade tray */}
          <View style={styles.block}>
            <Text variant="label">
              {readOnly ? 'Colours last applied' : 'Tap a shade to paint the selected wall'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowGap}>
              {tray.map((s) => {
                // The shop's own code, and its name only if the shop shows names.
                const display = shadeDisplay(scheme, { code: s.code, name: s.name });
                return (
                  <Pressable
                    key={`${s.brandSlug ?? ''}-${s.code}`}
                    onPress={() => applyShade(s)}
                    disabled={readOnly}
                    style={[styles.swatchButton, readOnly && styles.swatchDisabled]}
                  >
                    <View style={[styles.traySwatch, { backgroundColor: s.hex }]} />
                    <Text variant="caption" numberOfLines={1} style={styles.trayLabel}>
                      {display.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {saveError ? (
              <Text variant="caption" color={colors.warning}>
                {saveError}
              </Text>
            ) : null}
          </View>
        </>
      ) : null}

      <RecommendationsSheet
        visible={recsOpen}
        onClose={() => setRecsOpen(false)}
        loading={recsLoading}
        error={recsError}
        data={recs}
        onApply={(s) => {
          applyShade(s);
          setRecsOpen(false);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  canvasFrame: {
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  canvasCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  canvasOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.scrim },
  markHint: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.scrim,
  },
  block: { gap: spacing.sm },
  blockHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  viewOnly: { borderColor: colors.warning + '55' },
  reopen: { marginTop: spacing.md, gap: spacing.sm },
  gateAction: { marginTop: spacing.md },
  actionsRow: { flexDirection: 'row', gap: spacing.md },
  actionBtn: { flex: 1 },
  rowGap: { gap: spacing.sm, paddingVertical: spacing.xs },
  regionChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  regionChipActive: { backgroundColor: colors.accentGhost, borderColor: colors.accent },
  regionChipIdle: { backgroundColor: colors.surface, borderColor: colors.rule },
  regionDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1 },
  swatchButton: { width: 64, gap: spacing.xs, alignItems: 'center' },
  swatchDisabled: { opacity: 0.45 },
  traySwatch: { width: 64, height: 64, borderRadius: radius.card, borderWidth: 1, borderColor: colors.rule },
  trayLabel: { textAlign: 'center', width: 64 },
});
