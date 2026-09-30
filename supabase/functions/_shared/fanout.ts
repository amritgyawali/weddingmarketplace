/**
 * Who hears about a notification, and how (master plan §7.6). Pure: the
 * notify-fanout function loads the targets (vivah_fanout_targets) and sends
 * what this plans. Rules, the same as the app's notify():
 *
 *   - muted kinds send nothing (the row is still in the inbox);
 *   - `emergency` always rings, whatever the preferences;
 *   - push goes to every registered Expo token when push is on;
 *   - email only for kinds worth an email (Resend's free tier is 100 a day).
 */

export interface FanoutTarget {
  id: string;
  kind: string;
  title: string;
  body?: string | null;
  href?: string | null;
  email?: string | null;
  name?: string | null;
  prefs: { push?: boolean; email?: boolean; muted?: string[] };
  tokens: string[];
}

export interface ExpoMessage {
  to: string;
  title: string;
  body?: string;
  data: { href?: string; notificationId: string; kind: string };
  sound: 'default' | null;
  priority: 'high' | 'default';
  channelId: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface FanoutPlan {
  push: ExpoMessage[][];
  email: EmailMessage | null;
  skipped: string[];
}

/** Kinds that also go by email. Chat, gigs and leads stay in-app and push. */
export const EMAIL_KINDS = new Set(['emergency', 'quote', 'payment', 'payment_reminder', 'booking', 'system', 'verification']);

/** Expo accepts up to 100 messages per request. */
export const PUSH_BATCH = 100;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function planFanout(t: FanoutTarget, appUrl: string): FanoutPlan {
  const skipped: string[] = [];
  const emergency = t.kind === 'emergency';
  const muted = !emergency && (t.prefs.muted ?? []).includes(t.kind);
  if (muted) return { push: [], email: null, skipped: ['muted'] };

  const pushOn = emergency || t.prefs.push !== false;
  const tokens = [...new Set(t.tokens.filter((x) => /^Expo(nent)?PushToken\[.+\]$/.test(x)))];
  if (!pushOn) skipped.push('push off');
  else if (!tokens.length) skipped.push('no device');
  const messages: ExpoMessage[] = pushOn
    ? tokens.map((to) => ({
        to,
        title: t.title,
        body: t.body ?? undefined,
        data: { href: t.href ?? undefined, notificationId: t.id, kind: t.kind },
        sound: 'default',
        priority: emergency ? 'high' : 'default',
        channelId: emergency ? 'emergency' : 'default',
      }))
    : [];
  const push: ExpoMessage[][] = [];
  for (let i = 0; i < messages.length; i += PUSH_BATCH) push.push(messages.slice(i, i + PUSH_BATCH));

  let email: EmailMessage | null = null;
  const emailOn = emergency || t.prefs.email !== false;
  if (!emailOn) skipped.push('email off');
  else if (!t.email) skipped.push('no email');
  else if (!EMAIL_KINDS.has(t.kind)) skipped.push('in-app only kind');
  else {
    const link = t.href ? `${appUrl.replace(/\/$/, '')}${t.href}` : appUrl;
    const hello = t.name ? `Namaste ${esc(t.name.split(' ')[0])},` : 'Namaste,';
    email = {
      to: t.email,
      subject: t.title,
      text: `${t.name ? `Namaste ${t.name.split(' ')[0]},` : 'Namaste,'}\n\n${t.title}\n${t.body ?? ''}\n\nOpen Vivah: ${link}\n\nDhanyabad,\nVivah`,
      html: `<p>${hello}</p><p><strong>${esc(t.title)}</strong><br>${esc(t.body ?? '')}</p><p><a href="${esc(link)}">Open in Vivah</a></p><p>Dhanyabad,<br>Vivah</p>`,
    };
  }
  return { push, email, skipped };
}
