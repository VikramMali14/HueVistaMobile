import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, PressableScale, Text } from '../components';
import { colors, spacing, radius, alpha } from '../theme';
import { useShadeMatch } from '../shades/queries';
import { useAllowedBrands, useShadeCodeScheme } from '../account/queries';
import { shadeDisplay } from '../shades/shadeCodes';
import { summaryToShade, type Shade } from '../shades/types';
import { hexToLab, inkOn } from '../shades/colorScience';

export interface FinderPanelProps {
  /** Armed: the next tap on the photo lifts a colour instead of marking a wall. */
  picking: boolean;
  onTogglePicking: () => void;
  /** The colour last lifted out of the photo, or null. */
  pickedHex: string | null;
  onApply: (shade: Shade) => void;
  disabled?: boolean;
}

/** ΔE in CIELAB — how far the catalogue shade is from what was lifted. */
function deltaE(a: string, b: string): number {
  const x = hexToLab(a);
  const y = hexToLab(b);
  return Math.sqrt((x.L - y.L) ** 2 + (x.a - y.a) ** 2 + (x.b - y.b) ** 2);
}

/** Plain words for a ΔE. Below ~2 is the threshold most eyes stop seeing. */
function closeness(dE: number): string {
  if (dE < 2) return 'Practically the same colour';
  if (dE < 5) return 'Very close';
  if (dE < 10) return 'Close';
  return 'Nearest we stock';
}

/**
 * The colour finder, on the room itself.
 *
 * The website has had this for a while — upload a photo, click a colour, get
 * the shade codes. It never reached the phone, which is the odd way round: the
 * phone is where the photo is taken, and it is where a customer stands in front
 * of a wall they want matched. The photo is already decoded for the canvas, so
 * the whole feature is one pixel read plus the matcher the site already calls.
 *
 * Matching is scoped to the companies the shop may sell, because the nearest
 * shade on the platform is worthless if nobody behind the counter stocks it.
 */
export function FinderPanel({ picking, onTogglePicking, pickedHex, onApply, disabled }: FinderPanelProps) {
  const allowed = useAllowedBrands();
  const scheme = useShadeCodeScheme().data;
  // Scope only when the shop is genuinely restricted to a single company —
  // narrowing to one of several would quietly hide the better match.
  const brandSlug = allowed.restricted && allowed.brands.length === 1 ? allowed.brands[0].slug : undefined;

  const matches = useShadeMatch(pickedHex, brandSlug);
  const results = (matches.data ?? []).map(summaryToShade).filter((s): s is Shade => s !== null);

  return (
    <View style={styles.root}>
      <Text variant="bodySoft">
        Point at any colour in your own photo — a cushion, the floor, a wall you already like — and
        get the nearest shades you can actually buy.
      </Text>

      <Button
        label={picking ? 'Tap the photo · cancel' : pickedHex ? 'Lift another colour' : 'Lift a colour from the photo'}
        variant={picking ? 'secondary' : 'primary'}
        fullWidth
        icon={
          <Ionicons
            name={picking ? 'close' : 'eyedrop-outline'}
            size={16}
            color={picking ? colors.fg : '#fff'}
          />
        }
        onPress={onTogglePicking}
      />

      {pickedHex ? (
        <>
          <View style={styles.picked}>
            <View style={[styles.pickedSwatch, { backgroundColor: pickedHex, borderColor: alpha(pickedHex, 0.5) }]} />
            <View style={styles.pickedMeta}>
              <Text variant="overline">Lifted from your photo</Text>
              <Text variant="mono">{pickedHex.toUpperCase()}</Text>
            </View>
          </View>

          {matches.isLoading ? (
            <View style={styles.centre}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : matches.isError ? (
            <View style={styles.group}>
              <Text variant="body" color={colors.danger}>
                Couldn&apos;t reach the catalogue to match that colour.
              </Text>
              <Button label="Try again" variant="secondary" fullWidth onPress={() => matches.refetch()} />
            </View>
          ) : results.length === 0 ? (
            <Text variant="bodySoft">No catalogue shade came close to that colour.</Text>
          ) : (
            <View style={styles.group}>
              {results.map((s) => {
                const display = shadeDisplay(scheme, { code: s.code, name: s.name });
                const dE = deltaE(pickedHex, s.hex);
                return (
                  <PressableScale
                    key={`${s.brandSlug ?? ''}-${s.code}`}
                    onPress={() => onApply(s)}
                    disabled={disabled}
                    haptic="tap"
                    activeScale={0.98}
                    accessibilityRole="button"
                    accessibilityLabel={`${display.label}. ${closeness(dE)}. Paint the selected wall with it.`}
                    style={StyleSheet.flatten([styles.row, disabled && styles.rowDisabled])}
                  >
                    <View style={[styles.rowSwatch, { backgroundColor: s.hex, borderColor: alpha(s.hex, 0.5) }]}>
                      <Text variant="caption" color={inkOn(s.hex).soft}>
                        {Math.round(dE)}
                      </Text>
                    </View>
                    <View style={styles.rowMeta}>
                      <Text variant="heading" numberOfLines={1}>
                        {display.label}
                      </Text>
                      <Text variant="caption" numberOfLines={1}>
                        {s.brand ? `${s.brand} · ` : ''}
                        {closeness(dE)}
                      </Text>
                    </View>
                    {!disabled ? <Ionicons name="color-fill-outline" size={18} color={colors.accentSoft} /> : null}
                  </PressableScale>
                );
              })}
            </View>
          )}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  group: { gap: spacing.sm },
  centre: { paddingVertical: spacing.xl, alignItems: 'center' },
  picked: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pickedSwatch: {
    width: 56,
    height: 56,
    borderRadius: radius.cardTight,
    borderWidth: 1,
  },
  pickedMeta: { flex: 1, gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.cardTight,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassEdgeSoft,
  },
  rowDisabled: { opacity: 0.45 },
  rowSwatch: {
    width: 44,
    height: 44,
    borderRadius: radius.input,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMeta: { flex: 1, gap: 2 },
});
