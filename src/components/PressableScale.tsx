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
 */

type HapticIntent = 'tap' | 'press' | 'select' | 'none';

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  /** Optional: a bare colour swatch is a valid target with nothing inside it. */
  children?: React.ReactNode;
  /** How far it dips. 0.97 for large cards, 0.94 for small controls. */
  activeScale?: number;
  /** Which haptic fires on contact. `none` for rows that already trigger one. */
  haptic?: HapticIntent;
  style?: StyleProp<ViewStyle>;
  /** Applied on top of `style` while pressed. */
  pressedStyle?: StyleProp<ViewStyle>;
}

export function PressableScale({
  children,
  activeScale = 0.97,
  haptic = 'tap',
  style,
  pressedStyle,
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
    <Pressable
      onPressIn={disabled ? undefined : handleIn}
      onPressOut={disabled ? undefined : handleOut}
      disabled={disabled}
      {...rest}
    >
      {({ pressed }) => (
        <Animated.View style={[style, { transform: [{ scale }] }, pressed ? pressedStyle : null]}>
          {children}
        </Animated.View>
      )}
    </Pressable>
  );
}
