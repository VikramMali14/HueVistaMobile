import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../src/theme';

/**
 * The admin's app.
 *
 * Admins used to be routed into the RETAILER navigator — they landed on a shop
 * counter that was not their shop, with a plan meter reading zero and codes they
 * could not issue, and no dashboard or studio anywhere. The reasoning was that
 * admin tools stay on the website (PLAN.md §2.4), which is still true: nothing
 * here provisions a shop, changes a role or grants a plan. But "the console is
 * on the web" is not a reason to hand an admin someone else's screen.
 *
 * So this group is deliberately narrow — see the platform, and paint a room:
 *   Dashboard  what the platform is doing right now (read-only)
 *   Studio     the same visualizer every other role gets
 *   Shades     the catalogue
 *   Account    verification, password, support, sign out
 */
export default function AdminTabsLayout() {
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
        name="admin-dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="admin-studio"
        options={{
          title: 'Studio',
          tabBarIcon: ({ color, size }) => <Ionicons name="sparkles" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="admin-shades"
        options={{
          title: 'Shades',
          tabBarIcon: ({ color, size }) => <Ionicons name="color-palette" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="admin-account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
