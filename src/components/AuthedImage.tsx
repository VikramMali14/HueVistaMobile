import { Image, ImageProps } from 'expo-image';
import { resolveImageUrl } from '../api/config';
import { tokenStore } from '../auth/tokenStore';

export interface AuthedImageProps extends Omit<ImageProps, 'source'> {
  /** Backend image URL (absolute or origin-relative). Loaded with the bearer token. */
  url?: string | null;
}

/**
 * expo-image that attaches the access token, for the auth-gated image + mask
 * endpoints. Use for thumbnails/previews; the recolor canvas uses the Skia
 * loader (`useAuthedSkImage`) instead.
 */
export function AuthedImage({ url, ...props }: AuthedImageProps) {
  const resolved = resolveImageUrl(url);
  const token = tokenStore.getAccessToken();
  return (
    <Image
      {...props}
      source={resolved ? { uri: resolved, headers: token ? { Authorization: `Bearer ${token}` } : undefined } : undefined}
    />
  );
}
