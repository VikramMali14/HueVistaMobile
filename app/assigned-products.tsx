import { View, StyleSheet, ActivityIndicator } from 'react-native';

import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Text, Card, StatusPill, Meter, BackLink } from '../src/components';
import { colors, spacing, radius } from '../src/theme';
import { useAssignedProducts } from '../src/account/queries';
import { resolveImageUrl, ShopProduct } from '../src/api';

/** Price + unit as one line, e.g. "₹1,240 / litre". Blank when unpriced. */
function priceLine(p: ShopProduct): string | null {
  if (p.price == null) return null;
  const value = typeof p.price === 'string' ? Number(p.price) : p.price;
  if (Number.isNaN(value)) return null;
  return `₹${value.toLocaleString('en-IN')}${p.priceUnit ? ` / ${p.priceUnit}` : ''}`;
}

function ProductCard({ product }: { product: ShopProduct }) {
  const image = resolveImageUrl(product.imageUrl);
  const price = priceLine(product);
  return (
    <Card padded={false}>
      <View style={styles.productRow}>
        {image ? (
          <Image source={{ uri: image }} style={styles.productImage} contentFit="cover" transition={150} />
        ) : (
          <View style={[styles.productImage, styles.productImageEmpty]}>
            <Ionicons name="color-fill-outline" size={22} color={colors.fgMute} />
          </View>
        )}
        <View style={styles.productBody}>
          <Text variant="subhead" numberOfLines={2}>
            {product.lineName ?? 'Product'}
          </Text>
          <Text variant="caption">
            {[product.brandName, product.finish, product.packSize].filter(Boolean).join(' · ')}
          </Text>
          {price ? <Text variant="body">{price}</Text> : null}
          {product.coverage ? <Text variant="caption">Covers {product.coverage}</Text> : null}
          {product.brightness != null ? (
            // The shop rates each product 1–10 for brightness; show it as the
            // same meter the counter reads rather than a bare number.
            <View style={styles.brightness}>
              <Text variant="caption">Brightness</Text>
              <Meter value={product.brightness} max={10} showCount={false} style={styles.brightnessMeter} />
              <Text variant="caption">{product.brightness}/10</Text>
            </View>
          ) : null}
          {product.description ? (
            <Text variant="bodySoft" numberOfLines={3}>
              {product.description}
            </Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

/**
 * What this customer's shop unlocked for them: whole paint companies, plus the
 * individual products the shop picked. This is the counter's shortlist — the
 * things they can actually buy after visualizing.
 */
export default function AssignedProducts() {
  const { data, isLoading, isError } = useAssignedProducts();
  const brands = data?.allowedBrands ?? [];
  const products = data?.products ?? [];

  return (
    <Screen scroll contentStyle={styles.content}>
      <BackLink />

      <View style={styles.header}>
        <Text variant="title">Your products</Text>
        <Text variant="bodySoft">
          {data?.shopName ? `Picked for you by ${data.shopName}.` : 'Picked for you by your paint shop.'}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : isError ? (
        <Card>
          <Text variant="bodySoft">
            No shop has assigned you products yet. Redeem a shop code and they&apos;ll show up here.
          </Text>
        </Card>
      ) : (
        <>
          <View style={styles.section}>
            <Text variant="label">Paint companies</Text>
            {brands.length > 0 ? (
              <View style={styles.brandRow}>
                {brands.map((b) => (
                  <StatusPill key={b} label={b} tone="done" />
                ))}
              </View>
            ) : (
              <Card>
                <Text variant="bodySoft">
                  Every company in the catalogue is open to you — browse the whole shade library.
                </Text>
              </Card>
            )}
          </View>

          <View style={styles.section}>
            <Text variant="label">Products</Text>
            {products.length > 0 ? (
              <View style={styles.list}>
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </View>
            ) : (
              <Card>
                <Text variant="bodySoft">
                  Your shop hasn&apos;t picked individual products for you — ask them at the counter for
                  what suits your walls.
                </Text>
              </Card>
            )}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingTop: spacing.xl },
  header: { gap: spacing.xs },
  center: { paddingVertical: spacing.xxxl, alignItems: 'center' },
  section: { gap: spacing.sm },
  brandRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  list: { gap: spacing.md },
  productRow: { flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  productImage: {
    width: 84,
    height: 84,
    borderRadius: radius.card,
    backgroundColor: colors.surface2,
  },
  productImageEmpty: { alignItems: 'center', justifyContent: 'center' },
  productBody: { flex: 1, gap: 4 },
  brightness: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brightnessMeter: { flex: 1 },
});
