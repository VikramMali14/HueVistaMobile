import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Text, Button, BrandMark } from '../../src/components';
import { colors, spacing } from '../../src/theme';

/**
 * First screen for a signed-out user. Three entry paths (PLAN.md §3): sign in,
 * create an account, or redeem a paint-shop access code.
 */
export default function Welcome() {
  const router = useRouter();

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.hero}>
        <BrandMark subtitle="See real catalogue shades on your own walls — before you paint." />
      </View>

      <View style={styles.actions}>
        <Button label="Sign in" size="lg" fullWidth onPress={() => router.push('/sign-in')} />
        <Button
          label="Create an account"
          variant="secondary"
          size="lg"
          fullWidth
          onPress={() => router.push('/register')}
        />
        <Button
          label="My paint shop gave me a code"
          variant="ghost"
          fullWidth
          onPress={() => router.push('/redeem-code')}
        />
        <Text variant="caption" center style={styles.legal}>
          By continuing you agree to HueVista&apos;s Terms and Privacy Policy.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'space-between', paddingVertical: spacing.xxxl },
  hero: { flex: 1, justifyContent: 'center' },
  actions: { gap: spacing.md },
  legal: { color: colors.fgMute, marginTop: spacing.sm },
});
