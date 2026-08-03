import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  Aurora,
  Chip,
  Input,
  PressableScale,
  Segmented,
  SectionHeader,
  Text,
  Serif,
} from '../components';
import { colors, spacing, radius, alpha, fontSize } from '../theme';
import { haptics } from '../haptics';
import { useShadeFamilies, useShadesInfinite } from './queries';
import { useAllowedBrands, useShadeCodeScheme } from '../account/queries';
import { searchTermFor, shadeDisplay } from './shadeCodes';
import { summaryToShade, type Shade } from './types';
import { DEPTH_LABEL, inkOn, type Depth } from './colorScience';
import { useRecentShades } from './recentShades';
import type { BrandSummary } from '../api';

type DepthFilter = Depth | 'all';

const DEPTH_OPTIONS: readonly { value: DepthFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'light', label: DEPTH_LABEL.light },
  { value: 'medium', label: DEPTH_LABEL.medium },
  { value: 'dark', label: DEPTH_LABEL.dark },
];

function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export interface ShadePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called with the chosen shade. The sheet stays open — see `closeOnPick`. */
  onPick: (shade: Shade) => void;
  /** Currently applied shade, ringed in the grid. */
  selectedCode?: string | null;
  /**
   * Close as soon as something is picked. Off by default: in the Studio the
   * wall repaints live behind the sheet, so staying open lets you try five
   * colours in five taps instead of reopening the picker between each.
   */
  closeOnPick?: boolean;
  title?: string;
}

/**
 * The colour picker: the whole catalogue, reachable from wherever paint is
 * being chosen.
 *
 * The Studio and the room editor each had a horizontal strip of a dozen
 * hardcoded sample colours — a demo tray that shipped. Whatever the customer
 * was actually shown at the counter, the app could only paint walls in twelve
 * colours, and none of them were necessarily ones their shop sells.
 *
 * This is the real thing: company first, then search, depth and family within
 * it, over the same scoped catalogue the Shades tab uses. Recently used sits on
 * top, because comparing two colours means going back and forth between them.
 */
export function ShadePickerSheet({
  visible,
  onClose,
  onPick,
  selectedCode,
  closeOnPick = false,
  title = 'Choose a colour',
}: ShadePickerSheetProps) {
  const insets = useSafeAreaInsets();
  const allowed = useAllowedBrands();
  const scheme = useShadeCodeScheme().data;
  const { recent, remember } = useRecentShades();

  const [company, setCompany] = useState<BrandSummary | null>(null);
  const [family, setFamily] = useState<string | undefined>(undefined);
  const [depth, setDepth] = useState<DepthFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim());

  const onlyCompany = allowed.brands.length === 1 ? allowed.brands[0] : null;
  const activeCompany = company ?? onlyCompany;

  const familiesQuery = useShadeFamilies(activeCompany?.slug);
  const searchTerm = search ? searchTermFor(scheme, search) : undefined;
  const shadesQuery = useShadesInfinite(
    {
      brand: activeCompany?.slug,
      family,
      tonality: depth === 'all' ? undefined : depth,
      search: searchTerm,
    },
    { enabled: visible && !!activeCompany },
  );

  const shades = useMemo(
    () =>
      (shadesQuery.data?.pages ?? [])
        .flatMap((p) => p.content)
        .map(summaryToShade)
        .filter((s): s is Shade => s !== null),
    [shadesQuery.data],
  );

  function choose(shade: Shade) {
    remember(shade);
    onPick(shade);
    if (closeOnPick) onClose();
  }

  function openCompany(next: BrandSummary) {
    haptics.tap();
    setCompany(next);
    setFamily(undefined);
    setDepth('all');
    setSearchInput('');
  }

  function backToCompanies() {
    haptics.tap();
    setCompany(null);
    setFamily(undefined);
    setDepth('all');
    setSearchInput('');
  }

  const dismiss = () => {
    haptics.close();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={dismiss} transparent={false}>
      <View style={styles.root}>
        <Aurora intensity={0.8} />

        <View style={[styles.bar, { paddingTop: insets.top + spacing.sm }]}>
          {activeCompany && !onlyCompany ? (
            <PressableScale
              onPress={backToCompanies}
              haptic="none"
              activeScale={0.92}
              accessibilityRole="button"
              accessibilityLabel="Back to companies"
              style={styles.iconButton}
            >
              <Ionicons name="chevron-back" size={20} color={colors.fg} />
            </PressableScale>
          ) : (
            <View style={styles.iconButton} />
          )}

          <Text variant="heading" numberOfLines={1} style={styles.barTitle}>
            {activeCompany ? activeCompany.name : title}
          </Text>

          <PressableScale
            onPress={dismiss}
            haptic="none"
            activeScale={0.92}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={styles.iconButton}
          >
            <Ionicons name="close" size={20} color={colors.fg} />
          </PressableScale>
        </View>

        {!activeCompany ? (
          <ScrollView
            contentContainerStyle={[styles.companyList, { paddingBottom: insets.bottom + spacing.xxl }]}
            showsVerticalScrollIndicator={false}
          >
            <Text variant="display" style={styles.companyHead}>
              Which <Serif size={fontSize.display}>company</Serif>?
            </Text>
            {allowed.loading && allowed.brands.length === 0 ? (
              <ActivityIndicator color={colors.accent} style={styles.loading} />
            ) : allowed.brands.length === 0 ? (
              <Text variant="bodySoft">
                No paint companies are open to you yet. Ask your shop at the counter.
              </Text>
            ) : (
              allowed.brands.map((b) => (
                <PressableScale
                  key={b.slug}
                  onPress={() => openCompany(b)}
                  haptic="none"
                  activeScale={0.98}
                  style={styles.companyRow}
                >
                  <View style={styles.companyMeta}>
                    <Text variant="heading">{b.name}</Text>
                    <Text variant="caption">{b.shadeCount.toLocaleString()} shades</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.fgMute} />
                </PressableScale>
              ))
            )}
          </ScrollView>
        ) : (
          <FlatList
            data={shades}
            keyExtractor={(s) => `${s.brandSlug ?? ''}-${s.code}`}
            numColumns={3}
            columnWrapperStyle={styles.column}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + spacing.xxl }]}
            onEndReachedThreshold={0.6}
            onEndReached={() => {
              if (shadesQuery.hasNextPage && !shadesQuery.isFetchingNextPage) shadesQuery.fetchNextPage();
            }}
            ListHeaderComponent={
              <View style={styles.filters}>
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
                {(familiesQuery.data?.length ?? 0) > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                    <Chip label="All families" selected={!family} onPress={() => setFamily(undefined)} />
                    {familiesQuery.data?.map((f) => (
                      <Chip key={f} label={f} selected={family === f} onPress={() => setFamily(f)} />
                    ))}
                  </ScrollView>
                ) : null}

                {recent.length > 0 ? (
                  <View style={styles.recent}>
                    <SectionHeader title="Recently used" />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                      {recent.map((s) => (
                        <PressableScale
                          key={`recent-${s.brandSlug ?? ''}-${s.code}`}
                          onPress={() => choose(s)}
                          haptic="select"
                          activeScale={0.9}
                          accessibilityRole="button"
                          accessibilityLabel={shadeDisplay(scheme, { code: s.code, name: s.name }).label}
                          style={StyleSheet.flatten([
                            styles.recentSwatch,
                            {
                              backgroundColor: s.hex,
                              borderColor: s.code === selectedCode ? colors.fg : alpha(s.hex, 0.5),
                              borderWidth: s.code === selectedCode ? 2 : 1,
                              shadowColor: s.hex,
                            },
                          ])}
                        />
                      ))}
                    </ScrollView>
                  </View>
                ) : null}
              </View>
            }
            renderItem={({ item }) => {
              const display = shadeDisplay(scheme, { code: item.code, name: item.name });
              const active = item.code === selectedCode;
              const ink = inkOn(item.hex);
              return (
                <PressableScale
                  onPress={() => choose(item)}
                  haptic="select"
                  activeScale={0.92}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={display.label}
                  style={styles.cell}
                >
                  <View
                    style={[
                      styles.cellSwatch,
                      {
                        backgroundColor: item.hex,
                        borderColor: active ? colors.fg : alpha(item.hex, 0.5),
                        borderWidth: active ? 2 : 1,
                        shadowColor: item.hex,
                      },
                    ]}
                  >
                    {active ? <Ionicons name="checkmark" size={18} color={ink.strong} /> : null}
                  </View>
                  <Text variant="caption" numberOfLines={1} style={styles.cellLabel}>
                    {display.label}
                  </Text>
                </PressableScale>
              );
            }}
            ListFooterComponent={
              shadesQuery.isFetching ? (
                <View style={styles.loading}>
                  <ActivityIndicator color={colors.accent} />
                </View>
              ) : null
            }
            ListEmptyComponent={
              shadesQuery.isLoading ? (
                <View style={styles.loading}>
                  <ActivityIndicator color={colors.accent} />
                </View>
              ) : (
                <View style={styles.loading}>
                  <Text variant="bodySoft" center>
                    No shades match those filters.
                  </Text>
                </View>
              )
            }
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  barTitle: { flex: 1, textAlign: 'center' },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(colors.fg, 0.05),
    borderWidth: 1,
    borderColor: colors.glassEdge,
  },
  companyList: { paddingHorizontal: spacing.lg, gap: spacing.md },
  companyHead: { marginBottom: spacing.sm },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassEdge,
  },
  companyMeta: { flex: 1, gap: 2 },
  filters: { gap: spacing.md, marginBottom: spacing.lg },
  chips: { gap: spacing.sm, paddingVertical: spacing.xs },
  recent: { gap: spacing.sm, marginTop: spacing.xs },
  recentSwatch: {
    width: 54,
    height: 54,
    borderRadius: radius.cardTight,
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  grid: { paddingHorizontal: spacing.lg, gap: spacing.md },
  column: { gap: spacing.md },
  cell: { flex: 1, gap: spacing.xs, maxWidth: '31%' },
  cellSwatch: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.cardTight,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  cellLabel: { textAlign: 'center' },
  loading: { paddingVertical: spacing.xxl, alignItems: 'center' },
});
