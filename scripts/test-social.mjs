/**
 * Checks the social hub's rules (src/services/social.ts) and its demo seed:
 * each network's posting limits, the reply windows (24 hours, Meta's 7-day
 * human agent tag, WhatsApp templates), reading dates, guests, budget and
 * phone from a message (BS and AD dates), auto-replies and the away message,
 * best times, hashtags, and the inbox and post numbers. Node 24+ strips the
 * TypeScript.
 *
 *   npm run test:social
 */
import './ts-loader.mjs';

import { importApp } from './ts-loader.mjs';

const s = await importApp('@/services/social');
const { NETWORK_BY_ID, DEFAULT_SOCIAL_SETTINGS } = await importApp('@/data/social');
const { buildSocialSeed } = await importApp('@/data/socialSeed');
const { adToBs, bsToAd } = await importApp('@/utils/bs');
const { toISODate } = await importApp('@/utils/format');

const seed0 = buildSocialSeed();
const results = [];
const ok = (name, pass, detail = '') => results.push({ name, pass: !!pass, detail });

const HOUR = 3_600_000;
const now = Date.parse('2026-11-20T10:00:00.000Z');
const nowIso = new Date(now).toISOString();
const acct = (network, status = 'connected', extra = {}) => ({ id: `a_${network}`, ownerId: 'v', network, handle: '@x', name: 'X', status, followers: 1000, scopes: [], connectedAt: nowIso, ...extra });
const all = ['facebook', 'instagram', 'whatsapp', 'tiktok'].map((n) => acct(n));
const img = (i = 0) => ({ id: `m${i}`, kind: 'image', image: 'decorMandapNight' });
const vid = { id: 'v1', kind: 'video', uri: 'file:///clip.mp4' };
const post = (patch = {}) => ({ caption: 'Mangsir dates open #NepaliWedding', overrides: {}, media: [img()], networks: ['facebook', 'instagram', 'whatsapp', 'tiktok'], ...patch });
const errs = (checks, network) => checks.find((c) => c.network === network)?.errors ?? [];

// ─── Posting limits ─────────────────────────────────────────────────────────────
ok('post: a good post is ready for every network', s.postReady(s.checkPost(post(), all, nowIso)));
const noMedia = s.checkPost(post({ media: [] }), all, nowIso);
ok('post: Instagram and TikTok need a photo or video; Facebook and WhatsApp do not', errs(noMedia, 'instagram').length && errs(noMedia, 'tiktok').length && !errs(noMedia, 'facebook').length && !errs(noMedia, 'whatsapp').length);
const long = s.checkPost(post({ caption: 'x'.repeat(2_300) }), all, nowIso);
ok('post: a 2,300-character caption is too long for Instagram, fine for Facebook', errs(long, 'instagram').some((e) => e.includes('too long')) && !errs(long, 'facebook').length);
ok('post: a per-network caption is checked instead of the main one', !errs(s.checkPost(post({ caption: 'x'.repeat(2_300), overrides: { instagram: 'Short #tag' }, networks: ['instagram'] }), all, nowIso), 'instagram').length);
const tags = Array.from({ length: 31 }, (_, i) => `#t${i}`).join(' ');
ok('post: Instagram allows 30 hashtags', errs(s.checkPost(post({ caption: tags, networks: ['instagram'] }), all, nowIso), 'instagram').some((e) => e.includes('30 hashtags')));
ok('post: TikTok refuses photos mixed with a video', errs(s.checkPost(post({ media: [img(), vid], networks: ['tiktok'] }), all, nowIso), 'tiktok').some((e) => e.includes('not both')));
ok('post: WhatsApp takes one file', errs(s.checkPost(post({ media: [img(0), img(1)], networks: ['whatsapp'] }), all, nowIso), 'whatsapp').some((e) => e.includes('up to 1')));
ok('post: a network that is not connected is refused', errs(s.checkPost(post({ networks: ['tiktok'] }), [acct('facebook')], nowIso), 'tiktok')[0] === 'Connect TikTok first');
ok('post: an expired connection is refused with a reconnect hint', errs(s.checkPost(post({ networks: ['facebook'] }), [acct('facebook', 'expired')], nowIso), 'facebook')[0].startsWith('Reconnect Facebook'));
ok('post: a time in the past cannot be scheduled', errs(s.checkPost(post({ scheduledAt: new Date(now - HOUR).toISOString() }), all, nowIso), 'facebook').includes('Pick a time in the future'));
ok('post: an empty post is refused', errs(s.checkPost(post({ caption: '', media: [] }), all, nowIso), 'facebook').includes('Write a caption or add a photo'));
ok('post: access expiring within a week is a warning, not an error', (() => {
  const c = s.checkPost(post({ networks: ['facebook'] }), [acct('facebook', 'connected', { expiresAt: new Date(now + 3 * 24 * HOUR).toISOString() })], nowIso)[0];
  return !c.errors.length && c.warnings.some((w) => w.includes('expires soon'));
})());
ok('post: hashtags in any script are counted', s.hashtagsIn('#विवाह #NepaliWedding plain').length === 2);

// ─── Reply windows ──────────────────────────────────────────────────────────────
const th = (network, hoursAgo, kind = 'message') => ({ network, kind, lastInboundAt: new Date(now - hoursAgo * HOUR).toISOString() });
ok('window: open within 24 hours', s.replyWindow(th('instagram', 2), now).state === 'open');
ok('window: under 3 hours left says so', s.replyWindow(th('facebook', 22), now).message.includes('closes in'));
ok('window: Facebook after 24 hours uses the human agent tag', s.replyWindow(th('facebook', 30), now).state === 'human_agent');
ok('window: Instagram after 8 days is closed', s.replyWindow(th('instagram', 8 * 24), now).state === 'closed');
ok('window: WhatsApp after 24 hours needs a template', s.replyWindow(th('whatsapp', 25), now).state === 'template');
ok('window: comments can always be answered', s.replyWindow(th('facebook', 500, 'comment'), now).state === 'open');

// ─── Reading messages ───────────────────────────────────────────────────────────
ok('intent: "rate kati ho" is a price question', s.detectIntents('Rate kati ho?').includes('price'));
ok('intent: a BS month is a date question', s.detectIntents('Is Mangsir 22 free?').includes('availability'));
ok('intent: Devanagari works', s.detectIntents('धन्यवाद').includes('thanks'));
const today = '2026-10-03';
const hints = s.leadHints(['Namaste! Is Mangsir 22 available for our wedding and reception? Around 400 guests, budget 5 lakh. Call 9851098765.'], today);
const bsNow = adToBs(today);
let expected = bsToAd({ year: bsNow.year, month: 7, day: 22 });
if (expected < today) expected = bsToAd({ year: bsNow.year + 1, month: 7, day: 22 });
ok('lead: a BS date becomes the next AD date', hints.eventDate === expected, `${hints.eventDate} vs ${expected}`);
ok('lead: guests, budget in lakh and phone are read', hints.guests === 400 && hints.budget === 500_000 && hints.phone === '9851098765', JSON.stringify(hints));
ok('lead: functions are read', hints.functions.includes('Wedding') && hints.functions.includes('Reception'));
const ad = s.leadHints(['Do you have 5 Jan free? NPR 250,000 for 150 people'], today);
ok('lead: an AD date in the past this year rolls to next year', ad.eventDate === '2027-01-05' && ad.budget === 250_000 && ad.guests === 150, JSON.stringify(ad));
ok('lead: the latest mention wins', s.leadHints(['300 guests', 'sorry, 350 guests'], today).guests === 350);
ok('lead: nothing to read gives no date', s.leadHints(['Hello!'], today).eventDate === undefined);

// ─── Automation ─────────────────────────────────────────────────────────────────
const at = (h, m = 0) => new Date(2026, 9, 3, h, m);
const away = { active: true, from: '21:00', to: '08:00', text: 'x' };
ok('away: hours across midnight', s.isAway(away, at(23)) && s.isAway(away, at(7, 59)) && !s.isAway(away, at(8)) && !s.isAway(away, at(12)));
ok('away: same-day hours', s.isAway({ ...away, from: '13:00', to: '14:00' }, at(13, 30)) && !s.isAway({ ...away, from: '13:00', to: '14:00' }, at(14)));
ok('away: switched off never answers', !s.isAway({ ...away, active: false }, at(23)));
const rules = [
  { id: 'off', keywords: ['price'], reply: 'off', networks: [], active: false, hits: 0 },
  { id: 'ig', keywords: ['price'], reply: 'ig', networks: ['instagram'], active: true, hits: 0 },
  { id: 'all', keywords: ['kati', 'price'], reply: 'all', networks: [], active: true, hits: 0 },
];
ok('rules: inactive rules are skipped and networks respected', s.matchRule(rules, 'PRICE?', 'instagram')?.id === 'ig' && s.matchRule(rules, 'price?', 'facebook')?.id === 'all');
ok('rules: no keyword, no reply', s.matchRule(rules, 'hello', 'facebook') === undefined);
ok('rules: the starter price rule matches romanised Nepali', s.matchRule(DEFAULT_SOCIAL_SETTINGS.rules, 'rate kati ho', 'whatsapp')?.id === 'ar_price');
const filled = s.fillReply('Namaste {name}! {business} in {city} from {price}.', { business: 'Everest Grand', city: 'Kathmandu', price: 'NPR 1,250 per plate', contact: '@asmita.karki' });
ok('replies: placeholders are filled, the handle becomes a first name', filled === 'Namaste Asmita! Everest Grand in Kathmandu from NPR 1,250 per plate.', filled);
ok('replies: suggestions answer what was asked', s.suggestReplies('rate kati ho? parking?', { business: 'B', city: 'Pokhara', contact: 'Ram' }).length === 2);

ok('consent: START / SUBSCRIBE / सुरु opt in, STOP / बन्द opt out, anything else is a message', s.optInKeyword(' Start. ') === 'in' && s.optInKeyword('SUBSCRIBE') === 'in' && s.optInKeyword('सुरु') === 'in' && s.optInKeyword('stop!') === 'out' && s.optInKeyword('बन्द') === 'out' && s.optInKeyword('please stop calling') === null);
ok('seed: the WhatsApp follow-up customer agreed to updates', seed0.socialThreads.find((t) => t.id === 'st_kabita')?.optedIn === true);

// ─── Timing and hashtags ────────────────────────────────────────────────────────
const from = new Date(2026, 9, 3, 12, 0);
const slots = s.nextBestSlots(['instagram', 'facebook'], from, 4);
ok('times: four future slots, soonest first, at least an hour ahead', slots.length === 4 && slots.every((x, i) => Date.parse(x.at) >= from.getTime() + HOUR && (i === 0 || x.at >= slots[i - 1].at)));
ok('times: no network picked still suggests Facebook and Instagram times', s.nextBestSlots([], from, 2).length === 2);
ok('times: under three published posts there is nothing to learn', s.bestHourFromHistory([]) === null);
const hashtags = s.suggestHashtags({ services: ['venue', 'catering'], city: 'Kathmandu', caption: 'Hall #PartyPalace', date: '2026-11-20' });
const offSeason = s.suggestHashtags({ services: [], city: 'Pokhara', caption: '', date: '2026-10-03' });
ok('hashtags: out of season, the coming wedding month (Asoj → Mangsir)', offSeason.includes('#Mangsir2083') && offSeason.includes('#PokharaWedding'), offSeason.join(' '));
ok('hashtags: services, city and the Nepali month, minus those used', hashtags.includes('#KathmanduWedding') && hashtags.includes('#WeddingCatering') && !hashtags.includes('#PartyPalace') && hashtags.some((h) => /^#Mangsir20\d\d$/.test(h)), hashtags.join(' '));

// ─── Numbers ────────────────────────────────────────────────────────────────────
const m1 = s.projectedMetrics('sp_x', 'instagram', 10_000, 2);
ok('metrics: the same post always reports the same numbers', JSON.stringify(m1) === JSON.stringify(s.projectedMetrics('sp_x', 'instagram', 10_000, 2)));
ok('metrics: saves only on Instagram, no likes on WhatsApp', s.projectedMetrics('a', 'facebook', 5000, 1).saves === 0 && s.projectedMetrics('a', 'whatsapp', 500, 1).likes === 0);
ok('counts: 12,400 → 12K, 1,250 → 1.3K, 950 → 950', s.formatCount(12_400) === '12K' && s.formatCount(1_250) === '1.3K' && s.formatCount(950) === '950' && s.formatCount(1_250_000) === '1.3M');

// ─── Demo seed ──────────────────────────────────────────────────────────────────
const seed = buildSocialSeed();
const accIds = new Map(seed.socialAccounts.map((a) => [a.id, a]));
ok('seed: one account per network per business', new Set(seed.socialAccounts.map((a) => `${a.ownerId}:${a.network}`)).size === seed.socialAccounts.length);
ok('seed: every thread belongs to a connected account of its owner on its network', seed.socialThreads.every((t) => accIds.get(t.accountId)?.ownerId === t.ownerId && accIds.get(t.accountId)?.network === t.network));
ok('seed: every thread has messages, and unread counts the customer messages after the last reply', seed.socialThreads.every((t) => {
  const msgs = seed.socialMessages.filter((m) => m.threadId === t.id);
  const lastOut = msgs.map((m) => m.direction).lastIndexOf('out');
  return msgs.length > 0 && t.unread === msgs.filter((m, i) => m.direction === 'in' && i > lastOut).length;
}));
ok('seed: comment threads only on networks that have comments', seed.socialThreads.every((t) => NETWORK_BY_ID[t.network].inbox.includes(t.kind)));
ok('seed: published posts have a result for every network', seed.socialPosts.filter((p) => p.status === 'published').every((p) => p.networks.every((n) => p.results[n]?.status === 'published')));
ok('seed: scheduled posts are in the future and queued', seed.socialPosts.filter((p) => p.status === 'scheduled').every((p) => Date.parse(p.scheduledAt) > Date.now() && p.networks.every((n) => p.results[n]?.status === 'queued')));
ok('seed: the partly published post has one failure to retry', seed.socialPosts.some((p) => p.status === 'partial' && Object.values(p.results).some((r) => r.status === 'failed')));
ok('seed: the WhatsApp follow-up needs a template', s.replyWindow(seed.socialThreads.find((t) => t.id === 'st_kabita'), Date.now()).state === 'template');
const venue = seed.socialThreads.filter((t) => t.ownerId === 'acc_vendor_demo');
const st = s.inboxStats(venue, seed.socialMessages.filter((m) => venue.some((t) => t.id === m.threadId)));
ok('seed: the venue inbox opens with unanswered messages and a reply time', st.unanswered >= 3 && st.avgResponseMins > 0, JSON.stringify(st));
const ps = s.postStats(seed.socialPosts.filter((p) => p.ownerId === 'acc_vendor_demo'));
ok('seed: venue posts have reach, a best post and one scheduled', ps.reach > 0 && ps.top && ps.scheduled === 1 && ps.rate > 0 && ps.rate < 1);
ok('seed: the venue has enough history to learn its best hour', typeof s.bestHourFromHistory(seed.socialPosts.filter((p) => p.ownerId === 'acc_vendor_demo')) === 'number');
ok('seed: dates are local timestamps', seed.socialMessages.every((m) => !Number.isNaN(Date.parse(m.at))) && toISODate(new Date(seed.socialPosts[0].publishedAt)).length === 10);

const failed = results.filter((r) => !r.pass);
results.forEach((r) => console.log(`${r.pass ? 'pass' : 'FAIL'}  ${r.name}${!r.pass && r.detail ? `  (${r.detail})` : ''}`));
console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);
if (failed.length) process.exit(1);
