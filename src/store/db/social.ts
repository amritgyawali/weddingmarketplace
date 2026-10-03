/**
 * Social hub: a business connects Facebook, Instagram, WhatsApp and TikTok,
 * answers every message and comment from one inbox, and publishes one post to
 * every network. In production each action is a Supabase call:
 * connect/disconnect → `social-oauth`, replies → `social-send`, publishing and
 * the scheduled-post run → `social-publish`, and `receiveSocialMessage` is what
 * the `social-webhook` function does when a network delivers a message. The
 * demo stands in for the networks with timers (cleared on `resetDemo`).
 */
import { DEFAULT_SOCIAL_SETTINGS, NETWORK_BY_ID, SAMPLE_INBOUND, SOCIAL_LABELS } from '@/data/social';
import { checkPost, detectIntents, fillReply, isAway, matchRule, postUrl, projectedMetrics, replyWindow } from '@/services/social';
import { useSession } from '@/store/useSession';
import type { Account, SocialAccount, SocialMedia, SocialMessage, SocialNetwork, SocialPost, SocialPostResult, SocialSettings, SocialThread, SocialThreadKind, SocialThreadStatus } from '@/types/platform';
import { addDays, formatMoney, isNepalMobile, today, uid } from '@/utils/format';

import { currentActor, type GetDb, now, type SetDb } from './helpers';

/** A message or comment as a network delivers it (the webhook payload, normalised). */
export interface SocialInbound {
  ownerId: string;
  network: SocialNetwork;
  kind: SocialThreadKind;
  contactName: string;
  contactHandle: string;
  contactPhone?: string;
  text: string;
  postId?: string;
  postCaption?: string;
}

/** What "Create lead" saves from a conversation. */
export interface SocialLeadInput {
  eventDate: string;
  guests?: number;
  functions: string[];
  budget?: number;
  phone?: string;
}

/** Store actions of the social hub. */
export interface SocialActions {
  /** Connects a network for the signed-in business (in production: after the network's OAuth consent). Error text or null. */
  connectSocialAccount: (input: { network: SocialNetwork; handle: string; name?: string }) => string | null;
  disconnectSocialAccount: (accountId: string) => string | null;
  /** Renews an expired token (in production: the OAuth consent again). */
  reconnectSocialAccount: (accountId: string) => string | null;
  /** A message or comment arrives from a network (the webhook). Applies auto-replies and the away message. Returns the thread id. */
  receiveSocialMessage: (input: SocialInbound) => string | null;
  /** Pulls anything new from the connected networks and wakes snoozed threads. Returns how many messages arrived. */
  syncSocialInbox: () => number;
  /** Replies in the thread (message or public comment reply). Outside WhatsApp's 24-hour window pass an approved template id. */
  sendSocialReply: (threadId: string, text: string, opts?: { media?: SocialMedia[]; template?: string }) => string | null;
  addSocialNote: (threadId: string, text: string) => string | null;
  markSocialThreadRead: (threadId: string) => void;
  /** `pending` with `snoozeHours` hides the thread until then. */
  setSocialThreadStatus: (threadId: string, status: SocialThreadStatus, snoozeHours?: number) => string | null;
  toggleSocialThreadStar: (threadId: string) => void;
  setSocialThreadLabels: (threadId: string, labels: string[]) => void;
  assignSocialThread: (threadId: string, assignee?: string) => void;
  /** Turns a conversation into a CRM lead (source `social`) and links the two. Returns the lead id, or error text. */
  createLeadFromSocialThread: (threadId: string, input: SocialLeadInput) => { leadId?: string; error?: string };
  /** Creates or updates a draft. Returns the post id. */
  saveSocialPost: (input: Partial<SocialPost> & Pick<SocialPost, 'caption' | 'networks' | 'media'>) => { id?: string; error?: string };
  scheduleSocialPost: (postId: string, at: string) => string | null;
  /** Sends the post to every chosen network now. Networks that refuse it are marked failed; the rest go out. */
  publishSocialPost: (postId: string) => string | null;
  retrySocialPost: (postId: string, network: SocialNetwork) => string | null;
  duplicateSocialPost: (postId: string) => string | null;
  deleteSocialPost: (postId: string) => string | null;
  /** Publishes scheduled posts whose time has come and wakes snoozed threads (pg_cron + social-publish in production). Returns how many posts started. */
  runDueSocialPosts: () => number;
  updateSocialSettings: (patch: Partial<SocialSettings>) => string | null;
  /** Supabase builds: replaces one business's hub on this device with what the server holds (`syncSocialFromServer`). */
  mirrorSocialData: (ownerId: string, data: { accounts: SocialAccount[]; threads: SocialThread[]; messages: SocialMessage[]; posts: SocialPost[]; settings?: SocialSettings }) => void;
}

/** Timers standing in for the networks (delivery receipts, publishing, new messages). Cleared on reset. */
const socialTimers = new Set<ReturnType<typeof setTimeout>>();
/** Stops the simulated networks (on resetDemo). */
export const clearSocialTimers = () => {
  socialTimers.forEach(clearTimeout);
  socialTimers.clear();
};
const later = (ms: number, fn: () => void) => {
  const timer = setTimeout(() => {
    socialTimers.delete(timer);
    fn();
  }, ms);
  socialTimers.add(timer);
};

const me = (): Account | undefined => {
  const s = useSession.getState();
  return s.accounts.find((a) => a.id === s.session?.accountId);
};

/** The signed-in business, or an error. */
const business = (): Account | string => {
  const a = me();
  if (!a) return 'Sign in again';
  if (a.role !== 'vendor') return 'Only a business can use the social hub';
  return a;
};

/** Settings for a business, with the starter set until it saves its own. */
export const socialSettingsFor = (all: Record<string, SocialSettings>, ownerId: string) => all[ownerId] ?? DEFAULT_SOCIAL_SETTINGS;

const META_DAYS = 60;

/** The social hub actions for the shared store. */
export const socialActions = (set: SetDb, get: GetDb): SocialActions => {
  const mapThread = (id: string, fn: (t: SocialThread) => SocialThread) => set((s) => ({ socialThreads: s.socialThreads.map((t) => (t.id === id ? fn(t) : t)) }));
  const mapPost = (id: string, fn: (p: SocialPost) => SocialPost) => set((s) => ({ socialPosts: s.socialPosts.map((p) => (p.id === id ? { ...fn(p), updatedAt: now() } : p)) }));

  /** A thread of the signed-in business. */
  const ownThread = (threadId: string): { thread: SocialThread; owner: Account } | string => {
    const owner = business();
    if (typeof owner === 'string') return owner;
    const thread = get().socialThreads.find((t) => t.id === threadId);
    if (!thread || thread.ownerId !== owner.id) return 'Conversation not found';
    return { thread, owner };
  };
  const ownPost = (postId: string): { post: SocialPost; owner: Account } | string => {
    const owner = business();
    if (typeof owner === 'string') return owner;
    const post = get().socialPosts.find((p) => p.id === postId);
    if (!post || post.ownerId !== owner.id) return 'Post not found';
    return { post, owner };
  };

  const replyContext = (owner: Account, contact: string) => {
    const pkg = get().packages.filter((p) => p.providerId === owner.listingId && p.active).sort((a, b) => b.price - a.price)[0];
    return { business: owner.businessName ?? owner.name, city: owner.city, price: pkg ? `${formatMoney(pkg.price)} ${pkg.unit}` : undefined, contact };
  };

  /** Simulated delivery receipts for a sent message. */
  const deliver = (messageId: string, network: SocialNetwork, kind: SocialThreadKind) => {
    if (kind !== 'message') return;
    later(1200, () => set((s) => ({ socialMessages: s.socialMessages.map((m) => (m.id === messageId && m.status === 'sent' ? { ...m, status: 'delivered' } : m)) })));
    if (network !== 'tiktok') later(4000, () => set((s) => ({ socialMessages: s.socialMessages.map((m) => (m.id === messageId && (m.status === 'sent' || m.status === 'delivered') ? { ...m, status: 'read' } : m)) })));
  };

  /** Starts publishing a post to the given networks; each network answers after a moment. */
  const startPublishing = (post: SocialPost, networks: SocialNetwork[]) => {
    const accounts = get().socialAccounts.filter((a) => a.ownerId === post.ownerId);
    const checks = checkPost({ ...post, networks, scheduledAt: undefined }, accounts, now());
    const results: SocialPost['results'] = { ...post.results };
    const going: SocialNetwork[] = [];
    for (const c of checks) {
      if (c.errors.length) results[c.network] = { status: 'failed', error: c.errors[0], at: now() };
      else {
        results[c.network] = { status: 'publishing' };
        going.push(c.network);
      }
    }
    mapPost(post.id, (p) => ({ ...p, status: going.length ? 'publishing' : 'failed', results }));
    const settle = () => {
      const p = get().socialPosts.find((x) => x.id === post.id);
      if (!p || Object.values(p.results).some((r) => r?.status === 'publishing')) return;
      const states = p.networks.map((n) => p.results[n]?.status);
      const status: SocialPost['status'] = states.every((x) => x === 'published') ? 'published' : states.some((x) => x === 'published') ? 'partial' : 'failed';
      mapPost(p.id, (x) => ({ ...x, status, publishedAt: x.publishedAt ?? (status === 'failed' ? undefined : now()) }));
      const ok = p.networks.filter((n) => p.results[n]?.status === 'published').map((n) => NETWORK_BY_ID[n].label);
      if (status !== 'failed') get().notify(p.ownerId, status === 'published' ? 'Post published' : 'Post partly published', `Live on ${ok.join(', ')}`, '/business/social?tab=posts', 'system');
      else get().notify(p.ownerId, 'Post not published', p.networks.map((n) => p.results[n]?.error).filter(Boolean)[0] ?? 'Try again', '/business/social?tab=posts', 'system');
    };
    going.forEach((network, i) =>
      later(900 + i * 700, () => {
        const account = get().socialAccounts.find((a) => a.ownerId === post.ownerId && a.network === network && a.status === 'connected');
        const result: SocialPostResult = account
          ? { status: 'published', at: now(), url: postUrl(network, account.handle, `${post.id}${network}${Date.now()}`), ...projectedMetrics(post.id, network, account.followers, post.media.length) }
          : { status: 'failed', at: now(), error: `${NETWORK_BY_ID[network].label} was disconnected` };
        set((s) => ({ socialPosts: s.socialPosts.map((p) => (p.id === post.id ? { ...p, results: { ...p.results, [network]: result } } : p)) }));
        settle();
      }),
    );
    get().log(currentActor(), 'social.publish', 'social_post', post.id, networks.join(', '));
    if (!going.length) settle();
    return going.length ? null : (checks.flatMap((c) => c.errors)[0] ?? 'Nothing to publish');
  };

  return {
    connectSocialAccount: ({ network, handle, name }) => {
      const owner = business();
      if (typeof owner === 'string') return owner;
      const def = NETWORK_BY_ID[network];
      let clean = handle.trim();
      if (!clean) return `Enter your ${def.label} ${network === 'whatsapp' ? 'number' : 'page or handle'}`;
      if (network === 'whatsapp') {
        if (!isNepalMobile(clean)) return 'Enter a Nepal mobile number (98XXXXXXXX)';
        clean = `+977 ${clean.replace(/\D/g, '').slice(-10)}`;
      } else if (network !== 'facebook' && !clean.startsWith('@')) clean = `@${clean.replace(/\s+/g, '').toLowerCase()}`;
      const existing = get().socialAccounts.find((a) => a.ownerId === owner.id && a.network === network);
      if (existing && existing.status !== 'disconnected') return `${def.label} is already connected`;
      const seed = [...clean].reduce((s, c) => s + c.charCodeAt(0), 0);
      const account: SocialAccount = {
        id: existing?.id ?? uid('sa'),
        ownerId: owner.id,
        network,
        handle: clean,
        name: name?.trim() || owner.businessName || owner.name,
        status: 'connected',
        followers: existing?.followers ?? (network === 'whatsapp' ? 300 + (seed % 900) : 800 + ((seed * 37) % 15_000)),
        scopes: def.scopes,
        connectedAt: now(),
        expiresAt: network === 'tiktok' ? undefined : `${addDays(today(), META_DAYS)}T00:00:00.000Z`,
        lastSyncAt: now(),
      };
      set((s) => ({ socialAccounts: existing ? s.socialAccounts.map((a) => (a.id === existing.id ? account : a)) : [...s.socialAccounts, account] }));
      get().log(currentActor(), 'social.connect', 'social_account', account.id, `${def.label} ${clean}`);
      // The network starts delivering: one waiting message arrives shortly.
      const sample = SAMPLE_INBOUND.find((m) => m.network === network && !get().socialThreads.some((t) => t.ownerId === owner.id && t.contactHandle === m.handle));
      if (sample) later(5000, () => get().receiveSocialMessage({ ownerId: owner.id, network, kind: sample.kind, contactName: sample.name, contactHandle: sample.handle, contactPhone: sample.phone, text: sample.text, postCaption: sample.kind === 'comment' ? 'Your latest post' : undefined }));
      return null;
    },

    disconnectSocialAccount: (accountId) => {
      const owner = business();
      if (typeof owner === 'string') return owner;
      const account = get().socialAccounts.find((a) => a.id === accountId && a.ownerId === owner.id);
      if (!account) return 'Account not found';
      set((s) => ({ socialAccounts: s.socialAccounts.map((a) => (a.id === accountId ? { ...a, status: 'disconnected', expiresAt: undefined } : a)) }));
      get().log(currentActor(), 'social.disconnect', 'social_account', accountId, NETWORK_BY_ID[account.network].label);
      return null;
    },

    reconnectSocialAccount: (accountId) => {
      const owner = business();
      if (typeof owner === 'string') return owner;
      const account = get().socialAccounts.find((a) => a.id === accountId && a.ownerId === owner.id);
      if (!account) return 'Account not found';
      set((s) => ({ socialAccounts: s.socialAccounts.map((a) => (a.id === accountId ? { ...a, status: 'connected', expiresAt: a.network === 'tiktok' ? undefined : `${addDays(today(), META_DAYS)}T00:00:00.000Z`, lastSyncAt: now() } : a)) }));
      get().log(currentActor(), 'social.reconnect', 'social_account', accountId, NETWORK_BY_ID[account.network].label);
      return null;
    },

    receiveSocialMessage: (input) => {
      const s = get();
      const account = s.socialAccounts.find((a) => a.ownerId === input.ownerId && a.network === input.network && a.status !== 'disconnected');
      const text = input.text.trim();
      if (!account || !text) return null;
      const at = now();
      const existing = s.socialThreads.find((t) => t.ownerId === input.ownerId && t.network === input.network && t.kind === input.kind && t.contactHandle === input.contactHandle && (input.kind === 'message' || t.postId === input.postId));
      const intents = detectIntents(text);
      const autoLabels = [intents.includes('price') && 'Price asked', intents.includes('availability') && 'Date check', intents.includes('complaint') && 'Complaint'].filter((x): x is string => !!x && SOCIAL_LABELS.includes(x));
      const threadId = existing?.id ?? uid('st');
      const message: SocialMessage = { id: uid('sm'), threadId, direction: 'in', author: input.contactName, text, at };
      const thread: SocialThread = existing
        ? { ...existing, status: 'open', snoozedUntil: undefined, unread: existing.unread + 1, lastAt: at, lastInboundAt: at, labels: [...new Set([...existing.labels, ...autoLabels])] }
        : { id: threadId, ownerId: input.ownerId, accountId: account.id, network: input.network, kind: input.kind, contactName: input.contactName, contactHandle: input.contactHandle, contactPhone: input.contactPhone, postId: input.postId, postCaption: input.postCaption, status: 'open', labels: autoLabels, unread: 1, lastAt: at, lastInboundAt: at };
      set((st) => ({ socialMessages: [...st.socialMessages, message], socialThreads: existing ? st.socialThreads.map((t) => (t.id === threadId ? thread : t)) : [thread, ...st.socialThreads] }));
      const label = NETWORK_BY_ID[input.network].label;
      get().notify(input.ownerId, `${label}: ${input.contactName}`, text, `/business/social/thread/${threadId}`, 'message');

      // Automation: a keyword rule answers at once; otherwise the away message, once per night.
      const settings = socialSettingsFor(get().socialSettings, input.ownerId);
      const owner = useSession.getState().accounts.find((a) => a.id === input.ownerId);
      const rule = matchRule(settings.rules, text, input.network);
      const lastAuto = get().socialMessages.filter((m) => m.threadId === threadId && m.auto).pop();
      const awayDue = input.kind === 'message' && isAway(settings.away, new Date()) && (!lastAuto || Date.now() - Date.parse(lastAuto.at) > 12 * 3_600_000);
      const autoText = rule ? rule.reply : awayDue ? settings.away.text : null;
      if (autoText && owner) {
        const reply: SocialMessage = { id: uid('sm'), threadId, direction: 'out', author: 'Auto-reply', text: fillReply(autoText, replyContext(owner, input.contactName)), at: now(), status: 'sent', auto: true };
        set((st) => ({
          socialMessages: [...st.socialMessages, reply],
          socialSettings: rule ? { ...st.socialSettings, [input.ownerId]: { ...settings, rules: settings.rules.map((r) => (r.id === rule.id ? { ...r, hits: r.hits + 1 } : r)) } } : st.socialSettings,
        }));
        deliver(reply.id, input.network, input.kind);
      }
      return threadId;
    },

    syncSocialInbox: () => {
      const owner = business();
      if (typeof owner === 'string') return 0;
      const nowIso = now();
      set((s) => ({
        socialThreads: s.socialThreads.map((t) => (t.ownerId === owner.id && t.snoozedUntil && t.snoozedUntil <= nowIso ? { ...t, status: 'open', snoozedUntil: undefined } : t)),
        socialAccounts: s.socialAccounts.map((a) => (a.ownerId === owner.id && a.status === 'connected' ? { ...a, lastSyncAt: nowIso } : a)),
      }));
      const connected = get().socialAccounts.filter((a) => a.ownerId === owner.id && a.status !== 'disconnected').map((a) => a.network);
      const sample = SAMPLE_INBOUND.find((m) => connected.includes(m.network) && NETWORK_BY_ID[m.network].inbox.includes(m.kind) && !get().socialThreads.some((t) => t.ownerId === owner.id && t.contactHandle === m.handle));
      if (!sample) return 0;
      const post = sample.kind === 'comment' ? get().socialPosts.find((p) => p.ownerId === owner.id && p.networks.includes(sample.network) && p.results[sample.network]?.status === 'published') : undefined;
      get().receiveSocialMessage({ ownerId: owner.id, network: sample.network, kind: sample.kind, contactName: sample.name, contactHandle: sample.handle, contactPhone: sample.phone, text: sample.text, postId: post?.id, postCaption: post ? post.caption.split('\n')[0].slice(0, 80) : sample.kind === 'comment' ? 'Your latest post' : undefined });
      return 1;
    },

    sendSocialReply: (threadId, text, opts = {}) => {
      const own = ownThread(threadId);
      if (typeof own === 'string') return own;
      const { thread, owner } = own;
      const def = NETWORK_BY_ID[thread.network];
      const account = get().socialAccounts.find((a) => a.id === thread.accountId);
      if (!account || account.status === 'disconnected') return `Connect ${def.label} again to reply`;
      if (account.status === 'expired') return `Reconnect ${def.label} to reply: its access has expired`;
      const window = replyWindow(thread, Date.now());
      if (window.state === 'closed') return window.message;
      if (window.state === 'template' && !opts.template) return window.message;
      const settings = socialSettingsFor(get().socialSettings, owner.id);
      const body = text.trim();
      if (!body && !opts.media?.length) return 'Write a reply first';
      if (body.length > 2000) return 'Keep replies under 2,000 characters';
      const signed = settings.signature && thread.kind === 'message' && !opts.template ? `${body}\n${settings.signature}` : body;
      const at = now();
      const message: SocialMessage = { id: uid('sm'), threadId, direction: 'out', author: owner.name, text: signed, media: opts.media, at, status: 'sent', template: opts.template };
      set((s) => ({ socialMessages: [...s.socialMessages, message] }));
      mapThread(threadId, (t) => ({
        ...t,
        unread: 0,
        status: 'pending',
        lastAt: at,
        firstResponseMins: t.firstResponseMins ?? (t.lastInboundAt ? Math.max(1, Math.round((Date.parse(at) - Date.parse(t.lastInboundAt)) / 60_000)) : undefined),
      }));
      deliver(message.id, thread.network, thread.kind);
      return null;
    },

    addSocialNote: (threadId, text) => {
      const own = ownThread(threadId);
      if (typeof own === 'string') return own;
      if (!text.trim()) return 'Write the note first';
      set((s) => ({ socialMessages: [...s.socialMessages, { id: uid('sm'), threadId, direction: 'note', author: own.owner.name, text: text.trim(), at: now() }] }));
      return null;
    },

    markSocialThreadRead: (threadId) => mapThread(threadId, (t) => (t.unread ? { ...t, unread: 0 } : t)),

    setSocialThreadStatus: (threadId, status, snoozeHours) => {
      const own = ownThread(threadId);
      if (typeof own === 'string') return own;
      const until = status === 'pending' && snoozeHours && snoozeHours > 0 ? new Date(Date.now() + snoozeHours * 3_600_000).toISOString() : undefined;
      mapThread(threadId, (t) => ({ ...t, status, snoozedUntil: until, unread: status === 'done' ? 0 : t.unread }));
      return null;
    },

    toggleSocialThreadStar: (threadId) => mapThread(threadId, (t) => ({ ...t, starred: !t.starred })),

    setSocialThreadLabels: (threadId, labels) => mapThread(threadId, (t) => ({ ...t, labels: [...new Set(labels.map((l) => l.trim()).filter(Boolean))].slice(0, 8) })),

    assignSocialThread: (threadId, assignee) => mapThread(threadId, (t) => ({ ...t, assignee: assignee?.trim() || undefined })),

    createLeadFromSocialThread: (threadId, input) => {
      const own = ownThread(threadId);
      if (typeof own === 'string') return { error: own };
      const { thread, owner } = own;
      if (thread.leadId && get().leads.some((l) => l.id === thread.leadId)) return { error: 'This conversation is already a lead' };
      if (!owner.listingId) return { error: 'Set up your listing first' };
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.eventDate)) return { error: 'Pick the event date' };
      if (!input.functions.length) return { error: 'Pick at least one function' };
      const lastIn = get().socialMessages.filter((m) => m.threadId === threadId && m.direction === 'in').pop();
      const lead = get().createLead({
        listingKind: owner.listingKind ?? 'vendor',
        listingId: owner.listingId,
        listingName: owner.businessName ?? owner.name,
        customerId: `social_${thread.id}`,
        customerName: thread.contactName,
        customerPhone: (input.phone ?? thread.contactPhone ?? '').replace(/\D/g, '').slice(-10),
        city: owner.city,
        eventDate: input.eventDate,
        guests: input.guests && input.guests > 0 ? Math.round(input.guests) : undefined,
        functions: input.functions,
        budget: input.budget && input.budget > 0 ? Math.round(input.budget) : undefined,
        message: lastIn?.text,
        source: 'social',
        labels: [NETWORK_BY_ID[thread.network].label],
      });
      mapThread(threadId, (t) => ({ ...t, leadId: lead.id, labels: [...new Set([...t.labels, 'Hot lead'])] }));
      get().log(currentActor(), 'social.lead', 'lead', lead.id, `${NETWORK_BY_ID[thread.network].label} ${thread.contactHandle}`);
      return { leadId: lead.id };
    },

    saveSocialPost: (input) => {
      const owner = business();
      if (typeof owner === 'string') return { error: owner };
      const existing = input.id ? get().socialPosts.find((p) => p.id === input.id && p.ownerId === owner.id) : undefined;
      if (input.id && !existing) return { error: 'Post not found' };
      if (existing && (existing.status === 'published' || existing.status === 'partial' || existing.status === 'publishing')) return { error: 'A published post can’t be edited. Duplicate it instead.' };
      const at = now();
      const post: SocialPost = {
        id: existing?.id ?? uid('sp'),
        ownerId: owner.id,
        caption: input.caption,
        overrides: Object.fromEntries(Object.entries(input.overrides ?? existing?.overrides ?? {}).filter(([, v]) => v?.trim())),
        media: input.media.slice(0, 35),
        networks: [...new Set(input.networks)],
        link: input.link?.trim() || undefined,
        firstComment: input.firstComment?.trim() || undefined,
        campaign: input.campaign?.trim() || undefined,
        status: 'draft',
        scheduledAt: undefined,
        results: {},
        createdAt: existing?.createdAt ?? at,
        updatedAt: at,
      };
      set((s) => ({ socialPosts: existing ? s.socialPosts.map((p) => (p.id === post.id ? post : p)) : [post, ...s.socialPosts] }));
      return { id: post.id };
    },

    scheduleSocialPost: (postId, at) => {
      const own = ownPost(postId);
      if (typeof own === 'string') return own;
      const { post } = own;
      if (post.status !== 'draft' && post.status !== 'scheduled' && post.status !== 'failed') return 'Only drafts can be scheduled';
      if (!Number.isFinite(Date.parse(at))) return 'Pick a date and time';
      const checks = checkPost({ ...post, scheduledAt: at }, get().socialAccounts.filter((a) => a.ownerId === post.ownerId), now());
      const error = checks.flatMap((c) => c.errors)[0];
      if (!post.networks.length) return 'Pick at least one network';
      if (error) return error;
      mapPost(postId, (p) => ({ ...p, status: 'scheduled', scheduledAt: new Date(at).toISOString(), results: Object.fromEntries(p.networks.map((n) => [n, { status: 'queued' }])) }));
      get().log(currentActor(), 'social.schedule', 'social_post', postId, at);
      return null;
    },

    publishSocialPost: (postId) => {
      const own = ownPost(postId);
      if (typeof own === 'string') return own;
      const { post } = own;
      if (!post.networks.length) return 'Pick at least one network';
      if (post.status === 'publishing') return 'Already publishing';
      if (post.status === 'published') return 'Already published';
      return startPublishing({ ...post, results: {}, scheduledAt: undefined }, post.networks);
    },

    retrySocialPost: (postId, network) => {
      const own = ownPost(postId);
      if (typeof own === 'string') return own;
      const { post } = own;
      if (post.results[network]?.status !== 'failed') return 'Only a failed network can be retried';
      return startPublishing(post, [network]);
    },

    duplicateSocialPost: (postId) => {
      const own = ownPost(postId);
      if (typeof own === 'string') return own;
      const at = now();
      const copy: SocialPost = { ...own.post, id: uid('sp'), status: 'draft', scheduledAt: undefined, publishedAt: undefined, results: {}, createdAt: at, updatedAt: at };
      set((s) => ({ socialPosts: [copy, ...s.socialPosts] }));
      return copy.id;
    },

    deleteSocialPost: (postId) => {
      const own = ownPost(postId);
      if (typeof own === 'string') return own;
      if (own.post.status === 'publishing') return 'Wait until publishing finishes';
      set((s) => ({ socialPosts: s.socialPosts.filter((p) => p.id !== postId) }));
      return null;
    },

    runDueSocialPosts: () => {
      const nowIso = now();
      if (get().socialThreads.some((t) => t.snoozedUntil && t.snoozedUntil <= nowIso)) set((s) => ({ socialThreads: s.socialThreads.map((t) => (t.snoozedUntil && t.snoozedUntil <= nowIso ? { ...t, status: 'open', snoozedUntil: undefined } : t)) }));
      // Tokens that ran out need a new consent before anything else goes out.
      if (get().socialAccounts.some((a) => a.status === 'connected' && a.expiresAt && a.expiresAt <= nowIso)) set((s) => ({ socialAccounts: s.socialAccounts.map((a) => (a.status === 'connected' && a.expiresAt && a.expiresAt <= nowIso ? { ...a, status: 'expired' } : a)) }));
      const due = get().socialPosts.filter((p) => p.status === 'scheduled' && p.scheduledAt && p.scheduledAt <= nowIso);
      due.forEach((p) => startPublishing({ ...p, results: {} }, p.networks));
      return due.length;
    },

    updateSocialSettings: (patch) => {
      const owner = business();
      if (typeof owner === 'string') return owner;
      const current = socialSettingsFor(get().socialSettings, owner.id);
      const next: SocialSettings = {
        ...current,
        ...patch,
        savedReplies: (patch.savedReplies ?? current.savedReplies).filter((r) => r.text.trim()).slice(0, 50),
        rules: (patch.rules ?? current.rules).filter((r) => r.reply.trim() && r.keywords.some((k) => k.trim())).slice(0, 30),
        away: patch.away ? { ...current.away, ...patch.away } : current.away,
        signature: patch.signature !== undefined ? patch.signature.trim() || undefined : current.signature,
      };
      if (!/^\d{2}:\d{2}$/.test(next.away.from) || !/^\d{2}:\d{2}$/.test(next.away.to)) return 'Use HH:MM for the away hours';
      set((s) => ({ socialSettings: { ...s.socialSettings, [owner.id]: next } }));
      return null;
    },

    mirrorSocialData: (ownerId, data) =>
      set((s) => {
        const old = new Set(s.socialThreads.filter((t) => t.ownerId === ownerId).map((t) => t.id));
        return {
          socialAccounts: [...s.socialAccounts.filter((a) => a.ownerId !== ownerId), ...data.accounts],
          socialThreads: [...s.socialThreads.filter((t) => t.ownerId !== ownerId), ...data.threads],
          socialMessages: [...s.socialMessages.filter((m) => !old.has(m.threadId)), ...data.messages],
          socialPosts: [...s.socialPosts.filter((p) => p.ownerId !== ownerId), ...data.posts],
          socialSettings: data.settings ? { ...s.socialSettings, [ownerId]: data.settings } : s.socialSettings,
        };
      }),
  };
};
