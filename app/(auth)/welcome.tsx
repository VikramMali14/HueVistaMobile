import { View, StyleSheet, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, Serif, Button, PressableScale } from '../../src/components';
import { colors, spacing, fontSize } from '../../src/theme';

/**
 * The first screen.
 *
 * A photograph of a room fills the top two-thirds and the copy sits in the
 * gradient below it, because the single most persuasive thing this product can
 * say is a painted wall — not a paragraph about one. Everything on the screen
 * is subordinate to the picture.
 *
 * This is one of the three places the italic serif is spent (see SERIF_BUDGET
 * in theme/typography.ts). It gets the word "chosen", which is the promise.
 *
 * Two ways in, in the order they are actually used: most people arrive holding
 * a slip of paper from a paint shop, so the code goes first and carries the lit
 * button. "Just looking" is real and stays, quietly.
 */
export default function Welcome() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <ImageBackground
        source={require('../../assets/spike/sample-room.png')}
        style={styles.photo}
        imageStyle={styles.photoImage}
      >
        <LinearGradient
          colors={['rgba(5,4,9,0)', 'rgba(5,4,9,0.86)', colors.bg]}
          locations={[0, 0.52, 0.82]}
          style={StyleSheet.absoluteFill}
        />
      </ImageBackground>

      <View style={styles.body}>
        <View style={styles.copy}>
          <Text variant="eyebrow" color={colors.accentSoft}>
            Asian Paints at launch
          </Text>
          <Text variant="display">
            See your walls in your <Serif size={fontSize.display}>chosen</Serif> colour — before you paint
            a single stroke.
          </Text>
        </View>

        <View style={styles.actions}>
          <Button
            label="I have a code from my shop"
            size="lg"
            fullWidth
            onPress={() => router.push('/redeem-code')}
          />
          <Button
            label="Sign in"
            variant="secondary"
            size="lg"
            fullWidth
            onPress={() => router.push('/sign-in')}
          />
          <PressableScale
            onPress={() => router.push('/browse-shades')}
            haptic="tap"
            activeScale={0.96}
            accessibilityRole="button"
            style={styles.browse}
          >
            <Text variant="label" color={colors.fgMute}>
              Just looking? Browse the shade catalogue
            </Text>
          </PressableScale>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  photo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '62%',
  },
  photoImage: { resizeMode: 'cover' },
  body: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  copy: { gap: spacing.md },
  actions: { gap: spacing.sm },
  browse: {
    alignSelf: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
});
