import { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SheetModal, Text, Button, PressableScale, Disclosure } from '../components';
import { colors, spacing, radius, alpha } from '../theme';
import { useShadeDetail } from './queries';
import { ShadeSummary } from '../api';
import { shadeDisplay } from './shadeCodes';
import { useShadeCodeScheme } from '../account/queries';
import { HoldToWall } from './HoldToWall';
import { useSavedShades } from './savedShades';
import { depthOf, inkOn, lrvOf, undertone, DEPTH_LABEL, UNDERTONE_DOT } from './colorScience';

interface Props {
  /** The tapped summary, or null when the sheet is closed. */
  shade: ShadeSummary | null;
  onClose: () => void;
  onTryOnWall: (shade: ShadeSummary) => void;
  /** Primary action label (default "Try on wall"; guests get a sign-in CTA). */
  tryLabel?: string;
}

/** One labelled fact in the two-column grid. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text variant="eyebrow">{label}</Text>
      <Text variant="body" numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Bottom-sheet detail for one shade.
 *
 * Deliberately the same facts the website's catalogue shows and no more: the
 * colour, its name and code, the company, the hex, which way the undertone
 * leans, how light it is, its family, and the finishes it comes in.
 *
 * The AI-written prose and "great for" room lists that used to fill this sheet
 * are not on the website, so a customer comparing the two would find the app
 * asserting things the counter's own screen never says. The detail endpoint
 * still carries them; this simply stops being the place they surface.
 */
export function ShadeDetailSheet({ shade, onClose, onTryOnWall, tryLabel = 'Try on wall' }: Props) {
  // Enabled only when we have a brand slug + code; disabled (and null) when closed.
  const { data: detail } = useShadeDetail(shade?.brandSlug ?? undefined, shade?.shadeCode);
  const scheme = useShadeCodeScheme().data;
  const { isSaved, toggle } = useSavedShades();
  const [wallOpen, setWallOpen] = useState(false);

  const hex = detail?.hexCode ?? shade?.hexCode ?? undefined;
  // Presented the way the shop presents colours: its code pattern, and the paint
  // name only when the shop shows names.
  const display = shadeDisplay(scheme, {
    code: shade?.shadeCode ?? '',
    name: detail?.name ?? shade?.name,
  });
  const brandName = detail?.brandName ?? shade?.brandName ?? null;

  // The list row arrives first and the detail fills in behind it, so read
  // through both — otherwise every fact flickers in on open.
  const merged = { ...shade, ...detail };
  const depth = depthOf(merged);
  const lrv = lrvOf(merged);
  const tone = hex ? undertone(hex) : null;
  const family = detail?.shadeFamily ?? shade?.shadeFamily ?? null;
  const finishes = detail?.finishRecommendations ?? shade?.finishRecommendations ?? null;
  const ink = hex ? inkOn(hex) : null;

  /** The shape the saved-shade store keeps, built from whichever half loaded. */
  const asShade = shade
    ? {
        code: shade.shadeCode,
        name: detail?.name ?? shade.name ?? shade.shadeCode,
        hex: hex ?? '',
        brand: brandName ?? '',
        family: family ?? '',
        brandSlug: shade.brandSlug ?? undefined,
      }
    : null;
  const saved = asShade ? isSaved(asShade) : false;

  return (
    <>
      <SheetModal visible={!!shade} onClose={onClose} accent={hex}>
        {shade ? (
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* The colour leads at a size worth judging, and doubles as the way
                into the full-screen view. */}
            <PressableScale
              onPress={() => setWallOpen(true)}
              haptic="tap"
              activeScale={0.98}
              disabled={!hex}
              accessibilityRole="button"
              accessibilityLabel={`${display.label}. Show full screen to hold against the wall.`}
              style={StyleSheet.flatten([
                styles.hero,
                { backgroundColor: hex ?? colors.surface2, shadowColor: hex ?? colors.bgDeep },
              ])}
            >
              {hex && ink ? (
                <View style={styles.heroFooter}>
                  <Text variant="caption" color={ink.soft}>
                    Hold to wall
                  </Text>
                  <Ionicons name="expand-outline" size={15} color={ink.strong} />
                </View>
              ) : null}
            </PressableScale>

            <View style={styles.head}>
              <View style={styles.titleRow}>
                <Text variant="title" numberOfLines={2} style={styles.title}>
                  {display.label}
                </Text>
                {asShade && hex ? (
                  <PressableScale
                    onPress={() => toggle(asShade)}
                    haptic="select"
                    activeScale={0.9}
                    accessibilityRole="button"
                    accessibilityState={{ selected: saved }}
                    accessibilityLabel={saved ? 'Remove from saved shades' : 'Save this shade'}
                    style={StyleSheet.flatten([styles.save, saved ? styles.saveOn : null])}
                  >
                    <Ionicons
                      name={saved ? 'bookmark' : 'bookmark-outline'}
                      size={18}
                      color={saved ? colors.accentSoft : colors.fgSoft}
                    />
                  </PressableScale>
                ) : null}
              </View>
              <Text variant="code" color={colors.fgSoft}>
                {brandName ? `${brandName} · ` : ''}
                {display.code}
              </Text>
            </View>

            {tone && tone !== 'neutral' ? (
              <View style={styles.tone}>
                <View style={[styles.toneDot, { backgroundColor: UNDERTONE_DOT[tone] }]} />
                <Text variant="eyebrow">undertone · {tone}</Text>
              </View>
            ) : null}

            <View style={styles.facts}>
              {depth ? <Fact label="Depth" value={DEPTH_LABEL[depth]} /> : null}
              {lrv != null ? <Fact label="Light reflectance" value={`LRV ${lrv}`} /> : null}
              {family ? <Fact label="Family" value={family} /> : null}
              {hex ? <Fact label="Hex" value={hex.toUpperCase()} /> : null}
              {finishes?.length ? <Fact label="Finishes" value={finishes.join(' · ')} /> : null}
            </View>

            <Disclosure kind="colour" style={styles.disclosure} />

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

      <HoldToWall
        visible={wallOpen}
        hex={hex}
        label={display.label}
        code={display.code}
        onClose={() => setWallOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 520 },
  hero: {
    height: 150,
    borderRadius: radius.well,
    borderWidth: 1,
    borderColor: alpha(colors.fg, 0.12),
    justifyContent: 'flex-end',
    padding: spacing.md,
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  heroFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  head: { marginTop: spacing.lg, gap: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  title: { flex: 1 },
  save: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.glassEdge,
    backgroundColor: colors.glass,
  },
  saveOn: { borderColor: alpha(colors.accent, 0.5), backgroundColor: colors.accentGhost },
  disclosure: { marginTop: spacing.lg },
  tone: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  toneDot: { width: 9, height: 9, borderRadius: 5 },
  facts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.lg,
    rowGap: spacing.lg,
  },
  fact: { flexBasis: '50%', gap: 3, paddingRight: spacing.md },
  cta: { marginTop: spacing.xl },
});
