import { useCallback, useEffect, useState } from 'react';
import { Skia, type SkImage } from '@shopify/react-native-skia';
import { isApiOriginUrl } from '../api/config';
import { tokenStore } from '../auth/tokenStore';

async function fetchSkImage(url: string): Promise<SkImage | null> {
  // Only our own API is auth-gated. An S3 presigned URL carries its signature in
  // the query string and answers 400 if an Authorization header comes with it —
  // see isApiOriginUrl for why this distinction has to be made per URL.
  const token = isApiOriginUrl(url) ? tokenStore.getAccessToken() : null;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`image request failed: ${res.status}`);
  const buffer = await res.arrayBuffer();
  const data = Skia.Data.fromBytes(new Uint8Array(buffer));
  return Skia.Image.MakeImageFromEncoded(data);
}

/** Where a remote image load has got to. */
export type ImageLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface AuthedSkImageState {
  /** The decoded image, or null unless `status` is 'ready'. */
  image: SkImage | null;
  status: ImageLoadStatus;
  /**
   * Try again. Worth offering rather than only reporting: the two likeliest
   * causes — a presigned URL that has aged out, and a phone that lost signal
   * mid-request — both clear on a retry.
   */
  reload: () => void;
}

/**
 * Load a remote image into an SkImage with the access token attached when the
 * URL is ours, reporting how it went.
 *
 * A failure used to be indistinguishable from "still loading", because the hook
 * returned null for both: the editor then showed its spinner over a photo that
 * was never going to arrive. Callers that can act on a failure should use this
 * hook; `useAuthedSkImage` stays for the ones that just want the image.
 */
export function useAuthedSkImageState(url: string | null): AuthedSkImageState {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; image: SkImage | null; failed: boolean } | null>(null);

  /**
   * What the stored result belongs to. Both halves matter: the URL, so a stale
   * response for a previous photo is ignored, and the attempt, so a retry of the
   * SAME URL reads as loading again instead of showing the old failure. Keeping
   * this derived is also what lets the effect stay free of a synchronous reset.
   */
  const key = url === null ? null : `${attempt}:${url}`;

  useEffect(() => {
    if (url === null || key === null) return;
    let cancelled = false;
    fetchSkImage(url)
      .then((image) => {
        // A decode that yields no image is a failure too — an HTML error page
        // served with a 200, or a format Skia can't read.
        if (!cancelled) setResult({ key, image, failed: image === null });
      })
      .catch(() => {
        if (!cancelled) setResult({ key, image: null, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [url, key]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  if (url === null) return { image: null, status: 'idle', reload };
  if (result === null || result.key !== key) return { image: null, status: 'loading', reload };
  if (result.failed) return { image: null, status: 'error', reload };
  return { image: result.image, status: 'ready', reload };
}

/**
 * Load a remote image into an SkImage with the access token attached. Returns
 * null while loading or on failure. Reloads when the URL changes; a stale
 * response for a previous URL is ignored.
 */
export function useAuthedSkImage(url: string | null): SkImage | null {
  return useAuthedSkImageState(url).image;
}
