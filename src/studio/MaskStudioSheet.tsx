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
import { Canvas, Circle, Image as SkiaImage, Path, Skia, type SkImage } from '@shopify/react-native-skia';
import { Aurora, Button, Chip, PressableScale, Segmented, Text } from '../components';
import { colors, spacing, radius, alpha } from '../theme';
import { haptics } from '../haptics';
import { ApiError, projectsApi, regionMaskUrl, type Region, type RegionCategory } from '../api';
import { fitBox, rasterizeMask, useAuthedSkImage, type MaskStroke } from '../engine';

/** How the wall is being marked out. */
type MarkMode = 'detect' | 'points' | 'draw';

const MODE_OPTIONS: readonly { value: MarkMode; label: string }[] = [
  { value: 'detect', label: 'Tap' },
  { value: 'points', label: 'Corners' },
  { value: 'draw', label: 'Freehand' },
];

/** Zoom limits. Below 1 the photo would float inside its own frame. */
const MIN_SCALE = 1;
const MAX_SCALE = 6;

/** A touch that moves less than this (screen px) is a tap, not a drag. */
const TAP_SLOP = 8;

/** Corner handle radius, in screen px, before the zoom transform is applied. */
const HANDLE_R = 7;

interface Viewport {
  scale: number;
  tx: number;
  ty: number;
}

const IDENTITY: Viewport = { scale: 1, tx: 0, ty: 0 };

function clampScale(s: number): number {
  return s < MIN_SCALE ? MIN_SCALE : s > MAX_SCALE ? MAX_SCALE : s;
}

/**
 * How far the photo may be pushed around at a given zoom.
 *
 * Panning is bounded so the room cannot be dragged off its own frame and lost —
 * at scale 1 there is nothing to pan, and beyond that the slack is exactly the
 * overhang the zoom created.
 */
function clampPan(v: Viewport, w: number, h: number): Viewport {
  const maxX = Math.max(0, (w * v.scale - w) / 2);
  const maxY = Math.max(0, (h * v.scale - h) / 2);
  return {
    scale: v.scale,
    tx: Math.min(maxX, Math.max(-maxX, v.tx)),
    ty: Math.min(maxY, Math.max(-maxY, v.ty)),
  };
}

/**
 * Screen point → normalized (0–1) photo coordinate, undoing the zoom.
 *
 * React Native scales a view about its centre, so the inverse has to pivot there
 * too. Getting this wrong is silent and awful: taps land somewhere near where you
 * meant, and only at high zoom does it become obvious the mask is offset.
 */
function toPhoto(sx: number, sy: number, v: Viewport, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  return {
    x: clamp01((cx + (sx - v.tx - cx) / v.scale) / w),
    y: clamp01((cy + (sy - v.ty - cy) / v.scale) / h),
  };
}

/** Distance between the first two touches of a multi-touch event. */
function touchDistance(touches: readonly { pageX: number; pageY: number }[]): number {
  if (touches.length < 2) return 0;
  const dx = touches[0].pageX - touches[1].pageX;
  const dy = touches[0].pageY - touches[1].pageY;
  return Math.hypot(dx, dy);
}

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

  /**
   * Zoom and pan.
   *
   * Marking a wall accurately means working at the edges — the line where wall
   * meets ceiling, the gap beside a window frame — and at full-room zoom those
   * are a few pixels wide under a fingertip. Without magnification the mask is
   * only ever as good as the user's aim at 1:1.
   *
   * The viewport is React state so the coordinate maths can read it directly;
   * the ref mirrors it for the pan handlers, which are created once and would
   * otherwise close over the first render's value forever.
   */
  const [view, setView] = useState<Viewport>(IDENTITY);
  const viewRef = useRef<Viewport>(IDENTITY);
  /** Viewport and touch geometry captured when the current gesture began. */
  const gestureRef = useRef<{
    start: Viewport;
    startDistance: number;
    startX: number;
    startY: number;
    pinching: boolean;
    moved: boolean;
  } | null>(null);

  /** Point-to-point corners, in normalized photo coordinates. */
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const modeRef = useRef<MarkMode>('detect');

  // The photo is sized against the window rather than against its own
  // container: measuring a box whose height is decided by the thing being
  // measured is a loop, and it settles at whichever size it happened to start.
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const canvas = useMemo(
    () =>
      fitBox(photo?.width(), photo?.height(), {
        maxWidth: windowWidth - spacing.lg * 2,
        // Three fifths of the screen, and the photo never scrolls out of it —
        // see the fixed/scrolling split below. A wall you have to chase up the
        // page cannot be traced in one gesture, and a tap aimed at a moving
        // target lands somewhere the user did not mean.
        maxHeight: Math.max(220, windowHeight * 0.6),
      }),
    [photo, windowWidth, windowHeight],
  );
  const ready = !!photo && canvas.width > 0 && canvas.height > 0;

  canvasRef.current = { width: canvas.width || 1, height: canvas.height || 1 };
  eraseRef.current = erasing;
  viewRef.current = view;
  modeRef.current = mode;

  /**
   * The wall's current mask, shown underneath while it is being re-marked.
   *
   * Redrawing used to start from a blank photo, which meant working blind: you
   * could not see what the old mask got wrong, so you could not tell whether the
   * new outline was actually an improvement until after it was saved.
   */
  const existingMask = useAuthedSkImage(editTarget ? regionMaskUrl(projectId, editTarget.id) : null);
  const [showExisting, setShowExisting] = useState(true);

  function reset() {
    setStrokes([]);
    setLive(null);
    liveRef.current = null;
    setPoints([]);
    setView(IDENTITY);
    viewRef.current = IDENTITY;
    setError(null);
    setNote(null);
    setBusy(null);
  }

  function dismiss() {
    haptics.close();
    reset();
    onClose();
  }

  // ── Gestures ─────────────────────────────────────────────────────────────
  /**
   * One responder for all three modes.
   *
   * Two fingers always means zoom, whatever the mode — pinching is never a
   * drawing gesture, and treating it as one is how a stray second finger used to
   * put a stray line across the wall. One finger means whatever the mode says:
   * trace in Freehand, place a corner in Corners, pan otherwise.
   *
   * The maths run against `viewRef`/`canvasRef` rather than the closed-over
   * state because this responder is built once and must not be rebuilt mid
   * gesture — swapping handlers between finger-down and finger-up drops the
   * gesture entirely.
   */
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // The photo sits above a ScrollView; refusing to hand the gesture back
        // is what stops a traced outline from scrolling the sheet out from
        // under it.
        onPanResponderTerminationRequest: () => false,

        onPanResponderGrant: (e: GestureResponderEvent) => {
          const { touches, locationX, locationY } = e.nativeEvent;
          const pinching = touches.length >= 2;
          gestureRef.current = {
            start: viewRef.current,
            startDistance: touchDistance(touches),
            startX: locationX,
            startY: locationY,
            pinching,
            moved: false,
          };
          setError(null);
          if (pinching || modeRef.current !== 'draw') return;

          const point = toPhoto(
            locationX,
            locationY,
            viewRef.current,
            canvasRef.current.width,
            canvasRef.current.height,
          );
          const stroke: MaskStroke = { mode: eraseRef.current ? 'erase' : 'add', points: [point] };
          liveRef.current = stroke;
          setLive(stroke);
        },

        onPanResponderMove: (e: GestureResponderEvent, gs) => {
          const g = gestureRef.current;
          if (!g) return;
          const { touches, locationX, locationY } = e.nativeEvent;
          if (Math.abs(gs.dx) > TAP_SLOP || Math.abs(gs.dy) > TAP_SLOP) g.moved = true;

          // Two fingers: zoom about the pinch, regardless of mode.
          if (touches.length >= 2) {
            if (!g.pinching) {
              // A second finger landed mid-gesture. Re-baseline instead of
              // jumping, and abandon any stroke it interrupted.
              g.pinching = true;
              g.start = viewRef.current;
              g.startDistance = touchDistance(touches);
              liveRef.current = null;
              setLive(null);
              return;
            }
            const distance = touchDistance(touches);
            if (g.startDistance <= 0 || distance <= 0) return;
            const next = clampPan(
              {
                scale: clampScale(g.start.scale * (distance / g.startDistance)),
                tx: g.start.tx,
                ty: g.start.ty,
              },
              canvasRef.current.width,
              canvasRef.current.height,
            );
            viewRef.current = next;
            setView(next);
            return;
          }

          // One finger, Freehand: extend the trace.
          if (modeRef.current === 'draw' && !g.pinching) {
            const current = liveRef.current;
            if (!current) return;
            const point = toPhoto(
              locationX,
              locationY,
              viewRef.current,
              canvasRef.current.width,
              canvasRef.current.height,
            );
            const last = current.points[current.points.length - 1];
            // Thin out the trail: a finger reports far more points than an
            // outline needs, and every one of them costs a re-render. The
            // threshold shrinks as you zoom in, so detail work stays detailed.
            const step = MIN_STEP / viewRef.current.scale;
            if (Math.abs(point.x - last.x) < step && Math.abs(point.y - last.y) < step) return;
            const next: MaskStroke = { mode: current.mode, points: [...current.points, point] };
            liveRef.current = next;
            setLive(next);
            return;
          }

          // One finger, anything else: pan the photo. Only meaningful zoomed in,
          // where clampPan leaves slack.
          const next = clampPan(
            { scale: g.start.scale, tx: g.start.tx + gs.dx, ty: g.start.ty + gs.dy },
            canvasRef.current.width,
            canvasRef.current.height,
          );
          viewRef.current = next;
          setView(next);
        },

        onPanResponderRelease: (e: GestureResponderEvent) => {
          const g = gestureRef.current;
          gestureRef.current = null;
          const current = liveRef.current;
          liveRef.current = null;
          setLive(null);

          if (!g || g.pinching) return;

          // A tap drops a corner (Corners) or asks the model to cut a wall out
          // (Tap). Both fire on release and only when the finger stayed put, so
          // a pan is never mistaken for either.
          if (!g.moved) {
            const point = toPhoto(
              g.startX,
              g.startY,
              viewRef.current,
              canvasRef.current.width,
              canvasRef.current.height,
            );
            if (modeRef.current === 'points') {
              haptics.tap();
              setPoints((prev) => [...prev, point]);
              return;
            }
            if (modeRef.current === 'detect') {
              // Held in a ref because this responder is built once and cannot
              // see a fresh detectAt.
              detectRef.current?.(point);
              return;
            }
          }

          if (modeRef.current === 'draw' && current && current.points.length >= 3) {
            haptics.tap();
            setStrokes((prev) => [...prev, current]);
          }
        },
      }),
    [],
  );

  /** Corners become a closed polygon — the same shape a freehand trace makes. */
  const pointStroke: MaskStroke | null = useMemo(
    () => (points.length >= 3 ? { mode: 'add', points } : null),
    [points],
  );

  function zoomBy(factor: number) {
    const next = clampPan(
      { scale: clampScale(viewRef.current.scale * factor), tx: viewRef.current.tx, ty: viewRef.current.ty },
      canvasRef.current.width,
      canvasRef.current.height,
    );
    viewRef.current = next;
    setView(next);
    haptics.tap();
  }

  const paths = useMemo(() => {
    const all = [...strokes, ...(pointStroke ? [pointStroke] : []), ...(live ? [live] : [])];
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
  }, [strokes, pointStroke, live, canvas.width, canvas.height]);

  /** Everything that will be rasterized: traced strokes plus the corner shape. */
  const savable: MaskStroke[] = useMemo(
    () => (pointStroke ? [...strokes, pointStroke] : strokes),
    [strokes, pointStroke],
  );
  const drawn = savable.some((s) => s.mode === 'add');

  function undo() {
    haptics.tap();
    // Undo whichever mode the user is actually in, so the button never removes
    // work they cannot see.
    if (mode === 'points') setPoints((prev) => prev.slice(0, -1));
    else setStrokes((prev) => prev.slice(0, -1));
  }

  function clearAll() {
    haptics.tap();
    setStrokes([]);
    setPoints([]);
  }

  const undoable = mode === 'points' ? points.length > 0 : strokes.length > 0;

  // ── Saving ───────────────────────────────────────────────────────────────
  async function saveDrawing() {
    if (!photo) return;
    const label = editTarget?.label ?? nextLabel();
    setError(null);
    const maskBase64 = rasterizeMask(savable, photo.width(), photo.height());
    if (!maskBase64) {
      setError(
        mode === 'points'
          ? 'Place at least three corners around the wall first.'
          : 'Trace right around a wall first — a closed shape, back to where you started.',
      );
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

  /**
   * The current detectAt, reachable from the pan responder.
   *
   * The responder is built once, so it cannot close over a function that reads
   * `busy` or `photo`; without this indirection it would forever call the first
   * render's version and think the sheet was never busy.
   */
  const detectRef = useRef<((p: { x: number; y: number }) => void) | null>(null);
  detectRef.current = detectAt;

  async function detectAt({ x, y }: { x: number; y: number }) {
    if (!photo || busy) return;
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
          {mode !== 'detect' ? (
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

        {/* Fixed region: how you are marking, what to do, and the photo itself.
            None of it scrolls.

            The photo used to live inside the scroll view with everything else,
            which made it a moving target. Tracing a wall meant fighting the
            scroll for the gesture; tapping one meant hitting a photo that could
            have shifted since you looked at it. Pinning the photo removes the
            contention rather than arbitrating it — the drawing canvas and the
            detect overlay are now the only things that can claim a touch in
            this area, because there is no scroll here to claim it first. */}
        <View style={styles.fixed}>
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
              ? 'Tap the middle of a wall and we cut it out for you. Pinch to zoom in first if the wall is small.'
              : mode === 'points'
                ? 'Tap each corner of the wall, going around it. Three or more closes the shape. Pinch to zoom for tight corners.'
                : 'Trace right around the wall with a finger. Close the loop — it does not have to be neat.'}
          </Text>

          {/* The photo, at its own shape, at three fifths of the screen.

              The zoom lives on this wrapper rather than inside the Skia canvas
              so that one transform moves the photo, the outline and the corner
              handles together. Scaling them separately is how a mask ends up
              drawn a few pixels off the wall it was aimed at. */}
          <View style={styles.stage}>
            {!ready ? (
              <View style={styles.stageEmpty}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : (
              <View
                style={[styles.canvasFrame, { width: canvas.width, height: canvas.height }]}
                {...pan.panHandlers}
              >
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    { transform: [{ translateX: view.tx }, { translateY: view.ty }, { scale: view.scale }] },
                  ]}
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

                    {/* The mask this wall has now, faint underneath, so the new
                        outline can be judged against the one it replaces. */}
                    {existingMask && showExisting ? (
                      <SkiaImage
                        image={existingMask}
                        fit="contain"
                        x={0}
                        y={0}
                        width={canvas.width}
                        height={canvas.height}
                        opacity={0.32}
                      />
                    ) : null}
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
                        strokeWidth={2 / view.scale}
                      />
                    ))}

                    {/* Corner handles. Drawn at a constant screen size by
                        dividing out the zoom — a handle that grows with the
                        photo would swallow the very corner it is marking. */}
                    {mode === 'points'
                      ? points.map((p, i) => (
                          <Circle
                            key={`corner-${i}`}
                            cx={p.x * canvas.width}
                            cy={p.y * canvas.height}
                            r={HANDLE_R / view.scale}
                            color={i === 0 ? '#fff' : SELECT_BLUE}
                          />
                        ))
                      : null}
                  </Canvas>
                </View>

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
        </View>

        {/* Everything below the photo scrolls, so a small phone can still reach
            the category chips and the save button. */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.body, bodyPad]}
          showsVerticalScrollIndicator={false}
        >
          {/* Zoom, undo, clear — and, while redrawing, whether the old mask is
              visible underneath. Always present, because zoom applies to every
              mode including Tap. */}
          <View style={styles.tools}>
            {mode === 'draw' ? (
              <>
                <Chip label="Add" selected={!erasing} onPress={() => setErasing(false)} />
                <Chip label="Rub out" selected={erasing} onPress={() => setErasing(true)} />
              </>
            ) : null}

            {existingMask ? (
              <Chip
                label={showExisting ? 'Old mask on' : 'Old mask off'}
                selected={showExisting}
                onPress={() => setShowExisting((s) => !s)}
              />
            ) : null}

            <View style={styles.toolSpacer} />

            <PressableScale
              onPress={() => zoomBy(1 / 1.6)}
              disabled={view.scale <= MIN_SCALE}
              haptic="none"
              activeScale={0.92}
              accessibilityRole="button"
              accessibilityLabel="Zoom out"
              style={StyleSheet.flatten([styles.toolButton, view.scale <= MIN_SCALE && styles.chipDisabled])}
            >
              <Ionicons name="remove" size={17} color={colors.fg} />
            </PressableScale>
            <PressableScale
              onPress={() => zoomBy(1.6)}
              disabled={view.scale >= MAX_SCALE}
              haptic="none"
              activeScale={0.92}
              accessibilityRole="button"
              accessibilityLabel="Zoom in"
              style={StyleSheet.flatten([styles.toolButton, view.scale >= MAX_SCALE && styles.chipDisabled])}
            >
              <Ionicons name="add" size={17} color={colors.fg} />
            </PressableScale>

            <PressableScale
              onPress={undo}
              disabled={!undoable}
              haptic="none"
              activeScale={0.92}
              accessibilityRole="button"
              accessibilityLabel={mode === 'points' ? 'Undo the last corner' : 'Undo the last outline'}
              style={StyleSheet.flatten([styles.toolButton, !undoable && styles.chipDisabled])}
            >
              <Ionicons name="arrow-undo-outline" size={17} color={colors.fg} />
            </PressableScale>
            <PressableScale
              onPress={clearAll}
              disabled={strokes.length === 0 && points.length === 0}
              haptic="tap"
              activeScale={0.92}
              accessibilityRole="button"
              accessibilityLabel="Clear everything marked"
              style={StyleSheet.flatten([
                styles.toolButton,
                strokes.length === 0 && points.length === 0 && styles.chipDisabled,
              ])}
            >
              <Ionicons name="trash-outline" size={17} color={colors.fg} />
            </PressableScale>
          </View>

          {mode !== 'detect' && !editTarget ? (
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
                  road — neither of the by-hand modes needs a model, so neither
                  can be refused. Corners leads: for a wall, which is usually a
                  quadrilateral, four taps beat tracing the whole outline. */}
              {mode === 'detect' ? (
                <Button
                  label="Mark the corners myself instead"
                  variant="secondary"
                  fullWidth
                  icon={<Ionicons name="git-commit-outline" size={16} color={colors.fg} />}
                  onPress={() => {
                    setMode('points');
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

          {mode !== 'detect' ? (
            <Button
              label={
                editTarget
                  ? 'Replace this wall’s outline'
                  : mode === 'points'
                    ? `Save this wall${points.length > 0 ? ` (${points.length} corners)` : ''}`
                    : 'Save this wall'
              }
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
  fixed: { paddingHorizontal: spacing.lg, gap: spacing.md },
  scroll: { flex: 1 },
  body: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingTop: spacing.md },
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
