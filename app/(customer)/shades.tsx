import { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView, FlatList, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Input, Chip, StatusPill } from '../../src/components';
import { colors, spacing, radius } from '../../src/theme';
import { useShadeBrands, useShadesInfinite, useShadeFamilies } from '../../src/shades/queries';
import { ShadeSummary } from '../../src/api';
import { ShadeDetailSheet } from '../../src/shades/ShadeDetailSheet';

/** Debounce a rapidly-changing value (search box) to avoid a request per keystroke. */
function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/**
 * Live shade library backed by `GET /api/shades` (PLAN.md §5): brand + family
 * filters and search run server-side; results page in on scroll; the whole thing
 * is cached offline via React Query persistence. Tapping a shade opens its detail
 * and hands it to the visualizer.
 */
export default function Shades() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [brandSlug, setBrandSlug] = useState<string | undefined>(undefined);
  const [family, setFamily] = useState<string | undefined>(undefined);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim());
  const [selected, setSelected] = useState<ShadeSummary | null>(null);

  const brandsQuery = useShadeBrands();
  const familiesQuery = useShadeFamilies(brandSlug);
  const shadesQuery = useShadesInfinite({ brand: brandSlug, family, search: search || undefined });

  // Only shades with a hex render as swatches.
  const shades = useMemo(
    () => (shadesQuery.data?.pages ?? []).flatMap((p) => p.content).filter((s) => !!s.hexCode),
    [shadesQuery.data],
  );
  const total = shadesQuery.data?.pages?.[0]?.totalElements;

  function pickBrand(slug: string | undefined) {
    setBrandSlug(slug);
    setFamily(undefined); // families are brand-specific
  }

  const Header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text variant="title">Shades</Text>
        {total != null ? <StatusPill label={`${total.toLocaleString()} shades`} tone="neutral" /> : null}
      </View>

      <Input placeholder="Search name or code" value={searchInput} onChangeText={setSearchInput} autoCapitalize="none" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="All brands" selected={!brandSlug} onPress={() => pickBrand(undefined)} />
        {brandsQuery.data?.map((b) => (
          <Chip key={b.slug} label={b.name} selected={brandSlug === b.slug} onPress={() => pickBrand(b.slug)} />
        ))}
      </ScrollView>

      {brandSlug && (familiesQuery.data?.length ?? 0) > 0 ? (
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
      <FlatList
        data={shades}
        keyExtractor={(item) => `${item.brandSlug ?? 'x'}-${item.shadeCode}`}
        numColumns={2}
        columnWrapperStyle={styles.column}
        ListHeaderComponent={Header}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing.xxl,
          paddingHorizontal: spacing.lg,
          gap: spacing.md,
        }}
        keyboardShouldPersistTaps="handled"
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          if (shadesQuery.hasNextPage && !shadesQuery.isFetchingNextPage) shadesQuery.fetchNextPage();
        }}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => setSelected(item)}>
            <View style={[styles.swatch, { backgroundColor: item.hexCode ?? colors.surface2 }]} />
            <Text variant="heading" numberOfLines={1}>
              {item.name ?? item.shadeCode}
            </Text>
            <Text variant="mono" color={colors.fgSoft} numberOfLines={1}>
              {item.brandName ? `${item.brandName} · ` : ''}
              {item.shadeCode}
            </Text>
          </Pressable>
        )}
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
                Couldn&apos;t load shades. Pull to retry once you&apos;re back online.
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
        onClose={() => setSelected(null)}
        onTryOnWall={(s) => {
          setSelected(null);
          router.push({
            pathname: '/visualize',
            params: {
              code: s.shadeCode,
              name: s.name ?? s.shadeCode,
              hex: s.hexCode ?? '',
              brand: s.brandName ?? '',
              brandSlug: s.brandSlug ?? '',
              family: s.shadeFamily ?? '',
            },
          });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { gap: spacing.md, marginBottom: spacing.md },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chips: { gap: spacing.sm, paddingVertical: spacing.xs },
  column: { gap: spacing.md },
  card: { flex: 1, gap: 2 },
  swatch: { width: '100%', height: 104, borderRadius: radius.card, borderWidth: 1, borderColor: colors.rule, marginBottom: spacing.xs },
  footer: { paddingVertical: spacing.lg, alignItems: 'center' },
  empty: { paddingVertical: spacing.xxxl, alignItems: 'center' },
});
