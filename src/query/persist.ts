import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';

/**
 * Offline catalogue cache (PLAN.md §6). The shade catalogue rarely changes and is
 * expensive to refetch, so we persist those queries to the device (AsyncStorage)
 * and rehydrate on launch — the library works offline after the first load.
 *
 * Only shade queries are persisted; auth/session and any user-specific data are
 * deliberately excluded so nothing sensitive is written to disk.
 */
const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'huevista.query-cache',
});

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister: asyncStoragePersister,
  maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  buster: 'v1', // bump to invalidate all persisted caches on a breaking change
  dehydrateOptions: {
    shouldDehydrateQuery: (query) =>
      query.state.status === 'success' && query.queryKey[0] === 'shades',
  },
};
