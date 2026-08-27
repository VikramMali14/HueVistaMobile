import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Shade } from './types';

/**
 * Shades this person deliberately kept.
 *
 * Distinct from `recentShades`, which remembers what you touched: this is what
 * you chose to hold on to, and it does not fall off the end of a list of twelve.
 *
 * It lives on the device rather than on the account, because the backend has no
 * saved-shade endpoint — the catalogue is read-only and nothing in the API
 * carries a per-user shade list. The design showed a "Saved shades" shelf in the
 * library, and this is the honest version of it: real, immediate, works with no
 * signal at a counter, and clearly described in the UI as being on this phone.
 * If a server-side list ever lands, this hook is the seam to swap.
 */

const KEY = 'huevista.shades.saved';

/** Same shade code from the same company — names and hexes can be re-cased. */
function sameShade(a: Shade, b: Shade): boolean {
  return a.code === b.code && (a.brandSlug ?? a.brand) === (b.brandSlug ?? b.brand);
}

/** Stable identity for a shade, for list keys and membership checks. */
export function shadeKey(shade: Shade): string {
  return `${shade.brandSlug ?? shade.brand}:${shade.code}`;
}

async function read(): Promise<Shade[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Written by an older build, or hand-edited: keep only usable entries
    // rather than handing a grid something with no colour to draw.
    return parsed.filter(
      (s): s is Shade =>
        !!s &&
        typeof s === 'object' &&
        typeof (s as Shade).code === 'string' &&
        typeof (s as Shade).hex === 'string',
    );
  } catch {
    return [];
  }
}

export function useSavedShades(): {
  saved: Shade[];
  loading: boolean;
  isSaved: (shade: Shade) => boolean;
  toggle: (shade: Shade) => void;
  remove: (shade: Shade) => void;
} {
  const [saved, setSaved] = useState<Shade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    read().then((list) => {
      if (!active) return;
      setSaved(list);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  /** Fire-and-forget: the list is already correct on screen. */
  const persist = (next: Shade[]) => {
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
    return next;
  };

  const toggle = useCallback((shade: Shade) => {
    setSaved((prev) =>
      persist(
        prev.some((s) => sameShade(s, shade))
          ? prev.filter((s) => !sameShade(s, shade))
          : [shade, ...prev],
      ),
    );
  }, []);

  const remove = useCallback((shade: Shade) => {
    setSaved((prev) => persist(prev.filter((s) => !sameShade(s, shade))));
  }, []);

  const isSaved = useCallback(
    (shade: Shade) => saved.some((s) => sameShade(s, shade)),
    [saved],
  );

  return { saved, loading, isSaved, toggle, remove };
}
