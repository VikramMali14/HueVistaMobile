import { useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Screen,
  Text,
  Button,
  Card,
  Input,
  SheetModal,
  Segmented,
  StatusPill,
  PressableScale,
  AuthedImage,
  BackLink,
} from '../src/components';
import { colors, spacing, radius } from '../src/theme';
import {
  useAddBrand,
  useAddLine,
  useDeleteProduct,
  useMyOrg,
  usePaintBrands,
  usePaintLines,
  useSaveProduct,
  useShopProducts,
} from '../src/account/roleQueries';
import {
  defaultBrightness,
  userMessage,
  QUALITY_TIERS,
  type PaintBrand,
  type PaintLine,
  type ProductCategory,
  type QualityTier,
  type ShopProduct,
  type ShopProductInput,
} from '../src/api';

/**
 * The shop's paint products.
 *
 * The website has had this page since the beginning and the app never did, so a
 * shop could issue codes, run the counter and read its plan from the phone but
 * had to open a laptop to say what it actually sells. The listings are what the
 * customer sees on their assigned-products screen, so the gap was one-directional
 * in the worst way: the app showed the shelf without letting anyone stock it.
 *
 * A listing is a shop's own price and pack against a shared catalogue line, so
 * the form is a cascade — company, then which side of the wall, then the line —
 * before anything shop-specific is asked for. Both catalogue levels can be added
 * inline, because a shop that stocks a line nobody has entered would otherwise
 * be stuck at step one.
 */

const TIER_OPTIONS = [
  { value: 'ECONOMY' as const, label: 'Economy' },
  { value: 'PREMIUM' as const, label: 'Premium' },
  { value: 'LUXURY' as const, label: 'Luxury' },
];

const CATEGORY_OPTIONS = [
  { value: 'INTERIOR' as const, label: 'Interior' },
  { value: 'EXTERIOR' as const, label: 'Exterior' },
];

/** The bucket sizes a shop prices against, matching the website's list. */
const PRICE_UNITS = ['20 L', '10 L', '4 L', '1 L'];

const tierLabel = (t?: string | null) => (t ? t.charAt(0) + t.slice(1).toLowerCase() : '—');

/** Rupees from whatever the wire sent — BigDecimal arrives as a number or a string. */
function priceText(price: ShopProduct['price'], unit?: string | null): string | null {
  if (price == null || price === '') return null;
  const n = typeof price === 'number' ? price : Number(price);
  if (Number.isNaN(n)) return null;
  const amount = `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  return unit ? `${amount} · ${unit}` : amount;
}

/** The editable half of a listing. Empty strings so every field is controlled. */
interface Draft {
  price: string;
  priceUnit: string;
  packSize: string;
  coverage: string;
  finish: string;
  qualityTier: QualityTier;
  brightness: number;
  features: string;
  description: string;
}

/**
 * Read a tier off the wire, falling back rather than trusting the string.
 *
 * The schemas keep `qualityTier` as a plain string on purpose — a tier added
 * server-side should not fail the parse of a whole product list — so the screen
 * is where an unknown value has to become something the form can render.
 */
function asTier(value?: string | null): QualityTier {
  return (QUALITY_TIERS as readonly string[]).includes(value ?? '')
    ? (value as QualityTier)
    : 'PREMIUM';
}

function emptyDraft(line?: PaintLine | null): Draft {
  const tier = asTier(line?.qualityTier);
  return {
    price: '',
    priceUnit: PRICE_UNITS[0],
    packSize: PRICE_UNITS[0],
    coverage: '',
    finish: line?.defaultFinish ?? '',
    qualityTier: tier,
    brightness: defaultBrightness(tier),
    features: '',
    description: '',
  };
}

function draftFrom(p: ShopProduct): Draft {
  const tier = asTier(p.qualityTier);
  return {
    price: p.price != null ? String(p.price) : '',
    priceUnit: p.priceUnit ?? PRICE_UNITS[0],
    packSize: p.packSize ?? '',
    coverage: p.coverage ?? '',
    finish: p.finish ?? '',
    qualityTier: tier,
    brightness: p.brightness ?? defaultBrightness(tier),
    features: p.features ?? '',
    description: p.description ?? '',
  };
}

function draftToInput(lineId: number, d: Draft): ShopProductInput {
  const price = d.price.trim() ? Number(d.price) : undefined;
  return {
    lineId,
    price: price != null && !Number.isNaN(price) ? price : undefined,
    priceUnit: d.priceUnit || undefined,
    packSize: d.packSize || undefined,
    coverage: d.coverage || undefined,
    finish: d.finish || undefined,
    qualityTier: d.qualityTier,
    brightness: d.brightness,
    features: d.features || undefined,
    description: d.description || undefined,
  };
}

export default function ProductsScreen() {
  const org = useMyOrg();
  const orgId = org.data?.id;
  const products = useShopProducts(orgId);
  const save = useSaveProduct(orgId);
  const remove = useDeleteProduct(orgId);

  const [sheetOpen, setSheetOpen] = useState(false);
  /** The listing being edited, or null when the sheet is creating a new one. */
  const [editing, setEditing] = useState<ShopProduct | null>(null);
  const [brand, setBrand] = useState<PaintBrand | null>(null);
  const [category, setCategory] = useState<ProductCategory>('INTERIOR');
  const [line, setLine] = useState<PaintLine | null>(null);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft());
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState('');

  const rows = useMemo(() => {
    const all = products.data ?? [];
    const q = filter.trim().toLowerCase();
    if (!q) return all;
    return all.filter((p) =>
      [p.brandName, p.lineName, p.finish, p.category].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [products.data, filter]);

  function openNew() {
    setEditing(null);
    setBrand(null);
    setLine(null);
    setCategory('INTERIOR');
    setDraft(emptyDraft());
    setError(null);
    setSheetOpen(true);
  }

  function openEdit(p: ShopProduct) {
    setEditing(p);
    // The catalogue pickers stay closed when editing: the listing already knows
    // its line, and re-picking one is a different job from fixing a price.
    setBrand(null);
    setLine(null);
    setDraft(draftFrom(p));
    setError(null);
    setSheetOpen(true);
  }

  async function submit() {
    setError(null);
    const lineId = editing?.lineId ?? line?.id;
    if (lineId == null) {
      setError('Pick the product line first.');
      return;
    }
    try {
      await save.mutateAsync({ productId: editing?.id, input: draftToInput(lineId, draft) });
      setSheetOpen(false);
    } catch (err) {
      setError(userMessage(err));
    }
  }

  async function confirmDelete(p: ShopProduct) {
    setError(null);
    try {
      await remove.mutateAsync(p.id);
      setSheetOpen(false);
    } catch (err) {
      setError(userMessage(err));
    }
  }

  /** Keep the tier's own brightness unless the shop has typed its own. */
  function pickTier(t: QualityTier) {
    setDraft((d) => ({ ...d, qualityTier: t, brightness: defaultBrightness(t) }));
  }

  return (
    <Screen>
      <View style={styles.top}>
        <BackLink />
      </View>
      <View style={styles.header}>
        <View>
          <Text variant="title">Products</Text>
          <Text variant="bodySoft">{products.data?.length ?? 0} listed</Text>
        </View>
        <Button
          label="Add"
          icon={<Ionicons name="add" size={18} color="#fff" />}
          onPress={openNew}
        />
      </View>

      <FlatList
        data={rows}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={products.isRefetching}
            onRefresh={() => products.refetch()}
            tintColor={colors.accent}
          />
        }
        ListHeaderComponent={
          (products.data?.length ?? 0) > 4 ? (
            <Input
              placeholder="Filter by company, line or finish"
              value={filter}
              onChangeText={setFilter}
              autoCapitalize="none"
              containerStyle={styles.filter}
            />
          ) : null
        }
        ListEmptyComponent={
          products.isLoading ? (
            <Text variant="caption">Loading…</Text>
          ) : products.isError ? (
            <Card>
              <Text variant="body" color={colors.danger}>
                {userMessage(products.error)}
              </Text>
              <Text variant="caption" style={styles.emptyNote}>
                Products can be switched off for a shop by its distributor. If this shop should
                have the page, ask them to turn it back on.
              </Text>
            </Card>
          ) : (
            <Card>
              <Text variant="bodySoft">
                Nothing listed yet. Add what you stock — the price, the pack and the coverage — and
                it shows up for every customer holding one of your codes.
              </Text>
              <Button label="Add a product" fullWidth style={styles.emptyCta} onPress={openNew} />
            </Card>
          )
        }
        renderItem={({ item }) => {
          const price = priceText(item.price, item.priceUnit);
          return (
            <Card padded={false} onPress={() => openEdit(item)}>
              <View style={styles.row}>
                {item.imageUrl ? (
                  <AuthedImage url={item.imageUrl} style={styles.thumb} contentFit="cover" />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmpty]}>
                    <Ionicons name="color-fill-outline" size={22} color={colors.fgMute} />
                  </View>
                )}
                <View style={styles.rowMeta}>
                  <View style={styles.rowHead}>
                    <Text variant="heading" numberOfLines={1} style={styles.rowTitle}>
                      {item.lineName ?? 'Product'}
                    </Text>
                    <StatusPill
                      label={item.category === 'EXTERIOR' ? 'Exterior' : 'Interior'}
                      tone={item.category === 'EXTERIOR' ? 'progress' : 'done'}
                    />
                  </View>
                  <Text variant="caption" numberOfLines={1}>
                    {item.brandName ?? '—'} · {tierLabel(item.qualityTier)}
                    {item.finish ? ` · ${item.finish}` : ''}
                  </Text>
                  <Text variant="caption" numberOfLines={1}>
                    {price ?? 'No price set'}
                    {item.coverage ? ` · ${item.coverage}` : ''}
                  </Text>
                </View>
              </View>
            </Card>
          );
        }}
      />

      <SheetModal
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editing ? 'Edit listing' : 'Add a product'}
      >
        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheet}
          keyboardShouldPersistTaps="handled"
        >
          {editing ? (
            <Card tone="quiet">
              <Text variant="overline">Listing</Text>
              <Text variant="heading">{editing.lineName ?? 'Product'}</Text>
              <Text variant="caption">
                {editing.brandName ?? '—'} ·{' '}
                {editing.category === 'EXTERIOR' ? 'Exterior' : 'Interior'}
              </Text>
            </Card>
          ) : (
            <CataloguePicker
              brand={brand}
              category={category}
              line={line}
              onBrand={(b) => {
                setBrand(b);
                setLine(null);
              }}
              onCategory={(c) => {
                setCategory(c);
                setLine(null);
              }}
              onLine={(l) => {
                setLine(l);
                setDraft(emptyDraft(l));
              }}
            />
          )}

          {editing || line ? (
            <>
              <View style={styles.pair}>
                <Input
                  label="Price"
                  value={draft.price}
                  onChangeText={(v) => setDraft((d) => ({ ...d, price: v }))}
                  keyboardType="decimal-pad"
                  placeholder="2400"
                  containerStyle={styles.pairItem}
                />
                <View style={styles.pairItem}>
                  <Text variant="label" style={styles.fieldLabel}>
                    Per
                  </Text>
                  <View style={styles.chips}>
                    {PRICE_UNITS.map((u) => (
                      <PressableScale
                        key={u}
                        onPress={() => setDraft((d) => ({ ...d, priceUnit: u }))}
                        haptic="tap"
                        activeScale={0.96}
                        accessibilityRole="button"
                        accessibilityState={{ selected: draft.priceUnit === u }}
                        style={StyleSheet.flatten([
                          styles.chip,
                          draft.priceUnit === u && styles.chipOn,
                        ])}
                      >
                        <Text variant="caption" color={draft.priceUnit === u ? colors.fg : colors.fgSoft}>
                          {u}
                        </Text>
                      </PressableScale>
                    ))}
                  </View>
                </View>
              </View>

              <Input
                label="Pack size"
                value={draft.packSize}
                onChangeText={(v) => setDraft((d) => ({ ...d, packSize: v }))}
                placeholder="20 L"
              />
              <Input
                label="Coverage"
                value={draft.coverage}
                onChangeText={(v) => setDraft((d) => ({ ...d, coverage: v }))}
                placeholder="120–140 sq ft per litre, two coats"
              />
              <Input
                label="Finish"
                value={draft.finish}
                onChangeText={(v) => setDraft((d) => ({ ...d, finish: v }))}
                placeholder="Matt, sheen, gloss"
              />

              <View>
                <Text variant="label" style={styles.fieldLabel}>
                  Quality
                </Text>
                <Segmented
                  options={TIER_OPTIONS}
                  value={draft.qualityTier}
                  onChange={pickTier}
                  accessibilityLabel="Quality tier"
                />
                <Text variant="caption" style={styles.hint}>
                  Sets the 1–10 mark customers see. Now {draft.brightness}/10 — change it below if
                  this product sits above or below its band.
                </Text>
                <Input
                  label="Mark out of 10"
                  value={String(draft.brightness)}
                  onChangeText={(v) => {
                    const n = Number(v.replace(/[^0-9]/g, ''));
                    setDraft((d) => ({
                      ...d,
                      brightness: Number.isNaN(n) ? d.brightness : Math.max(1, Math.min(10, n)),
                    }));
                  }}
                  keyboardType="number-pad"
                />
              </View>

              <Input
                label="Features"
                value={draft.features}
                onChangeText={(v) => setDraft((d) => ({ ...d, features: v }))}
                placeholder="Washable, anti-fungal, low odour"
                multiline
              />
              <Input
                label="Description"
                value={draft.description}
                onChangeText={(v) => setDraft((d) => ({ ...d, description: v }))}
                placeholder="How you'd describe it across the counter"
                multiline
              />

              {error ? (
                <Text variant="body" color={colors.danger}>
                  {error}
                </Text>
              ) : null}

              <Button
                label={editing ? 'Save changes' : 'Add to my products'}
                fullWidth
                loading={save.isPending}
                onPress={submit}
              />
              {editing ? (
                <Button
                  label="Remove from my products"
                  variant="secondary"
                  fullWidth
                  loading={remove.isPending}
                  onPress={() => confirmDelete(editing)}
                />
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </SheetModal>
    </Screen>
  );
}

/**
 * Company → interior/exterior → line, in that order.
 *
 * Each step only appears once the one before it is answered: the line list is
 * meaningless without a company and a side of the wall, and showing three empty
 * pickers at once is how the website's version reads on a narrow screen.
 */
function CataloguePicker({
  brand,
  category,
  line,
  onBrand,
  onCategory,
  onLine,
}: {
  brand: PaintBrand | null;
  category: ProductCategory;
  line: PaintLine | null;
  onBrand: (b: PaintBrand) => void;
  onCategory: (c: ProductCategory) => void;
  onLine: (l: PaintLine) => void;
}) {
  const brands = usePaintBrands();
  const lines = usePaintLines(brand?.id, category);
  const addBrand = useAddBrand();
  const addLine = useAddLine();

  const [newBrand, setNewBrand] = useState('');
  const [newLine, setNewLine] = useState('');
  const [adding, setAdding] = useState<'brand' | 'line' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitBrand() {
    setError(null);
    try {
      const created = await addBrand.mutateAsync(newBrand);
      setNewBrand('');
      setAdding(null);
      onBrand(created);
    } catch (err) {
      setError(userMessage(err));
    }
  }

  async function submitLine() {
    if (!brand) return;
    setError(null);
    try {
      const created = await addLine.mutateAsync({
        brandId: brand.id,
        name: newLine,
        category,
      });
      setNewLine('');
      setAdding(null);
      onLine(created);
    } catch (err) {
      setError(userMessage(err));
    }
  }

  return (
    <View style={styles.picker}>
      <View>
        <Text variant="label" style={styles.fieldLabel}>
          Company
        </Text>
        {brands.isLoading ? (
          <Text variant="caption">Loading companies…</Text>
        ) : (
          <View style={styles.chips}>
            {(brands.data ?? []).map((b) => (
              <PressableScale
                key={b.id}
                onPress={() => onBrand(b)}
                haptic="tap"
                activeScale={0.96}
                accessibilityRole="button"
                accessibilityState={{ selected: brand?.id === b.id }}
                style={StyleSheet.flatten([styles.chip, brand?.id === b.id && styles.chipOn])}
              >
                <Text variant="caption" color={brand?.id === b.id ? colors.fg : colors.fgSoft}>
                  {b.name}
                </Text>
              </PressableScale>
            ))}
            <PressableScale
              onPress={() => setAdding(adding === 'brand' ? null : 'brand')}
              haptic="tap"
              activeScale={0.96}
              accessibilityRole="button"
              style={StyleSheet.flatten([styles.chip, styles.chipAdd])}
            >
              <Text variant="caption" color={colors.accentSoft}>
                + Add
              </Text>
            </PressableScale>
          </View>
        )}
        {adding === 'brand' ? (
          <View style={styles.inline}>
            <Input
              placeholder="Company name"
              value={newBrand}
              onChangeText={setNewBrand}
              autoCapitalize="words"
              containerStyle={styles.inlineInput}
            />
            <Button
              label="Add"
              loading={addBrand.isPending}
              disabled={!newBrand.trim()}
              onPress={submitBrand}
            />
          </View>
        ) : null}
      </View>

      {brand ? (
        <View>
          <Text variant="label" style={styles.fieldLabel}>
            Where it goes
          </Text>
          <Segmented
            options={CATEGORY_OPTIONS}
            value={category}
            onChange={onCategory}
            accessibilityLabel="Interior or exterior"
          />
        </View>
      ) : null}

      {brand ? (
        <View>
          <Text variant="label" style={styles.fieldLabel}>
            Line
          </Text>
          {lines.isLoading ? (
            <Text variant="caption">Loading lines…</Text>
          ) : (
            <View style={styles.chips}>
              {(lines.data ?? []).map((l) => (
                <PressableScale
                  key={l.id}
                  onPress={() => onLine(l)}
                  haptic="tap"
                  activeScale={0.96}
                  accessibilityRole="button"
                  accessibilityState={{ selected: line?.id === l.id }}
                  style={StyleSheet.flatten([styles.chip, line?.id === l.id && styles.chipOn])}
                >
                  <Text variant="caption" color={line?.id === l.id ? colors.fg : colors.fgSoft}>
                    {l.name}
                  </Text>
                </PressableScale>
              ))}
              <PressableScale
                onPress={() => setAdding(adding === 'line' ? null : 'line')}
                haptic="tap"
                activeScale={0.96}
                accessibilityRole="button"
                style={StyleSheet.flatten([styles.chip, styles.chipAdd])}
              >
                <Text variant="caption" color={colors.accentSoft}>
                  + Add
                </Text>
              </PressableScale>
            </View>
          )}
          {(lines.data ?? []).length === 0 && !lines.isLoading && adding !== 'line' ? (
            <Text variant="caption" style={styles.hint}>
              No {category.toLowerCase()} lines entered for {brand.name} yet — add the one you
              stock.
            </Text>
          ) : null}
          {adding === 'line' ? (
            <View style={styles.inline}>
              <Input
                placeholder="Line name"
                value={newLine}
                onChangeText={setNewLine}
                autoCapitalize="words"
                containerStyle={styles.inlineInput}
              />
              <Button
                label="Add"
                loading={addLine.isPending}
                disabled={!newLine.trim()}
                onPress={submitLine}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {error ? (
        <Text variant="body" color={colors.danger}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  filter: { marginBottom: spacing.sm },
  emptyCta: { marginTop: spacing.md },
  emptyNote: { marginTop: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md, padding: spacing.sm, alignItems: 'center' },
  thumb: { width: 64, height: 64, borderRadius: radius.cardTight },
  thumbEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassEdgeSoft,
  },
  rowMeta: { flex: 1, gap: 2 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowTitle: { flex: 1 },
  sheetScroll: { maxHeight: 520 },
  sheet: { gap: spacing.md, paddingBottom: spacing.lg },
  picker: { gap: spacing.md },
  fieldLabel: { marginBottom: spacing.xs },
  hint: { marginTop: spacing.xs },
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
  chipAdd: { borderStyle: 'dashed', borderColor: colors.accentSoft },
  inline: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
  inlineInput: { flex: 1 },
  pair: { flexDirection: 'row', gap: spacing.md },
  pairItem: { flex: 1 },
});
