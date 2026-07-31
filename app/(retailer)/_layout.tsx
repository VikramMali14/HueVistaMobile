import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../src/theme';
import { useMyAccess } from '../../src/account/roleQueries';

/**
 * The shop's counter.
 *
 * A distributor can switch pages off for the shops it supplies, so two tabs are
 * conditional: Codes is the customer portal, Shades is the catalogue. The grant
 * is expressed as the WEBSITE paths each feature gates — that string is the
 * contract between the two clients — so the app maps those paths to its own tabs
 * rather than keeping a second list that would drift from the one the backend
 * enforces.
 *
 * A grant that fails to load reads as unrestricted, the same way the website
 * treats it: a backend hiccup must not strip a shop's own tabs.
 */
export default function RetailerTabsLayout() {
  const access = useMyAccess().data;
  const restricted = access?.featuresRestricted ?? false;
  const paths = access?.allowedPaths ?? [];
  const can = (path: string) => !restricted || paths.includes(path);

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
        name="counter"
        options={{
          title: 'Counter',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="codes"
        options={{
          title: 'Codes',
          href: can('/portal') ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="ticket" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: 'Customers',
          href: can('/portal') ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          tabBarIcon: ({ color, size }) => <Ionicons name="card" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="shop-account"
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
