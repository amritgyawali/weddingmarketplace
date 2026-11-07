import * as Linking from 'expo-linking';
import { Share } from 'react-native';

import { toastError } from '@/components/ui/Toast';
import { isSafeLink } from '@/utils/safeUrl';

/** Public web origin for couple websites and RSVP pages (served by the web build). */
export const WEB_ORIGIN = 'https://vivah.app';

export const webUrl = (path: string) => `${WEB_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;

/** Deep link into the app (exp:// in Expo Go, vivah:// in builds). */
export const appUrl = (path: string) => Linking.createURL(path);

export const rsvpPath = (code: string) => `/rsvp/${code}`;
export const sitePath = (slug: string) => `/w/${slug}`;

/** Native share sheet with a WhatsApp-friendly message. */
export async function shareMessage(message: string, url?: string) {
  try {
    await Share.share(url ? { message: `${message}\n${url}`, url } : { message });
  } catch {
    // Dismissed or unavailable — nothing to do.
  }
}

/** Opens WhatsApp with a prefilled message (optionally to one Nepali number). */
export function openWhatsApp(message: string, phone?: string) {
  const to = phone ? phone.replace(/\D/g, '').slice(-10) : '';
  const url = `https://wa.me/${to ? `977${to}` : ''}?text=${encodeURIComponent(message)}`;
  return Linking.openURL(url).catch(() => shareMessage(message));
}

/** Opens the SMS composer with a prefilled body. */
export function openSms(message: string, phone?: string) {
  const to = phone ? phone.replace(/\D/g, '').slice(-10) : '';
  return Linking.openURL(`sms:${to}?body=${encodeURIComponent(message)}`).catch(() => shareMessage(message));
}

/**
 * Opens a link that came from someone's data (a delivery link, a registry
 * wishlist, a shared file, a banner) only when its scheme is safe
 * (`isSafeLink`); anything else, such as `javascript:`, is refused with a
 * toast. Resolves to whether the link was opened.
 */
export async function openSafeLink(url: string | undefined | null, opts: { files?: boolean } = {}): Promise<boolean> {
  if (!isSafeLink(url, opts)) {
    toastError('This link can’t be opened safely');
    return false;
  }
  try {
    await Linking.openURL(url.trim());
    return true;
  } catch {
    toastError('This link can’t be opened safely');
    return false;
  }
}
