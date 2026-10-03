/**
 * Social hub on Supabase builds. Connecting a network opens its own consent
 * page through `social-oauth`; the tokens it returns are kept on the server
 * (`social_account_secrets`, service role only) and never reach the device.
 * Replies go out through `social-send`, posts through `social-publish`, and
 * the networks deliver new messages to `social-webhook`.
 *
 * With the mock backend none of this runs: the store's social actions stand
 * in for the networks.
 */
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { ENV, usesSupabase } from '@/constants/env';
import { useDb } from '@/store/useDb';
import type { SocialAccount, SocialMedia, SocialMessage, SocialNetwork, SocialPost, SocialSettings, SocialThread } from '@/types/platform';

import { getAccessToken } from './auth';
import { rpc } from './supabase';
import { failResult, okResult, type Result } from './types';

/** True when the hub talks to the real networks instead of the demo. */
export const socialLive = () => usesSupabase();

/** Where the network's consent page sends the business back to. */
export const socialReturnUrl = () =>
  Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.origin}/business/social?tab=accounts` : Linking.createURL('business/social', { queryParams: { tab: 'accounts' } });

async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<Result<T>> {
  if (!ENV.supabaseUrl) return failResult('Social accounts aren’t set up in this build');
  const token = await getAccessToken();
  if (!token) return failResult('Sign in again to continue');
  try {
    const res = await fetch(`${ENV.supabaseUrl}/functions/v1/${name}`, {
      method: 'POST',
      headers: { apikey: ENV.supabasePublishableKey ?? '', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const out = (await res.json().catch(() => ({}))) as T & { message?: string };
    if (!res.ok) return failResult(out.message || `Request failed (${res.status})`);
    return okResult(out);
  } catch {
    return failResult('No connection. Check your internet and try again.');
  }
}

/** Opens the network's consent page (Facebook Login for Facebook, Instagram and WhatsApp; TikTok Login Kit for TikTok). */
export async function startSocialConnect(network: SocialNetwork): Promise<Result<{ url: string }>> {
  const started = await callFunction<{ url: string }>('social-oauth', { action: 'start', network, returnTo: socialReturnUrl() });
  if (!started.ok) return started;
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.assign(started.value.url);
  else await Linking.openURL(started.value.url);
  return started;
}

/** Sends a reply (or an approved WhatsApp template) through the network. */
export const sendSocialReplyLive = (threadId: string, text: string, template?: string) => callFunction<{ messageId: string }>('social-send', { threadId, text, template: template ?? null });

/** Publishes a saved post to its networks now. */
export const publishSocialPostLive = (postId: string) => callFunction<{ results: Record<string, { status: string; error?: string }> }>('social-publish', { postId });

const UUID = /^[0-9a-f-]{36}$/i;

/** Saves a draft on the server (a new one when the id is still a device id). Returns the server's post id. */
export const saveSocialPostLive = (post: Pick<SocialPost, 'id' | 'caption' | 'overrides' | 'media' | 'networks' | 'link' | 'firstComment' | 'campaign'>) =>
  rpc<string>('rpc_social_save_post', {
    p_post: { id: UUID.test(post.id) ? post.id : null, caption: post.caption, overrides: post.overrides, media: post.media, networks: post.networks, link: post.link ?? '', firstComment: post.firstComment ?? '', campaign: post.campaign ?? '' },
  });

/** Deletes a post (RLS lets members delete anything not mid-publish). */
export async function deleteSocialPostLive(postId: string): Promise<Result<void>> {
  if (!UUID.test(postId)) return okResult(undefined);
  const token = await getAccessToken();
  if (!ENV.supabaseUrl || !token) return failResult('Sign in again to continue');
  try {
    const res = await fetch(`${ENV.supabaseUrl}/rest/v1/social_posts?id=eq.${postId}`, { method: 'DELETE', headers: { apikey: ENV.supabasePublishableKey ?? '', Authorization: `Bearer ${token}` } });
    return res.ok ? okResult(undefined) : failResult(`Could not delete the post (${res.status})`);
  } catch {
    return failResult('No connection. Check your internet and try again.');
  }
}

/**
 * Saves the composer's post on the server and then publishes it now or
 * schedules it. Returns the server's post id.
 */
export async function sendSocialPostLive(post: SocialPost, when: { at?: string }): Promise<Result<string>> {
  const saved = await saveSocialPostLive(post);
  if (!saved.ok) return saved;
  const done = when.at ? await rpc<void>('rpc_social_schedule', { p_post: saved.value, p_at: when.at }) : await publishSocialPostLive(saved.value);
  return done.ok ? okResult(saved.value) : failResult(done.error);
}

/** Inbox triage on the server: status (and snooze), star, labels, read. */
export const triageSocialLive = (threadId: string, patch: { status?: string; snoozedUntil?: string | null; starred?: boolean; labels?: string[]; read?: boolean; assignee?: string | null }) =>
  UUID.test(threadId) ? rpc<void>('rpc_social_triage', { p_thread: threadId, p_patch: patch }) : Promise.resolve(okResult(undefined));

/** An internal note on the server. */
export const noteSocialLive = (threadId: string, text: string) => rpc<string>('rpc_social_note', { p_thread: threadId, p_text: text });

/** Turns a server thread into a CRM lead (rpc_social_lead). */
export const leadSocialLive = (threadId: string, input: { eventDate: string; guests?: number; functions: string[]; budget?: number; phone?: string }) =>
  rpc<string>('rpc_social_lead', { p_thread: threadId, p_event_date: input.eventDate, p_guests: input.guests ?? null, p_functions: input.functions, p_budget: input.budget ?? null, p_phone: input.phone ?? null });

/** Records (or withdraws) a WhatsApp customer's consent to broadcasts. */
export const optInSocialLive = (threadId: string, on: boolean) => rpc<void>('rpc_social_optin', { p_thread: threadId, p_on: on });

/** Disconnects a network on the server; its token is deleted. */
export const disconnectSocialLive = (accountId: string) => rpc<void>('rpc_social_disconnect', { p_account: accountId });

/** Saves the automation (owners and managers). */
export const saveSocialSettingsLive = (settings: SocialSettings) => rpc<void>('rpc_social_save_settings', { p_settings: settings });

interface Row {
  [key: string]: unknown;
}

const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

/** The server's hub (rpc_social_inbox) in the app's shapes, owned by this device's business account. */
export function mapSocialInbox(ownerId: string, d: { accounts?: Row[]; threads?: Row[]; messages?: Row[]; posts?: Row[]; settings?: Row | null }) {
  const accounts: SocialAccount[] = (d.accounts ?? []).map((a) => ({
    id: String(a.id),
    ownerId,
    network: a.network as SocialNetwork,
    handle: String(a.handle),
    name: String(a.name),
    status: a.status as SocialAccount['status'],
    followers: Number(a.followers) || 0,
    scopes: (a.scopes as string[]) ?? [],
    connectedAt: String(a.connected_at),
    expiresAt: str(a.expires_at),
    lastSyncAt: str(a.last_sync_at),
  }));
  const threads: SocialThread[] = (d.threads ?? []).map((t) => ({
    id: String(t.id),
    ownerId,
    accountId: String(t.account_id),
    network: t.network as SocialNetwork,
    kind: t.kind as SocialThread['kind'],
    contactName: String(t.contact_name),
    contactHandle: str(t.contact_handle) ?? String(t.contact_name),
    contactPhone: str(t.contact_phone),
    postId: str(t.post_id),
    postCaption: str(t.post_caption),
    status: t.status as SocialThread['status'],
    snoozedUntil: str(t.snoozed_until),
    starred: !!t.starred,
    labels: (t.labels as string[]) ?? [],
    leadId: str(t.lead_id),
    assignee: str(t.assignee_name),
    optedIn: t.opted_in === true ? true : undefined,
    unread: Number(t.unread) || 0,
    lastAt: String(t.last_at),
    lastInboundAt: str(t.last_inbound_at),
    firstResponseMins: typeof t.first_response_mins === 'number' ? t.first_response_mins : undefined,
  }));
  const messages: SocialMessage[] = (d.messages ?? []).map((m) => ({
    id: String(m.id),
    threadId: String(m.thread_id),
    direction: m.direction as SocialMessage['direction'],
    text: String(m.body ?? ''),
    at: String(m.created_at),
    author: str(m.author_name),
    media: (m.media as SocialMedia[]) ?? undefined,
    status: (m.status as SocialMessage['status']) ?? undefined,
    auto: !!m.auto,
    template: str(m.template),
    error: str(m.error),
  }));
  const posts: SocialPost[] = (d.posts ?? []).map((p) => ({
    id: String(p.id),
    ownerId,
    caption: String(p.caption ?? ''),
    overrides: (p.overrides as SocialPost['overrides']) ?? {},
    media: (p.media as SocialMedia[]) ?? [],
    networks: (p.networks as SocialNetwork[]) ?? [],
    link: str(p.link),
    firstComment: str(p.first_comment),
    campaign: str(p.campaign),
    status: p.status as SocialPost['status'],
    scheduledAt: str(p.scheduled_at),
    publishedAt: str(p.published_at),
    results: Object.fromEntries(
      ((p.targets as Row[]) ?? []).map((x) => [
        x.network,
        { status: x.status, url: str(x.url), error: str(x.error), at: str(x.published_at), reach: x.reach ?? undefined, likes: x.likes ?? undefined, comments: x.comments ?? undefined, shares: x.shares ?? undefined, saves: x.saves ?? undefined },
      ]),
    ) as SocialPost['results'],
    createdAt: String(p.created_at),
    updatedAt: String(p.updated_at),
  }));
  const s = d.settings;
  const settings: SocialSettings | undefined = s
    ? { savedReplies: (s.saved_replies as SocialSettings['savedReplies']) ?? [], rules: (s.rules as SocialSettings['rules']) ?? [], away: s.away as SocialSettings['away'], signature: str(s.signature) }
    : undefined;
  return { accounts, threads, messages, posts, settings };
}

/** Reads the hub from the server into the device's mirror (on opening the hub, on refresh and after each change). */
export async function syncSocialFromServer(ownerId: string): Promise<Result<void>> {
  const res = await rpc<{ accounts?: Row[]; threads?: Row[]; messages?: Row[]; posts?: Row[]; settings?: Row | null }>('rpc_social_inbox', {});
  if (!res.ok) return res;
  useDb.getState().mirrorSocialData(ownerId, mapSocialInbox(ownerId, res.value));
  return okResult(undefined);
}
