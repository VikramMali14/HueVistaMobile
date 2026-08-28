import { useContext, useEffect, useState } from 'react';
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
import {
  colors,
  alpha,
  spacing,
  radius,
  elevation,
  duration,
  easing,
  spring,
  fontSize,
  tabBar,
  glow,
  useAnimatedValue,
} from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { PressableScale } from './PressableScale';
import { haptics } from '../haptics';

/**
 * The floating tab bar, and the raised action that sits in the middle of it.
 *
 * It began as a full-width strip welded to the bottom edge; it became a dark
 * capsule with a pill that faded in behind whichever icon was active. The fade
 * was the remaining tell that this is not an iOS app: on iOS the selected
 * indicator is one object that TRAVELS — you watch it leave the tab you were on
 * and arrive at the one you chose, and that movement is what tells you which
 * direction you just moved through the app. Two pills cross-fading tell you
 * nothing, and the eye reads it as a flicker.
 *
 * So there is exactly one indicator here, and it slides. A single spring drives
 * it, matching the settle of iOS's own selection: quick, slightly eager at the
 * end, no wobble. The icon it lands under lifts and the label under it brightens
 * on the same beat.
 *
 * ── The centre action ─────────────────────────────────────────────────────
 * The design this came from put "Studio" in the tab rail as a fifth
 * destination, pointing at the colour step of a room. A tab has to be a place
 * you can always go, and that one is not: with three rooms on the go it cannot
 * know which room, and with none it has nothing to show. It is an ACTION —
 * start a room, or carry on with the one you were in — so it is drawn as one:
 * a raised accent capsule breaking the top edge of the bar, in the middle,
 * where the thumb naturally rests.
 *
 * The row therefore lays out five slots for four routes, with the middle slot
 * left empty for the action to sit over. The travelling indicator maps route
 * index → slot index so it skips that gap rather than sliding underneath it.
 *
 * Wired via `tabBar={(props) => <FloatingTabBar {...props} action={…} />}` on a
 * Tabs navigator; screens must reserve `useTabBarInset()` of bottom padding.
 */

/** The raised centre button. Not a route — see the note above. */
export interface TabBarAction {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityHint?: string;
}

const ICON_SIZE = 22;
/** Breathing room between the travelling indicator and the capsule's edge. */
const INDICATOR_INSET = 4;

export function FloatingTabBar({
  state,
  descriptors,
  navigation,
  action,
}: BottomTabBarProps & { action?: TabBarAction }) {
  const insets = useSafeAreaInsets();

  // BottomTabView hands every custom bar a setter for its own height and feeds
  // the result to each screen through BottomTabBarHeightContext. Reporting the
  // real measured height here is what lets `Screen` reserve the right amount of
  // room without any screen having to know a tab bar exists.
  const reportHeight = useContext(BottomTabBarHeightCallbackContext);
  const onLayout = (e: LayoutChangeEvent) => reportHeight?.(e.nativeEvent.layout.height);

  // The capsule's inner width, measured once laid out. Tabs are equal width, so
  // the indicator's own width never changes — only where it sits — which is what
  // keeps the whole travel on the native driver.
  const [innerWidth, setInnerWidth] = useState(0);
  const count = state.routes.length;
  /** Slots = routes, plus one empty one in the middle when there is an action. */
  const slotCount = action ? count + 1 : count;
  const itemWidth = slotCount > 0 ? innerWidth / slotCount : 0;
  /** Which slot the action occupies. Middle of the row. */
  const actionSlot = Math.floor(slotCount / 2);
  /** Route index → slot index, stepping over the action's gap. */
  const slotOf = (routeIndex: number) =>
    action && routeIndex >= actionSlot ? routeIndex + 1 : routeIndex;

  /**
   * The row, laid out. `null` is the gap the raised action sits over.
   */
  const slots: ({ route: (typeof state.routes)[number]; index: number } | null)[] = [];
  state.routes.forEach((route, index) => {
    if (action && slots.length === actionSlot) slots.push(null);
    slots.push({ route, index });
  });

  const slide = useAnimatedValue(state.index);
  useEffect(() => {
    const anim = Animated.spring(slide, { toValue: state.index, ...spring.settle });
    anim.start();
    return () => anim.stop();
  }, [state.index, slide]);

  return (
    <View
      style={[
        styles.wrap,
        { paddingBottom: Math.max(insets.bottom, spacing.md), paddingHorizontal: tabBar.inset },
      ]}
      pointerEvents="box-none"
      onLayout={onLayout}
    >
      <View style={styles.barWrap}>
      <View style={styles.bar}>
        {/* The lit top edge of the capsule. Light falls on a real object from
            above; without this the bar is a flat rectangle of dark paint. */}
        <View style={styles.barSheen} pointerEvents="none" />

        <View style={styles.row} onLayout={(e) => setInnerWidth(e.nativeEvent.layout.width)}>
          {/* One indicator, travelling. Rendered only once the row has been
              measured and only with somewhere to travel — `interpolate` needs a
              strictly increasing input range, so a single tab would throw. */}
          {itemWidth > 0 && count > 1 ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.indicator,
                {
                  width: itemWidth - INDICATOR_INSET * 2,
                  transform: [
                    {
                      translateX: slide.interpolate({
                        inputRange: state.routes.map((_, i) => i),
                        outputRange: state.routes.map(
                          (_, i) => slotOf(i) * itemWidth + INDICATOR_INSET,
                        ),
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.indicatorSheen} />
            </Animated.View>
          ) : null}

          {slots.map((slot) => {
            if (slot === null) return <View key="action-slot" style={styles.item} />;
            const { route, index } = slot;
            const { options } = descriptors[route.key];
            const focused = state.index === index;
            const title = options.title ?? route.name;
            const label =
              typeof options.tabBarAccessibilityLabel === 'string'
                ? options.tabBarAccessibilityLabel
                : title;

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
                title={title}
                accessibilityLabel={label}
                onPress={onPress}
              />
            );
          })}
        </View>
      </View>

      {action && itemWidth > 0 ? (
        <PressableScale
          onPress={action.onPress}
          haptic="press"
          activeScale={0.94}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          accessibilityHint={action.accessibilityHint}
          style={StyleSheet.flatten([
            styles.action,
            {
              // Centred on its own empty slot rather than on the bar, so it
              // stays put if the number of tabs ever changes.
              left: spacing.xs + actionSlot * itemWidth + itemWidth / 2 - ACTION_SIZE / 2,
            },
          ])}
        >
          <Ionicons name={action.icon} size={26} color={colors.onFill} />
        </PressableScale>
      ) : null}
      </View>
    </View>
  );
}

function TabItem({
  icon,
  focused,
  title,
  accessibilityLabel,
  onPress,
}: {
  icon: React.ReactNode;
  focused: boolean;
  title: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  // One driver for the icon's lift and the label's brightening, so the two can
  // never disagree mid-transition. The indicator has its own, shared, driver —
  // it belongs to the bar, not to any one tab.
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
      accessibilityLabel={accessibilityLabel}
      style={styles.item}
      hitSlop={6}
    >
      <Animated.View
        style={{
          transform: [
            { translateY: active.interpolate({ inputRange: [0, 1], outputRange: [0, -1] }) },
            { scale: active.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
          ],
        }}
      >
        {icon}
      </Animated.View>
      {/* iOS names its tabs. The label is small and quiet until selected, so it
          reads as a caption on the icon rather than as a second row of chrome. */}
      <Animated.View style={{ opacity: active.interpolate({ inputRange: [0, 1], outputRange: [0.62, 1] }) }}>
        <Text
          variant="label"
          numberOfLines={1}
          style={styles.label}
          color={focused ? colors.fg : colors.fgMute}
        >
          {title}
        </Text>
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

/** Diameter of the raised centre action, and how far it breaks the bar's edge. */
const ACTION_SIZE = 54;
const ACTION_LIFT = 12;

const styles = StyleSheet.create({
  barWrap: {
    position: 'relative',
  },
  action: {
    position: 'absolute',
    bottom: (tabBar.height - ACTION_SIZE) / 2 + ACTION_LIFT,
    width: ACTION_SIZE,
    height: ACTION_SIZE,
    borderRadius: ACTION_SIZE / 2,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: alpha(colors.onFill, 0.18),
    ...glow(colors.accent, 0.5, 20),
  },
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bar: {
    height: tabBar.height,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    borderWidth: 1,
    borderColor: colors.inkEdge,
    paddingHorizontal: spacing.xs,
    overflow: 'hidden',
    ...elevation.mid,
  },
  barSheen: {
    position: 'absolute',
    top: 0,
    left: '8%',
    right: '8%',
    height: 1,
    backgroundColor: alpha(colors.fg, 0.14),
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  item: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    fontSize: fontSize.xs - 1,
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  indicator: {
    position: 'absolute',
    left: 0,
    top: INDICATOR_INSET,
    bottom: INDICATOR_INSET,
    borderRadius: radius.pill,
    backgroundColor: alpha(colors.accent, 0.26),
    borderWidth: 1,
    borderColor: alpha(colors.accentSoft, 0.34),
    overflow: 'hidden',
  },
  // A brighter band across the top half: the glass catches the light that the
  // capsule's own edge is catching, so the two read as the same material.
  indicatorSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '52%',
    backgroundColor: alpha(colors.fg, 0.06),
  },
});
