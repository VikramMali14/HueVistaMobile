import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Chip, Input, PressableScale, Segmented, SheetModal, Text } from '../components';
import { colors, spacing, radius, alpha } from '../theme';
import { useShadeFamilies, useShadesInfinite } from '../shades/queries';
import { useAllowedBrands, useShadeCodeScheme } from '../account/queries';
import { searchTermFor, shadeDisplay } from '../shades/shadeCodes';
import { summaryToShade, type Shade } from '../shades/types';
import { useRecentShades } from '../shades/recentShades';
import { useDebouncedValue } from '../shades/useDebouncedValue';
import { DEPTH_LABEL, inkOn, type Depth } from '../shades/colorScience';
import type { BrandSummary } from '../api';

type DepthFilter = Depth | 'all';

const DEPTH_OPTIONS: readonly { value: DepthFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'light', label: DEPTH_LABEL.light },
  { value: 'medium', label: DEPTH_LABEL.medium },
  { value: 'dark', label: DEPTH_LABEL.dark },
];

/** Swatches per row, and how many more each scroll to the end reveals. */
const COLUMNS = 4;
const PAGE_STEP = COLUMNS * 3;

/**
 * How tall the swatch area is allowed to get before it scrolls on its own.
 *
 * The grid used to grow the page instead, which meant the wall being painted
 * slid off the top as soon as a few rows were revealed — the one thing the
 * catalogue is not allowed to do. Bounding it keeps the room and the colours on
 * screen together, and gives the list somewhere to scroll so more can arrive
 * without a button asking for permission.
 */
const GRID_MAX_HEIGHT = 300;

/** How close to the end of the list counts as "ready for more" (px). */
const LOAD_MORE_SLACK = 120;

export interface ColourPanelProps {
  /** Applies the shade to whatever is selected. */
  onPick: (shade: Shade) => void;
  /** Currently applied code, ringed in the grid. */
  selectedCode?: string | null;
  /** Off while the room is view-only — the colours still show, tapping does nothing. */
  disabled?: boolean;
}

/**
 * Choosing a colour, in place.
 *
 * This used to be a full-screen modal — the catalogue took over the phone, the
 * room disappeared, and picking a colour meant losing sight of the wall you were
 * picking it for. That is exactly backwards for a visualizer: the whole value of
 * the thing is watching the wall change.
 *
 * So the catalogue lives under the photo now. Company, search, depth and family
 * narrow it behind one button rather than stacking four controls above the
 * colours, and the grid scrolls inside a bounded box — see `GRID_MAX_HEIGHT`.
 *
 * That box is the reason the nesting is safe. Two vertical scrolls on a phone
 * are normally a fight the user loses, but the outer one belongs to a screen
 * whose photo is pinned above it and whose remaining content is a few rows
 * tall, so there is no long page for the grid to steal a flick from; the grid
 * is the only thing here with a real distance to travel.
 */
export function ColourPanel({ onPick, selectedCode, disabled }: ColourPanelProps) {
  const allowed = useAllowedBrands();
  const scheme = useShadeCodeScheme().data;
  const { recent } = useRecentShades();

  const [company, setCompany] = useState<BrandSummary | null>(null);
  const [family, setFamily] = useState<string | undefined>(undefined);
  const [depth, setDepth] = useState<DepthFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [visible, setVisible] = useState(PAGE_STEP);
  /** Company, search, depth and family all live behind this now. */
  const [filtersOpen, setFiltersOpen] = useState(false);
  const search = useDebouncedValue(searchInput.trim());

  // Tile width is measured rather than expressed as a percentage: four columns
  // plus three gaps cannot be written as one percentage, and guessing leaves
  // either a ragged last column or three per row on a narrow phone.
  const [gridWidth, setGridWidth] = useState(0);
  const tileWidth = gridWidth > 0 ? (gridWidth - spacing.sm * (COLUMNS - 1)) / COLUMNS : 0;

  // One company open to this shop needs no picker — it is already the answer.
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
    { enabled: !!activeCompany },
  );

  const shades = useMemo(
    () =>
      (shadesQuery.data?.pages ?? [])
        .flatMap((p) => p.content)
        .map(summaryToShade)
        .filter((s): s is Shade => s !== null),
    [shadesQuery.data],
  );

  const shown = shades.slice(0, visible);
  const moreLocally = shades.length > shown.length;
  const canShowMore = moreLocally || shadesQuery.hasNextPage;

  /** Any change of filter starts the grid over — otherwise "show more" would
   *  keep revealing rows of a list the user has just replaced. */
  function refilter(apply: () => void) {
    apply();
    setVisible(PAGE_STEP);
  }

  function showMore() {
    if (!canShowMore) return;
    setVisible((n) => n + PAGE_STEP);
    if (!moreLocally && shadesQuery.hasNextPage && !shadesQuery.isFetchingNextPage) {
      shadesQuery.fetchNextPage();
    }
  }

  /**
   * Reveal more as the list reaches its end, rather than asking for a tap.
   *
   * Scrolling already means "show me what's next"; a button under the grid made
   * the user say it twice. `onScroll` is throttled because this fires on every
   * frame of a flick and each call can start a page fetch.
   */
  function onGridScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const distanceToEnd = contentSize.height - contentOffset.y - layoutMeasurement.height;
    if (distanceToEnd < LOAD_MORE_SLACK) showMore();
  }

  /** How many filters are narrowing the list right now — shown on the button. */
  const activeFilters = (family ? 1 : 0) + (depth === 'all' ? 0 : 1) + (search ? 1 : 0);

  return (
    <View style={styles.root}>
      {/* Recently used first: comparing two candidates means going back and
          forth between them, and that should not cost a search each way. */}
      {recent.length > 0 ? (
        <View style={styles.group}>
          <Text variant="eyebrow">Recently used</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
            {recent.map((s) => (
              <SwatchTile
                key={`recent-${s.brandSlug ?? ''}-${s.code}`}
                shade={s}
                label={shadeDisplay(scheme, { code: s.code, name: s.name }).code}
                selected={s.code === selectedCode}
                disabled={disabled}
                onPress={() => onPick(s)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* One compact line where four stacked controls used to be: which company
          is being shown, and one way in to everything that narrows it. The
          company picker, the search box, the depth segments and the family chips
          took up more vertical space than the swatches did — on a small phone
          the colours themselves started below the fold. */}
      <View style={styles.bar}>
        <PressableScale
          onPress={() => setFiltersOpen(true)}
          haptic="tap"
          activeScale={0.97}
          accessibilityRole="button"
          accessibilityLabel="Choose a company, search, or filter the colours"
          style={styles.barMain}
        >
          <Text variant="label" numberOfLines={1} color={colors.fg} style={styles.barLabel}>
            {activeCompany?.name ?? (allowed.loading ? 'Loading companies…' : 'Choose a company')}
          </Text>
          <Ionicons name="chevron-down" size={14} color={colors.fgMute} />
        </PressableScale>

        <PressableScale
          onPress={() => setFiltersOpen(true)}
          haptic="tap"
          activeScale={0.92}
          accessibilityRole="button"
          accessibilityLabel={
            activeFilters > 0 ? `Filters, ${activeFilters} active` : 'Search and filter the colours'
          }
          style={StyleSheet.flatten([styles.barIcon, activeFilters > 0 && styles.barIconActive])}
        >
          <Ionicons
            name={activeFilters > 0 ? 'funnel' : 'search'}
            size={16}
            color={activeFilters > 0 ? colors.accentSoft : colors.fgSoft}
          />
          {activeFilters > 0 ? (
            <View style={styles.badge}>
              <Text variant="caption" color={colors.bg}>
                {activeFilters}
              </Text>
            </View>
          ) : null}
        </PressableScale>
      </View>

      {!activeCompany ? (
        <Text variant="bodySoft" style={styles.empty}>
          {allowed.loading
            ? 'Loading the companies open to you…'
            : allowed.brands.length === 0
              ? 'No paint companies are open to you yet. Ask your shop at the counter.'
              : 'Choose a company to see its colours.'}
        </Text>
      ) : (
        <ScrollView
          style={styles.gridScroll}
          contentContainerStyle={styles.gridContent}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          onScroll={onGridScroll}
          scrollEventThrottle={80}
        >
          <View style={styles.grid} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
            {shadesQuery.isLoading ? (
              <View style={styles.centre}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : shown.length === 0 ? (
              <Text variant="bodySoft" style={styles.empty}>
                Nothing matches that. Try a shorter search, or clear the filters.
              </Text>
            ) : tileWidth > 0 ? (
              shown.map((s) => (
                <SwatchTile
                  key={`${s.brandSlug ?? ''}-${s.code}`}
                  shade={s}
                  label={shadeDisplay(scheme, { code: s.code, name: s.name }).code}
                  selected={s.code === selectedCode}
                  disabled={disabled}
                  width={tileWidth}
                  onPress={() => onPick(s)}
                />
              ))
            ) : null}
          </View>

          {/* A spinner at the tail, where the next rows will appear — not a
              control, just a sign that more is on the way. */}
          {shadesQuery.isFetchingNextPage ? (
            <View style={styles.tail}>
              <ActivityIndicator color={colors.accentSoft} />
            </View>
          ) : null}
        </ScrollView>
      )}

      {/* Everything that narrows the list, in one sheet over the room rather
          than pushing it down the page. */}
      <SheetModal visible={filtersOpen} onClose={() => setFiltersOpen(false)} title="Find a colour">
        <View style={styles.filterSheet}>
          {allowed.brands.length > 1 ? (
            <View style={styles.group}>
              <Text variant="eyebrow">Company</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
                {allowed.brands.map((b) => (
                  <Chip
                    key={b.slug}
                    label={b.name}
                    selected={activeCompany?.slug === b.slug}
                    onPress={() => refilter(() => setCompany(b))}
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}

          <Input
            placeholder="Search name or code"
            value={searchInput}
            onChangeText={(t) => refilter(() => setSearchInput(t))}
            autoCapitalize="none"
          />

          <Segmented
            options={DEPTH_OPTIONS}
            value={depth}
            onChange={(d) => refilter(() => setDepth(d))}
            accessibilityLabel="Filter by how light or dark the shade is"
          />

          {(familiesQuery.data?.length ?? 0) > 0 ? (
            <View style={styles.group}>
              <Text variant="eyebrow">Family</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
                <Chip label="All families" selected={!family} onPress={() => refilter(() => setFamily(undefined))} />
                {familiesQuery.data?.map((f) => (
                  <Chip key={f} label={f} selected={family === f} onPress={() => refilter(() => setFamily(f))} />
                ))}
              </ScrollView>
            </View>
          ) : null}

          <Button label="Show colours" fullWidth onPress={() => setFiltersOpen(false)} />
        </View>
      </SheetModal>
    </View>
  );
}

function SwatchTile({
  shade,
  label,
  selected,
  disabled,
  width = 64,
  onPress,
}: {
  shade: Shade;
  label: string;
  selected?: boolean;
  disabled?: boolean;
  /** Measured column width in the grid; the default is the horizontal strip's. */
  width?: number;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic="none"
      activeScale={0.9}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      accessibilityLabel={`${shade.name}, ${label}`}
      style={StyleSheet.flatten([styles.tile, { width }, disabled && styles.tileDisabled])}
    >
      <View
        style={[
          styles.swatch,
          {
            backgroundColor: shade.hex,
            // Lit by its own colour rather than ringed in accent purple, which
            // fought every warm shade on the screen.
            borderColor: selected ? colors.fg : alpha(shade.hex, 0.45),
            borderWidth: selected ? 2 : 1,
            shadowColor: shade.hex,
            shadowOpacity: selected ? 0.8 : 0.3,
          },
        ]}
      >
        {selected ? <Ionicons name="checkmark" size={16} color={inkOn(shade.hex).strong} /> : null}
      </View>
      <Text variant="caption" numberOfLines={1} style={styles.tileLabel}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  group: { gap: spacing.sm },
  strip: { gap: spacing.sm, paddingVertical: 2 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  barMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  barLabel: { flexShrink: 1 },
  barIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  barIconActive: { backgroundColor: colors.accentGhost, borderColor: alpha(colors.accentSoft, 0.4) },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridScroll: { maxHeight: GRID_MAX_HEIGHT },
  gridContent: { gap: spacing.sm, paddingBottom: spacing.xs },
  tail: { paddingVertical: spacing.md, alignItems: 'center' },
  filterSheet: { gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, minHeight: 40 },
  tile: { alignItems: 'center', gap: spacing.xs },
  tileDisabled: { opacity: 0.45 },
  swatch: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.cardTight,
    alignItems: 'center',
    justifyContent: 'center',
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  tileLabel: { textAlign: 'center' },
  centre: { paddingVertical: spacing.xl, alignItems: 'center' },
  empty: { paddingVertical: spacing.sm },
});
