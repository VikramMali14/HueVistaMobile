import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ShadeLibrary } from '../../src/shades/ShadeLibrary';
import { Text, Card, Button, BackLink } from '../../src/components';
import { spacing } from '../../src/theme';

/**
 * Guest browse — the full catalogue with no account, using the public
 * `/api/shades` endpoints (PLAN.md §5). Visualizing on a wall needs an account,
 * so the detail sheet's action routes to sign-up.
 */
export default function BrowseShades() {
  const router = useRouter();
  return (
    <ShadeLibrary
      headerTitle="Browse shades"
      tryLabel="Create an account to try it"
      onTryOnWall={() => router.push('/register')}
      extraHeader={
        <View style={styles.banner}>
          <BackLink />
          <Card>
            <Text variant="heading">Browsing as a guest</Text>
            <Text variant="bodySoft" style={styles.bannerBody}>
              Explore the full catalogue. Create a free account to try shades on your own room.
            </Text>
            <View style={styles.bannerActions}>
              <Button label="Create account" onPress={() => router.push('/register')} />
              <Button label="Sign in" variant="ghost" onPress={() => router.push('/sign-in')} />
            </View>
          </Card>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  banner: { gap: spacing.md },
  bannerBody: { marginTop: spacing.xs },
  bannerActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});
