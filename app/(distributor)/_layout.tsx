import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FloatingTabBar } from '../../src/components';
import { colors } from '../../src/theme';

/**
 * The distributor's app.
 *
 * No Studio tab, deliberately — a distributor sells to shops rather than
 * painting rooms, and the website hides the studio from them for the same
 * reason. What they need is the network: who is under them, how each shop is
 * doing, and what each one is allowed to reach.
 */
export default function DistributorTabsLayout() {
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
        name="network"
        options={{
          title: 'Network',
          tabBarIcon: ({ color, size }) => <Ionicons name="git-network" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="distributor-account"
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
