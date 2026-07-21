import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api';

/**
 * Shared React Query client. Sensible mobile defaults: don't hammer the network,
 * and never retry a 4xx (auth/validation failures won't fix themselves).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
