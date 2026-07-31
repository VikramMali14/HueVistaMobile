import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../src/theme';

/**
 * The painter's app: the work, the tool, the account.
 *
 * A painter gets the same visualizer a shop does — they are often the one
 * standing in the room when the customer changes their mind — so Visualize is a
 * first-class tab here rather than something reached through a shop.
 */
export default function PainterTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accentSoft,
        tabBarInactiveTintColor: colors.fgMute,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.rule,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontFamily: fonts.heading, fontSize: 11 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ color, size }) => <Ionicons name="briefcase" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="painter-shades"
        options={{
          title: 'Shades',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="color-palette" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="painter-account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
