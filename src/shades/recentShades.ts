import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Shade } from './types';

/**
 * The colours this person actually works with, most recent first.
 *
 * Paint work is repetitive in a way the catalogue does not reflect: a painter
 * puts the same three whites on ceilings all week, and a customer comparing two
 * shades taps between them a dozen times. Making them search a 9,500-shade
 * catalogue for a colour they used ninety seconds ago is the single most
 * annoying thing the picker could do.
 *
 * Stored locally rather than on the account: this is a convenience list, not
 * data worth a round trip, and it should work with no signal at a site.
 */

const KEY = 'huevista.shades.recent';
const MAX = 12;

/** Same shade code from the same company — names and hexes can be re-cased. */
function sameShade(a: Shade, b: Shade): boolean {
  return a.code === b.code && (a.brandSlug ?? a.brand) === (b.brandSlug ?? b.brand);
}

async function read(): Promise<Shade[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Written by an older build, or hand-edited: keep only usable entries
    // rather than handing the tray something with no colour to paint.
    return parsed.filter(
      (s): s is Shade =>
        !!s && typeof s === 'object' && typeof (s as Shade).code === 'string' && typeof (s as Shade).hex === 'string',
    );
  } catch {
    return [];
  }
}

export function useRecentShades(): {
  recent: Shade[];
  remember: (shade: Shade) => void;
} {
  const [recent, setRecent] = useState<Shade[]>([]);

  useEffect(() => {
    let active = true;
    read().then((list) => {
      if (active) setRecent(list);
    });
    return () => {
      active = false;
    };
  }, []);

  const remember = useCallback((shade: Shade) => {
    setRecent((prev) => {
      const next = [shade, ...prev.filter((s) => !sameShade(s, shade))].slice(0, MAX);
      // Fire-and-forget: the list is already correct on screen, and a failed
      // write costs the user nothing but a lost convenience next launch.
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return { recent, remember };
}
