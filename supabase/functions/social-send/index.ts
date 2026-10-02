/**
 * social-send: a reply from the unified inbox goes out on its network.
 *
 *   POST { "threadId": uuid, "text": "…", "template": null | "follow_up" } (Authorization: Bearer <user JWT>)
 *        → { messageId }
 *
 * The caller must belong to the business (vivah_social_send_context refuses
 * anyone else). The networks' reply rules are enforced here as in the app:
 * within 24 hours of the customer's last message any reply is fine; after
 * that Messenger and Instagram allow a person's reply for 7 days with the
 * HUMAN_AGENT tag, and WhatsApp needs an approved template. Comments can
 * always be answered. The reply (or the network's refusal) is recorded with
 * vivah_social_record_out.
 */
import { deno, redis, socialConfig } from '../_shared/env.ts';
import { fail, json, preflight } from '../_shared/http.ts';
import { LIMITS, rateLimit } from '../_shared/ratelimit.ts';
import { type Network, networkError, refusedBy, replyId, replyRequest, replyWindowState } from '../_shared/social.ts';
import { callerId, serviceRpc } from '../_shared/supabase.ts';

interface SendContext {
  threadId: string;
  network: Network;
  kind: 'message' | 'comment';
  accountStatus: 'connected' | 'expired' | 'disconnected';
  accountExternalId: string;
  contact: string;
  contactName: string;
  commentId: string | null;
  postId: string | null;
  lastInboundAt: string | null;
  token: string | null;
  meta: Record<string, string> | null;
}

deno().serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  if (req.method !== 'POST') return fail('Use POST', 405);
  const userId = await callerId(req);
  if (!userId) return fail('Sign in again to reply', 401);

  let body: { threadId?: unknown; text?: unknown; template?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail('Send JSON with a threadId and text');
  }
  const threadId = String(body.threadId ?? '');
  const text = String(body.text ?? '').trim();
  const template = typeof body.template === 'string' && /^[a-z0-9_]{1,60}$/.test(body.template) ? body.template : null;
  if (!/^[0-9a-f-]{36}$/i.test(threadId)) return fail('threadId must be a uuid');
  if (!text && !template) return fail('Write a reply first');
  if (text.length > 2000) return fail('Keep replies under 2,000 characters');

  const verdict = await rateLimit(redis(), `social-send:${userId}`, LIMITS.socialRepliesPerUser);
  if (!verdict.allowed) return json({ message: 'Reply limit reached for this hour. Try again later.' }, 429, { 'Retry-After': String(verdict.retryAfter) });

  const ctx = await serviceRpc<SendContext | null>('vivah_social_send_context', { p_user: userId, p_thread: threadId });
  if (!ctx) return fail('Conversation not found', 404);
  if (ctx.accountStatus !== 'connected' || !ctx.token) return fail('Reconnect this account to reply', 409);

  const window = replyWindowState(ctx.network, ctx.kind, ctx.lastInboundAt);
  if (window === 'closed') return fail('This network no longer allows replies here. Wait for the customer to write again.', 409);
  if (window === 'template' && !template) return fail('The 24-hour window has closed. Send an approved template.', 409);

  const cfg = socialConfig();
  const first = (ctx.contactName || '').replace(/^[@+]/, '').split(/[\s._]/)[0] || 'there';
  const request = replyRequest(
    {
      network: ctx.network,
      kind: ctx.kind,
      accountExternalId: ctx.accountExternalId,
      contact: ctx.contact,
      commentId: ctx.commentId,
      postId: ctx.postId,
      text,
      token: ctx.token,
      meta: ctx.meta ?? {},
      humanAgent: window === 'human_agent',
      template: template && ctx.network === 'whatsapp' ? { name: template, language: cfg.whatsappLanguage, params: [first] } : null,
    },
    cfg.graphVersion,
  );
  const res = await fetch(request.url, { method: request.method, headers: request.headers, body: request.body });
  const out = await res.json().catch(() => ({}));
  if (refusedBy(res, out)) {
    const error = networkError(out, res.status);
    await serviceRpc('vivah_social_record_out', { p_user: userId, p_thread: threadId, p_text: text || `Template: ${template}`, p_external_id: null, p_template: template, p_status: 'failed', p_error: error });
    return fail(error, 502);
  }
  const messageId = await serviceRpc<string>('vivah_social_record_out', { p_user: userId, p_thread: threadId, p_text: text || `Template: ${template}`, p_external_id: replyId(ctx.network, out) ?? null, p_template: template, p_status: 'sent', p_error: null });
  return json({ messageId });
});
