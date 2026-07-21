import { useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Text, Button, Card, StatusPill } from '../../src/components';
import { colors, spacing, radius } from '../../src/theme';
import { useProject } from '../../src/projects/queries';
import { projectsApi, regionMaskUrl, resolveImageUrl, ApiError } from '../../src/api';
import { useAuthedSkImage, PaintedPhoto, PaintLayer } from '../../src/engine';
import { usePopularShades } from '../../src/shades/queries';
import { summaryToShade, Shade } from '../../src/shades/types';
import { SAMPLE_SHADES } from '../../src/shades/sampleShades';

type Applied = { hex: string; code?: string };

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

  // Shade tray: live popular shades, sample as offline fallback.
  const popular = (usePopularShades(12).data ?? []).map(summaryToShade).filter((s): s is Shade => s !== null);
  const tray = popular.length > 0 ? popular : SAMPLE_SHADES;

  const [overrides, setOverrides] = useState<Record<number, Applied>>({});
  const [selectedRegionId, setSelectedRegionId] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [segmentError, setSegmentError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

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
    if (selectedRegionId == null) return;
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

  async function startSegmentation() {
    setStarting(true);
    setSegmentError(null);
    try {
      await projectsApi.segment(id, 'AUTO');
      await queryClient.invalidateQueries({ queryKey: ['projects', id] });
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        setSegmentError('This plan has no auto wall-detection credits left.');
      } else if (err instanceof ApiError && err.status === 409) {
        await queryClient.invalidateQueries({ queryKey: ['projects', id] }); // already running
      } else {
        setSegmentError(err instanceof ApiError ? err.message : 'Could not start wall detection.');
      }
    } finally {
      setStarting(false);
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

      {/* Canvas */}
      <View style={[styles.canvasFrame, { height: canvasH }]}>
        {isLoading || !photo ? (
          <View style={styles.canvasCenter}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <PaintedPhoto photo={photo} layers={status === 'SEGMENTED' ? layers : []} width={canvasW} height={canvasH} />
        )}
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
      </View>

      {/* Status-driven controls */}
      {status === 'CREATED' ? (
        <View style={styles.block}>
          <Text variant="bodySoft">Detect the walls in this photo so you can paint them.</Text>
          {segmentError ? (
            <Text variant="body" color={colors.danger}>
              {segmentError}
            </Text>
          ) : null}
          <Button label="Detect walls" size="lg" fullWidth loading={starting} onPress={startSegmentation} />
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
          <Button label="Try again" size="lg" fullWidth loading={starting} onPress={startSegmentation} />
        </View>
      ) : null}

      {status === 'SEGMENTED' && regions.length === 0 ? (
        <Card>
          <Text variant="bodySoft">
            No walls were detected automatically. Marking walls by hand is coming in the next update.
          </Text>
        </Card>
      ) : null}

      {status === 'SEGMENTED' && regions.length > 0 ? (
        <>
          {/* Region chips */}
          <View style={styles.block}>
            <Text variant="label">Wall</Text>
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
          </View>

          {/* Shade tray */}
          <View style={styles.block}>
            <Text variant="label">Tap a shade to paint the selected wall</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowGap}>
              {tray.map((s) => (
                <Pressable key={`${s.brandSlug ?? ''}-${s.code}`} onPress={() => applyShade(s)} style={styles.swatchButton}>
                  <View style={[styles.traySwatch, { backgroundColor: s.hex }]} />
                  <Text variant="caption" numberOfLines={1} style={styles.trayLabel}>
                    {s.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            {saveError ? (
              <Text variant="caption" color={colors.warning}>
                {saveError}
              </Text>
            ) : null}
          </View>
        </>
      ) : null}
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
  block: { gap: spacing.sm },
  rowGap: { gap: spacing.sm, paddingVertical: spacing.xs },
  regionChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  regionChipActive: { backgroundColor: colors.accentGhost, borderColor: colors.accent },
  regionChipIdle: { backgroundColor: colors.surface, borderColor: colors.rule },
  regionDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1 },
  swatchButton: { width: 64, gap: spacing.xs, alignItems: 'center' },
  traySwatch: { width: 64, height: 64, borderRadius: radius.card, borderWidth: 1, borderColor: colors.rule },
  trayLabel: { textAlign: 'center', width: 64 },
});
