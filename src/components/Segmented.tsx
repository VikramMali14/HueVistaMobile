import { useEffect, useState } from 'react';
import { Animated, LayoutChangeEvent, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, alpha, spacing, radius, duration, easing, useAnimatedValue } from '../theme';
import { Text } from './Text';
import { haptics } from '../haptics';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Small colour dot before the label — a depth swatch, a family colour. */
  dot?: string;
}

export interface SegmentedProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

/**
 * A row of mutually exclusive options with a thumb that slides between them.
 *
 * Filters that pick exactly one value out of three or four — depth, sort order —
 * were reaching for the same `Chip` the multi-select filters use, so nothing on
 * screen distinguished "narrow this list" from "choose one of these". The
 * sliding thumb makes the single-choice nature visible without a word of
 * explanation, and the movement shows which way the selection travelled.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
  accessibilityLabel,
}: SegmentedProps<T>) {
  const [width, setWidth] = useState(0);
  const thumb = useAnimatedValue(0);

  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const segment = options.length > 0 ? width / options.length : 0;

  useEffect(() => {
    const anim = Animated.timing(thumb, {
      toValue: index,
      duration: duration.base,
      easing: easing.standard,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [index, thumb]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View
      style={[styles.track, style]}
      onLayout={onLayout}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
    >
      {/* Rendered once the track is measured (before that the thumb has no
          width to travel and would flash at the left edge) and only with
          something to travel between — `interpolate` demands a strictly
          increasing input range, so a one-option row would throw. */}
      {segment > 0 && options.length > 1 ? (
        <Animated.View
          style={[
            styles.thumb,
            {
              width: segment - 4,
              transform: [
                {
                  translateX: thumb.interpolate({
                    inputRange: options.map((_, i) => i),
                    outputRange: options.map((_, i) => i * segment + 2),
                  }),
                },
              ],
            },
          ]}
        />
      ) : null}

      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (selected) return;
              haptics.select();
              onChange(option.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            style={styles.item}
          >
            {option.dot ? (
              <View style={[styles.dot, { backgroundColor: option.dot }]} />
            ) : null}
            <Text
              variant="label"
              numberOfLines={1}
              color={selected ? colors.fg : colors.fgMute}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: alpha(colors.fg, 0.05),
    borderWidth: 1,
    borderColor: colors.glassEdge,
    padding: 2,
  },
  thumb: {
    position: 'absolute',
    left: 0,
    top: 2,
    bottom: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.accentGhost,
    borderWidth: 1,
    borderColor: alpha(colors.accentSoft, 0.35),
  },
  item: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: '100%',
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: alpha(colors.fg, 0.25),
  },
});
