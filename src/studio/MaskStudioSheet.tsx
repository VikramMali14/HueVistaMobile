import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Canvas, Image as SkiaImage, Path, Skia, type SkImage } from '@shopify/react-native-skia';
import { Aurora, Button, Chip, PressableScale, Segmented, Text } from '../components';
import { colors, spacing, radius, alpha } from '../theme';
import { haptics } from '../haptics';
import { ApiError, projectsApi, type Region, type RegionCategory } from '../api';
import { fitBox, rasterizeMask, type MaskStroke } from '../engine';

/** How the wall is being marked out. */
type MarkMode = 'detect' | 'draw';

const MODE_OPTIONS: readonly { value: MarkMode; label: string }[] = [
  { value: 'detect', label: 'Tap to detect' },
  { value: 'draw', label: 'Draw it' },
];

const CATEGORIES: readonly { value: RegionCategory; label: string }[] = [
  { value: 'MAIN_WALL', label: 'Main wall' },
  { value: 'ACCENT_WALL', label: 'Accent wall' },
  { value: 'TRIM', label: 'Trim' },
  { value: 'MANUAL', label: 'Other' },
];

/** Selection blue and removal red — the two colours that read against any room. */
const SELECT_BLUE = '#3b82f6';
const REMOVE_RED = '#ef4444';

/** Minimum finger travel (in normalized units) before another point is kept. */
const MIN_STEP = 0.004;

export interface MaskStudioSheetProps {
  visible: boolean;
  onClose: () => void;
  projectId: string;
  photo: SkImage | null;
  /** How many walls already exist — names the next one. */
  regionCount: number;
  /**
   * Set to REDRAW an existing region's mask instead of creating a new wall.
   * The old mask is replaced, not edited — a stored PNG cannot be turned back
   * into the outline that made it, so this is a fresh trace of the same wall,
   * which is what fixes an AI mask that took half a pillar.
   */
  editTarget?: { id: number; label: string } | null;
  /** A wall was created or refined; the screen refetches and selects it. */
  onSaved: (region: Region) => void;
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/**
 * Mark a wall — the popup.
 *
 * Marking used to happen on the editor screen itself: arm a hidden flag, tap the
 * photo, and hope. Every failure of that single path was terminal, because that
 * path went through SAM 2 — no model call, no wall, no way to paint the room the
 * user had just paid to upload. And nothing on screen explained which of the
 * three preconditions (editable, segmented, armed) had not been met.
 *
 * Here it is one place with one job, and it has two ways to do it:
 *
 *   - **Tap to detect** — SAM 2 cuts out the surface under a finger. Fast, and
 *     the right answer when it works.
 *   - **Draw it** — trace the wall by hand. No model, no credit, no dependency
 *     on anything but the phone, so it is always available and is offered by
 *     name the moment detection fails rather than being the consolation prize
 *     nobody finds.
 */
export function MaskStudioSheet({
  visible,
  onClose,
  projectId,
  photo,
  regionCount,
  editTarget,
  onSaved,
}: MaskStudioSheetProps) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<MarkMode>('detect');
  const [category, setCategory] = useState<RegionCategory>('MAIN_WALL');
  const [erasing, setErasing] = useState(false);
  const [strokes, setStrokes] = useState<MaskStroke[]>([]);
  const [live, setLive] = useState<MaskStroke | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // Refs the (once-created) pan handlers read, so they always see the current
  // canvas size and add/erase choice without being rebuilt mid-gesture. The
  // stroke in progress is one of them: the handlers would otherwise close over
  // the first render's empty stroke and append to it forever.
  const liveRef = useRef<MaskStroke | null>(null);
  const canvasRef = useRef({ width: 1, height: 1 });
  const eraseRef = useRef(false);

  // The photo is sized against the window rather than against its own
  // container: measuring a box whose height is decided by the thing being
  // measured is a loop, and it settles at whichever size it happened to start.
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const canvas = useMemo(
    () =>
      fitBox(photo?.width(), photo?.height(), {
        maxWidth: windowWidth - spacing.lg * 2,
        // Leave room for the tools under it — a wall you have to scroll to
        // reach cannot be traced in one gesture.
        maxHeight: Math.max(220, windowHeight * 0.52),
      }),
    [photo, windowWidth, windowHeight],
  );
  const ready = !!photo && canvas.width > 0 && canvas.height > 0;

  canvasRef.current = { width: canvas.width || 1, height: canvas.height || 1 };
  eraseRef.current = erasing;

  function reset() {
    setStrokes([]);
    setLive(null);
    liveRef.current = null;
    setError(null);
    setNote(null);
    setBusy(null);
  }

  function dismiss() {
    haptics.close();
    reset();
    onClose();
  }

  // ── Drawing ──────────────────────────────────────────────────────────────
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // The photo sits in a ScrollView; claiming the gesture on move is what
        // stops a traced outline from scrolling the sheet out from under it.
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e: GestureResponderEvent) => {
          const point = {
            x: clamp01(e.nativeEvent.locationX / canvasRef.current.width),
            y: clamp01(e.nativeEvent.locationY / canvasRef.current.height),
          };
          const stroke: MaskStroke = { mode: eraseRef.current ? 'erase' : 'add', points: [point] };
          liveRef.current = stroke;
          setLive(stroke);
          setError(null);
        },
        onPanResponderMove: (e: GestureResponderEvent) => {
          const current = liveRef.current;
          if (!current) return;
          const point = {
            x: clamp01(e.nativeEvent.locationX / canvasRef.current.width),
            y: clamp01(e.nativeEvent.locationY / canvasRef.current.height),
          };
          const last = current.points[current.points.length - 1];
          // Thin out the trail: a finger reports far more points than an
          // outline needs, and every one of them costs a re-render.
          if (Math.abs(point.x - last.x) < MIN_STEP && Math.abs(point.y - last.y) < MIN_STEP) return;
          const next: MaskStroke = { mode: current.mode, points: [...current.points, point] };
          liveRef.current = next;
          setLive(next);
        },
        onPanResponderRelease: () => {
          const current = liveRef.current;
          liveRef.current = null;
          setLive(null);
          if (!current || current.points.length < 3) return;
          haptics.tap();
          setStrokes((prev) => [...prev, current]);
        },
      }),
    [],
  );

  const paths = useMemo(() => {
    const all = live ? [...strokes, live] : strokes;
    return all.map((stroke, i) => {
      const path = Skia.Path.Make();
      stroke.points.forEach((p, j) => {
        const x = p.x * canvas.width;
        const y = p.y * canvas.height;
        if (j === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      });
      path.close();
      return { key: `${i}-${stroke.points.length}`, path, mode: stroke.mode };
    });
  }, [strokes, live, canvas.width, canvas.height]);

  const drawn = strokes.some((s) => s.mode === 'add');

  function undo() {
    haptics.tap();
    setStrokes((prev) => prev.slice(0, -1));
  }

  // ── Saving ───────────────────────────────────────────────────────────────
  async function saveDrawing() {
    if (!photo) return;
    const label = editTarget?.label ?? nextLabel();
    setError(null);
    const maskBase64 = rasterizeMask(strokes, photo.width(), photo.height());
    if (!maskBase64) {
      setError('Trace right around a wall first — a closed shape, back to where you started.');
      return;
    }
    setBusy(editTarget ? 'Replacing that wall…' : 'Saving that wall…');
    try {
      const region = editTarget
        ? await projectsApi.updateRegionMask(projectId, editTarget.id, { maskBase64, category, label })
        : await projectsApi.createCustomMaskRegion(projectId, { maskBase64, category, label });
      haptics.success();
      onSaved(region);
      reset();
      onClose();
    } catch (err) {
      haptics.error();
      setError(saveMessage(err));
    } finally {
      setBusy(null);
    }
  }

  function nextLabel(): string {
    return `Wall ${regionCount + 1}`;
  }

  async function detectAt(e: GestureResponderEvent) {
    if (!photo || busy) return;
    const x = clamp01(e.nativeEvent.locationX / canvas.width);
    const y = clamp01(e.nativeEvent.locationY / canvas.height);
    setError(null);
    setNote(null);
    setBusy('Cutting out that wall…');
    haptics.impact('heavy');
    try {
      const region = await projectsApi.segmentPoint(projectId, x, y, nextLabel());
      haptics.success();
      onSaved(region);
      // Stay open: a room has several walls and closing after each one turns a
      // one-minute job into four trips through this sheet.
      setNote('Marked ✓ — tap another wall, or close when you are done.');
    } catch (err) {
      haptics.error();
      setError(detectMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const bodyPad = { paddingBottom: insets.bottom + spacing.xl };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={dismiss} transparent={false}>
      <View style={styles.root}>
        <Aurora intensity={0.7} />

        <View style={[styles.bar, { paddingTop: insets.top + spacing.sm }]}>
          <PressableScale
            onPress={dismiss}
            haptic="none"
            activeScale={0.92}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={styles.iconButton}
          >
            <Ionicons name="close" size={20} color={colors.fg} />
          </PressableScale>
          <Text variant="heading" numberOfLines={1} style={styles.barTitle}>
            {editTarget ? `Redraw ${editTarget.label}` : 'Mark a wall'}
          </Text>
          {mode === 'draw' ? (
            <PressableScale
              onPress={saveDrawing}
              disabled={!drawn || !!busy}
              haptic="none"
              activeScale={0.94}
              accessibilityRole="button"
              accessibilityLabel="Save this wall"
              style={StyleSheet.flatten([styles.saveChip, (!drawn || !!busy) && styles.chipDisabled])}
            >
              <Text variant="label" color={colors.accentSoft}>
                Save
              </Text>
            </PressableScale>
          ) : (
            <View style={styles.iconButton} />
          )}
        </View>

        <ScrollView
          contentContainerStyle={[styles.body, bodyPad]}
          showsVerticalScrollIndicator={false}
          // Scrolling stays on so nothing below the photo can be trapped off
          // screen on a small phone. A trace does not turn into a scroll
          // because the canvas refuses to hand the gesture back once it has it
          // (onPanResponderTerminationRequest).
        >
          <Segmented
            options={MODE_OPTIONS}
            value={mode}
            onChange={(m) => {
              setMode(m);
              setError(null);
              setNote(null);
            }}
            accessibilityLabel="How to mark this wall"
          />

          <Text variant="bodySoft">
            {mode === 'detect'
              ? 'Tap the middle of a wall and we cut it out for you.'
              : editTarget
                ? `Trace ${editTarget.label} again with a finger — the new outline replaces the old one.`
                : 'Trace right around the wall with a finger. Close the loop — it does not have to be neat.'}
          </Text>

          {/* The photo, at its own shape and sized so the whole wall is
              reachable without scrolling mid-trace. */}
          <View style={styles.stage}>
            {!ready ? (
              <View style={styles.stageEmpty}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : (
              <View
                style={[styles.canvasFrame, { width: canvas.width, height: canvas.height }]}
                {...(mode === 'draw' ? pan.panHandlers : {})}
              >
                <Canvas style={StyleSheet.absoluteFill}>
                  <SkiaImage
                    image={photo}
                    fit="contain"
                    x={0}
                    y={0}
                    width={canvas.width}
                    height={canvas.height}
                  />
                  {paths.map((p) => (
                    <Path
                      key={p.key}
                      path={p.path}
                      color={p.mode === 'add' ? SELECT_BLUE : REMOVE_RED}
                      style="fill"
                      opacity={0.42}
                    />
                  ))}
                  {paths.map((p) => (
                    <Path
                      key={`${p.key}-edge`}
                      path={p.path}
                      color={p.mode === 'add' ? SELECT_BLUE : REMOVE_RED}
                      style="stroke"
                      strokeWidth={2}
                    />
                  ))}
                </Canvas>

                {/* Detection taps go through a plain overlay rather than the
                    pan responder — a tap is not a trace and should not have to
                    survive one. */}
                {mode === 'detect' ? (
                  <View
                    style={StyleSheet.absoluteFill}
                    onStartShouldSetResponder={() => true}
                    onResponderRelease={detectAt}
                  />
                ) : null}

                {busy ? (
                  <View style={styles.busy}>
                    <ActivityIndicator color="#fff" />
                    <Text variant="label" color="#fff" style={styles.busyLabel}>
                      {busy}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>

          {mode === 'draw' ? (
            <View style={styles.tools}>
              <Chip label="Add" selected={!erasing} onPress={() => setErasing(false)} />
              <Chip label="Rub out" selected={erasing} onPress={() => setErasing(true)} />
              <View style={styles.toolSpacer} />
              <PressableScale
                onPress={undo}
                disabled={strokes.length === 0}
                haptic="none"
                activeScale={0.92}
                accessibilityRole="button"
                accessibilityLabel="Undo the last outline"
                style={StyleSheet.flatten([styles.toolButton, strokes.length === 0 && styles.chipDisabled])}
              >
                <Ionicons name="arrow-undo-outline" size={17} color={colors.fg} />
              </PressableScale>
              <PressableScale
                onPress={() => setStrokes([])}
                disabled={strokes.length === 0}
                haptic="tap"
                activeScale={0.92}
                accessibilityRole="button"
                accessibilityLabel="Clear everything drawn"
                style={StyleSheet.flatten([styles.toolButton, strokes.length === 0 && styles.chipDisabled])}
              >
                <Ionicons name="trash-outline" size={17} color={colors.fg} />
              </PressableScale>
            </View>
          ) : null}

          {mode === 'draw' && !editTarget ? (
            <View style={styles.group}>
              <Text variant="overline">What is it?</Text>
              <View style={styles.categories}>
                {CATEGORIES.map((c) => (
                  <Chip
                    key={c.value}
                    label={c.label}
                    selected={category === c.value}
                    onPress={() => setCategory(c.value)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {error ? (
            <View style={styles.group}>
              <Text variant="body" color={colors.danger}>
                {error}
              </Text>
              {/* The way through, named. Detection failing is not the end of the
                  road — drawing needs no model and cannot be refused. */}
              {mode === 'detect' ? (
                <Button
                  label="Draw the wall myself instead"
                  variant="secondary"
                  fullWidth
                  icon={<Ionicons name="brush-outline" size={16} color={colors.fg} />}
                  onPress={() => {
                    setMode('draw');
                    setError(null);
                  }}
                />
              ) : null}
            </View>
          ) : note ? (
            <Text variant="label" color={colors.success}>
              {note}
            </Text>
          ) : null}

          {mode === 'draw' ? (
            <Button
              label={editTarget ? 'Replace this wall’s outline' : 'Save this wall'}
              size="lg"
              fullWidth
              disabled={!drawn}
              loading={!!busy}
              onPress={saveDrawing}
            />
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

/** What went wrong detecting a wall, in a sentence worth showing. */
function detectMessage(err: unknown): string {
  if (err instanceof ApiError && err.isNetwork) {
    // A timeout aborts the fetch and arrives as the raw "Aborted" — not a
    // sentence for anyone. Point segmentation is a live model call on a 60s
    // budget, so this is the failure most worth naming properly.
    return 'That took too long, or the connection dropped. Tap the wall again, or draw it yourself.';
  }
  if (err instanceof ApiError) return err.message;
  return 'Couldn’t cut out that wall. Try tapping its middle, or draw it yourself.';
}

function saveMessage(err: unknown): string {
  if (err instanceof ApiError && err.isNetwork) {
    return 'The connection dropped while saving. Your outline is still here — try again.';
  }
  if (err instanceof ApiError) return err.message;
  return 'Couldn’t save that wall. Your outline is still here — try again.';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  barTitle: { flex: 1, textAlign: 'center' },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassEdge,
  },
  saveChip: {
    height: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentGhost,
    borderWidth: 1,
    borderColor: alpha(colors.accentSoft, 0.3),
  },
  chipDisabled: { opacity: 0.4 },
  body: { paddingHorizontal: spacing.lg, gap: spacing.md },
  group: { gap: spacing.sm },
  stage: { minHeight: 260, alignItems: 'center', justifyContent: 'center' },
  stageEmpty: { height: 260, alignItems: 'center', justifyContent: 'center' },
  canvasFrame: {
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  busy: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.scrim,
  },
  busyLabel: { marginTop: spacing.sm },
  tools: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  toolSpacer: { flex: 1 },
  toolButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassEdge,
  },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
