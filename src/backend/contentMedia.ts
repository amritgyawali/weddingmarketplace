/**
 * Where a photo a super admin picks for the app (Content studio) is kept, so
 * it can be shown again later:
 *
 *   - Supabase builds with Cloudinary: uploaded through `media-sign`, stored
 *     as a web address, so every device shows it;
 *   - the demo on a phone: copied into the app's documents folder and stored
 *     as `vivah-file://name.jpg` (this device only);
 *   - the demo in a browser: kept inline when it is small; larger photos need
 *     a link, because a browser has nowhere durable to keep a file.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { LOCAL_IMAGE_SCHEME, MAX_INLINE_IMAGE } from '@/services/content';
import { LOCAL_IMAGE_DIR } from '@/utils/localImage';

import { cloudinaryUrl, cloudMediaReady, type UploadInput, uploadMedia, uploadToCloud } from './media';
import { failResult, okResult, type Result } from './types';

/** True when a picked photo reaches every device, not only this one. */
export const contentImagesShared = cloudMediaReady;

const extensionOf = (file: UploadInput) => {
  const fromName = /\.(jpe?g|png|webp|gif|heic)$/i.exec(file.fileName ?? file.uri)?.[1];
  return (fromName ?? (file.mimeType?.split('/')[1] || 'jpg')).toLowerCase();
};

async function inline(uri: string): Promise<Result<string>> {
  if (uri.startsWith('data:image/')) return uri.length <= MAX_INLINE_IMAGE ? okResult(uri) : failResult('That photo is too large to keep in the browser. Paste a link to it instead, or pick one under 300 KB.');
  try {
    const blob = await (await fetch(uri)).blob();
    if (blob.size > MAX_INLINE_IMAGE * 0.74) return failResult('That photo is too large to keep in the browser. Paste a link to it instead, or pick one under 300 KB.');
    return await new Promise<Result<string>>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? okResult(reader.result) : failResult('Couldn’t read that photo'));
      reader.onerror = () => resolve(failResult('Couldn’t read that photo'));
      reader.readAsDataURL(blob);
    });
  } catch {
    return failResult('Couldn’t read that photo');
  }
}

/** Keeps a picked photo and returns the address to store for it. */
export async function keepContentImage(file: UploadInput): Promise<Result<string>> {
  if (cloudMediaReady()) {
    const up = await uploadToCloud(file, 'idea');
    return up.ok ? okResult(cloudinaryUrl(up.value.publicId, 't_full')) : up;
  }
  if (Platform.OS === 'web') return inline(file.uri);
  try {
    const dir = new Directory(Paths.document, LOCAL_IMAGE_DIR);
    if (!dir.exists) dir.create({ intermediates: true });
    const name = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.${extensionOf(file)}`;
    new File(file.uri).copy(new File(dir, name));
    return okResult(LOCAL_IMAGE_SCHEME + name);
  } catch {
    return failResult('Couldn’t save that photo on this phone. Try another, or paste a link.');
  }
}

/**
 * Keeps a profile photo someone picked on Edit profile. Supabase builds with
 * Cloudinary upload it as the account's avatar (rpc_register_media sets
 * profiles.avatar_url); the demo keeps it on this device like a content photo.
 */
export async function keepProfilePhoto(file: UploadInput): Promise<Result<string>> {
  if (cloudMediaReady()) {
    const up = await uploadMedia(file, 'avatar');
    return up.ok ? okResult(up.value.url) : up;
  }
  return keepContentImage(file);
}
