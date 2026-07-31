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

import type { UserRole } from '../src/api/schemas';

/**
 * Where each role lands after signing in. One app for every role (PLAN §2.3):
 * the server says which one this account is, and the app mounts that role's tab
 * navigator.
 *
 * ADMIN is deliberately absent — admin tools stay on the web (§2.4) — so an
 * admin signing in here gets the shop counter, which is the closest thing the
 * app has to what they came for and is never a dead end.
 */
const HOME_FOR_ROLE: Record<UserRole, string> = {
  CUSTOMER: '/home',
  RETAILER: '/counter',
  PAINTER: '/jobs',
  DISTRIBUTOR: '/network',
  ADMIN: '/counter',
};

/**
 * Redirect the user to the right area whenever auth state resolves or changes:
 *   unauthenticated  → /welcome (unless already in the auth group)
 *   authenticated    → that role's tab navigator (see HOME_FOR_ROLE)
 *
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
      router.replace((role && HOME_FOR_ROLE[role]) ?? '/coming-soon');
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
