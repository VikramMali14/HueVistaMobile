import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Text, Serif, Button, BrandMark, Reveal, PressableScale } from '../../src/components';
import { colors, spacing, fontSize } from '../../src/theme';

/**
 * First screen for a signed-out user. Three entry paths (PLAN.md §3): sign in,
 * create an account, or redeem a paint-shop access code.
 *
 * This is the app's one chance to look like something, so it gets the brightest
 * aurora and the largest type in the product. The old version stacked four
 * equally-weighted buttons under a wordmark, which said nothing about what the
 * app does; the headline now does that job and the buttons fall into rank
 * behind it.
 */
export default function Welcome() {
  const router = useRouter();

  return (
    <Screen contentStyle={styles.content} auroraIntensity={1.25}>
      <View style={styles.hero}>
        <Reveal>
          <BrandMark />
        </Reveal>

        <Reveal index={1} style={styles.headline}>
          <Text variant="hero">
            See the colour{'\n'}before you{' '}
            <Serif size={fontSize.hero}>commit</Serif>
          </Text>
        </Reveal>

        <Reveal index={2}>
          <Text variant="bodySoft" style={styles.sub}>
            Try real catalogue shades on your own walls, in your own light.
          </Text>
        </Reveal>
      </View>

      <Reveal index={3} style={styles.actions}>
        <Button label="Sign in" size="lg" fullWidth onPress={() => router.push('/sign-in')} />
        <Button
          label="Create an account"
          variant="outline"
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
        <PressableScale
          onPress={() => router.push('/browse-shades')}
          haptic="tap"
          activeScale={0.96}
          style={styles.browse}
        >
          <Text variant="label" color={colors.accentSoft} center>
            Browse shades without an account
          </Text>
        </PressableScale>
        <Text variant="caption" center style={styles.legal}>
          By continuing you agree to HueVista&apos;s Terms and Privacy Policy.
        </Text>
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'space-between', paddingVertical: spacing.xxxl },
  hero: { flex: 1, justifyContent: 'center', gap: spacing.lg },
  headline: { marginTop: spacing.sm },
  sub: { maxWidth: 300 },
  actions: { gap: spacing.md },
  browse: { paddingVertical: spacing.sm },
  legal: { color: colors.fgMute, marginTop: spacing.sm },
});
