import { useEffect } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, alpha, elevation, duration, easing, useAnimatedValue } from '../theme';
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

/**
 * Bottom-sheet modal. Still dependency-light (native Modal + scrim, no gesture
 * library), but no longer a plain grey slab: the top edge catches light, the
 * scrim fades in rather than appearing, and opening or dismissing it registers
 * as a tap in the hand.
 *
 * `accent` puts the sheet's subject in its edge, which matters most on the
 * shade detail sheet — the colour under discussion frames the sheet showing it.
 */
export function SheetModal({ visible, onClose, title, accent, children }: SheetModalProps) {
  const insets = useSafeAreaInsets();
  const fade = useAnimatedValue(0);

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
    if (visible) haptics.open();
  }, [visible]);

  const dismiss = () => {
    haptics.close();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={dismiss}>
      <Animated.View style={[styles.scrimLayer, { opacity: fade }]} pointerEvents="none" />
      <Pressable style={styles.scrimTouch} onPress={dismiss} accessibilityRole="button" accessibilityLabel="Close">
        {/* Stop propagation: taps inside the sheet must not close it. */}
        <Pressable
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + spacing.lg },
            accent ? { borderColor: alpha(accent, 0.3) } : null,
          ]}
          onPress={() => {}}
        >
          <View style={styles.grabber} />
          {title ? (
            <Text variant="title" style={styles.title}>
              {title}
            </Text>
          ) : null}
          {children}
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
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: alpha(colors.fg, 0.22),
    marginBottom: spacing.lg,
  },
  title: {
    marginBottom: spacing.lg,
  },
});
