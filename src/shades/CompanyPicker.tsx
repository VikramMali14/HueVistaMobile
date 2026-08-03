import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, Card, PressableScale, Reveal } from '../components';
import { colors, spacing, alpha } from '../theme';
import { useBrandPreview } from './queries';
import type { BrandSummary } from '../api';

export interface CompanyPickerProps {
  companies: readonly BrandSummary[];
  onPick: (company: BrandSummary) => void;
  loading?: boolean;
  /** Shown when the account has no companies open to it. */
  emptyNote?: string;
}

/**
 * Step one of the catalogue: which paint company.
 *
 * The catalogue is ~9.5k shades across several companies, and it used to open
 * as one flat grid with the companies as chips above it — so the first thing a
 * customer saw was thousands of colours from brands their shop may not even
 * stock, and picking a company was an optional afterthought rather than the
 * first decision.
 *
 * That is backwards from how paint is actually bought. A shop carries certain
 * companies; a customer picks a company, then a colour within it. This makes
 * that the shape of the screen.
 */
export function CompanyPicker({ companies, onPick, loading, emptyNote }: CompanyPickerProps) {
  if (loading && companies.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
        <Text variant="caption" style={styles.centerNote}>
          Loading companies…
        </Text>
      </View>
    );
  }

  if (companies.length === 0) {
    return (
      <Card>
        <Text variant="bodySoft">
          {emptyNote ?? 'No paint companies are open to you yet. Ask your shop at the counter.'}
        </Text>
      </Card>
    );
  }

  return (
    <View style={styles.list}>
      {companies.map((company, i) => (
        <Reveal key={company.slug} index={i}>
          <CompanyCard company={company} onPress={() => onPick(company)} />
        </Reveal>
      ))}
    </View>
  );
}

function CompanyCard({ company, onPress }: { company: BrandSummary; onPress: () => void }) {
  const preview = useBrandPreview(company.slug).data ?? [];

  return (
    <PressableScale onPress={onPress} haptic="tap" activeScale={0.98}>
      <Card padded={false} style={styles.card}>
        {/* Six of the company's own colours, edge to edge — the card's whole
            job is to show what this catalogue looks like. */}
        <View style={styles.strip}>
          {preview.length > 0 ? (
            preview.map((s) => (
              <View
                key={`${s.shadeCode}`}
                style={[styles.stripCell, { backgroundColor: s.hexCode ?? colors.surface2 }]}
              />
            ))
          ) : (
            <View style={[styles.stripCell, styles.stripEmpty]} />
          )}
        </View>

        <View style={styles.body}>
          <View style={styles.meta}>
            <Text variant="heading" numberOfLines={1}>
              {company.name}
            </Text>
            <Text variant="caption">
              {company.shadeCount.toLocaleString()} {company.shadeCount === 1 ? 'shade' : 'shades'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.fgMute} />
        </View>
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  card: { overflow: 'hidden' },
  strip: { flexDirection: 'row', height: 76 },
  stripCell: { flex: 1, height: '100%' },
  stripEmpty: { backgroundColor: alpha(colors.fg, 0.06) },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  meta: { flex: 1, gap: 2 },
  center: { paddingVertical: spacing.xxxl, alignItems: 'center' },
  centerNote: { marginTop: spacing.sm },
});
