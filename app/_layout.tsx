import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import * as SystemUI from 'expo-system-ui';

import { colors, fontMap } from '../src/theme';
import { SessionProvider } from '../src/auth';
import { queryClient } from '../src/query/client';

/**
 * Root layout. Loads fonts, sets the dark system background, and wraps the whole
 * app in the query, session and safe-area providers. The role-based tab
 * navigators (customer / retailer / painter / distributor) mount under the auth
 * gate in Phase 1 — for now a single index route renders.
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
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
              animation: 'fade',
            }}
          />
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
