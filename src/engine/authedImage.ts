import { useEffect, useState } from 'react';
import { Skia, type SkImage } from '@shopify/react-native-skia';
import { tokenStore } from '../auth/tokenStore';

async function fetchSkImage(url: string): Promise<SkImage | null> {
  const token = tokenStore.getAccessToken();
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`image request failed: ${res.status}`);
  const buffer = await res.arrayBuffer();
  const data = Skia.Data.fromBytes(new Uint8Array(buffer));
  return Skia.Image.MakeImageFromEncoded(data);
}

/**
 * Load a remote image into an SkImage with the access token attached. Returns
 * null while loading or on failure. Reloads when the URL changes; a stale
 * response for a previous URL is ignored.
 */
export function useAuthedSkImage(url: string | null): SkImage | null {
  const [loaded, setLoaded] = useState<{ url: string; img: SkImage | null } | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    fetchSkImage(url)
      .then((img) => {
        if (!cancelled) setLoaded({ url, img });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ url, img: null });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return loaded && loaded.url === url ? loaded.img : null;
}
