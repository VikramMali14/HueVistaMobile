import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Chip, Input, PressableScale, Segmented, Text } from '../components';
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

/** Swatches per row, and how many more "Show more" reveals each time. */
const COLUMNS = 4;
const PAGE_STEP = COLUMNS * 3;

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
 * narrow it in place; the grid grows on demand rather than scrolling inside a
 * scroll (nested vertical scrolling on a phone is a fight between two lists,
 * and the user loses it).
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
    setVisible((n) => n + PAGE_STEP);
    if (!moreLocally && shadesQuery.hasNextPage && !shadesQuery.isFetchingNextPage) {
      shadesQuery.fetchNextPage();
    }
  }

  return (
    <View style={styles.root}>
      {/* Recently used first: comparing two candidates means going back and
          forth between them, and that should not cost a search each way. */}
      {recent.length > 0 ? (
        <View style={styles.group}>
          <Text variant="overline">Recently used</Text>
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

      {allowed.brands.length > 1 ? (
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
      ) : null}

      {!activeCompany ? (
        <Text variant="bodySoft" style={styles.empty}>
          {allowed.loading
            ? 'Loading the companies open to you…'
            : allowed.brands.length === 0
              ? 'No paint companies are open to you yet. Ask your shop at the counter.'
              : 'Choose a company to see its colours.'}
        </Text>
      ) : (
        <>
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
              <Chip label="All families" selected={!family} onPress={() => refilter(() => setFamily(undefined))} />
              {familiesQuery.data?.map((f) => (
                <Chip
                  key={f}
                  label={f}
                  selected={family === f}
                  onPress={() => refilter(() => setFamily(f))}
                />
              ))}
            </ScrollView>
          ) : null}

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

          {canShowMore && shown.length > 0 ? (
            <PressableScale onPress={showMore} haptic="tap" activeScale={0.97} style={styles.more}>
              {shadesQuery.isFetchingNextPage ? (
                <ActivityIndicator color={colors.accentSoft} />
              ) : (
                <>
                  <Text variant="label" color={colors.accentSoft}>
                    Show more colours
                  </Text>
                  <Ionicons name="chevron-down" size={15} color={colors.accentSoft} />
                </>
              )}
            </PressableScale>
          ) : null}
        </>
      )}
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
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 44,
    borderRadius: radius.button,
    backgroundColor: colors.accentGhost,
    borderWidth: 1,
    borderColor: alpha(colors.accentSoft, 0.28),
  },
});
