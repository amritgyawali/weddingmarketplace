/**
 * Which links typed by other people are safe to open. A vendor's delivery
 * link, a registry wishlist, a shared file or an admin banner comes from data
 * someone else wrote, so it could be `javascript:` (runs code in the web app),
 * `data:` (a fake page) or an `intent:` that launches another app. Only the
 * schemes below are opened. Pure, so Node tests can load it.
 */

/** Schemes any link may use: the web, email, phone, SMS and WhatsApp. */
export const SAFE_LINK_SCHEMES = ['https:', 'http:', 'mailto:', 'tel:', 'sms:', 'whatsapp:'] as const;

/** Extra schemes for files picked on this device (document picker, camera roll). */
export const DEVICE_FILE_SCHEMES = ['file:', 'content:', 'ph:', 'assets-library:'] as const;

/** The longest link we open; anything longer is refused rather than parsed. */
export const MAX_LINK_LENGTH = 2048;

/** The scheme of a link, lower-cased with its colon, or null when it has none. */
export function linkScheme(url: string): string | null {
  // Browsers ignore leading whitespace and control characters, and tabs or
  // newlines inside the scheme ("java\tscript:"), so strip them before judging.
  const cleaned = url.replace(/[\u0000-\u0020\u007f-\u009f]/g, '');
  const m = cleaned.match(/^([a-z][a-z0-9+.-]*):/i);
  return m ? `${m[1].toLowerCase()}:` : null;
}

/**
 * Whether a link that came from user data may be opened. Web links need a
 * host; `files` also allows on-device file links (for files the user picked).
 */
export function isSafeLink(url: unknown, opts: { files?: boolean } = {}): url is string {
  if (typeof url !== 'string') return false;
  const value = url.trim();
  if (!value || value.length > MAX_LINK_LENGTH) return false;
  const scheme = linkScheme(value);
  if (!scheme) return false;
  const allowed: readonly string[] = opts.files ? [...SAFE_LINK_SCHEMES, ...DEVICE_FILE_SCHEMES] : SAFE_LINK_SCHEMES;
  if (!allowed.includes(scheme)) return false;
  if (scheme === 'https:' || scheme === 'http:') {
    // No credentials in the address ("https://bank.com@evil.example") and a real host.
    return /^https?:\/\/[^/?#@\s]+(?:[/?#]|$)/i.test(value);
  }
  return true;
}
