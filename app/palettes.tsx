import { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Screen,
  Text,
  Button,
  Card,
  Input,
  SheetModal,
  Segmented,
  PressableScale,
  BackLink,
} from '../src/components';
import { colors, spacing, radius, alpha } from '../src/theme';
import {
  useCreateCombo,
  useDeleteCombo,
  useMyOrg,
  useShopCombos,
} from '../src/account/roleQueries';
import { useShadeCodeScheme } from '../src/account/queries';
import { useShadeBrands, useShadesInfinite } from '../src/shades/queries';
import { useDebouncedValue } from '../src/shades/useDebouncedValue';
import { shadeDisplay } from '../src/shades/shadeCodes';
import { summaryToShade, type Shade } from '../src/shades/types';
import { inkOn } from '../src/shades/colorScience';
import { userMessage, type ComboShadeInput, type RetailerCombo } from '../src/api';

/**
 * The palettes a shop curates.
 *
 * The studio already offered these — `SuggestPanel` puts them above the model's
 * own suggestions, because a combination chosen by the people who sell the paint
 * beats a generated one and costs nothing to show. What the app never had was
 * the other end of it: the shop could see its palettes on a customer's phone but
 * could only create them on the website.
 *
 * A palette is exactly three shades in the studio's own role order — main wall,
 * accent, trim — so the builder is three fixed slots rather than a list. That is
 * also the backend's rule, and making it visible here means the shop is never
 * assembling something the server will reject.
 */

const SCOPES = [
  { value: 'INTERIOR' as const, label: 'Interior' },
  { value: 'EXTERIOR' as const, label: 'Exterior' },
];

const SLOTS = [
  { key: 0, label: 'Main wall' },
  { key: 1, label: 'Accent' },
  { key: 2, label: 'Trim' },
];

type Scope = 'INTERIOR' | 'EXTERIOR';
/** The three slots as they fill up. A hole is a slot not yet chosen. */
type SlotShades = [Shade | null, Shade | null, Shade | null];

export default function PalettesScreen() {
  const org = useMyOrg();
  const orgId = org.data?.id;
  const combos = useShopCombos(orgId);
  const create = useCreateCombo(orgId);
  const remove = useDeleteCombo(orgId);
  const scheme = useShadeCodeScheme().data;

  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState('');
  const [scope, setScope] = useState<Scope>('INTERIOR');
  const [shades, setShades] = useState<SlotShades>([null, null, null]);
  /** Which slot the shade picker is filling, or null when it is closed. */
  const [picking, setPicking] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = combos.data ?? [];
  const interior = rows.filter((c) => c.scope === 'INTERIOR');
  const exterior = rows.filter((c) => c.scope === 'EXTERIOR');

  const complete = shades.every((s): s is Shade => s !== null) && name.trim().length > 0;

  function openNew() {
    setName('');
    setScope('INTERIOR');
    setShades([null, null, null]);
    setError(null);
    setSheetOpen(true);
  }

  function setSlot(index: number, shade: Shade) {
    setShades((prev) => {
      const next = [...prev] as SlotShades;
      next[index] = shade;
      return next;
    });
    setPicking(null);
  }

  async function submit() {
    setError(null);
    const picked = shades.filter((s): s is Shade => s !== null);
    if (picked.length !== 3) {
      setError('Pick all three colours.');
      return;
    }
    const payload = picked.map(
      (s): ComboShadeInput => ({ code: s.code, name: s.name, hex: s.hex }),
    ) as [ComboShadeInput, ComboShadeInput, ComboShadeInput];
    try {
      await create.mutateAsync({ name, scope, shades: payload });
      setSheetOpen(false);
    } catch (err) {
      setError(userMessage(err));
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <BackLink />

        <View style={styles.header}>
          <Text variant="title">Palettes</Text>
          <Text variant="bodySoft">
            {rows.length ? `${rows.length} saved` : 'None saved yet'} · shown in the studio before
            the AI&apos;s own suggestions
          </Text>
        </View>

        <Button
          label="New palette"
          icon={<Ionicons name="add" size={18} color="#fff" />}
          fullWidth
          onPress={openNew}
        />

        {combos.isLoading ? (
          <Text variant="caption">Loading…</Text>
        ) : combos.isError ? (
          <Card>
            <Text variant="body" color={colors.danger}>
              {userMessage(combos.error)}
            </Text>
          </Card>
        ) : rows.length === 0 ? (
          <Card>
            <Text variant="bodySoft">
              Nothing saved yet. A palette is three colours that work together — a main wall, an
              accent and a trim. Anyone painting with your shop sees them first, ahead of the
              generated suggestions.
            </Text>
          </Card>
        ) : (
          <>
            {interior.length ? (
              <ComboGroup
                title="Interior"
                combos={interior}
                scheme={scheme}
                deleting={remove.isPending}
                onDelete={(id) => remove.mutate(id)}
              />
            ) : null}
            {exterior.length ? (
              <ComboGroup
                title="Exterior"
                combos={exterior}
                scheme={scheme}
                deleting={remove.isPending}
                onDelete={(id) => remove.mutate(id)}
              />
            ) : null}
          </>
        )}
      </ScrollView>

      <SheetModal visible={sheetOpen} onClose={() => setSheetOpen(false)} title="New palette">
        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheet}
          keyboardShouldPersistTaps="handled"
        >
          <Input
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Morning light, Coastal, Heritage"
            autoCapitalize="words"
          />

          <View>
            <Text variant="label" style={styles.fieldLabel}>
              Where it is for
            </Text>
            <Segmented
              options={SCOPES}
              value={scope}
              onChange={setScope}
              accessibilityLabel="Interior or exterior"
            />
          </View>

          <View style={styles.slots}>
            {SLOTS.map((slot) => {
              const shade = shades[slot.key];
              return (
                <PressableScale
                  key={slot.key}
                  onPress={() => setPicking(slot.key)}
                  haptic="tap"
                  activeScale={0.97}
                  accessibilityRole="button"
                  accessibilityLabel={
                    shade ? `${slot.label}: ${shade.name}. Change it.` : `Pick the ${slot.label} colour`
                  }
                  style={styles.slot}
                >
                  <View
                    style={[
                      styles.slotSwatch,
                      shade
                        ? { backgroundColor: shade.hex, borderColor: alpha(shade.hex, 0.5) }
                        : styles.slotEmpty,
                    ]}
                  >
                    {!shade ? <Ionicons name="add" size={18} color={colors.fgMute} /> : null}
                  </View>
                  <Text variant="caption" color={colors.fgSoft}>
                    {slot.label}
                  </Text>
                  <Text variant="caption" numberOfLines={1} style={styles.slotName}>
                    {shade ? shadeDisplay(scheme, { code: shade.code, name: shade.name }).code : 'Pick'}
                  </Text>
                </PressableScale>
              );
            })}
          </View>

          {error ? (
            <Text variant="body" color={colors.danger}>
              {error}
            </Text>
          ) : null}

          <Button
            label="Save palette"
            fullWidth
            loading={create.isPending}
            disabled={!complete}
            onPress={submit}
          />
        </ScrollView>
      </SheetModal>

      <ShadePicker
        visible={picking !== null}
        title={picking !== null ? `Pick the ${SLOTS[picking].label.toLowerCase()} colour` : ''}
        onClose={() => setPicking(null)}
        onPick={(s) => (picking !== null ? setSlot(picking, s) : undefined)}
      />
    </Screen>
  );
}

function ComboGroup({
  title,
  combos,
  scheme,
  deleting,
  onDelete,
}: {
  title: string;
  combos: RetailerCombo[];
  scheme: ReturnType<typeof useShadeCodeScheme>['data'];
  deleting: boolean;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      <Text variant="label">{title}</Text>
      {combos.map((combo) => (
        <Card key={combo.id} style={styles.combo}>
          <View style={styles.comboHead}>
            <Text variant="heading" numberOfLines={1} style={styles.comboName}>
              {combo.name ?? 'Palette'}
            </Text>
            <Button
              label="Delete"
              variant="ghost"
              loading={deleting}
              onPress={() => onDelete(combo.id)}
            />
          </View>
          <View style={styles.comboSwatches}>
            {combo.shades.slice(0, 3).map((s, i) =>
              s.hex ? (
                <View
                  key={`${combo.id}-${i}`}
                  style={[styles.comboSwatch, { backgroundColor: s.hex }]}
                >
                  <Text variant="caption" color={inkOn(s.hex).soft}>
                    {shadeDisplay(scheme, { code: s.code ?? '', name: s.name ?? '' }).code}
                  </Text>
                </View>
              ) : null,
            )}
          </View>
        </Card>
      ))}
    </>
  );
}

/**
 * Pick one catalogue shade.
 *
 * Company first, then a search inside it — the same order the Shades tab uses,
 * and the same reason: an unfiltered search across every company on the platform
 * returns colours the shop may not be allowed to sell.
 */
function ShadePicker({
  visible,
  title,
  onClose,
  onPick,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  onPick: (s: Shade) => void;
}) {
  const brands = useShadeBrands();
  const scheme = useShadeCodeScheme().data;
  const [brandSlug, setBrandSlug] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query, 250);

  const filters = useMemo(
    () => ({ brand: brandSlug ?? undefined, search: debounced.trim() || undefined }),
    [brandSlug, debounced],
  );
  const shades = useShadesInfinite(filters, { enabled: visible && Boolean(brandSlug) });

  const results = useMemo(() => {
    const pages = shades.data?.pages ?? [];
    return pages
      .flatMap((p) => p.content)
      .map(summaryToShade)
      .filter((s): s is Shade => s !== null)
      .slice(0, 60);
  }, [shades.data]);

  return (
    <SheetModal visible={visible} onClose={onClose} title={title}>
      <View style={styles.picker}>
        <View style={styles.chips}>
          {(brands.data ?? []).map((b) => (
            <PressableScale
              key={b.slug}
              onPress={() => setBrandSlug(b.slug)}
              haptic="tap"
              activeScale={0.96}
              accessibilityRole="button"
              accessibilityState={{ selected: brandSlug === b.slug }}
              style={StyleSheet.flatten([styles.chip, brandSlug === b.slug && styles.chipOn])}
            >
              <Text variant="caption" color={brandSlug === b.slug ? colors.fg : colors.fgSoft}>
                {b.name}
              </Text>
            </PressableScale>
          ))}
        </View>

        {brandSlug ? (
          <>
            <Input
              placeholder="Search this company's shades"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
            />
            {shades.isLoading ? (
              <Text variant="caption">Loading…</Text>
            ) : results.length === 0 ? (
              <Text variant="bodySoft">Nothing matched that.</Text>
            ) : (
              <FlatList
                data={results}
                keyExtractor={(s) => `${s.brandSlug ?? ''}-${s.code}`}
                style={styles.results}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const display = shadeDisplay(scheme, { code: item.code, name: item.name });
                  return (
                    <PressableScale
                      onPress={() => onPick(item)}
                      haptic="tap"
                      activeScale={0.98}
                      accessibilityRole="button"
                      accessibilityLabel={display.label}
                      style={styles.result}
                    >
                      <View style={[styles.resultSwatch, { backgroundColor: item.hex }]} />
                      <View style={styles.resultMeta}>
                        <Text variant="heading" numberOfLines={1}>
                          {display.label}
                        </Text>
                        <Text variant="caption" numberOfLines={1}>
                          {item.family || item.brand}
                        </Text>
                      </View>
                    </PressableScale>
                  );
                }}
              />
            )}
          </>
        ) : (
          <Text variant="bodySoft">Pick a company to search its shades.</Text>
        )}
      </View>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  header: { gap: spacing.xs },
  combo: { gap: spacing.sm },
  comboHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  comboName: { flex: 1 },
  comboSwatches: { flexDirection: 'row', gap: spacing.sm },
  comboSwatch: {
    flex: 1,
    height: 56,
    borderRadius: radius.cardTight,
    borderWidth: 1,
    borderColor: colors.rule,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetScroll: { maxHeight: 480 },
  sheet: { gap: spacing.md, paddingBottom: spacing.lg },
  fieldLabel: { marginBottom: spacing.xs },
  slots: { flexDirection: 'row', gap: spacing.md },
  slot: { flex: 1, alignItems: 'center', gap: 2 },
  slotSwatch: {
    width: '100%',
    height: 64,
    borderRadius: radius.cardTight,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  slotEmpty: {
    backgroundColor: colors.glass,
    borderColor: colors.glassEdgeSoft,
    borderStyle: 'dashed',
  },
  slotName: { textAlign: 'center' },
  picker: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassEdgeSoft,
  },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.glassStrong },
  results: { maxHeight: 320 },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  resultSwatch: {
    width: 44,
    height: 44,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  resultMeta: { flex: 1, gap: 2 },
});
