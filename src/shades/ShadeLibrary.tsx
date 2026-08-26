import { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, FlatList, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Text,
  Input,
  Chip,
  StatusPill,
  Aurora,
  Segmented,
  BackLink,
  Disclosure,
  useTabBarInset,
} from '../components';
import { colors, spacing } from '../theme';
import { useShadesInfinite, useShadeFamilies } from './queries';
import { ShadeSummary, BrandSummary } from '../api';
import { ShadeDetailSheet } from './ShadeDetailSheet';
import { ShadeSwatchCard } from './ShadeSwatchCard';
import { CompanyPicker } from './CompanyPicker';
import { searchTermFor } from './shadeCodes';
import { useAllowedBrands, useShadeCodeScheme } from '../account/queries';
import { DEPTH_LABEL, type Depth } from './colorScience';

/** Debounce a rapidly-changing value (search box) to avoid a request per keystroke. */
function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

type DepthFilter = Depth | 'all';

/**
 * Depth is the filter customers actually reach for — "something lighter" is the
 * most common request at a counter. `all` is first so the row reads as a scale
 * with an escape hatch, not four equal options.
 */
const DEPTH_OPTIONS: readonly { value: DepthFilter; label: string; dot?: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'light', label: DEPTH_LABEL.light, dot: '#e8e2d6' },
  { value: 'medium', label: DEPTH_LABEL.medium, dot: '#a08d74' },
  { value: 'dark', label: DEPTH_LABEL.dark, dot: '#4a3f35' },
];

export interface ShadeLibraryProps {
  headerTitle?: string;
  /** Optional banner rendered above the search box (e.g. a guest sign-in prompt). */
  extraHeader?: React.ReactNode;
  /** Label for the detail sheet's primary action. */
  tryLabel?: string;
  /** Called when the user taps the detail sheet's primary action. */
  onTryOnWall: (shade: ShadeSummary) => void;
}

/**
 * The live shade catalogue, in the order paint is actually bought: company
 * first, then colour.
 *
 * It used to open as one flat grid of every shade from every company, with the
 * companies reduced to a chip row above it — so the first thing on screen was
 * thousands of colours, most of them from brands the customer's shop does not
 * stock, and narrowing to a company was optional. Now picking the company is
 * step one, and the grid that follows belongs to exactly one catalogue.
 *
 * A shop restricted to a single company skips the picker entirely: a choice
 * with one option is a screen no-one should have to tap through.
 *
 * Backed by the public `/api/shades` endpoints and the offline cache. Reused by
 * the customer, painter and admin Shades tabs and the guest browse screen —
 * only the detail sheet's primary action differs.
 */
export function ShadeLibrary({ headerTitle = 'Shades', extraHeader, tryLabel, onTryOnWall }: ShadeLibraryProps) {
  const insets = useSafeAreaInsets();
  const tabBarInset = useTabBarInset();

  const [company, setCompany] = useState<BrandSummary | null>(null);
  const [family, setFamily] = useState<string | undefined>(undefined);
  const [depth, setDepth] = useState<DepthFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim());
  const [selected, setSelected] = useState<ShadeSummary | null>(null);

  /**
   * The companies this account may actually work with — a customer's from the
   * code their shop issued, a shop's from its distributor's grant. Signed-out
   * browsing is unrestricted, so the guest library sees the whole catalogue.
   */
  const allowed = useAllowedBrands();
  const scheme = useShadeCodeScheme().data;

  /**
   * With exactly one company available there is nothing to choose, so the
   * picker is skipped and its back link hidden. Derived from the same value
   * that opens it, so the two can never disagree.
   */
  const onlyCompany = allowed.brands.length === 1 ? allowed.brands[0] : null;
  const activeCompany = company ?? onlyCompany;

  const familiesQuery = useShadeFamilies(activeCompany?.slug);
  /**
   * Under a shop's pattern the encoded code is the only one on screen, so it is
   * the only one the customer can type — but the catalogue indexes the real
   * code. Decode first, and a search for what they can see actually finds it.
   */
  const searchTerm = search ? searchTermFor(scheme, search) : undefined;
  const shadesQuery = useShadesInfinite(
    {
      brand: activeCompany?.slug,
      family,
      tonality: depth === 'all' ? undefined : depth,
      search: searchTerm,
    },
    { enabled: !!activeCompany },
  );

  const shades = useMemo(
    () => (shadesQuery.data?.pages ?? []).flatMap((p) => p.content).filter((s) => !!s.hexCode),
    [shadesQuery.data],
  );
  const total = shadesQuery.data?.pages?.[0]?.totalElements;

  /** Leaving a company drops its filters — they mean nothing in the next one. */
  function openCompany(next: BrandSummary) {
    setCompany(next);
    setFamily(undefined);
    setDepth('all');
    setSearchInput('');
  }

  function backToCompanies() {
    setCompany(null);
    setFamily(undefined);
    setDepth('all');
    setSearchInput('');
  }

  // ── Step one: which company ──────────────────────────────────────────────
  if (!activeCompany) {
    return (
      <View style={styles.root}>
        <Aurora intensity={0.7} />
        <ScrollView
          contentContainerStyle={{
            paddingTop: insets.top + spacing.md,
            paddingBottom: insets.bottom + spacing.xxl + tabBarInset,
            paddingHorizontal: spacing.lg,
            gap: spacing.lg,
          }}
          showsVerticalScrollIndicator={false}
        >
          {extraHeader}
          <View style={styles.companyHead}>
            <Text variant="display">{headerTitle}</Text>
            <Text variant="bodySoft">Start with the paint company, then find your colour.</Text>
          </View>
          <CompanyPicker
            companies={allowed.brands}
            onPick={openCompany}
            loading={allowed.loading}
            emptyNote={
              allowed.restricted
                ? "Your shop hasn't opened any paint companies for you yet. Ask them at the counter."
                : undefined
            }
          />
        </ScrollView>
      </View>
    );
  }

  // ── Step two: the colours in that company ────────────────────────────────
  const header = (
    <View style={styles.header}>
      {extraHeader}

      {onlyCompany ? null : <BackLink label="Companies" onPress={backToCompanies} />}

      <View style={styles.titleRow}>
        <Text variant="display" numberOfLines={2} style={styles.title}>
          {activeCompany.name}
        </Text>
        {total != null ? <StatusPill label={`${total.toLocaleString()} shades`} tone="neutral" /> : null}
      </View>

      <Input
        placeholder="Search name or code"
        value={searchInput}
        onChangeText={setSearchInput}
        autoCapitalize="none"
      />

      <Segmented
        options={DEPTH_OPTIONS}
        value={depth}
        onChange={setDepth}
        accessibilityLabel="Filter by how light or dark the shade is"
      />

      {/* Cached shades still on screen after a failed refresh. Saying so beats
          both a silent stale list and an error page over data that is right. */}
      {shadesQuery.isError && shades.length > 0 ? (
        <View style={styles.offline}>
          <Text variant="caption" color={colors.warning}>
            No connection — showing the shades saved on this phone.
          </Text>
        </View>
      ) : null}

      {(familiesQuery.data?.length ?? 0) > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="All families" selected={!family} onPress={() => setFamily(undefined)} />
          {familiesQuery.data?.map((f) => (
            <Chip key={f} label={f} selected={family === f} onPress={() => setFamily(f)} />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );

  return (
    <View style={styles.root}>
      <Aurora intensity={0.7} />
      <FlatList
        data={shades}
        keyExtractor={(item) => `${item.brandSlug ?? 'x'}-${item.shadeCode}`}
        numColumns={2}
        columnWrapperStyle={styles.column}
        ListHeaderComponent={header}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing.xxl + tabBarInset,
          paddingHorizontal: spacing.lg,
          gap: spacing.md,
        }}
        keyboardShouldPersistTaps="handled"
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          if (shadesQuery.hasNextPage && !shadesQuery.isFetchingNextPage) shadesQuery.fetchNextPage();
        }}
        renderItem={({ item }) => (
          <ShadeSwatchCard
            shade={item}
            scheme={scheme}
            onPress={() => setSelected(item)}
            style={styles.card}
          />
        )}
        ListFooterComponent={
          shadesQuery.isFetching ? (
            <View style={styles.footer}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : shades.length > 0 ? (
            /* Said once, at the end of the grid, rather than pasted above every
               section: paint on a screen is not paint on a wall, and the person
               who wants that spelled out is the one who has finished looking. */
            <View style={styles.footer}>
              <Disclosure kind="colour" />
            </View>
          ) : null
        }
        ListEmptyComponent={
          shadesQuery.isLoading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={colors.accent} />
              <Text variant="caption" style={{ marginTop: spacing.sm }}>
                Loading catalogue…
              </Text>
            </View>
          ) : shadesQuery.isError ? (
            <View style={styles.empty}>
              <Text variant="bodySoft" center>
                Couldn&apos;t load shades. Try again once you&apos;re back online.
              </Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <Text variant="bodySoft" center>
                {depth === 'all'
                  ? 'No shades match your filters.'
                  : `No ${DEPTH_LABEL[depth].toLowerCase()} shades match your filters.`}
              </Text>
            </View>
          )
        }
      />

      <ShadeDetailSheet
        shade={selected}
        tryLabel={tryLabel}
        onClose={() => setSelected(null)}
        onTryOnWall={(s) => {
          setSelected(null);
          onTryOnWall(s);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { gap: spacing.md, marginBottom: spacing.lg },
  companyHead: { gap: spacing.xs, marginBottom: spacing.sm },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  title: { flexShrink: 1 },
  chips: { gap: spacing.sm, paddingVertical: spacing.xs },
  offline: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.md,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassEdgeSoft,
  },
  column: { gap: spacing.md },
  card: { flex: 1 },
  footer: { paddingVertical: spacing.lg, alignItems: 'center' },
  empty: { paddingVertical: spacing.xxxl, alignItems: 'center' },
});
