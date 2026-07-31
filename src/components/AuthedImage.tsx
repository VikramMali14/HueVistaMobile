import { Image, ImageProps } from 'expo-image';
import { isApiOriginUrl, resolveImageUrl } from '../api/config';
import { tokenStore } from '../auth/tokenStore';

export interface AuthedImageProps extends Omit<ImageProps, 'source'> {
  /** Backend image URL (absolute or origin-relative). Loaded with the bearer token. */
  url?: string | null;
}

/**
 * expo-image that attaches the access token, for the auth-gated image + mask
 * endpoints. Use for thumbnails/previews; the recolor canvas uses the Skia
 * loader (`useAuthedSkImage`) instead.
 *
 * The token is attached only when the URL is on our own API origin: an S3
 * presigned URL is already signed and answers 400 to a request that also sends
 * an Authorization header, which showed up as thumbnails that never appeared.
 */
export function AuthedImage({ url, ...props }: AuthedImageProps) {
  const resolved = resolveImageUrl(url);
  const token = isApiOriginUrl(resolved) ? tokenStore.getAccessToken() : null;
  return (
    <Image
      {...props}
      source={resolved ? { uri: resolved, headers: token ? { Authorization: `Bearer ${token}` } : undefined } : undefined}
    />
  );
}
