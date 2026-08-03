import { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, FlatList, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Serif, Input, Chip, StatusPill, Aurora, PressableScale, useTabBarInset } from '../components';
import { colors, spacing, radius, alpha, fontSize } from '../theme';
import { useShadesInfinite, useShadeFamilies } from './queries';
import { ShadeSummary } from '../api';
import { ShadeDetailSheet } from './ShadeDetailSheet';
import { shadeDisplay, searchTermFor } from './shadeCodes';
import { useAllowedBrands, useShadeCodeScheme } from '../account/queries';

/** Debounce a rapidly-changing value (search box) to avoid a request per keystroke. */
function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

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
 * The live shade catalogue (search + brand/family filters + infinite scroll +
 * detail sheet), backed by the public `/api/shades` endpoints and the offline
 * cache. Reused by the customer Shades tab and the guest browse screen — only
 * the detail sheet's primary action differs.
 */
export function ShadeLibrary({ headerTitle = 'Shades', extraHeader, tryLabel, onTryOnWall }: ShadeLibraryProps) {
  const insets = useSafeAreaInsets();
  const tabBarInset = useTabBarInset();

  const [brandSlug, setBrandSlug] = useState<string | undefined>(undefined);
  const [family, setFamily] = useState<string | undefined>(undefined);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim());
  const [selected, setSelected] = useState<ShadeSummary | null>(null);

  /**
   * The companies this account may actually work with — a customer's from the
   * code their shop issued, a shop's from its distributor's grant. Signed-out
   * browsing is unrestricted, so the guest library is unchanged.
   */
  const allowed = useAllowedBrands();
  const scheme = useShadeCodeScheme().data;

  /**
   * A restricted account has no "all brands" view to fall back to: the catalogue
   * endpoint is public and unfiltered, so leaving the brand unset would show
   * companies this shop was explicitly not given. Defaulting to the first allowed
   * company keeps every shade on screen one they can actually buy.
   *
   * Derived rather than written into state, so it settles the moment the
   * restriction loads instead of a render later.
   */
  const effectiveBrand =
    brandSlug ?? (allowed.restricted ? allowed.brands[0]?.slug : undefined);

  const familiesQuery = useShadeFamilies(effectiveBrand);
  /**
   * Under a shop's pattern the encoded code is the only one on screen, so it is
   * the only one the customer can type — but the catalogue indexes the real
   * code. Decode first, and a search for what they can see actually finds it.
   */
  const searchTerm = search ? searchTermFor(scheme, search) : undefined;
  const shadesQuery = useShadesInfinite({
    brand: effectiveBrand,
    family,
    search: searchTerm,
  });

  const shades = useMemo(
    () => (shadesQuery.data?.pages ?? []).flatMap((p) => p.content).filter((s) => !!s.hexCode),
    [shadesQuery.data],
  );
  const total = shadesQuery.data?.pages?.[0]?.totalElements;

  function pickBrand(slug: string | undefined) {
    setBrandSlug(slug);
    setFamily(undefined);
  }

  const Header = (
    <View style={styles.header}>
      {extraHeader}
      <View style={styles.titleRow}>
        <Text variant="display">
          <Serif size={fontSize.display}>{headerTitle}</Serif>
        </Text>
        {total != null ? <StatusPill label={`${total.toLocaleString()} shades`} tone="neutral" /> : null}
      </View>

      <Input placeholder="Search name or code" value={searchInput} onChangeText={setSearchInput} autoCapitalize="none" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {!allowed.restricted ? (
          <Chip label="All brands" selected={!brandSlug} onPress={() => pickBrand(undefined)} />
        ) : null}
        {allowed.brands.map((b) => (
          <Chip key={b.slug} label={b.name} selected={effectiveBrand === b.slug} onPress={() => pickBrand(b.slug)} />
        ))}
      </ScrollView>

      {allowed.restricted && allowed.brands.length === 0 ? (
        <Text variant="bodySoft">
          Your shop hasn&apos;t opened any paint companies for you yet. Ask them at the counter.
        </Text>
      ) : null}

      {effectiveBrand && (familiesQuery.data?.length ?? 0) > 0 ? (
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
        ListHeaderComponent={Header}
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
        renderItem={({ item }) => {
          // The shop's own code, and the paint name only if the shop shows names.
          const display = shadeDisplay(scheme, { code: item.shadeCode, name: item.name });
          return (
            <PressableScale style={styles.card} onPress={() => setSelected(item)} haptic="tap" activeScale={0.95}>
              {/* The swatch carries a glow of its own colour, so a wall of
                  them reads as paint under light rather than as a table. */}
              <View
                style={[
                  styles.swatch,
                  {
                    backgroundColor: item.hexCode ?? colors.surface2,
                    shadowColor: item.hexCode ?? colors.bgDeep,
                    borderColor: item.hexCode ? alpha(item.hexCode, 0.5) : colors.rule,
                  },
                ]}
              />
              <Text variant="heading" numberOfLines={1}>
                {display.label}
              </Text>
              <Text variant="mono" color={colors.fgSoft} numberOfLines={1}>
                {display.name && item.brandName ? `${item.brandName} · ` : ''}
                {display.code}
              </Text>
            </PressableScale>
          );
        }}
        ListFooterComponent={
          shadesQuery.isFetching ? (
            <View style={styles.footer}>
              <ActivityIndicator color={colors.accent} />
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
                No shades match your filters.
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
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chips: { gap: spacing.sm, paddingVertical: spacing.xs },
  column: { gap: spacing.md },
  card: { flex: 1, gap: 2 },
  swatch: {
    width: '100%',
    height: 118,
    borderRadius: radius.card,
    borderWidth: 1,
    marginBottom: spacing.sm,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  footer: { paddingVertical: spacing.lg, alignItems: 'center' },
  empty: { paddingVertical: spacing.xxxl, alignItems: 'center' },
});
