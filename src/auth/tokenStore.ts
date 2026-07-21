import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Token storage. The access token lives only in memory (cleared on app kill);
 * the long-lived refresh token is persisted in the platform keystore via
 * expo-secure-store (Android Keystore / iOS Keychain) — the mobile equivalent of
 * the website's HttpOnly cookie (PLAN.md §5).
 *
 * On web (dev only) SecureStore is unavailable, so we fall back to an in-memory
 * value; web is not a shipping target.
 */
const REFRESH_KEY = 'huevista.refreshToken';
const useSecureStore = Platform.OS !== 'web';

let accessToken: string | null = null;
let webRefreshFallback: string | null = null;

export const tokenStore = {
  getAccessToken(): string | null {
    return accessToken;
  },

  setAccessToken(token: string | null): void {
    accessToken = token;
  },

  async getRefreshToken(): Promise<string | null> {
    if (!useSecureStore) return webRefreshFallback;
    return (await SecureStore.getItemAsync(REFRESH_KEY)) ?? null;
  },

  async setRefreshToken(token: string | null): Promise<void> {
    if (!useSecureStore) {
      webRefreshFallback = token;
      return;
    }
    if (token) {
      await SecureStore.setItemAsync(REFRESH_KEY, token);
    } else {
      await SecureStore.deleteItemAsync(REFRESH_KEY);
    }
  },

  /** Wipe both tokens (sign-out / auth failure). */
  async clear(): Promise<void> {
    accessToken = null;
    webRefreshFallback = null;
    if (useSecureStore) await SecureStore.deleteItemAsync(REFRESH_KEY);
  },
};
