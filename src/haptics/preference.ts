import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setHapticsEnabled } from './index';

/**
 * Persistence for the haptics on/off preference.
 *
 * Vibration is not universally welcome — some people find it unpleasant, and on
 * an older Android it can be loud enough to be socially awkward at a shop
 * counter. Since the redesign puts haptics on essentially every control, the
 * app owes the user a way to turn them off, and it has to survive a restart or
 * it is not really a setting.
 */

const KEY = 'huevista.haptics.enabled';

/**
 * Restore the stored preference into the haptics module. Call once, from the
 * root layout, before the first screen can be tapped. Defaults to on when
 * nothing is stored or storage is unreadable — the feature is opt-out.
 */
export async function loadHapticsPreference(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw !== null) setHapticsEnabled(raw === 'true');
  } catch {
    // A device with no readable storage still gets working haptics.
  }
}

/**
 * Bound state for the settings row. Applies the change immediately, then
 * persists — the switch must never wait on disk to move.
 */
export function useHapticsPreference(): [boolean, (next: boolean) => void] {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (active && raw !== null) setEnabled(raw === 'true');
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const update = useCallback((next: boolean) => {
    setEnabled(next);
    setHapticsEnabled(next);
    AsyncStorage.setItem(KEY, String(next)).catch(() => {});
  }, []);

  return [enabled, update];
}
