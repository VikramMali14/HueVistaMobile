import { useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Text, Card, Button } from '../../src/components';
import { colors, spacing } from '../../src/theme';
import { orgApi, userMessage } from '../../src/api';

/** A toggle row: the thing, and whether this shop has it. */
function Toggle({
  label,
  hint,
  on,
  onPress,
}: {
  label: string;
  hint?: string | null;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.toggle}>
      <Ionicons
        name={on ? 'checkbox' : 'square-outline'}
        size={22}
        color={on ? colors.accent : colors.fgMute}
      />
      <View style={styles.toggleText}>
        <Text variant="body">{label}</Text>
        {hint ? (
          <Text variant="caption" numberOfLines={2}>
            {hint}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * What one shop may reach: its paint companies, and its pages.
 *
 * Both grants share a rule worth stating plainly on screen — an EMPTY selection
 * means "no restriction", not "nothing". That reading is the backend's, and a
 * distributor who assumes the opposite would think they had locked a shop down
 * when they had in fact opened it up.
 */
export default function ShopDetail() {
  const raw = useLocalSearchParams<{ id: string }>();
  const orgId = Array.isArray(raw.id) ? raw.id[0] : raw.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const brands = useQuery({
    queryKey: ['org', 'shop-brands', orgId],
    queryFn: () => orgApi.retailerBrands(orgId),
    enabled: Boolean(orgId),
  });
  const features = useQuery({
    queryKey: ['org', 'shop-features', orgId],
    queryFn: () => orgApi.retailerFeatures(orgId),
    enabled: Boolean(orgId),
  });

  const saveBrands = useMutation({
    mutationFn: (ids: number[]) => orgApi.setRetailerBrands(orgId, ids),
    onSuccess: (rows) => queryClient.setQueryData(['org', 'shop-brands', orgId], rows),
    onError: (err) => setError(userMessage(err)),
  });
  const saveFeatures = useMutation({
    mutationFn: (keys: string[]) => orgApi.setRetailerFeatures(orgId, keys),
    onSuccess: (rows) => queryClient.setQueryData(['org', 'shop-features', orgId], rows),
    onError: (err) => setError(userMessage(err)),
  });

  function toggleBrand(id: number | null | undefined) {
    if (id == null) return;
    const current = (brands.data ?? []).filter((b) => b.assigned).map((b) => b.id as number);
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    setError(null);
    saveBrands.mutate(next);
  }

  function toggleFeature(key: string) {
    const current = (features.data ?? []).filter((f) => f.assigned).map((f) => f.key);
    const next = current.includes(key) ? current.filter((x) => x !== key) : [...current, key];
    setError(null);
    saveFeatures.mutate(next);
  }

  const anyBrand = (brands.data ?? []).some((b) => b.assigned);
  const anyFeature = (features.data ?? []).some((f) => f.assigned);

  return (
    <Screen scroll contentStyle={styles.content}>
      <Pressable onPress={() => router.back()} hitSlop={12}>
        <Text variant="label" color={colors.fgSoft}>
          ‹ Network
        </Text>
      </Pressable>

      <Text variant="title">What this shop can reach</Text>

      {error ? (
        <Text variant="body" color={colors.danger}>
          {error}
        </Text>
      ) : null}

      <Card>
        <View style={styles.head}>
          <Text variant="label">Paint companies</Text>
          {saveBrands.isPending ? <ActivityIndicator color={colors.accent} size="small" /> : null}
        </View>
        <Text variant="caption" style={styles.rule}>
          {anyBrand
            ? 'Only the ticked companies. Untick them all to allow every brand.'
            : 'Nothing ticked — this shop can work with every brand in the catalogue.'}
        </Text>
        {brands.isLoading ? (
          <Text variant="caption">Loading…</Text>
        ) : (
          (brands.data ?? []).map((b) => (
            <Toggle
              key={b.id ?? b.name}
              label={b.name}
              on={b.assigned}
              onPress={() => toggleBrand(b.id)}
            />
          ))
        )}
      </Card>

      <Card>
        <View style={styles.head}>
          <Text variant="label">Pages</Text>
          {saveFeatures.isPending ? <ActivityIndicator color={colors.accent} size="small" /> : null}
        </View>
        <Text variant="caption" style={styles.rule}>
          {anyFeature
            ? 'Only the ticked pages. Untick them all to allow the whole workspace.'
            : 'Nothing ticked — this shop can reach the whole workspace.'}
        </Text>
        {features.isLoading ? (
          <Text variant="caption">Loading…</Text>
        ) : (
          (features.data ?? []).map((f) => (
            <Toggle
              key={f.key}
              label={f.label ?? f.key}
              hint={f.description}
              on={f.assigned}
              onPress={() => toggleFeature(f.key)}
            />
          ))
        )}
      </Card>

      <Text variant="caption">
        The dashboard, account settings and the plan page are never switchable — a shop that
        couldn&apos;t reach its own billing could never fix a lapsed subscription.
      </Text>

      <Button label="Done" variant="secondary" fullWidth onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rule: { marginTop: spacing.xs, marginBottom: spacing.sm },
  toggle: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.xs },
  toggleText: { flexShrink: 1, gap: 2 },
});
