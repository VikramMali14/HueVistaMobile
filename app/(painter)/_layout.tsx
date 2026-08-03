import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FloatingTabBar } from '../../src/components';
import { colors } from '../../src/theme';

/**
 * The painter's app: the work, the tool, the account.
 *
 * A painter gets the same Studio a customer does — they are often the one
 * standing in the room when the customer changes their mind — so it is a
 * first-class tab here rather than something reached through a shop.
 */
export default function PainterTabsLayout() {
  return (
    <Tabs
      // The bar floats over the scene, so the scene keeps the full height and
      // screens reserve their own room for it via `<Screen tabBar>`.
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
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
        name="painter-studio"
        options={{
          title: 'Studio',
          tabBarIcon: ({ color, size }) => <Ionicons name="sparkles" size={size} color={color} />,
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
