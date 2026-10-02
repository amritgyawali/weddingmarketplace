/**
 * social-webhook: where the networks deliver what happens on a connected
 * account.
 *
 *   GET  ?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…   Meta's subscription check
 *   POST (X-Hub-Signature-256)   Meta: Messenger and Instagram messages, page
 *        and Instagram comments, WhatsApp messages and delivery receipts
 *        → vivah_social_ingest, which stores each message once (retries are
 *          matched by the network's id), wakes the thread and tells the team
 *   POST (TikTok-Signature)      TikTok: how a post it was pulling went
 *        → vivah_social_publish_update
 *
 * Only signed requests are accepted (META_APP_SECRET, TIKTOK_CLIENT_SECRET).
 * Answers 200 quickly so the networks don't retry. The networks call without
 * a user session, so config.toml turns off JWT verification.
 */
import { deno, socialConfig } from '../_shared/env.ts';
import { fail, json, safeEqual } from '../_shared/http.ts';
import { type MetaWebhook, parseMetaWebhook, parseTikTokWebhook, type TikTokWebhook, verifyMetaSignature, verifyTikTokSignature } from '../_shared/social.ts';
import { serviceRpc } from '../_shared/supabase.ts';

deno().serve(async (req) => {
  const cfg = socialConfig();

  if (req.method === 'GET') {
    const q = new URL(req.url).searchParams;
    if (q.get('hub.mode') === 'subscribe' && cfg.metaVerifyToken && safeEqual(q.get('hub.verify_token') ?? '', cfg.metaVerifyToken)) return new Response(q.get('hub.challenge') ?? '', { status: 200 });
    return fail('Forbidden', 403);
  }
  if (req.method !== 'POST') return fail('Use POST', 405);

  const raw = await req.text();
  const metaSig = req.headers.get('x-hub-signature-256');
  const tiktokSig = req.headers.get('tiktok-signature');

  if (metaSig) {
    if (!cfg.metaAppSecret || !(await verifyMetaSignature(raw, metaSig, cfg.metaAppSecret))) return fail('Bad signature', 401);
    let body: MetaWebhook;
    try {
      body = JSON.parse(raw) as MetaWebhook;
    } catch {
      return fail('Send JSON');
    }
    const events = parseMetaWebhook(body);
    const stored = events.length ? await serviceRpc<number>('vivah_social_ingest', { p_events: events }) : 0;
    return json({ received: events.length, stored });
  }

  if (tiktokSig) {
    if (!cfg.tiktokClientSecret || !(await verifyTikTokSignature(raw, tiktokSig, cfg.tiktokClientSecret))) return fail('Bad signature', 401);
    let body: TikTokWebhook;
    try {
      body = JSON.parse(raw) as TikTokWebhook;
    } catch {
      return fail('Send JSON');
    }
    const updates = parseTikTokWebhook(body);
    for (const u of updates) await serviceRpc('vivah_social_publish_update', { p_network: 'tiktok', p_external_id: u.publishId, p_status: u.status, p_url: null, p_error: u.error ?? null });
    return json({ received: updates.length });
  }

  return fail('Unsigned request', 401);
});
