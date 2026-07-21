import { apiFetch } from './client';
import { imageResponseSchema, ImageResponse } from './projectSchemas';

/** A local image ready to upload (from the camera or the gallery picker). */
export interface LocalImage {
  uri: string;
  /** File name, e.g. "room.jpg". */
  name?: string;
  /** MIME type, e.g. "image/jpeg". */
  mimeType?: string;
}

function guessName(uri: string, fallback: string): string {
  const last = uri.split('/').pop();
  return last && last.includes('.') ? last : fallback;
}

function guessType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

export const imagesApi = {
  /**
   * Upload + classify a room/exterior photo. The backend runs vision
   * classification and rejects non-room images with 422 (surfaced as an
   * ApiError the caller can message). Max 10 MB, JPEG/PNG/WebP.
   */
  upload(image: LocalImage): Promise<ImageResponse> {
    const name = image.name ?? guessName(image.uri, 'photo.jpg');
    const type = image.mimeType ?? guessType(name);
    const form = new FormData();
    // React Native's FormData takes a { uri, name, type } file part.
    form.append('file', { uri: image.uri, name, type } as unknown as Blob);
    return apiFetch('/images/upload', { method: 'POST', body: form as unknown as BodyInit }).then((d) =>
      imageResponseSchema.parse(d),
    );
  },

  get(imageId: string): Promise<ImageResponse> {
    return apiFetch(`/images/${encodeURIComponent(imageId)}`).then((d) => imageResponseSchema.parse(d));
  },
};
