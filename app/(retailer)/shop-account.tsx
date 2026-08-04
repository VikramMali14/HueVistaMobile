import { View, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Serif, Text, Card, Button } from '../../src/components';
import { spacing, fontSize } from '../../src/theme';
import { AccountPanel } from '../../src/account/AccountPanel';
import { useMyAccess, useMyOrg } from '../../src/account/roleQueries';

/**
 * The shop's own account.
 *
 * Beyond the shared panel it names two things only a shop has: which
 * organisation this is, and what its distributor has granted it — the paint
 * companies it may work with, and the pages it may reach. Both are decided
 * upstream, so they are stated here rather than offered as settings.
 */
export default function ShopAccount() {
  const router = useRouter();
  const org = useMyOrg();
  const access = useMyAccess().data;

  // Same rule the tab bar uses: a grant that failed to load reads as
  // unrestricted, so a backend hiccup never hides a shop's own tools.
  const restricted = access?.featuresRestricted ?? false;
  const can = (path: string) => !restricted || (access?.allowedPaths ?? []).includes(path);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="display">
        <Serif size={fontSize.display}>Account</Serif>
      </Text>

        <AccountPanel>
          <Card>
            <Text variant="label">Shop</Text>
            <Text variant="heading" style={{ marginTop: spacing.xs }}>
              {org.data?.name ?? '—'}
            </Text>

            <View style={styles.grant}>
              <Text variant="caption">
                {access?.brandsRestricted
                  ? `Paint companies: ${access.allowedBrands.join(', ') || 'none assigned yet'}`
                  : 'Paint companies: every brand in the catalogue'}
              </Text>
              <Text variant="caption">
                {access?.featuresRestricted
                  ? `Pages: ${access.allowedFeatures.join(', ') || 'none assigned yet'}`
                  : 'Pages: all of them'}
              </Text>
              {access?.brandsRestricted || access?.featuresRestricted ? (
                <Text variant="caption">
                  Your distributor decides these. Ask them to change what your shop can reach.
                </Text>
              ) : null}
            </View>
          </Card>

          {/* Both the invitation and the account-creation endpoints behind this
              screen are NETWORK-gated, so a shop without that grant would only
              reach a screen whose every button 403s. */}
          {can('/network') ? (
            <Card>
              <Text variant="label">Painters</Text>
              <Text variant="bodySoft" style={{ marginTop: spacing.xs }}>
                Invite a painter and they get their own login, with the jobs you assign them — or
                create the account yourself when they cannot pick up an invitation.
              </Text>
              <Button
                label="Manage painters"
                variant="secondary"
                fullWidth
                style={styles.action}
                onPress={() => router.push('/painters')}
              />
            </Card>
          ) : null}

          {/* The shelf: what this shop sells, as every customer holding one of its
              codes sees it. Hidden when the distributor has switched the page off,
              matching the website's own nav filter. */}
          {can('/products') ? (
            <Card>
              <Text variant="label">Products</Text>
              <Text variant="bodySoft" style={{ marginTop: spacing.xs }}>
                The paint you stock — price, pack, coverage and finish. This is what your customers
                see against the codes you issue.
              </Text>
              <Button
                label="Manage products"
                variant="secondary"
                fullWidth
                style={styles.action}
                onPress={() => router.push('/products')}
              />
            </Card>
          ) : null}

          {/* Palettes the shop curates itself. They lead in the studio's suggest
              tab, ahead of the model's — chosen by the people selling the paint. */}
          {can('/portal') ? (
            <Card>
              <Text variant="label">Palettes</Text>
              <Text variant="bodySoft" style={{ marginTop: spacing.xs }}>
                Three-colour combinations you put together. They show up first in the studio, above
                the AI suggestions, for anyone painting with your shop.
              </Text>
              <Button
                label="Manage palettes"
                variant="secondary"
                fullWidth
                style={styles.action}
                onPress={() => router.push('/palettes')}
              />
            </Card>
          ) : null}

          {/* The public kiosk link: a walk-in pays HueVista directly and the shop
              earns points per sale. */}
          <Card>
            <Text variant="label">Kiosk link</Text>
            <Text variant="bodySoft" style={{ marginTop: spacing.xs }}>
              A public link anyone can buy a code from — no counter time, and you earn points on
              every sale.
            </Text>
            <Button
              label="Manage kiosk"
              variant="secondary"
              fullWidth
              style={styles.action}
              onPress={() => router.push('/kiosk')}
            />
          </Card>
        </AccountPanel>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  grant: { marginTop: spacing.sm, gap: 2 },
  action: { marginTop: spacing.md },
});
