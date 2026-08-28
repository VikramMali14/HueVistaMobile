import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, PressableScale, Text } from '../components';
import { colors, spacing, radius } from '../theme';
import { shopCombosApi, type MatchedShade, type RecommendationResponse, type ShadeCodeScheme } from '../api';
import { shadeDisplay } from '../shades/shadeCodes';
import { useShadeCodeScheme } from '../account/queries';
import { useSession } from '../auth';
import { hexOnlyShade, isCatalogueShade, type Shade } from '../shades/types';

export interface SuggestPanelProps {
  loading: boolean;
  error: string | null;
  data: RecommendationResponse | null;
  /** Asks for suggestions. A real model call, so it is never fired on mount. */
  onAsk: () => void;
  onApply: (shade: Shade) => void;
  /** Nothing to apply a palette to on a view-only room. */
  disabled?: boolean;
}

/**
 * A suggested colour, as something the rest of the app can hold.
 *
 * The model returns a hex per role and, where it found one, the catalogue shade
 * nearest to it. Only the second kind has a code; the first used to be given
 * the em dash this panel prints under a swatch, which then travelled as a real
 * shade code to `PUT /projects/{id}/regions` and into "Recently used". A
 * colour with no product behind it now says so — see `isCatalogueShade`.
 */
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
  if (hex) return hexOnlyShade(hex, roleLabel ?? 'Colour');
  return null;
}

/**
 * The palette ideas, in place under the photo.
 *
 * These were behind a button that opened a bottom sheet over the room — so the
 * one thing a suggestion needs to be judged against, the actual wall, was
 * covered by the suggestion itself. Docked here, tapping a swatch repaints the
 * wall a few centimetres above it and the rest of the palette stays on screen
 * to try next.
 */
export function SuggestPanel({ loading, error, data, onAsk, onApply, disabled }: SuggestPanelProps) {
  const scheme = useShadeCodeScheme().data;
  const { status } = useSession();

  /**
   * The shop's own saved palettes, offered beside Claude's. Free, instant and
   * chosen by the people who sell the paint, so they lead when they exist. A
   * customer with no shop gets a 403 or an empty list, which read the same.
   */
  const combos = useQuery({
    queryKey: ['account', 'shop-combos'],
    queryFn: () => shopCombosApi.mine(),
    enabled: status === 'authenticated',
    staleTime: 30 * 60_000,
    retry: false,
  });
  const shopCombos = combos.data ?? [];
  const claudeCombos = data?.combinations ?? [];

  return (
    <View style={styles.root}>
      {shopCombos.length > 0 ? (
        <View style={styles.group}>
          <Text variant="eyebrow">From your shop</Text>
          {shopCombos.map((combo) => (
            <Card key={combo.id} tone="quiet" style={styles.combo}>
              <Text variant="subhead">{combo.name ?? 'Shop palette'}</Text>
              <View style={styles.swatchRow}>
                {combo.shades.slice(0, 3).map((s, j) =>
                  s.hex ? (
                    <Swatch
                      key={`${combo.id}-${j}`}
                      label={j === 0 ? 'Main' : j === 1 ? 'Accent' : 'Trim'}
                      shade={
                        s.code
                          ? { code: s.code, name: s.name ?? s.code, hex: s.hex, brand: '', family: '' }
                          : hexOnlyShade(s.hex, s.name ?? 'Colour')
                      }
                      scheme={scheme}
                      disabled={disabled}
                      onApply={onApply}
                    />
                  ) : null,
                )}
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      <View style={styles.group}>
        {shopCombos.length > 0 ? <Text variant="eyebrow">Matched to this room</Text> : null}

        {loading ? (
          <View style={styles.centre}>
            <ActivityIndicator color={colors.accent} />
            <Text variant="caption" style={styles.centreNote}>
              Reading your room…
            </Text>
          </View>
        ) : error ? (
          <View style={styles.group}>
            <Text variant="body" color={colors.dangerSoft}>
              {error}
            </Text>
            <Button label="Try again" variant="secondary" fullWidth onPress={onAsk} />
          </View>
        ) : claudeCombos.length === 0 ? (
          <View style={styles.group}>
            <Text variant="bodySoft">
              Palettes chosen for this room — the light in it, what is already on the floor and the
              furniture. Included in the room, so asking costs nothing.
            </Text>
            <Button
              label="Suggest palettes"
              icon={<Ionicons name="sparkles" size={16} color={colors.onFill} />}
              fullWidth
              onPress={onAsk}
              disabled={disabled}
            />
          </View>
        ) : (
          <>
            <Text variant="bodySoft">Tap a colour to paint the selected surface.</Text>
            {claudeCombos.map((combo, i) => (
              <Card key={`${combo.name ?? 'combo'}-${i}`} tone="quiet" style={styles.combo}>
                <Text variant="subhead">{combo.name ?? `Palette ${i + 1}`}</Text>
                {combo.rationale ? <Text variant="bodySoft">{combo.rationale}</Text> : null}
                <View style={styles.swatchRow}>
                  <Swatch
                    label="Primary"
                    shade={toShade(combo.primaryHex, combo.primaryShade, 'Primary')}
                    scheme={scheme}
                    disabled={disabled}
                    onApply={onApply}
                  />
                  <Swatch
                    label="Accent"
                    shade={toShade(combo.accentHex, combo.accentShade, 'Accent')}
                    scheme={scheme}
                    disabled={disabled}
                    onApply={onApply}
                  />
                  <Swatch
                    label="Trim"
                    shade={toShade(combo.trimHex, combo.trimShade, 'Trim')}
                    scheme={scheme}
                    disabled={disabled}
                    onApply={onApply}
                  />
                </View>
              </Card>
            ))}
          </>
        )}
      </View>
    </View>
  );
}

function Swatch({
  label,
  shade,
  scheme,
  disabled,
  onApply,
}: {
  label: string;
  shade: Shade | null;
  scheme: ShadeCodeScheme | undefined;
  disabled?: boolean;
  onApply: (s: Shade) => void;
}) {
  if (!shade) return null;
  // A suggestion is still a catalogue shade, so it reads the way every other
  // swatch under this shop reads — the shop's code, never the manufacturer's.
  const display = shadeDisplay(scheme, { code: shade.code, name: shade.name });
  return (
    <PressableScale
      onPress={() => onApply(shade)}
      disabled={disabled}
      haptic="none"
      activeScale={0.94}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${shade.name}`}
      style={StyleSheet.flatten([styles.swatchCol, disabled && styles.swatchDisabled])}
    >
      <View style={[styles.swatch, { backgroundColor: shade.hex }]} />
      <Text variant="caption" color={colors.fgSoft}>
        {label}
      </Text>
      <Text variant="caption" numberOfLines={1} style={styles.swatchName}>
        {isCatalogueShade(shade) ? display.code : shade.hex.toUpperCase()}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.lg },
  group: { gap: spacing.sm },
  combo: { gap: spacing.xs, padding: spacing.md },
  swatchRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  swatchCol: { alignItems: 'center', gap: 2, flex: 1 },
  swatchDisabled: { opacity: 0.45 },
  swatch: {
    width: '100%',
    height: 56,
    borderRadius: radius.cardTight,
    borderWidth: 1,
    borderColor: colors.rule,
    marginBottom: 2,
  },
  swatchName: { textAlign: 'center' },
  centre: { paddingVertical: spacing.xl, alignItems: 'center' },
  centreNote: { marginTop: spacing.sm },
});
