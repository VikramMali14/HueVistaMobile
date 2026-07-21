import { View, StyleSheet, ScrollView } from 'react-native';
import { SheetModal, Text, Button, StatusPill } from '../components';
import { colors, spacing, radius } from '../theme';
import { useShadeDetail } from './queries';
import { ShadeSummary } from '../api';

interface Props {
  /** The tapped summary, or null when the sheet is closed. */
  shade: ShadeSummary | null;
  onClose: () => void;
  onTryOnWall: (shade: ShadeSummary) => void;
}

/** Bottom-sheet detail for one shade, fetching AI-enriched fields on open. */
export function ShadeDetailSheet({ shade, onClose, onTryOnWall }: Props) {
  // Enabled only when we have a brand slug + code; disabled (and null) when closed.
  const { data: detail, isLoading } = useShadeDetail(shade?.brandSlug ?? undefined, shade?.shadeCode);

  const hex = detail?.hexCode ?? shade?.hexCode ?? undefined;
  const tags = [detail?.shadeFamily, detail?.colorTemperature, detail?.tonality, detail?.featureTag].filter(
    Boolean,
  ) as string[];

  return (
    <SheetModal visible={!!shade} onClose={onClose}>
      {shade ? (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.head}>
            <View style={[styles.swatch, { backgroundColor: hex ?? colors.surface }]} />
            <View style={styles.headMeta}>
              <Text variant="title" numberOfLines={2}>
                {detail?.name ?? shade.name ?? shade.shadeCode}
              </Text>
              <Text variant="mono" color={colors.fgSoft}>
                {(detail?.brandName ?? shade.brandName) ? `${detail?.brandName ?? shade.brandName} · ` : ''}
                {shade.shadeCode}
                {hex ? ` · ${hex.toUpperCase()}` : ''}
              </Text>
            </View>
          </View>

          {tags.length > 0 ? (
            <View style={styles.tags}>
              {tags.map((t) => (
                <StatusPill key={t} label={t} tone="neutral" />
              ))}
            </View>
          ) : null}

          {detail?.aiDescription ? (
            <Text variant="bodySoft" style={styles.desc}>
              {detail.aiDescription}
            </Text>
          ) : isLoading ? (
            <Text variant="caption" style={styles.desc}>
              Loading details…
            </Text>
          ) : null}

          {detail?.suitableRooms?.length ? (
            <View style={styles.metaBlock}>
              <Text variant="label">Great for</Text>
              <Text variant="bodySoft">{detail.suitableRooms.join(' · ')}</Text>
            </View>
          ) : null}

          {detail?.lrv != null ? (
            <View style={styles.metaBlock}>
              <Text variant="label">Light reflectance (LRV)</Text>
              <Text variant="bodySoft">{String(detail.lrv)}</Text>
            </View>
          ) : null}

          <Button
            label="Try on wall"
            size="lg"
            fullWidth
            disabled={!hex}
            onPress={() => onTryOnWall(shade)}
            style={styles.cta}
          />
        </ScrollView>
      ) : null}
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 460 },
  head: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  swatch: { width: 72, height: 72, borderRadius: radius.card, borderWidth: 1, borderColor: colors.rule },
  headMeta: { flex: 1, gap: spacing.xs },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  desc: { marginTop: spacing.lg },
  metaBlock: { marginTop: spacing.lg, gap: spacing.xs },
  cta: { marginTop: spacing.xl },
});
