import { useEffect } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';
import { duration, easing, revealOffset, stagger, useAnimatedValue } from '../theme';

/**
 * Fades and lifts its child into place on mount.
 *
 * Screens used to appear all at once, fully formed — which is exactly what a
 * generated layout looks like. Revealing sections in reading order gives the
 * eye somewhere to start and makes the hierarchy legible before a word is read.
 *
 * `index` staggers siblings; the delay is capped (see `stagger`) so a long list
 * does not take three seconds to finish arriving. Deliberately mount-only:
 * re-running on every prop change would make lists flicker as data refetches.
 */

export interface RevealProps {
  children: React.ReactNode;
  /** Position among siblings — drives the stagger delay. */
  index?: number;
  /** Extra delay (ms) on top of the stagger. */
  delay?: number;
  /** Travel distance (dp). Negative lifts from below, positive drops from above. */
  offset?: number;
  style?: StyleProp<ViewStyle>;
}

export function Reveal({ children, index = 0, delay = 0, offset = revealOffset, style }: RevealProps) {
  const progress = useAnimatedValue(0);

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: duration.reveal,
      delay: stagger(index) + delay,
      easing: easing.entrance,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
    // Mount-only by design — see the note above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
