import { useEffect } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { spacing, radius, fontSize, duration, easing, useAnimatedValue } from '../theme';
import { Text, Serif } from './Text';

const SPECTRUM = ['#7c5cff', '#a080ff', '#7fae84', '#d9b45c', '#d0654c'];

/**
 * The HueVista brand moment: spectrum bar + wordmark. Reused on auth screens.
 *
 * The swatches now deal themselves in one after another, each rising into place
 * — a paint app should introduce itself with colour arriving, not with colour
 * already sitting there. The wordmark takes the serif on "Vista" so the brand
 * carries the same sans/serif contrast as the rest of the type.
 */
export function BrandMark({ subtitle }: { subtitle?: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.spectrum}>
        {SPECTRUM.map((c, i) => (
          <SpectrumSwatch key={c} color={c} index={i} />
        ))}
      </View>
      <Text variant="display">
        Hue<Serif size={fontSize.display}>Vista</Serif>
      </Text>
      {subtitle ? <Text variant="bodySoft">{subtitle}</Text> : null}
    </View>
  );
}

function SpectrumSwatch({ color, index }: { color: string; index: number }) {
  const enter = useAnimatedValue(0);

  useEffect(() => {
    const anim = Animated.timing(enter, {
      toValue: 1,
      duration: duration.slow,
      delay: 90 + index * 80,
      easing: easing.entrance,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [enter, index]);

  return (
    <Animated.View
      style={[
        styles.swatch,
        {
          backgroundColor: color,
          shadowColor: color,
          opacity: enter,
          transform: [
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
            { scaleY: enter.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
          ],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  spectrum: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.lg },
  swatch: {
    width: 34,
    height: 9,
    borderRadius: radius.pill,
    shadowOpacity: 0.7,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
});
