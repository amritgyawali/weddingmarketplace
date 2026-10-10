import { Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { LOCAL_IMAGE_SCHEME } from '@/services/content';

/** Folder, inside the app's documents, for photos a super admin picked on this device. */
export const LOCAL_IMAGE_DIR = 'content';

/**
 * The address to load an image from. Photos kept on the device are stored as
 * `vivah-file://name.jpg` because the documents folder moves when the app is
 * updated; every other address is returned as it is.
 */
export function imageUri(address: string): string {
  if (!address.startsWith(LOCAL_IMAGE_SCHEME) || Platform.OS === 'web') return address;
  return `${Paths.document.uri.replace(/\/+$/, '')}/${LOCAL_IMAGE_DIR}/${address.slice(LOCAL_IMAGE_SCHEME.length)}`;
}
