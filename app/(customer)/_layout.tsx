import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FloatingTabBar } from '../../src/components';
import { colors } from '../../src/theme';

/**
 * The signed-in app: four destinations and one action.
 *
 * Home is where you are, Shades is the catalogue, Library is what you have made
 * and Account is you. The raised button in the middle of the bar starts a room.
 *
 * The design this came from had five tabs, with "Studio" among them pointing at
 * the colour step of a project. That cannot be a tab: with three rooms on the go
 * it does not know which one to open, and with none it has nothing to show. It
 * is the app's primary verb, so it is drawn as a button — see the note in
 * FloatingTabBar.
 *
 * The room flow itself lives outside these tabs, in its own stack, because it is
 * a five-step job on a photograph that wants the whole screen. A wizard with a
 * tab bar under it invites you to wander off in the middle of it and lose your
 * place — and the design's own camera step hid the bar anyway, so the rail was
 * already inconsistent about it.
 */
export default function CustomerTabsLayout() {
  const router = useRouter();

  return (
    <Tabs
      // The bar floats over the scene, so the scene keeps the full height and
      // screens reserve their own room for it via `<Screen tabBar>`.
      tabBar={(props) => (
        <FloatingTabBar
          {...props}
          action={{
            label: 'Start a room',
            icon: 'camera',
            accessibilityHint: 'Photograph a room and try shades on its walls',
            onPress: () => router.push('/studio/new'),
          }}
        />
      )}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="shades"
        options={{
          title: 'Shades',
          tabBarIcon: ({ color, size }) => <Ionicons name="color-palette" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarIcon: ({ color, size }) => <Ionicons name="albums" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
