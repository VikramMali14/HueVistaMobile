/**
 * API origin resolution. `EXPO_PUBLIC_*` vars are inlined into the bundle at
 * build time by Expo, so this is safe to read on-device.
 *
 * Point a dev build at your machine by setting EXPO_PUBLIC_API_ORIGIN in
 * `.env` (see .env.example). On a physical device, use your LAN IP, not
 * localhost — the phone can't reach the laptop's loopback.
 */
export const API_ORIGIN = (process.env.EXPO_PUBLIC_API_ORIGIN ?? 'http://localhost:8080').replace(/\/+$/, '');

/** Prefix for all backend routes (they all live under /api — see PLAN.md §5). */
export const API_BASE = `${API_ORIGIN}/api`;
