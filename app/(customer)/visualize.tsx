import { useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView, useWindowDimensions, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useImage } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { Screen, Text, Card, StatusPill } from '../../src/components';
import { colors, spacing, radius } from '../../src/theme';
import { RecolorCanvas } from '../../src/engine';
import { SAMPLE_SHADES } from '../../src/shades/sampleShades';
import { Shade } from '../../src/shades/types';

/**
 * Phase 1 recolor-engine spike (PLAN.md §6 — the technical gate). Loads a
 * bundled sample room + wall mask and recolors the wall live on the GPU with
 * luminance preserved. Press-and-hold compares against the original. The camera
 * → upload → AI-segmentation flow that produces real photos + masks is the next
 * Phase 1 task; this proves the on-device engine those screens will feed.
 */
export default function Visualize() {
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{
    code?: string;
    name?: string;
    hex?: string;
    brand?: string;
    brandSlug?: string;
    family?: string;
  }>();
  const photo = useImage(require('../../assets/spike/sample-room.png'));
  const mask = useImage(require('../../assets/spike/sample-mask.png'));

  // "Try on wall" passes a full shade (hex + meta); the older sample path passes
  // just a code. Build a Shade from whichever we got.
  function shadeFromParams(): Shade | null {
    if (params.code && params.hex) {
      return {
        code: params.code,
        name: params.name || params.code,
        hex: params.hex,
        brand: params.brand || '',
        family: params.family || '',
        brandSlug: params.brandSlug || undefined,
      };
    }
    if (params.code) return SAMPLE_SHADES.find((s) => s.code === params.code) ?? null;
    return null;
  }

  const [shade, setShade] = useState<Shade>(() => shadeFromParams() ?? SAMPLE_SHADES[5]);
  const [comparing, setComparing] = useState(false);

  // Sync when a new shade is passed via params, by adjusting state during render
  // (React's recommended pattern), while still letting the tray override locally.
  const paramKey = `${params.code ?? ''}:${params.hex ?? ''}`;
  const [lastKey, setLastKey] = useState(paramKey);
  if (params.code && paramKey !== lastKey) {
    setLastKey(paramKey);
    const next = shadeFromParams();
    if (next) setShade(next);
  }

  const canvasWidth = Math.round(width - spacing.lg * 2);
  const canvasHeight = Math.round((canvasWidth * 600) / 800);
  const ready = !!photo && !!mask;

  function selectShade(next: Shade) {
    Haptics.selectionAsync().catch(() => {});
    setShade(next);
  }

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.head}>
        <View style={styles.headRow}>
          <Text variant="title">Visualizer</Text>
          <StatusPill label="Engine spike" tone="new" />
        </View>
        <Text variant="bodySoft">On-device recolor · luminance preserved · bundled sample room.</Text>
      </View>

      <View style={[styles.canvasFrame, { height: canvasHeight }]}>
        {ready ? (
          <RecolorCanvas
            photo={photo}
            mask={mask}
            color={shade.hex}
            strength={comparing ? 0 : 1}
            width={canvasWidth}
            height={canvasHeight}
          />
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
            <Text variant="caption" style={{ marginTop: spacing.sm }}>
              Loading sample room…
            </Text>
          </View>
        )}
      </View>

      <Pressable
        onPressIn={() => setComparing(true)}
        onPressOut={() => setComparing(false)}
        style={({ pressed }) => [styles.compare, pressed && { borderColor: colors.accent }]}
      >
        <Text variant="label" color={comparing ? colors.accentSoft : colors.fgSoft}>
          {comparing ? 'Showing original — release to paint' : 'Hold to compare with original'}
        </Text>
      </Pressable>

      <Card>
        <View style={styles.shadeRow}>
          <View style={[styles.selectedSwatch, { backgroundColor: shade.hex }]} />
          <View style={styles.shadeMeta}>
            <Text variant="heading">{shade.name}</Text>
            <Text variant="mono" color={colors.fgSoft}>
              {shade.brand} · {shade.code}
            </Text>
          </View>
          <StatusPill label={shade.family} tone="neutral" />
        </View>
      </Card>

      <View style={styles.trayWrap}>
        <Text variant="label">Try a shade</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tray}>
          {SAMPLE_SHADES.map((s) => {
            const active = s.code === shade.code;
            return (
              <Pressable key={s.code} onPress={() => selectShade(s)} style={styles.swatchButton}>
                <View
                  style={[
                    styles.traySwatch,
                    { backgroundColor: s.hex, borderColor: active ? colors.accent : colors.rule, borderWidth: active ? 3 : 1 },
                  ]}
                />
                <Text variant="caption" numberOfLines={1} style={styles.trayLabel}>
                  {s.code}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <Card>
        <Text variant="label">What this proves</Text>
        <Text variant="bodySoft" style={{ marginTop: spacing.xs }}>
          The wall recolors on the GPU while shadows, the skirting and the window cut-out stay intact —
          the same luminance-preserving technique as the website. Next, the camera flow feeds it real
          photos and AI-generated masks.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: spacing.xl },
  head: { gap: spacing.xs },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  canvasFrame: {
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  compare: {
    height: 46,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  selectedSwatch: { width: 48, height: 48, borderRadius: radius.button, borderWidth: 1, borderColor: colors.rule },
  shadeMeta: { flex: 1, gap: 2 },
  trayWrap: { gap: spacing.sm },
  tray: { gap: spacing.md, paddingVertical: spacing.xs },
  swatchButton: { width: 64, gap: spacing.xs, alignItems: 'center' },
  traySwatch: { width: 64, height: 64, borderRadius: radius.card },
  trayLabel: { textAlign: 'center' },
});
