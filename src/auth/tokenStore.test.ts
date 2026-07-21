import { tokenStore } from './tokenStore';

// jest.mock is hoisted above imports by babel-plugin-jest-hoist, so the mock is
// in place before ./tokenStore pulls in expo-secure-store.
jest.mock('expo-secure-store', () => {
  const store: Record<string, string> = {};
  return {
    getItemAsync: jest.fn(async (k: string) => (k in store ? store[k] : null)),
    setItemAsync: jest.fn(async (k: string, v: string) => {
      store[k] = v;
    }),
    deleteItemAsync: jest.fn(async (k: string) => {
      delete store[k];
    }),
  };
});

describe('tokenStore', () => {
  afterEach(async () => {
    await tokenStore.clear();
  });

  it('holds the access token in memory only', () => {
    expect(tokenStore.getAccessToken()).toBeNull();
    tokenStore.setAccessToken('access-1');
    expect(tokenStore.getAccessToken()).toBe('access-1');
  });

  it('persists the refresh token and reads it back', async () => {
    await tokenStore.setRefreshToken('refresh-1');
    expect(await tokenStore.getRefreshToken()).toBe('refresh-1');
  });

  it('clear() wipes both tokens', async () => {
    tokenStore.setAccessToken('access-2');
    await tokenStore.setRefreshToken('refresh-2');
    await tokenStore.clear();
    expect(tokenStore.getAccessToken()).toBeNull();
    expect(await tokenStore.getRefreshToken()).toBeNull();
  });
});
