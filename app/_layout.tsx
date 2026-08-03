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

import type { UserRole } from '../src/api/schemas';

/**
 * Where each role lands after signing in. One app for every role (PLAN §2.3):
 * the server says which one this account is, and the app mounts that role's tab
 * navigator.
 *
 * ADMIN used to land on `/counter` on the grounds that admin tools stay on the
 * web (§2.4). That rule still holds — nothing in `(admin)` provisions anything —
 * but the landing was wrong: it dropped an admin into a RETAILER navigator, so
 * they got a shop counter that was not their shop (no org, so an empty plan
 * meter and codes they cannot issue) and, because the retailer tab set has
 * neither, no dashboard and no studio anywhere in the app. They now get their
 * own group with both.
 */
const HOME_FOR_ROLE: Record<UserRole, string> = {
  CUSTOMER: '/home',
  RETAILER: '/counter',
  PAINTER: '/jobs',
  DISTRIBUTOR: '/network',
  ADMIN: '/admin-dashboard',
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
