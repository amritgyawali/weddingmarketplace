/**
 * social-publish: sends one post to every network it was written for.
 *
 *   POST { "postId": uuid } (Authorization: Bearer <user JWT>)   publish now
 *        → { status, results: { facebook: { status, url?, error? }, … } }
 *   POST { "due": true } (x-webhook-secret: NOTIFY_WEBHOOK_SECRET)   the scheduled run
 *        (job_social_due in 0018, every five minutes through pg_cron and pg_net)
 *        → claims the due posts (vivah_social_claim_due) and publishes each
 *
 * Each network follows its own steps (publishTo in _shared/social.ts) and
 * its outcome is recorded with vivah_social_target_result, which also sets
 * the post's status: published, partly published or failed. TikTok pulls the
 * files itself and reports back through social-webhook. WhatsApp sends the
 * approved broadcast template to customers who agreed to updates. Expired
 * TikTok access tokens are refreshed with the stored refresh token first.
 */
import { deno, env, redis, socialConfig } from '../_shared/env.ts';
import { fail, json, preflight, safeEqual } from '../_shared/http.ts';
import { LIMITS, rateLimit } from '../_shared/ratelimit.ts';
import { mediaUrls, type Network, publishTo, TIKTOK_API } from '../_shared/social.ts';
import { callerId, serviceRpc } from '../_shared/supabase.ts';

interface Target {
  network: Network;
  accountId: string | null;
  accountStatus: string | null;
  accountExternalId: string | null;
  handle: string | null;
  token: string | null;
  refreshToken: string | null;
  meta: Record<string, string> | null;
  targetStatus: string | null;
}

interface Context {
  post: { id: string; caption: string; overrides: Partial<Record<Network, string>>; media: { kind?: string; publicId?: string; uri?: string }[]; link: string | null; first_comment: string | null; status: string; org_id: string };
  targets: Target[];
}

/** A fresh TikTok access token when the stored one has run out (they last a day); the new one is saved. */
async function tiktokToken(t: Target): Promise<string | null> {
  const cfg = socialConfig();
  const expires = t.meta?.accessExpiresAt ? Date.parse(t.meta.accessExpiresAt) : 0;
  if (t.token && expires > Date.now() + 60_000) return t.token;
  if (!t.refreshToken || !t.accountId || !cfg.tiktokClientKey || !cfg.tiktokClientSecret) return t.token;
  const res = await fetch(`${TIKTOK_API}/v2/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key: cfg.tiktokClientKey, client_secret: cfg.tiktokClientSecret, grant_type: 'refresh_token', refresh_token: t.refreshToken }).toString(),
  });
  const out = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (!out.access_token) return t.token;
  await serviceRpc('vivah_social_update_token', { p_account: t.accountId, p_token: out.access_token, p_meta: { accessExpiresAt: new Date(Date.now() + (out.expires_in ?? 86_400) * 1000).toISOString() } });
  return out.access_token;
}

const PUBLISHABLE = new Set(['draft', 'scheduled', 'failed', 'partial', 'publishing']);

/** Publishes one post to each network not yet published and records every outcome. */
async function publish(postId: string, userId: string | null): Promise<{ status: string; results: Record<string, { status: string; url?: string; error?: string }> } | null | 'busy'> {
  const ctx = await serviceRpc<Context | null>('vivah_social_publish_context', { p_post: postId, p_user: userId });
  if (!ctx) return null;
  if (!PUBLISHABLE.has(ctx.post.status) || (userId && ctx.post.status === 'publishing')) return 'busy';
  await serviceRpc('vivah_social_begin', { p_post: postId });
  const cfg = socialConfig();
  const media = mediaUrls(ctx.post.media ?? [], cfg.cloudinaryCloudName);
  const results: Record<string, { status: string; url?: string; error?: string }> = {};
  let status = 'publishing';
  for (const t of ctx.targets) {
    if (t.targetStatus === 'published') {
      results[t.network] = { status: 'published' };
      continue;
    }
    let r: { status: string; externalId?: string; url?: string; error?: string };
    if (!t.accountExternalId || !t.token || t.accountStatus !== 'connected') {
      r = { status: 'failed', error: t.accountStatus === 'expired' ? 'Access expired. Reconnect and try again.' : 'Not connected' };
    } else {
      const token = t.network === 'tiktok' ? ((await tiktokToken(t)) ?? t.token) : t.token;
      const contacts = t.network === 'whatsapp' ? await serviceRpc<string[]>('vivah_social_broadcast_list', { p_org: ctx.post.org_id }) : [];
      r = await publishTo(
        { network: t.network, accountExternalId: t.accountExternalId, handle: t.handle ?? undefined, token, meta: t.meta ?? {} },
        { id: ctx.post.id, caption: ctx.post.overrides?.[t.network]?.trim() || ctx.post.caption, media, link: ctx.post.link, firstComment: ctx.post.first_comment },
        fetch,
        { graphVersion: cfg.graphVersion, tiktokPrivacy: cfg.tiktokPrivacy, whatsappTemplate: cfg.whatsappTemplate, whatsappLanguage: cfg.whatsappLanguage, whatsappContacts: contacts ?? [] },
      );
    }
    results[t.network] = { status: r.status, url: r.url, error: r.error };
    status = await serviceRpc<string>('vivah_social_target_result', { p_post: postId, p_network: t.network, p_status: r.status, p_external_id: r.externalId ?? null, p_url: r.url ?? null, p_error: r.error ?? null });
  }
  return { status, results };
}

deno().serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  if (req.method !== 'POST') return fail('Use POST', 405);
  let body: { postId?: unknown; due?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail('Send JSON with a postId');
  }

  // The scheduled run, called by the database with the shared secret.
  if (body.due === true) {
    const secret = env('NOTIFY_WEBHOOK_SECRET');
    if (!secret || !safeEqual(req.headers.get('x-webhook-secret') ?? '', secret)) return fail('Forbidden', 403);
    const ids = await serviceRpc<string[]>('vivah_social_claim_due', { p_limit: 20 });
    const done: Record<string, unknown> = {};
    for (const id of ids ?? []) done[id] = await publish(id, null);
    return json({ published: Object.keys(done).length, posts: done });
  }

  const userId = await callerId(req);
  if (!userId) return fail('Sign in again to publish', 401);
  const postId = String(body.postId ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(postId)) return fail('postId must be a uuid');
  const verdict = await rateLimit(redis(), `social-publish:${userId}`, LIMITS.socialPublishesPerUser);
  if (!verdict.allowed) return json({ message: 'Publishing limit reached for this hour. Try again later.' }, 429, { 'Retry-After': String(verdict.retryAfter) });
  const out = await publish(postId, userId);
  if (!out) return fail('Post not found', 404);
  if (out === 'busy') return fail('This post is already published or publishing', 409);
  return json(out);
});
