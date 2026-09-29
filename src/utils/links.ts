import * as Linking from 'expo-linking';
import { Share } from 'react-native';

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
