import { useCallback, useEffect, useState } from 'react';
import { Skia, rect, type SkImage } from '@shopify/react-native-skia';
import { isApiOriginUrl } from '../api/config';
import { tokenStore } from '../auth/tokenStore';

/**
 * Longest edge, in pixels, that a decoded photo or mask is allowed to keep.
 *
 * A phone camera shoots around 12 MP. Decoded to RGBA that is a ~48 MB texture,
 * and a room with three walls holds the photo plus three masks of the same
 * dimensions — roughly 190 MB of graphics memory for one screen. None of it buys
 * anything: the canvas is at most a few hundred points wide, so even at 3× pixel
 * density the photo is being drawn at under a fifth of the resolution it is
 * being stored at.
 *
 * 1600 matches MASK_MAX_EDGE, which is the size masks drawn on-device are
 * already rasterized at, so a downloaded mask and a locally drawn one now agree.
 */
const DECODE_MAX_EDGE = 1600;

/**
 * Shrink a decoded image so its longest edge fits DECODE_MAX_EDGE.
 *
 * Skia decodes at native size and offers no "decode to bounds", so the oversized
 * image has to exist for a moment before it can be replaced. The original is
 * disposed straight afterwards rather than left for the collector, which is the
 * whole point — holding both is exactly the peak this is meant to avoid.
 *
 * Returns the original when it is already small enough, or when the device
 * refuses an offscreen surface. Falling back to the full-size image is right:
 * a heavy picture beats no picture.
 */
function downscale(image: SkImage): SkImage {
  const w = image.width();
  const h = image.height();
  const longest = Math.max(w, h);
  if (!(longest > DECODE_MAX_EDGE)) return image;

  const scale = DECODE_MAX_EDGE / longest;
  const targetW = Math.max(1, Math.round(w * scale));
  const targetH = Math.max(1, Math.round(h * scale));

  const surface = Skia.Surface.MakeOffscreen(targetW, targetH);
  if (!surface) return image;

  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  surface
    .getCanvas()
    .drawImageRect(image, rect(0, 0, w, h), rect(0, 0, targetW, targetH), paint);

  const scaled = surface.makeImageSnapshot();
  if (!scaled) return image;

  (image as unknown as { dispose?: () => void }).dispose?.();
  return scaled;
}

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
  const image = Skia.Image.MakeImageFromEncoded(data);
  return image ? downscale(image) : null;
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

/**
 * How many decoded masks to keep alive at once.
 *
 * Every entry is a GPU-backed texture the size of the room photo, so this is a
 * VRAM budget, not a convenience cache. Two rooms' worth of walls is enough to
 * make going back and forth feel instant without letting a long session
 * accumulate every mask it has ever seen — which is how the renderer ran the
 * device out of graphics memory.
 */
const MASK_CACHE_LIMIT = 12;

/** Decoded masks, in insertion order so the oldest is the one evicted. */
const maskCache = new Map<string, SkImage>();

function cacheMask(url: string, image: SkImage) {
  maskCache.set(url, image);
  while (maskCache.size > MASK_CACHE_LIMIT) {
    const oldest = maskCache.keys().next();
    if (oldest.done) break;
    const evicted = maskCache.get(oldest.value);
    maskCache.delete(oldest.value);
    // Skia images hold native memory that GC will not reclaim promptly. Older
    // versions of the binding have no dispose(), hence the guard.
    (evicted as unknown as { dispose?: () => void })?.dispose?.();
  }
}

/**
 * Load several authed images at once, sharing one bounded cache.
 *
 * The editor draws one mask per painted wall. Loading them through a hook *per
 * layer* — which is what a component-per-layer forced — meant a component tree
 * whose shape changed with the number of walls, and a fresh decode of every
 * mask whenever that number moved. Taking the whole list at once keeps the tree
 * flat, lets a wall that is already decoded render immediately, and puts a
 * ceiling on how much texture memory the screen can be holding.
 *
 * Returns an array positionally matching `urls`; entries are null until decoded,
 * so walls appear as they arrive rather than all-or-nothing.
 */
export function useAuthedSkImages(urls: readonly string[]): (SkImage | null)[] {
  const key = urls.join('\n');
  const [, bump] = useState(0);

  useEffect(() => {
    const missing = urls.filter((u) => !maskCache.has(u));
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(
      missing.map(async (url) => {
        try {
          const image = await fetchSkImage(url);
          if (image) cacheMask(url, image);
        } catch {
          // A mask that will not load simply leaves that wall unpainted; the
          // photo underneath is still correct, so there is nothing to report.
        }
      }),
    ).then(() => {
      if (!cancelled) bump((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
    // `key` stands in for the URL list; re-running on identity alone would
    // refetch on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return urls.map((u) => maskCache.get(u) ?? null);
}
