import { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView, FlatList, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Input, Chip, StatusPill } from '../components';
import { colors, spacing, radius } from '../theme';
import { useShadeBrands, useShadesInfinite, useShadeFamilies } from './queries';
import { ShadeSummary } from '../api';
import { ShadeDetailSheet } from './ShadeDetailSheet';

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

  const [brandSlug, setBrandSlug] = useState<string | undefined>(undefined);
  const [family, setFamily] = useState<string | undefined>(undefined);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim());
  const [selected, setSelected] = useState<ShadeSummary | null>(null);

  const brandsQuery = useShadeBrands();
  const familiesQuery = useShadeFamilies(brandSlug);
  const shadesQuery = useShadesInfinite({ brand: brandSlug, family, search: search || undefined });

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
        <Text variant="title">{headerTitle}</Text>
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
  header: { gap: spacing.md, marginBottom: spacing.md },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chips: { gap: spacing.sm, paddingVertical: spacing.xs },
  column: { gap: spacing.md },
  card: { flex: 1, gap: 2 },
  swatch: { width: '100%', height: 104, borderRadius: radius.card, borderWidth: 1, borderColor: colors.rule, marginBottom: spacing.xs },
  footer: { paddingVertical: spacing.lg, alignItems: 'center' },
  empty: { paddingVertical: spacing.xxxl, alignItems: 'center' },
});
