import { View, StyleSheet, ScrollView } from 'react-native';
import { SheetModal, Text, Button, StatusPill } from '../components';
import { colors, spacing, radius } from '../theme';
import { useShadeDetail } from './queries';
import { ShadeSummary } from '../api';
import { shadeDisplay } from './shadeCodes';
import { useShadeCodeScheme } from '../account/queries';

interface Props {
  /** The tapped summary, or null when the sheet is closed. */
  shade: ShadeSummary | null;
  onClose: () => void;
  onTryOnWall: (shade: ShadeSummary) => void;
  /** Primary action label (default "Try on wall"; guests get a sign-in CTA). */
  tryLabel?: string;
}

/** Bottom-sheet detail for one shade, fetching AI-enriched fields on open. */
export function ShadeDetailSheet({ shade, onClose, onTryOnWall, tryLabel = 'Try on wall' }: Props) {
  // Enabled only when we have a brand slug + code; disabled (and null) when closed.
  const { data: detail, isLoading } = useShadeDetail(shade?.brandSlug ?? undefined, shade?.shadeCode);
  const scheme = useShadeCodeScheme().data;

  const hex = detail?.hexCode ?? shade?.hexCode ?? undefined;
  // Presented the way the shop presents colours: its code pattern, and the paint
  // name only when the shop shows names.
  const display = shadeDisplay(scheme, {
    code: shade?.shadeCode ?? '',
    name: detail?.name ?? shade?.name,
  });
  const brandName = display.name ? (detail?.brandName ?? shade?.brandName) : null;
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
                {display.label}
              </Text>
              <Text variant="mono" color={colors.fgSoft}>
                {brandName ? `${brandName} · ` : ''}
                {display.code}
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
            label={tryLabel}
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
