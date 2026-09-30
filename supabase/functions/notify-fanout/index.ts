/**
 * notify-fanout: called by the database for each new notification row
 * (vivah_fanout_notification in 0012, through pg_net), with a shared secret.
 * Loads the recipient's tokens, email and preferences, then sends Expo push
 * (batches of 100) and a Resend email as planFanout() decides.
 *
 *   POST { "notification_id": "<uuid>" } (x-webhook-secret: NOTIFY_WEBHOOK_SECRET)
 */
import { appUrl, deno, env } from '../_shared/env.ts';
import { planFanout, type FanoutTarget } from '../_shared/fanout.ts';
import { fail, json, safeEqual } from '../_shared/http.ts';
import { serviceRpc } from '../_shared/supabase.ts';

deno().serve(async (req) => {
  if (req.method !== 'POST') return fail('Use POST', 405);
  const secret = env('NOTIFY_WEBHOOK_SECRET');
  if (!secret || !safeEqual(req.headers.get('x-webhook-secret') ?? '', secret)) return fail('Forbidden', 403);

  let id = '';
  try {
    id = String(((await req.json()) as { notification_id?: unknown }).notification_id ?? '');
  } catch {
    return fail('Send JSON with a notification_id');
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail('notification_id must be a uuid');

  const target = await serviceRpc<FanoutTarget | null>('vivah_fanout_targets', { p_notification: id });
  if (!target) return json({ sent: false, reason: 'no such notification' });
  const plan = planFanout(target, appUrl());
  const result = { push: 0, pushErrors: 0, email: false, skipped: plan.skipped };

  const expoToken = env('EXPO_ACCESS_TOKEN');
  for (const batch of plan.push) {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(expoToken ? { Authorization: `Bearer ${expoToken}` } : {}) },
      body: JSON.stringify(batch),
    });
    if (res.ok) result.push += batch.length;
    else result.pushErrors += batch.length;
  }

  const resendKey = env('RESEND_API_KEY');
  if (plan.email && resendKey) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env('RESEND_FROM') ?? 'Vivah <hello@vivah.com.np>', to: [plan.email.to], subject: plan.email.subject, html: plan.email.html, text: plan.email.text }),
    });
    result.email = res.ok;
  } else if (plan.email) {
    result.skipped.push('email not configured');
  }
  return json(result);
});
