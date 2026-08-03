import {
  Animated,
  GestureResponderEvent,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { spring, useAnimatedValue } from '../theme';
import { haptics } from '../haptics';

/**
 * A Pressable that physically responds: it dips under the finger and fires a
 * haptic on the way down.
 *
 * The app's touch feedback was `opacity: pressed ? 0.9 : 1` — a change small
 * enough to miss, applied inconsistently, and inert on the one sense that
 * makes a phone feel like an object. Scale plus haptic is the whole difference
 * between a tappable rectangle and a button.
 *
 * The haptic fires on press-*in*, not on press. Firing on release would land
 * after the user already knows they tapped; firing on contact is the part that
 * reads as responsiveness. It fires even if the press is later cancelled by a
 * drag, which is correct — the touch did happen.
 *
 * `style` lands on the pressable itself rather than on an inner wrapper. That
 * matters for layout, not just tidiness: with the style on a child, a
 * `flex: 1` handed to a grid cell applied to the wrapper while the Pressable
 * sized itself to its content, so a two-column catalogue laid out columns as
 * wide as each shade's name — "Champagne Wash" came out visibly wider than
 * "Linen Fold". Animating the Pressable keeps the transform and the layout on
 * one element.
 */

type HapticIntent = 'tap' | 'press' | 'select' | 'none';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  /** Optional: a bare colour swatch is a valid target with nothing inside it. */
  children?: React.ReactNode;
  /** How far it dips. 0.97 for large cards, 0.94 for small controls. */
  activeScale?: number;
  /** Which haptic fires on contact. `none` for rows that already trigger one. */
  haptic?: HapticIntent;
  style?: StyleProp<ViewStyle>;
}

export function PressableScale({
  children,
  activeScale = 0.97,
  haptic = 'tap',
  style,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: PressableScaleProps) {
  const scale = useAnimatedValue(1);

  const to = (value: number) => {
    Animated.spring(scale, { toValue: value, ...spring.press }).start();
  };

  const handleIn = (e: GestureResponderEvent) => {
    to(activeScale);
    if (haptic !== 'none') haptics[haptic]();
    onPressIn?.(e);
  };

  const handleOut = (e: GestureResponderEvent) => {
    to(1);
    onPressOut?.(e);
  };

  return (
    <AnimatedPressable
      onPressIn={disabled ? undefined : handleIn}
      onPressOut={disabled ? undefined : handleOut}
      disabled={disabled}
      style={[style, { transform: [{ scale }] }]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
