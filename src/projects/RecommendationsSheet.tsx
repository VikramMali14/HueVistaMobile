import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SheetModal, Text, Card } from '../components';
import { colors, spacing, radius } from '../theme';
import { RecommendationResponse, MatchedShade, ShadeCodeScheme, retailApi } from '../api';
import { Shade } from '../shades/types';
import { shadeDisplay } from '../shades/shadeCodes';
import { useShadeCodeScheme } from '../account/queries';
import { useSession } from '../auth';

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

function Swatch({
  label,
  shade,
  scheme,
  onApply,
}: {
  label: string;
  shade: Shade | null;
  scheme: ShadeCodeScheme | undefined;
  onApply: (s: Shade) => void;
}) {
  if (!shade) return null;
  // A suggestion is still a catalogue shade, so it reads the way every other
  // swatch under this shop reads — the shop's code, never the manufacturer's.
  const display = shadeDisplay(scheme, { code: shade.code, name: shade.name });
  return (
    <Pressable style={styles.swatchCol} onPress={() => onApply(shade)}>
      <View style={[styles.swatch, { backgroundColor: shade.hex }]} />
      <Text variant="caption" color={colors.fgSoft}>
        {label}
      </Text>
      <Text variant="caption" numberOfLines={1} style={styles.swatchName}>
        {shade.code !== '—' ? display.code : shade.hex.toUpperCase()}
      </Text>
    </Pressable>
  );
}

/** Bottom-sheet of Claude's three suggested palettes. Tap any swatch to paint
 *  the selected wall with it. */
export function RecommendationsSheet({ visible, onClose, loading, error, data, onApply }: Props) {
  const scheme = useShadeCodeScheme().data;
  const { status } = useSession();

  /**
   * The shop's own saved palettes, offered beside Claude's.
   *
   * These are free, instant and chosen by the people who sell the paint, so they
   * lead when they exist. Only fetched while the sheet is open — a customer with
   * no shop gets a 403 or an empty list, which reads the same either way.
   */
  const combos = useQuery({
    queryKey: ['retail', 'my-combos'],
    queryFn: () => retailApi.myCombos(),
    enabled: visible && status === 'authenticated',
    staleTime: 30 * 60_000,
    retry: false,
  });
  const shopCombos = combos.data ?? [];

  return (
    <SheetModal visible={visible} onClose={onClose} title="Palette ideas">
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

          {/* The shop's own combinations first — chosen by the people selling the
              paint, and already in their catalogue. */}
          {shopCombos.length > 0 ? (
            <>
              <Text variant="label" style={styles.sectionHead}>
                From your shop
              </Text>
              {shopCombos.map((combo) => (
                <Card key={combo.id} style={styles.combo}>
                  <Text variant="heading">{combo.name ?? 'Shop palette'}</Text>
                  <View style={styles.swatchRow}>
                    {combo.shades.slice(0, 3).map((s, j) =>
                      s.hex ? (
                        <Swatch
                          key={`${combo.id}-${j}`}
                          label={j === 0 ? 'Main' : j === 1 ? 'Accent' : 'Trim'}
                          shade={{
                            code: s.code ?? '—',
                            name: s.name ?? s.code ?? 'Colour',
                            hex: s.hex,
                            brand: '',
                            family: '',
                          }}
                          scheme={scheme}
                          onApply={onApply}
                        />
                      ) : null,
                    )}
                  </View>
                </Card>
              ))}
              <Text variant="label" style={styles.sectionHead}>
                From Claude
              </Text>
            </>
          ) : null}

          {(data?.combinations ?? []).map((combo, i) => (
            <Card key={`${combo.name ?? 'combo'}-${i}`} style={styles.combo}>
              <Text variant="heading">{combo.name ?? `Palette ${i + 1}`}</Text>
              {combo.rationale ? (
                <Text variant="bodySoft" style={styles.rationale}>
                  {combo.rationale}
                </Text>
              ) : null}
              <View style={styles.swatchRow}>
                <Swatch label="Primary" shade={toShade(combo.primaryHex, combo.primaryShade, 'Primary')} scheme={scheme} onApply={onApply} />
                <Swatch label="Accent" shade={toShade(combo.accentHex, combo.accentShade, 'Accent')} scheme={scheme} onApply={onApply} />
                <Swatch label="Trim" shade={toShade(combo.trimHex, combo.trimShade, 'Trim')} scheme={scheme} onApply={onApply} />
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
  sectionHead: { marginBottom: spacing.sm },
  combo: { marginBottom: spacing.md, gap: spacing.xs },
  rationale: { marginTop: spacing.xs },
  swatchRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  swatchCol: { alignItems: 'center', gap: 2, width: 72 },
  swatch: { width: 72, height: 56, borderRadius: radius.card, borderWidth: 1, borderColor: colors.rule, marginBottom: 2 },
  swatchName: { width: 72, textAlign: 'center' },
});
