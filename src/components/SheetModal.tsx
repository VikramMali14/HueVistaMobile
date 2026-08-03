import { useEffect, useMemo } from 'react';
import { Animated, Modal, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, alpha, elevation, duration, easing, spring, useAnimatedValue } from '../theme';
import { Text } from './Text';
import { haptics } from '../haptics';

export interface SheetModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Tints the sheet's top edge — e.g. the shade the sheet is about. */
  accent?: string | null;
  children: React.ReactNode;
}

/** How far down the sheet must be dragged before letting go dismisses it. */
const DISMISS_DISTANCE = 90;
/** …or how fast, for a flick that never travels that far. */
const DISMISS_VELOCITY = 0.6;

/**
 * Bottom-sheet modal. Still dependency-light (native Modal + scrim, no gesture
 * library), but no longer a plain grey slab: the top edge catches light, the
 * scrim fades in rather than appearing, and opening or dismissing it registers
 * as a tap in the hand.
 *
 * It also comes down when you push it down. A grabber that does not grab is a
 * lie the whole sheet tells — on iOS that bar is the handle, and reaching for
 * it is the first thing a thumb does. Dragging tracks the finger, and letting
 * go either flicks the sheet away or springs it back.
 *
 * `accent` puts the sheet's subject in its edge, which matters most on the
 * shade detail sheet — the colour under discussion frames the sheet showing it.
 */
export function SheetModal({ visible, onClose, title, accent, children }: SheetModalProps) {
  const insets = useSafeAreaInsets();
  const fade = useAnimatedValue(0);
  /** How far the sheet has been dragged down, in dp. */
  const drag = useAnimatedValue(0);
  // The scrim is animated separately from the Modal's own `slide` so the
  // darkening leads the sheet slightly — it reads as the sheet casting shade.
  useEffect(() => {
    const anim = Animated.timing(fade, {
      toValue: visible ? 1 : 0,
      duration: visible ? duration.base : duration.fast,
      easing: visible ? easing.entrance : easing.exit,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [visible, fade]);

  useEffect(() => {
    if (visible) {
      haptics.open();
      // A sheet reopened after a drag-dismiss must not start half way down.
      drag.setValue(0);
    }
  }, [visible, drag]);

  const dismiss = () => {
    haptics.close();
    onClose();
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        // Only a downward drag is ours. Claiming every touch would swallow the
        // taps on whatever the sheet contains.
        onMoveShouldSetPanResponder: (_e, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_e, g) => {
          drag.setValue(Math.max(0, g.dy));
        },
        onPanResponderRelease: (_e, g) => {
          if (g.dy > DISMISS_DISTANCE || g.vy > DISMISS_VELOCITY) {
            haptics.close();
            onClose();
            return;
          }
          Animated.spring(drag, { toValue: 0, ...spring.settle }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(drag, { toValue: 0, ...spring.settle }).start();
        },
      }),
    // Rebuilt when `onClose` changes identity, which for an inline arrow is
    // every render. That is safe: the handlers hold no state of their own —
    // everything they need arrives in the gesture — so the responder system
    // simply dispatches into the newer pair mid-drag.
    [drag, onClose],
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={dismiss}>
      <Animated.View style={[styles.scrimLayer, { opacity: fade }]} pointerEvents="none" />
      <Pressable style={styles.scrimTouch} onPress={dismiss} accessibilityRole="button" accessibilityLabel="Close">
        {/* Stop propagation: taps inside the sheet must not close it. */}
        <Pressable onPress={() => {}}>
          <Animated.View
            style={[
              styles.sheet,
              { paddingBottom: insets.bottom + spacing.lg, transform: [{ translateY: drag }] },
              accent ? { borderColor: alpha(accent, 0.3) } : null,
            ]}
            {...pan.panHandlers}
          >
            <View style={styles.grabber} />
            {title ? (
              <Text variant="title" style={styles.title}>
                {title}
              </Text>
            ) : null}
            {children}
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrimLayer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.scrim,
  },
  scrimTouch: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface2,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.glassEdge,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    ...elevation.high,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: alpha(colors.fg, 0.28),
    marginBottom: spacing.lg,
  },
  title: {
    marginBottom: spacing.lg,
  },
});
