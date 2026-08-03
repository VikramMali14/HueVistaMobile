import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components';
import { spacing, radius } from '../theme';
import { inkOn, isLightPaint } from './colorScience';
import { haptics } from '../haptics';

export interface HoldToWallProps {
  visible: boolean;
  hex?: string | null;
  /** Name and code as this shop presents them. */
  label: string;
  code?: string | null;
  onClose: () => void;
}

/**
 * The whole screen filled with one colour, so the phone becomes a shade card
 * you can hold against the actual wall.
 *
 * The website has this, and it is the one feature that is plainly better here
 * than there: the device is already in your hand and already next to the wall.
 * A 118dp swatch in a grid tells you very little about a colour that is going
 * to cover a room.
 *
 * The label sits in ink derived from the colour itself, so it stays readable on
 * a near-white and on a near-black alike, and everything is dismissed by
 * tapping anywhere — hands are busy holding the phone up.
 */
export function HoldToWall({ visible, hex, label, code, onClose }: HoldToWallProps) {
  const insets = useSafeAreaInsets();
  const color = hex ?? '#000000';
  const ink = inkOn(color);

  const dismiss = () => {
    haptics.close();
    onClose();
  };

  return (
    <Modal visible={visible && !!hex} animationType="fade" onRequestClose={dismiss} supportedOrientations={['portrait', 'landscape']}>
      {/* The status bar's icons sit directly on the paint, and the app's usual
          light content vanishes on a near-white shade. */}
      <StatusBar style={isLightPaint(color) ? 'dark' : 'light'} />
      <Pressable
        style={[styles.fill, { backgroundColor: color }]}
        onPress={dismiss}
        accessibilityRole="button"
        accessibilityLabel={`${label}, full screen. Tap to close.`}
      >
        <View style={[styles.top, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.hint}>
            <Text variant="caption" color={ink.soft}>
              Screen brightness up · hold against the wall
            </Text>
          </View>
          <View style={styles.close}>
            <Ionicons name="close" size={20} color={ink.strong} />
          </View>
        </View>

        <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.xl }]}>
          <Text variant="title" color={ink.strong}>
            {label}
          </Text>
          {code ? (
            <Text variant="mono" color={ink.soft}>
              {code}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'space-between' },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  hint: { flex: 1 },
  close: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottom: { paddingHorizontal: spacing.xl, gap: 2 },
});
