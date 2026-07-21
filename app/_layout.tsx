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

/**
 * Redirect the user to the right area whenever auth state resolves or changes:
 *   unauthenticated              → /welcome (unless already in the auth group)
 *   authenticated + CUSTOMER     → /home    (the customer tabs)
 *   authenticated + other role   → /coming-soon (retailer/painter/distributor land in Phase 2/3)
 * Once inside their area the user navigates freely; this only fires on the
 * boundary (auth group or the initial index route), so there are no loops.
 */
function useAuthGate() {
  const { status, role } = useSession();
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
    // authenticated
    if (inAuthGroup || root === undefined) {
      router.replace(role === 'CUSTOMER' ? '/home' : '/coming-soon');
    }
  }, [status, role, segments, router]);
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
