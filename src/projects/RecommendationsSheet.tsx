import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SheetModal, Text, Card } from '../components';
import { colors, spacing, radius } from '../theme';
import { RecommendationResponse, MatchedShade } from '../api';
import { Shade } from '../shades/types';

interface Props {
  visible: boolean;
  onClose: () => void;
  loading: boolean;
  error: string | null;
  data: RecommendationResponse | null;
  onApply: (shade: Shade) => void;
}

function toShade(hex?: string | null, matched?: MatchedShade | null, roleLabel?: string): Shade | null {
  if (matched?.hexCode) {
    return {
      code: matched.shadeCode,
      name: matched.name ?? matched.shadeCode,
      hex: matched.hexCode,
      brand: matched.brand ?? '',
      family: matched.shadeFamily ?? '',
    };
  }
  if (hex) return { code: '—', name: roleLabel ?? 'Colour', hex, brand: '', family: '' };
  return null;
}

function Swatch({ label, shade, onApply }: { label: string; shade: Shade | null; onApply: (s: Shade) => void }) {
  if (!shade) return null;
  return (
    <Pressable style={styles.swatchCol} onPress={() => onApply(shade)}>
      <View style={[styles.swatch, { backgroundColor: shade.hex }]} />
      <Text variant="caption" color={colors.fgSoft}>
        {label}
      </Text>
      <Text variant="caption" numberOfLines={1} style={styles.swatchName}>
        {shade.code !== '—' ? shade.code : shade.hex.toUpperCase()}
      </Text>
    </Pressable>
  );
}

/** Bottom-sheet of Claude's three suggested palettes. Tap any swatch to paint
 *  the selected wall with it. */
export function RecommendationsSheet({ visible, onClose, loading, error, data, onApply }: Props) {
  return (
    <SheetModal visible={visible} onClose={onClose} title="AI palette ideas">
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
          <Text variant="caption" style={{ marginTop: spacing.sm }}>
            Analyzing your room…
          </Text>
        </View>
      ) : error ? (
        <Text variant="body" color={colors.danger}>
          {error}
        </Text>
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text variant="bodySoft" style={styles.hint}>
            Tap a colour to paint the selected wall.
          </Text>
          {(data?.combinations ?? []).map((combo, i) => (
            <Card key={`${combo.name ?? 'combo'}-${i}`} style={styles.combo}>
              <Text variant="heading">{combo.name ?? `Palette ${i + 1}`}</Text>
              {combo.rationale ? (
                <Text variant="bodySoft" style={styles.rationale}>
                  {combo.rationale}
                </Text>
              ) : null}
              <View style={styles.swatchRow}>
                <Swatch label="Primary" shade={toShade(combo.primaryHex, combo.primaryShade, 'Primary')} onApply={onApply} />
                <Swatch label="Accent" shade={toShade(combo.accentHex, combo.accentShade, 'Accent')} onApply={onApply} />
                <Swatch label="Trim" shade={toShade(combo.trimHex, combo.trimShade, 'Trim')} onApply={onApply} />
              </View>
            </Card>
          ))}
        </ScrollView>
      )}
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: spacing.xxl, alignItems: 'center' },
  scroll: { maxHeight: 460 },
  hint: { marginBottom: spacing.md },
  combo: { marginBottom: spacing.md, gap: spacing.xs },
  rationale: { marginTop: spacing.xs },
  swatchRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  swatchCol: { alignItems: 'center', gap: 2, width: 72 },
  swatch: { width: 72, height: 56, borderRadius: radius.card, borderWidth: 1, borderColor: colors.rule, marginBottom: 2 },
  swatchName: { width: 72, textAlign: 'center' },
});
