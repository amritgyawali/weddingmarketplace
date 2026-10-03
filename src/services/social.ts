/**
 * Social hub rules (pure): checking a post against each network's limits,
 * hashtag and best-time suggestions, the networks' reply windows, reading a
 * customer's message for intent and lead details, auto-replies and the away
 * message, and the inbox and post numbers. No React, no store.
 */
import { NETWORK_BY_ID } from '@/data/social';
import type { SocialAccount, SocialAutoRule, SocialMessage, SocialNetwork, SocialPost, SocialPostResult, SocialSettings, SocialThread } from '@/types/platform';
import { adToBs, bsToAd, BS_MONTHS_EN } from '@/utils/bs';
import { toISODate } from '@/utils/format';

const HOUR = 3_600_000;

/** The caption a network gets: its own override, else the main caption. */
export const captionFor = (post: Pick<SocialPost, 'caption' | 'overrides'>, network: SocialNetwork) => post.overrides[network]?.trim() || post.caption;

/** `#tags` in a caption (letters in any script, digits, underscores). */
export const hashtagsIn = (text: string) => text.match(/#[\p{L}\p{N}_]+/gu) ?? [];

/** What one network says about a post before it goes out. */
export interface PostCheck {
  network: SocialNetwork;
  /** Stop the post going out to this network. */
  errors: string[];
  /** Worth knowing; the post can still go. */
  warnings: string[];
}

/** Checks a post against every chosen network before it is published or scheduled. */
export function checkPost(post: Pick<SocialPost, 'caption' | 'overrides' | 'media' | 'networks' | 'scheduledAt'>, accounts: SocialAccount[], nowIso: string): PostCheck[] {
  return post.networks.map((network) => {
    const def = NETWORK_BY_ID[network];
    const errors: string[] = [];
    const warnings: string[] = [];
    const account = accounts.find((a) => a.network === network && a.status !== 'disconnected');
    const caption = captionFor(post, network);
    const videos = post.media.filter((m) => m.kind === 'video').length;
    if (!account) errors.push(`Connect ${def.label} first`);
    else if (account.status === 'expired') errors.push(`Reconnect ${def.label}: its access has expired`);
    if (!caption.trim() && post.media.length === 0) errors.push('Write a caption or add a photo');
    if (caption.length > def.captionLimit) errors.push(`${caption.length - def.captionLimit} characters too long for ${def.label}`);
    if (def.needsMedia && post.media.length === 0) errors.push(`${def.label} needs a photo or video`);
    if (post.media.length > def.maxMedia) errors.push(`${def.label} takes up to ${def.maxMedia} files`);
    if (network === 'tiktok' && videos > 0 && post.media.length > 1) errors.push('TikTok takes photos or one video, not both');
    const tags = hashtagsIn(caption).length;
    if (def.hashtagLimit && tags > def.hashtagLimit) errors.push(`${def.label} allows ${def.hashtagLimit} hashtags; this has ${tags}`);
    if ((network === 'instagram' || network === 'tiktok') && tags === 0 && caption.trim()) warnings.push('Add a few hashtags so couples find it');
    if (network === 'whatsapp') warnings.push('Goes only to customers who agreed to WhatsApp updates');
    if (account?.expiresAt && account.status === 'connected' && Date.parse(account.expiresAt) - Date.parse(nowIso) < 7 * 24 * HOUR) warnings.push(`${def.label} access expires soon; reconnect this week`);
    if (post.scheduledAt && Date.parse(post.scheduledAt) < Date.parse(nowIso) - 60_000) errors.push('Pick a time in the future');
    return { network, errors, warnings };
  });
}

/** True when every chosen network accepts the post. */
export const postReady = (checks: PostCheck[]) => checks.length > 0 && checks.every((c) => c.errors.length === 0);

const SERVICE_TAGS: Record<string, string[]> = {
  venue: ['#PartyPalace', '#WeddingVenueNepal'],
  catering: ['#WeddingCatering', '#NepaliKhana'],
  photography: ['#NepaliWeddingPhotography', '#WeddingPhotographerNepal'],
  videography: ['#WeddingFilmNepal', '#CinematicWedding'],
  'pre-wedding': ['#PreWeddingNepal', '#PreWeddingShoot'],
  decoration: ['#WeddingDecorNepal', '#MandapDecor'],
  florist: ['#WeddingFlowers', '#FloralDecor'],
  lighting: ['#WeddingLights'],
  makeup: ['#NepaliBride', '#BridalMakeupNepal'],
  mehendi: ['#MehendiNepal', '#BridalMehendi'],
  dj: ['#WeddingDJ', '#ReceptionNight'],
  'panche-baja': ['#PancheBaja', '#NepaliCulture'],
  'bridal-wear': ['#NepaliBride', '#BridalLehenga'],
  jewellery: ['#BridalJewellery', '#TilahariNepal'],
  'wedding-car': ['#WeddingCarNepal', '#JantiCar'],
  cake: ['#WeddingCake'],
  planner: ['#WeddingPlannerNepal'],
};

/** Bikram Sambat months couples marry in most: Mangsir, Magh, Falgun and Baisakh. */
const PEAK_MONTHS = [7, 9, 10, 0];

/** The wedding season a date falls in, or the next one: { month (0 = Baisakh), year }. */
function seasonOf(date: string) {
  const bs = adToBs(date);
  if (!bs) return null;
  for (let i = 0; i < 12; i++) {
    const month = (bs.month + i) % 12;
    if (PEAK_MONTHS.includes(month)) return { month, year: bs.year + (bs.month + i >= 12 ? 1 : 0) };
  }
  return null;
}

/** Hashtags for a post: the business's services, its city, the coming wedding season and general wedding tags, minus those already used. */
export function suggestHashtags(input: { services: string[]; city: string; caption: string; date: string }): string[] {
  const used = new Set(hashtagsIn(input.caption).map((t) => t.toLowerCase()));
  const bs = seasonOf(input.date);
  const city = input.city.replace(/[^\p{L}\p{N}]/gu, '');
  const tags = [
    ...input.services.flatMap((s) => SERVICE_TAGS[s] ?? []),
    ...(city ? [`#${city}Wedding`] : []),
    ...(bs ? [`#${BS_MONTHS_EN[bs.month]}${bs.year}`] : []),
    '#NepaliWedding',
    '#WeddingNepal',
    '#Bibaha',
    '#VivahNepal',
  ];
  return [...new Set(tags)].filter((t) => !used.has(t.toLowerCase())).slice(0, 10);
}

/**
 * When couples in Nepal are on each network (weekday 0 = Sunday, the first
 * working day; Saturday is the weekly holiday). Local device time.
 */
const SLOTS: Record<SocialNetwork, { weekday: number; hour: number; minute: number; why: string }[]> = {
  facebook: [
    { weekday: 5, hour: 19, minute: 30, why: 'Friday evening, families planning together' },
    { weekday: 6, hour: 11, minute: 0, why: 'Saturday late morning, the weekly holiday' },
    { weekday: 2, hour: 20, minute: 0, why: 'Tuesday after dinner' },
  ],
  instagram: [
    { weekday: 6, hour: 19, minute: 0, why: 'Saturday evening, the busiest scroll of the week' },
    { weekday: 3, hour: 20, minute: 30, why: 'Wednesday night' },
    { weekday: 0, hour: 12, minute: 30, why: 'Sunday lunch break' },
  ],
  tiktok: [
    { weekday: 5, hour: 21, minute: 0, why: 'Friday night' },
    { weekday: 6, hour: 20, minute: 0, why: 'Saturday evening' },
    { weekday: 4, hour: 19, minute: 0, why: 'Thursday evening' },
  ],
  whatsapp: [
    { weekday: 0, hour: 10, minute: 0, why: 'Sunday morning, start of the working week' },
    { weekday: 3, hour: 11, minute: 0, why: 'Wednesday late morning' },
  ],
};

/** Hour of day (0–23) at which this business's published posts earned the most engagement per reach; null with fewer than three posts. */
export function bestHourFromHistory(posts: SocialPost[]): number | null {
  const byHour = new Map<number, { eng: number; reach: number }>();
  const published = posts.filter((p) => p.publishedAt && Object.values(p.results).some((r) => r?.reach));
  if (published.length < 3) return null;
  for (const p of published) {
    const hour = new Date(p.publishedAt!).getHours();
    const cur = byHour.get(hour) ?? { eng: 0, reach: 0 };
    for (const r of Object.values(p.results)) {
      if (!r?.reach) continue;
      cur.eng += engagementOf(r);
      cur.reach += r.reach;
    }
    byHour.set(hour, cur);
  }
  let best: number | null = null;
  let rate = -1;
  byHour.forEach((v, hour) => {
    const r = v.reach ? v.eng / v.reach : 0;
    if (r > rate) {
      rate = r;
      best = hour;
    }
  });
  return best;
}

/** The next good times to post to these networks, soonest first, at least an hour from `from`. */
export function nextBestSlots(networks: SocialNetwork[], from: Date, count = 3, learnedHour: number | null = null): { at: string; why: string }[] {
  const out: { at: string; why: string }[] = [];
  const earliest = from.getTime() + HOUR;
  const slots = [...new Set(networks.length ? networks : (['facebook', 'instagram'] as SocialNetwork[]))].flatMap((n) => SLOTS[n]);
  for (let offset = 0; offset < 8; offset++) {
    const d = new Date(from);
    d.setDate(d.getDate() + offset);
    if (learnedHour !== null) {
      const t = new Date(d);
      t.setHours(learnedHour, 0, 0, 0);
      if (t.getTime() >= earliest) out.push({ at: t.toISOString(), why: 'When your own posts have done best' });
    }
    for (const s of slots.filter((x) => x.weekday === d.getDay())) {
      const t = new Date(d);
      t.setHours(s.hour, s.minute, 0, 0);
      if (t.getTime() >= earliest) out.push({ at: t.toISOString(), why: s.why });
    }
  }
  const seen = new Set<string>();
  return out
    .sort((a, b) => a.at.localeCompare(b.at))
    .filter((s) => {
      const key = s.at.slice(0, 13);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, count);
}

/** Whether a conversation can still be answered, and how. */
export interface ReplyWindow {
  /** `human_agent`: Meta allows a person's reply (not automation) for 7 days. `template`: WhatsApp needs an approved template. */
  state: 'open' | 'human_agent' | 'template' | 'closed';
  hoursLeft?: number;
  message: string;
}

/** Whether the network still lets the business reply to this conversation, and how. */
export function replyWindow(thread: Pick<SocialThread, 'network' | 'kind' | 'lastInboundAt'>, nowMs: number): ReplyWindow {
  const def = NETWORK_BY_ID[thread.network];
  if (thread.kind === 'comment' || !def.replyWindowHours || !thread.lastInboundAt) return { state: 'open', message: '' };
  const hours = (nowMs - Date.parse(thread.lastInboundAt)) / HOUR;
  if (hours < def.replyWindowHours) {
    const left = def.replyWindowHours - hours;
    return { state: 'open', hoursLeft: left, message: left < 3 ? `Reply window closes in ${Math.max(1, Math.round(left * 60))} min` : '' };
  }
  if (def.humanAgentDays && hours < def.humanAgentDays * 24) return { state: 'human_agent', message: 'Over 24 hours: your reply goes out with the human agent tag, allowed for 7 days.' };
  if (thread.network === 'whatsapp') return { state: 'template', message: 'The 24-hour window has closed. Send an approved template to restart the conversation.' };
  return { state: 'closed', message: `${def.label} no longer allows replies here. Wait for the customer to write again.` };
}

/** What a customer message is about. */
export type SocialIntent = 'price' | 'availability' | 'location' | 'visit' | 'booking' | 'complaint' | 'thanks';

const INTENT_WORDS: Record<SocialIntent, string[]> = {
  price: ['price', 'rate', 'cost', 'kati', 'कति', 'package', 'budget', 'per plate', 'charge', 'quotation', 'quote', 'lakh', 'मूल्य', 'पैसा'],
  availability: ['available', 'availability', 'free on', 'khali', 'खाली', 'date', 'मिति', ...BS_MONTHS_EN.map((m) => m.toLowerCase()), 'mangshir', 'mansir'],
  location: ['location', 'where', 'kaha', 'कहाँ', 'address', 'map', 'parking'],
  visit: ['visit', 'come and see', 'see the hall', 'meet', 'appointment', 'herna'],
  booking: ['book', 'confirm', 'advance', 'deposit', 'reserve', 'hold the date'],
  complaint: ['bad', 'late', 'worst', 'refund', 'complain', 'disappointed', 'rude', 'नराम्रो'],
  thanks: ['thank', 'dhanyabad', 'धन्यवाद', 'loved', 'amazing'],
};

/** What a customer's message is about (several can apply). */
export function detectIntents(text: string): SocialIntent[] {
  const lower = text.toLowerCase();
  return (Object.keys(INTENT_WORDS) as SocialIntent[]).filter((intent) => INTENT_WORDS[intent].some((w) => lower.includes(w)));
}

/** The business details filled into replies. */
export interface ReplyContext {
  business: string;
  city: string;
  /** Starting price, already formatted ("NPR 180,000 per event"). */
  price?: string;
  /** Customer's name; the first word is used. */
  contact: string;
}

/** Fills `{price}`, `{city}`, `{business}` and `{1}`/`{name}` (the customer's first name) in a saved reply or template. */
export function fillReply(text: string, ctx: ReplyContext): string {
  const first = ctx.contact.replace(/^@/, '').split(/[\s._]/)[0] || 'there';
  return text
    .replace(/\{price\}/g, ctx.price ?? 'a price that fits your guest count')
    .replace(/\{city\}/g, ctx.city)
    .replace(/\{business\}/g, ctx.business)
    .replace(/\{1\}|\{name\}/g, first.charAt(0).toUpperCase() + first.slice(1));
}

const SUGGESTIONS: Record<SocialIntent, string> = {
  price: 'Namaste {name}! Our packages start at {price}. Share your date and guest count and we will send an exact quotation.',
  availability: 'Thank you {name}! Let us check the calendar. Could you confirm the date and the number of guests?',
  location: 'We are in {city}. We will send the map pin here; parking is available for guests.',
  visit: 'You are most welcome to visit, {name}. Which day and time suit you? We are open 9 am to 7 pm.',
  booking: 'Wonderful! To hold your date we take a small advance. Shall we send the quotation and payment details?',
  complaint: 'We are sorry to hear this, {name}. Please share your number and the manager will call you today.',
  thanks: 'Dhanyabad {name}! It means a lot to us.',
};

/** Up to three ready replies for what the customer asked, filled in for this business. */
export function suggestReplies(text: string, ctx: ReplyContext): string[] {
  const intents = detectIntents(text);
  const picked = (intents.length ? intents : (['availability'] as SocialIntent[])).slice(0, 3);
  return picked.map((i) => fillReply(SUGGESTIONS[i], ctx));
}

/** Lead details read from a conversation. */
export interface LeadHints {
  eventDate?: string;
  guests?: number;
  phone?: string;
  budget?: number;
  functions: string[];
}

const AD_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const BS_ALIASES: [string, number][] = [...BS_MONTHS_EN.map((m, i) => [m.toLowerCase(), i] as [string, number]), ['mangshir', 7], ['mansir', 7], ['poush', 8], ['push', 8], ['falgun', 10], ['fagun', 10], ['baishakh', 0], ['jeth', 1], ['ashoj', 5], ['kartik', 6], ['chait', 11]];
const FUNCTION_WORDS: [RegExp, string][] = [
  [/\b(wedding|bibaha|biha|vivah)\b|बिहे|विवाह/i, 'Wedding'],
  [/\breception\b/i, 'Reception'],
  [/\b(mehendi|mehndi)\b|मेहेन्दी/i, 'Mehendi'],
  [/\bhaldi\b/i, 'Haldi'],
  [/\b(engagement|sagai|ring ceremony)\b/i, 'Engagement'],
  [/\bpasni\b|पास्नी/i, 'Pasni'],
  [/\bbratabandha\b|ब्रतबन्ध/i, 'Bratabandha'],
  [/\bbirthday\b/i, 'Birthday'],
];

/** The next date on or after today for a BS or AD month and day. */
function nextDate(make: (year: number) => string | null, baseYear: number, todayIso: string): string | undefined {
  for (const year of [baseYear, baseYear + 1]) {
    const iso = make(year);
    if (iso && iso >= todayIso) return iso;
  }
  return undefined;
}

/** Event date, guests, phone, budget and functions mentioned in a conversation (latest mention wins). */
export function leadHints(texts: string[], todayIso: string): LeadHints {
  const hints: LeadHints = { functions: [] };
  const bsToday = adToBs(todayIso);
  for (const raw of texts) {
    const text = raw.toLowerCase();
    const iso = text.match(/\b(20\d\d)-(\d\d)-(\d\d)\b/);
    if (iso) hints.eventDate = iso[0];
    for (const [name, month] of BS_ALIASES) {
      const m = text.match(new RegExp(`\\b${name}\\s+(\\d{1,2})\\b|\\b(\\d{1,2})\\s*(?:st|nd|rd|th)?\\s+${name}\\b`));
      const dayNum = m ? Number(m[1] ?? m[2]) : 0;
      if (m && bsToday && dayNum >= 1 && dayNum <= 32) {
        const date = nextDate((year) => bsToAd({ year, month, day: dayNum }), bsToday.year, todayIso);
        if (date) hints.eventDate = date;
        break;
      }
    }
    if (!iso) {
      const ad = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\b|\b(\d{1,2})\s*(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/);
      if (ad) {
        const month = AD_MONTHS.indexOf(ad[1] ?? ad[4]);
        const dayNum = Number(ad[2] ?? ad[3]);
        if (month >= 0 && dayNum >= 1 && dayNum <= 31) {
          const date = nextDate((year) => toISODate(new Date(year, month, dayNum)), Number(todayIso.slice(0, 4)), todayIso);
          if (date) hints.eventDate = date;
        }
      }
    }
    const guests = text.match(/(\d{2,4})\s*\+?\s*(?:guests?|people|persons|pax|jana|जना|log\b)/);
    if (guests) hints.guests = Number(guests[1]);
    const phone = raw.match(/(?:\+?977[\s-]?)?\b(9[678]\d{8})\b/);
    if (phone) hints.phone = phone[1];
    const lakh = text.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|lac|लाख)/);
    const rupees = text.match(/(?:npr|rs\.?|रु\.?)\s*([\d,]{4,})/);
    if (lakh) hints.budget = Math.round(Number(lakh[1]) * 100_000);
    else if (rupees) hints.budget = Number(rupees[1].replace(/,/g, ''));
    for (const [re, name] of FUNCTION_WORDS) if (re.test(raw) && !hints.functions.includes(name)) hints.functions.push(name);
  }
  return hints;
}

/** Minutes since midnight for "HH:MM". */
const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Is the business away (outside its hours) at this local time? Hours may span midnight. */
export function isAway(away: SocialSettings['away'], at: Date): boolean {
  if (!away.active) return false;
  const now = at.getHours() * 60 + at.getMinutes();
  const from = minutesOf(away.from);
  const to = minutesOf(away.to);
  if (from === to) return false;
  return from < to ? now >= from && now < to : now >= from || now < to;
}

/** The first active auto-reply rule whose keyword the message contains, for this network. */
export function matchRule(rules: SocialAutoRule[], text: string, network: SocialNetwork): SocialAutoRule | undefined {
  const lower = text.toLowerCase();
  return rules.find((r) => r.active && (r.networks.length === 0 || r.networks.includes(network)) && r.keywords.some((k) => k.trim() && lower.includes(k.trim().toLowerCase())));
}

/** Likes + comments + shares + saves. */
export const engagementOf = (r: SocialPostResult) => (r.likes ?? 0) + (r.comments ?? 0) + (r.shares ?? 0) + (r.saves ?? 0);

/** Repeatable 0–1 number from a string (demo metrics, never random). */
function unit(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10_000) / 10_000;
}

/**
 * Reach and engagement a network reports for a post, worked out from the
 * account's followers (the demo stands in for the networks' insights APIs).
 * WhatsApp reach is the customers the broadcast was read by.
 */
export function projectedMetrics(seed: string, network: SocialNetwork, followers: number, mediaCount: number): Required<Pick<SocialPostResult, 'reach' | 'likes' | 'comments' | 'shares' | 'saves'>> {
  const r = unit(`${seed}:${network}`);
  const boost = (network === 'tiktok' ? 2.4 : network === 'instagram' ? 1.2 : 1) * (mediaCount > 1 ? 1.15 : 1);
  const reach = network === 'whatsapp' ? Math.round(followers * (0.7 + r * 0.25)) : Math.round(followers * (0.15 + r * 0.3) * boost);
  const likes = network === 'whatsapp' ? 0 : Math.round(reach * (0.04 + r * 0.05));
  return {
    reach,
    likes,
    comments: Math.round((network === 'whatsapp' ? reach * 0.06 : likes * 0.09) + r * 3),
    shares: Math.round(likes * 0.05),
    saves: network === 'instagram' ? Math.round(likes * 0.12) : 0,
  };
}

/** Public link of a published post (the networks return the real one; the demo builds a believable one). */
export function postUrl(network: SocialNetwork, handle: string, id: string): string | undefined {
  const slug = handle.replace(/^@/, '').replace(/\s+/g, '').toLowerCase();
  const code = id.replace(/[^a-z0-9]/gi, '').slice(-11);
  if (network === 'facebook') return `https://facebook.com/${slug}/posts/${code}`;
  if (network === 'instagram') return `https://instagram.com/p/${code}`;
  if (network === 'tiktok') return `https://tiktok.com/@${slug}/photo/${code}`;
  return undefined;
}

/** 950 → "950", 12,400 → "12.4K", 1,250,000 → "1.3M". */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, '')}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}

/** Inbox numbers: open, unread, unanswered, reply time, unread by network. */
export interface InboxStats {
  open: number;
  unread: number;
  /** Open conversations whose last message is from the customer. */
  unanswered: number;
  avgResponseMins: number | null;
  byNetwork: Record<SocialNetwork, number>;
}

/** Numbers for the inbox header and the insights tab. */
export function inboxStats(threads: SocialThread[], messages: SocialMessage[]): InboxStats {
  const lastDir = new Map<string, SocialMessage['direction']>();
  for (const m of messages) if (m.direction !== 'note') lastDir.set(m.threadId, m.direction);
  const open = threads.filter((t) => t.status === 'open');
  const timed = threads.filter((t) => typeof t.firstResponseMins === 'number');
  const byNetwork = { facebook: 0, instagram: 0, whatsapp: 0, tiktok: 0 } as Record<SocialNetwork, number>;
  for (const t of open) byNetwork[t.network] += t.unread;
  return {
    open: open.length,
    unread: threads.reduce((s, t) => s + t.unread, 0),
    unanswered: open.filter((t) => lastDir.get(t.id) === 'in').length,
    avgResponseMins: timed.length ? Math.round(timed.reduce((s, t) => s + (t.firstResponseMins ?? 0), 0) / timed.length) : null,
    byNetwork,
  };
}

/** Post numbers: published, scheduled, reach, engagement, by network, best post. */
export interface PostStats {
  published: number;
  scheduled: number;
  reach: number;
  engagement: number;
  /** Engagement per reach, 0–1. */
  rate: number;
  byNetwork: Record<SocialNetwork, { posts: number; reach: number; engagement: number }>;
  top?: SocialPost;
}

/** Totals across published posts, per network, and the best post by engagement. */
export function postStats(posts: SocialPost[]): PostStats {
  const byNetwork = { facebook: { posts: 0, reach: 0, engagement: 0 }, instagram: { posts: 0, reach: 0, engagement: 0 }, whatsapp: { posts: 0, reach: 0, engagement: 0 }, tiktok: { posts: 0, reach: 0, engagement: 0 } } as PostStats['byNetwork'];
  let top: SocialPost | undefined;
  let topEng = -1;
  for (const p of posts) {
    let eng = 0;
    for (const [n, r] of Object.entries(p.results) as [SocialNetwork, SocialPostResult | undefined][]) {
      if (r?.status !== 'published') continue;
      byNetwork[n].posts += 1;
      byNetwork[n].reach += r.reach ?? 0;
      byNetwork[n].engagement += engagementOf(r);
      eng += engagementOf(r);
    }
    if (eng > topEng && (p.status === 'published' || p.status === 'partial')) {
      topEng = eng;
      top = p;
    }
  }
  const reach = Object.values(byNetwork).reduce((s, n) => s + n.reach, 0);
  const engagement = Object.values(byNetwork).reduce((s, n) => s + n.engagement, 0);
  return {
    published: posts.filter((p) => p.status === 'published' || p.status === 'partial').length,
    scheduled: posts.filter((p) => p.status === 'scheduled').length,
    reach,
    engagement,
    rate: reach ? engagement / reach : 0,
    byNetwork,
    top,
  };
}

/** WhatsApp broadcast consent by keyword: "START"/"SUBSCRIBE" opts in, "STOP"/"UNSUBSCRIBE" opts out (also in Nepali). Same words as the SQL trigger in 0020. */
export function optInKeyword(text: string): 'in' | 'out' | null {
  const word = text.trim().toLowerCase().replace(/[.!।]+$/, '');
  if (['start', 'subscribe', 'सुरु', 'yes updates'].includes(word)) return 'in';
  if (['stop', 'unsubscribe', 'बन्द', 'no more'].includes(word)) return 'out';
  return null;
}
