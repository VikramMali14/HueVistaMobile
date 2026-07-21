import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';
import { Text } from './Text';

export interface SheetModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

/**
 * Bottom-sheet modal. Deliberately dependency-light for Phase 0 (native Modal +
 * scrim, no gesture library). The 3/7/14-day access-code sheet and the share
 * sheet in later phases build on this.
 */
export function SheetModal({ visible, onClose, title, children }: SheetModalProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
        {/* Stop propagation: taps inside the sheet must not close it. */}
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} onPress={() => {}}>
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
  scrim: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface2,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.fgMute,
    marginBottom: spacing.lg,
  },
  title: {
    marginBottom: spacing.lg,
  },
});
