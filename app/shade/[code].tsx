import { View, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Screen,
  Text,
  Button,
  BackLink,
  Disclosure,
  PressableScale,
} from '../../src/components';
import { colors, spacing, radius, alpha, hairline } from '../../src/theme';
import { useShadeDetail } from '../../src/shades/queries';
import { useShadeCodeScheme } from '../../src/account/queries';
import { shadeDisplay } from '../../src/shades/shadeCodes';
import { useSavedShades } from '../../src/shades/savedShades';
import { HoldToWall } from '../../src/shades/HoldToWall';
import {
  depthOf,
  lrvOf,
  undertone,
  inkOn,
  DEPTH_LABEL,
  UNDERTONE_DOT,
} from '../../src/shades/colorScience';
import { useProjects } from '../../src/projects/queries';
import { useState } from 'react';
import type { Shade } from '../../src/shades/types';

/**
 * One shade, full screen.
 *
 * The catalogue opens shades in a bottom sheet, because a sheet keeps your place
 * in a grid you have scrolled a long way down. This route exists for every OTHER
 * way a shade is reached — a saved swatch, a popular chip on Home, a link — where
 * there is no grid to hold and a sheet over a half-loaded screen behind it is
 * just a sheet over nothing.
 *
 * Both show the same facts, and both take them from the same `colorScience`
 * module, so the depth band and undertone a customer reads here are the ones the
 * counter's own screen shows.
 */
export default function ShadeDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string;
    name?: string;
    hex?: string;
    brand?: string;
    brandSlug?: string;
    family?: string;
  }>();

  const code = typeof params.code === 'string' ? params.code : '';
  const brandSlug = typeof params.brandSlug === 'string' ? params.brandSlug : undefined;

  const detail = useShadeDetail(brandSlug || undefined, code || undefined).data;
  const scheme = useShadeCodeScheme().data;
  const { isSaved, toggle } = useSavedShades();
  const projects = useProjects().data ?? [];
  const [wallOpen, setWallOpen] = useState(false);

  // The params arrive instantly and the detail fills in behind them, so read
  // through both — otherwise every fact flickers in on open.
  const hex = detail?.hexCode ?? (typeof params.hex === 'string' ? params.hex : '') ?? '';
  const name = detail?.name ?? (typeof params.name === 'string' ? params.name : code);
  const brand = detail?.brandName ?? (typeof params.brand === 'string' ? params.brand : '');
  const family = detail?.shadeFamily ?? (typeof params.family === 'string' ? params.family : null);

  const shade: Shade = {
    code,
    name,
    hex,
    brand,
    family: family ?? '',
    brandSlug: brandSlug || undefined,
  };
  const saved = isSaved(shade);

  const display = shadeDisplay(scheme, { code, name });
  const merged = { hexCode: hex, ...detail };
  const depth = depthOf(merged);
  const lrv = lrvOf(merged);
  const tone = hex ? undertone(hex) : null;
  const ink = hex ? inkOn(hex) : null;
  const finishes = detail?.finishRecommendations ?? null;

  /** A room worth trying it on: the most recently touched one still editable. */
  const openRoom = projects.find((p) => !p.readOnly);

  if (!hex) {
    return (
      <Screen scroll contentStyle={styles.content}>
        <BackLink />
        <Text variant="title">That shade has no colour on record.</Text>
        <Text variant="bodySoft">
          It cannot be shown or painted. Try another from the catalogue.
        </Text>
        <Button label="Open the catalogue" fullWidth onPress={() => router.push('/shades')} />
      </Screen>
    );
  }

  return (
    <Screen scroll contentStyle={styles.content} tint={hex} auroraIntensity={0.8}>
      <BackLink />

      <PressableScale
        onPress={() => setWallOpen(true)}
        haptic="tap"
        activeScale={0.985}
        accessibilityRole="button"
        accessibilityLabel={`${display.label}. Show full screen to hold against the wall.`}
        style={StyleSheet.flatten([styles.hero, { backgroundColor: hex, shadowColor: hex }])}
      >
        <View style={styles.heroFooter}>
          <Text variant="caption" color={ink?.soft}>
            Hold to wall
          </Text>
          <Ionicons name="expand-outline" size={16} color={ink?.strong} />
        </View>
      </PressableScale>

      <View style={styles.head}>
        {brand ? <Text variant="eyebrow">{brand}</Text> : null}
        <View style={styles.titleRow}>
          <Text variant="display" style={styles.title} numberOfLines={2}>
            {display.label}
          </Text>
          <PressableScale
            onPress={() => toggle(shade)}
            haptic="select"
            activeScale={0.9}
            accessibilityRole="button"
            accessibilityState={{ selected: saved }}
            accessibilityLabel={saved ? 'Remove from saved shades' : 'Save this shade'}
            style={StyleSheet.flatten([styles.save, saved ? styles.saveOn : null])}
          >
            <Ionicons
              name={saved ? 'bookmark' : 'bookmark-outline'}
              size={19}
              color={saved ? colors.accentSoft : colors.fgSoft}
            />
          </PressableScale>
        </View>
        <Text variant="code">{display.code}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.facts}
      >
        {depth ? <Fact label="Depth" value={DEPTH_LABEL[depth]} /> : null}
        {lrv != null ? <Fact label="Light reflectance" value={`LRV ${lrv}`} /> : null}
        {tone && tone !== 'neutral' ? (
          <Fact label="Undertone" value={tone} dot={UNDERTONE_DOT[tone]} />
        ) : null}
        {family ? <Fact label="Family" value={family} /> : null}
        <Fact label="Hex" value={hex.toUpperCase()} />
        {finishes?.length ? <Fact label="Finishes" value={finishes.join(' · ')} /> : null}
      </ScrollView>

      <Disclosure kind="colour" />

      <View style={styles.actions}>
        <Button
          label={openRoom ? 'Try it on your room' : 'Try it on a room'}
          size="lg"
          fullWidth
          onPress={() =>
            openRoom
              ? router.push({
                  pathname: '/studio/[id]',
                  params: { id: openRoom.id, code, name, hex, brand, brandSlug: brandSlug ?? '' },
                })
              : router.push('/studio/new')
          }
        />
        <Button
          label={saved ? 'Saved to your library' : 'Save this shade'}
          variant="secondary"
          fullWidth
          icon={
            <Ionicons
              name={saved ? 'bookmark' : 'bookmark-outline'}
              size={17}
              color={saved ? colors.accentSoft : colors.fg}
            />
          }
          onPress={() => toggle(shade)}
        />
      </View>

      <HoldToWall
        visible={wallOpen}
        hex={hex}
        label={display.label}
        code={display.code}
        onClose={() => setWallOpen(false)}
      />
    </Screen>
  );
}

function Fact({ label, value, dot }: { label: string; value: string; dot?: string }) {
  return (
    <View style={styles.fact}>
      <Text variant="eyebrow">{label}</Text>
      <View style={styles.factValue}>
        {dot ? <View style={[styles.factDot, { backgroundColor: dot }]} /> : null}
        <Text variant="subhead" numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: spacing.lg },
  hero: {
    height: 200,
    borderRadius: radius.well,
    borderWidth: hairline,
    borderColor: alpha(colors.fg, 0.12),
    justifyContent: 'flex-end',
    padding: spacing.lg,
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  heroFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  head: { gap: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  title: { flex: 1 },
  save: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: hairline,
    borderColor: colors.glassEdge,
    backgroundColor: colors.glass,
  },
  saveOn: {
    borderColor: alpha(colors.accent, 0.5),
    backgroundColor: colors.accentGhost,
  },
  facts: { gap: spacing.sm, paddingVertical: spacing.xs },
  fact: {
    gap: spacing.xs,
    minWidth: 104,
    padding: spacing.md,
    borderRadius: radius.cardTight,
    borderWidth: hairline,
    borderColor: colors.glassEdgeSoft,
    backgroundColor: colors.glass,
  },
  factValue: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  factDot: { width: 8, height: 8, borderRadius: 4 },
  actions: { gap: spacing.sm },
});
