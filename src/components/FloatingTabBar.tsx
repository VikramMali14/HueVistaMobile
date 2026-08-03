import { useContext, useEffect } from 'react';
import { Animated, LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// expo-router vendors react-navigation's bottom tabs rather than depending on
// the published package, so both the prop types and the height contexts come
// from its subpath, not from `@react-navigation/bottom-tabs` (not installed).
import {
  BottomTabBarHeightCallbackContext,
  BottomTabBarHeightContext,
  type BottomTabBarProps,
} from 'expo-router/tabs';
import { colors, alpha, spacing, radius, elevation, duration, easing, tabBar, useAnimatedValue } from '../theme';
import { haptics } from '../haptics';

/**
 * The floating pill tab bar.
 *
 * Replaces the default bar — a full-width strip welded to the bottom edge with
 * a hairline on top and a text label under every icon. That bar was five words
 * of chrome competing with the content and, because it spanned the full width,
 * it visually ended the screen early.
 *
 * This one is an object: a dark capsule inset from all three edges, floating
 * over the aurora with the content scrolling beneath it. Labels are dropped in
 * favour of a lit pill behind the active icon, which the eye tracks faster than
 * it reads. Switching tabs fires a selection haptic.
 *
 * Wired via `tabBar={(props) => <FloatingTabBar {...props} />}` on a Tabs
 * navigator; screens must reserve `useTabBarInset()` of bottom padding.
 */

const ICON_SIZE = 21;

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  // BottomTabView hands every custom bar a setter for its own height and feeds
  // the result to each screen through BottomTabBarHeightContext. Reporting the
  // real measured height here is what lets `Screen` reserve the right amount of
  // room without any screen having to know a tab bar exists.
  const reportHeight = useContext(BottomTabBarHeightCallbackContext);
  const onLayout = (e: LayoutChangeEvent) => reportHeight?.(e.nativeEvent.layout.height);

  return (
    <View
      style={[
        styles.wrap,
        { paddingBottom: Math.max(insets.bottom, spacing.md), paddingHorizontal: tabBar.inset },
      ]}
      pointerEvents="box-none"
      onLayout={onLayout}
    >
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label =
            typeof options.tabBarAccessibilityLabel === 'string'
              ? options.tabBarAccessibilityLabel
              : (options.title ?? route.name);

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (focused || event.defaultPrevented) return;
            haptics.select();
            navigation.navigate(route.name, route.params);
          };

          return (
            <TabItem
              key={route.key}
              // Icons stay declared on each Tabs.Screen, next to its title and
              // its `href` gating, rather than in a lookup table here that
              // would silently fall out of step when a route is renamed.
              icon={options.tabBarIcon?.({
                focused,
                color: focused ? colors.fg : colors.fgMute,
                size: ICON_SIZE,
              })}
              focused={focused}
              label={label}
              onPress={onPress}
            />
          );
        })}
      </View>
    </View>
  );
}

function TabItem({
  icon,
  focused,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  focused: boolean;
  label: string;
  onPress: () => void;
}) {
  // One driver for both the pill behind the icon and the icon's own lift, so
  // they can never disagree mid-transition.
  const active = useAnimatedValue(focused ? 1 : 0);

  useEffect(() => {
    const anim = Animated.timing(active, {
      toValue: focused ? 1 : 0,
      duration: duration.base,
      easing: easing.standard,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [focused, active]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={styles.item}
      hitSlop={6}
    >
      <Animated.View
        style={[
          styles.pill,
          {
            opacity: active,
            transform: [{ scale: active.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
          },
        ]}
      />
      <Animated.View
        style={{
          transform: [
            { translateY: active.interpolate({ inputRange: [0, 1], outputRange: [0, -1] }) },
          ],
        }}
      >
        {icon}
      </Animated.View>
    </Pressable>
  );
}

/**
 * Bottom padding a scrolling surface must add so its last row clears the
 * floating bar. Returns 0 outside a tab navigator, so it is safe to call
 * unconditionally from a component used in both places (the shade library is
 * used by four tabs and by the signed-out browse screen).
 */
export function useTabBarInset(): number {
  const height = useContext(BottomTabBarHeightContext);
  return height ? height + spacing.md : 0;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: tabBar.height,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    borderWidth: 1,
    borderColor: colors.inkEdge,
    paddingHorizontal: spacing.xs,
    ...elevation.mid,
  },
  item: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    position: 'absolute',
    width: 46,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: alpha(colors.accent, 0.22),
    borderWidth: 1,
    borderColor: alpha(colors.accentSoft, 0.3),
  },
});
