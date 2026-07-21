import { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Text, Input, Chip, StatusPill } from '../../src/components';
import { colors, spacing, radius } from '../../src/theme';
import { SAMPLE_SHADES } from '../../src/shades/sampleShades';

const BRANDS = ['All', ...Array.from(new Set(SAMPLE_SHADES.map((s) => s.brand)))];

/**
 * Shade library (Phase 1 preview). Search + brand filter run over the local
 * sample set; the full catalogue (`GET /api/shades`, ~8,000 shades) with family
 * filters and offline cache replaces this data source next. "Try on wall" hands
 * the shade to the visualizer via a route param.
 */
export default function Shades() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [brand, setBrand] = useState('All');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SAMPLE_SHADES.filter((s) => {
      const matchesBrand = brand === 'All' || s.brand === brand;
      const matchesQuery = !q || s.name.toLowerCase().includes(q) || s.code.includes(q) || s.family.toLowerCase().includes(q);
      return matchesBrand && matchesQuery;
    });
  }, [query, brand]);

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.head}>
        <Text variant="title">Shades</Text>
        <StatusPill label="Sample catalogue" tone="neutral" />
      </View>

      <Input placeholder="Search name, code or family" value={query} onChangeText={setQuery} autoCapitalize="none" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {BRANDS.map((b) => (
          <Chip key={b} label={b} selected={brand === b} onPress={() => setBrand(b)} />
        ))}
      </ScrollView>

      <View style={styles.grid}>
        {results.map((s) => (
          <Pressable
            key={s.code}
            onPress={() => router.push({ pathname: '/visualize', params: { code: s.code } })}
            style={styles.cardWrap}
          >
            <View style={[styles.swatch, { backgroundColor: s.hex }]} />
            <Text variant="heading" numberOfLines={1}>
              {s.name}
            </Text>
            <Text variant="mono" color={colors.fgSoft}>
              {s.brand} · {s.code}
            </Text>
          </Pressable>
        ))}
        {results.length === 0 ? <Text variant="bodySoft">No shades match “{query}”.</Text> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingTop: spacing.xl },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chips: { gap: spacing.sm, paddingVertical: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  cardWrap: { width: '47%', gap: 2 },
  swatch: { width: '100%', height: 96, borderRadius: radius.card, borderWidth: 1, borderColor: colors.rule, marginBottom: spacing.xs },
});
