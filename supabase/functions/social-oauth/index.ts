/**
 * social-oauth: connects a business's Facebook page, Instagram profile,
 * WhatsApp Business number or TikTok account.
 *
 *   POST { "action": "start", "network": "instagram", "returnTo": "<app url>" } (Authorization: Bearer <user JWT>)
 *        → { url }   the network's consent page, with a signed state
 *   GET  ?code=…&state=…   the network sends the browser back here
 *        → exchanges the code for tokens, finds the page / profile / number,
 *          saves it with vivah_social_save_account (tokens go to
 *          social_account_secrets, readable by the service role only)
 *        → 302 to returnTo?connected=<network> (or ?social_error=…)
 *
 * Meta: the code becomes a long-lived user token (about 60 days); Facebook
 * and Instagram keep the page token it gives, WhatsApp the token and the
 * WhatsApp Business account it was granted. TikTok: access and refresh
 * tokens (social-publish refreshes the access token as needed).
 * The network calls back without a user session, so config.toml turns off
 * JWT verification; the start step checks the caller itself.
 */
import { appUrl, deno, functionsUrl, paymentReturnHosts, redis, socialConfig } from '../_shared/env.ts';
import { fail, json, preflight } from '../_shared/http.ts';
import { LIMITS, rateLimit } from '../_shared/ratelimit.ts';
import { allowedReturn, authorizeUrl, graphBase, isNetwork, type Network, readState, signState, TIKTOK_API, withQuery } from '../_shared/social.ts';
import { callerId, serviceRpc } from '../_shared/supabase.ts';

const redirectUri = () => `${functionsUrl()}/social-oauth`;

interface Saved {
  externalId: string;
  handle: string;
  name: string;
  followers: number;
  token: string;
  refresh?: string;
  expiresAt?: string;
  meta: Record<string, string>;
  scopes: string[];
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = (await res.json().catch(() => ({}))) as T & { error?: { code?: number | string; message?: string } | string; error_description?: string };
  const err = body.error;
  // Meta errors carry a numeric code; TikTok answers every call with error.code "ok" on success, or a string error from its token endpoint.
  const refused = !res.ok || (typeof err === 'string' && err.length > 0) || (typeof err === 'object' && err !== null && (err.code === undefined ? !!err.message : err.code !== 'ok' && err.code !== 0));
  if (refused) {
    const message = typeof err === 'object' && err ? err.message : (body.error_description ?? err);
    throw new Error(message || `Request failed (${res.status})`);
  }
  return body;
}

/** Meta: code → long-lived user token → the page, Instagram profile or WhatsApp number it can manage. */
async function connectMeta(network: Exclude<Network, 'tiktok'>, code: string): Promise<Saved> {
  const cfg = socialConfig();
  const graph = graphBase(cfg.graphVersion);
  const short = await getJson<{ access_token: string }>(`${graph}/oauth/access_token?${new URLSearchParams({ client_id: cfg.metaAppId!, client_secret: cfg.metaAppSecret!, redirect_uri: redirectUri(), code })}`);
  const long = await getJson<{ access_token: string; expires_in?: number }>(`${graph}/oauth/access_token?${new URLSearchParams({ grant_type: 'fb_exchange_token', client_id: cfg.metaAppId!, client_secret: cfg.metaAppSecret!, fb_exchange_token: short.access_token })}`);
  const userToken = long.access_token;
  const expiresAt = new Date(Date.now() + (long.expires_in ?? 60 * 86_400) * 1000).toISOString();

  if (network === 'whatsapp') {
    const debug = await getJson<{ data?: { scopes?: string[]; granular_scopes?: { scope: string; target_ids?: string[] }[] } }>(`${graph}/debug_token?${new URLSearchParams({ input_token: userToken, access_token: `${cfg.metaAppId}|${cfg.metaAppSecret}` })}`);
    const waba = debug.data?.granular_scopes?.find((s) => s.scope === 'whatsapp_business_management')?.target_ids?.[0];
    if (!waba) throw new Error('No WhatsApp Business account was shared. Pick one on the consent page.');
    const phones = await getJson<{ data: { id: string; display_phone_number: string; verified_name?: string }[] }>(`${graph}/${waba}/phone_numbers?fields=id,display_phone_number,verified_name`, { headers: { Authorization: `Bearer ${userToken}` } });
    const phone = phones.data[0];
    if (!phone) throw new Error('That WhatsApp Business account has no phone number yet');
    // Receive this number's messages on our webhook.
    await fetch(`${graph}/${waba}/subscribed_apps`, { method: 'POST', headers: { Authorization: `Bearer ${userToken}` } });
    return { externalId: phone.id, handle: phone.display_phone_number, name: phone.verified_name ?? phone.display_phone_number, followers: 0, token: userToken, expiresAt, meta: { wabaId: waba }, scopes: debug.data?.scopes ?? [] };
  }

  const pages = await getJson<{ data: { id: string; name: string; access_token: string; fan_count?: number; instagram_business_account?: { id: string; username?: string; followers_count?: number } }[] }>(
    `${graph}/me/accounts?fields=id,name,access_token,fan_count,instagram_business_account{id,username,followers_count}`,
    { headers: { Authorization: `Bearer ${userToken}` } },
  );
  const scopes = network === 'facebook' ? ['pages_show_list', 'pages_manage_posts', 'pages_read_engagement', 'pages_messaging', 'pages_manage_engagement'] : ['instagram_basic', 'instagram_content_publish', 'instagram_manage_messages', 'instagram_manage_comments'];
  if (network === 'facebook') {
    const page = [...pages.data].sort((a, b) => (b.fan_count ?? 0) - (a.fan_count ?? 0))[0];
    if (!page) throw new Error('No Facebook page was shared. Pick your page on the consent page.');
    await fetch(`${graph}/${page.id}/subscribed_apps?subscribed_fields=messages,feed`, { method: 'POST', headers: { Authorization: `Bearer ${page.access_token}` } });
    return { externalId: page.id, handle: page.name, name: page.name, followers: page.fan_count ?? 0, token: page.access_token, meta: { pageId: page.id }, scopes };
  }
  const page = pages.data.find((p) => p.instagram_business_account);
  const ig = page?.instagram_business_account;
  if (!page || !ig) throw new Error('No Instagram business profile is linked to your Facebook pages');
  await fetch(`${graph}/${page.id}/subscribed_apps?subscribed_fields=messages,feed`, { method: 'POST', headers: { Authorization: `Bearer ${page.access_token}` } });
  return { externalId: ig.id, handle: ig.username ? `@${ig.username}` : page.name, name: page.name, followers: ig.followers_count ?? 0, token: page.access_token, meta: { pageId: page.id }, scopes };
}

/** TikTok: code → access and refresh tokens → the account's name and followers. */
async function connectTikTok(code: string): Promise<Saved> {
  const cfg = socialConfig();
  const tokens = await getJson<{ access_token: string; refresh_token: string; open_id: string; expires_in: number; refresh_expires_in: number; scope: string }>(`${TIKTOK_API}/v2/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key: cfg.tiktokClientKey!, client_secret: cfg.tiktokClientSecret!, code, grant_type: 'authorization_code', redirect_uri: redirectUri() }).toString(),
  });
  const info = await getJson<{ data?: { user?: { display_name?: string; username?: string; follower_count?: number } } }>(`${TIKTOK_API}/v2/user/info/?fields=open_id,display_name,username,follower_count`, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
  const user = info.data?.user ?? {};
  return {
    externalId: tokens.open_id,
    handle: user.username ? `@${user.username}` : (user.display_name ?? 'TikTok'),
    name: user.display_name ?? user.username ?? 'TikTok',
    followers: user.follower_count ?? 0,
    token: tokens.access_token,
    refresh: tokens.refresh_token,
    // The account needs a new consent when the refresh token runs out (a year).
    expiresAt: new Date(Date.now() + tokens.refresh_expires_in * 1000).toISOString(),
    meta: { accessExpiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString() },
    scopes: tokens.scope.split(','),
  };
}

deno().serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  const cfg = socialConfig();
  if (!cfg.stateSecret) return fail('Social accounts aren’t set up yet', 503);

  // The network sends the browser back.
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const state = await readState(url.searchParams.get('state'), cfg.stateSecret);
    if (!state) return new Response('This link has expired. Go back to Vivah and connect again.', { status: 400 });
    const back = (values: Record<string, string>) => Response.redirect(withQuery(state.r, values), 302);
    const code = url.searchParams.get('code');
    if (!code) return back({ social_error: url.searchParams.get('error_description') ?? url.searchParams.get('error') ?? 'cancelled' });
    try {
      const saved = state.n === 'tiktok' ? await connectTikTok(code) : await connectMeta(state.n, code);
      await serviceRpc('vivah_social_save_account', {
        p_user: state.u,
        p_network: state.n,
        p_external_id: saved.externalId,
        p_handle: saved.handle,
        p_name: saved.name,
        p_followers: saved.followers,
        p_scopes: saved.scopes,
        p_token: saved.token,
        p_refresh: saved.refresh ?? null,
        p_token_expires: saved.expiresAt ?? null,
        p_meta: saved.meta,
      });
      return back({ connected: state.n });
    } catch (e) {
      return back({ social_error: (e as Error).message.slice(0, 160) });
    }
  }

  if (req.method !== 'POST') return fail('Use POST', 405);
  const userId = await callerId(req);
  if (!userId) return fail('Sign in again to connect', 401);
  let body: { action?: unknown; network?: unknown; returnTo?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail('Send JSON with a network');
  }
  if (body.action !== 'start' || !isNetwork(body.network)) return fail('Say which network to connect');
  if (!allowedReturn(body.returnTo, appUrl(), paymentReturnHosts())) return fail('That return address isn’t allowed');
  const verdict = await rateLimit(redis(), `social-connect:${userId}`, LIMITS.socialConnectsPerUser);
  if (!verdict.allowed) return json({ message: 'Too many tries. Wait a little and connect again.' }, 429, { 'Retry-After': String(verdict.retryAfter) });

  const state = await signState({ u: userId, n: body.network, r: body.returnTo, exp: Date.now() + 15 * 60_000 }, cfg.stateSecret);
  const url = authorizeUrl(body.network, { metaAppId: cfg.metaAppId, metaConfigId: cfg.metaConfigId, tiktokClientKey: cfg.tiktokClientKey, graphVersion: cfg.graphVersion }, redirectUri(), state);
  const keys = body.network === 'tiktok' ? cfg.tiktokClientSecret : cfg.metaAppSecret;
  if (!url || !keys) return fail(`${body.network === 'tiktok' ? 'TikTok' : 'Meta'} isn’t set up yet`, 503);
  return json({ url });
});
