import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import * as SystemUI from 'expo-system-ui';

import { colors, fontMap } from '../src/theme';
import { SessionProvider, useSession } from '../src/auth';
import { queryClient } from '../src/query/client';
import { persistOptions } from '../src/query/persist';
import { loadHapticsPreference } from '../src/haptics/preference';

/**
 * Send the user to the right half of the app whenever auth resolves or changes:
 *
 *   unauthenticated → /welcome, unless they are already somewhere in `(auth)`
 *   authenticated   → /home
 *
 * There is one destination now. The app used to be five apps in a trench coat —
 * a shop counter, a painter's job list, a distributor network and an admin
 * console rode along with the customer's, and this gate picked between them by
 * role. All of that runs on the web, where it belongs: a phone in a customer's
 * hand is for seeing a wall in a colour, and everything else was weight.
 *
 * A non-customer account that signs in here still gets the customer app, which
 * is the honest outcome — the screens their role needs are simply not in this
 * build, and they have a browser.
 *
 * The gate only fires on the boundary (the auth group, or the bare index
 * route), so navigation inside the app never re-triggers it and there are no
 * redirect loops.
 */
function useAuthGate() {
  const { status } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    const root = segments[0];
    const inAuthGroup = root === '(auth)';

    if (status === 'unauthenticated') {
      if (!inAuthGroup) router.replace('/welcome');
      return;
    }
    if (inAuthGroup || root === undefined) router.replace('/home');
  }, [status, segments, router]);
}

function RootNavigator() {
  useAuthGate();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'fade',
      }}
    />
  );
}

/**
 * Root layout. Loads fonts, sets the dark system background, and wraps the app
 * in the query, session and safe-area providers.
 */
export default function RootLayout() {
  const [fontsLoaded] = useFonts(fontMap);

  useEffect(() => {
    // Keep the OS chrome (Android nav bar, overscroll) on-brand.
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});
    // Restore "haptics off" before anything is tappable, so a user who turned
    // them off does not get one buzz per launch.
    loadHapticsPreference();
  }, []);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <SessionProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </SessionProvider>
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}
