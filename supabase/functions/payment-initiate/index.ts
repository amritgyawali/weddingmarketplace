/**
 * payment-initiate: starts paying one milestone with Khalti or eSewa
 * (master plan §7.5). The amount is worked out by rpc_begin_payment from the
 * milestone, as the signed-in couple, never taken from the client as-is.
 *
 *   POST { "milestoneId": uuid, "method": "khalti" | "esewa", "amount"?: rupees, "returnTo"?: url }
 *        (Authorization: Bearer <user JWT>)
 *   → { intent, gateway, amount (rupees), url, form? }
 *
 * `url` is where to send the couple: Khalti's payment page, or for eSewa the
 * web app's /pay/esewa page, which posts the signed form (eSewa only accepts a
 * form POST). Web clients can post `form` themselves. Both gateways send the
 * browser back to payment-verify, never straight to the app.
 */
import { appUrl, deno, esewaConfig, functionsUrl, khaltiConfig, paymentReturnHosts, redis } from '../_shared/env.ts';
import { fail, json, preflight } from '../_shared/http.ts';
import { esewaForm, type Intent, isGateway, khaltiInitiateBody, safeReturnTo, SQL_METHOD } from '../_shared/payments.ts';
import { LIMITS, rateLimit } from '../_shared/ratelimit.ts';
import { callerId, serviceRpc, userRpc } from '../_shared/supabase.ts';

deno().serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  if (req.method !== 'POST') return fail('Use POST', 405);

  let body: { milestoneId?: unknown; method?: unknown; amount?: unknown; returnTo?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail('Send JSON with a milestoneId and a method');
  }
  const { milestoneId, method } = body;
  if (typeof milestoneId !== 'string' || !/^[0-9a-f-]{36}$/i.test(milestoneId)) return fail('Pick a milestone to pay');
  if (!isGateway(method)) return fail('Pay with khalti or esewa');
  const amount = body.amount === undefined || body.amount === null ? null : Number(body.amount);
  if (amount !== null && !(amount > 0 && Number.isFinite(amount))) return fail('Enter an amount above zero');

  const khalti = khaltiConfig();
  const esewa = esewaConfig();
  if (method === 'khalti' && !khalti) return fail('Khalti isn’t set up yet', 503);
  if (method === 'esewa' && !esewa) return fail('eSewa isn’t set up yet', 503);

  const userId = await callerId(req);
  if (!userId) return fail('Sign in again to pay', 401);
  const verdict = await rateLimit(redis(), `pay:${userId}`, LIMITS.paymentsPerUser);
  if (!verdict.allowed) return json({ message: 'Too many payment attempts. Try again in a while.' }, 429, { 'Retry-After': String(verdict.retryAfter) });

  const returnTo = safeReturnTo(body.returnTo, appUrl(), paymentReturnHosts()) ?? `${appUrl().replace(/\/$/, '')}/pay/result`;
  const begun = await userRpc<Intent>(req, 'rpc_begin_payment', {
    p_milestone: milestoneId,
    p_method: SQL_METHOD[method],
    p_amount: amount === null ? null : Math.round(amount * 100),
    p_return_to: returnTo,
  });
  if (!begun.ok) return fail(begun.message, begun.status);
  const intent = begun.value;
  const verifyBase = `${functionsUrl()}/payment-verify/${method}/${intent.intent}`;

  if (method === 'khalti') {
    const res = await fetch(`${khalti!.baseUrl.replace(/\/$/, '')}/epayment/initiate/`, {
      method: 'POST',
      headers: { Authorization: `Key ${khalti!.secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(khaltiInitiateBody(intent, verifyBase, appUrl())),
    });
    const out = (await res.json().catch(() => ({}))) as { pidx?: string; payment_url?: string; detail?: string; error_key?: string };
    if (!res.ok || !out.pidx || !out.payment_url) {
      await serviceRpc('rpc_settle_payment', { p_intent: intent.intent, p_outcome: 'FAILED', p_amount: intent.amount, p_response: out }).catch(() => null);
      return fail(`Khalti couldn’t start the payment${out.detail ? `: ${out.detail}` : ''}. Try again or pick eSewa.`, 502);
    }
    await serviceRpc('rpc_payment_attach', { p_intent: intent.intent, p_gateway_ref: out.pidx, p_response: out });
    return json({ intent: intent.intent, gateway: method, amount: intent.amount / 100, url: out.payment_url });
  }

  const form = await esewaForm(esewa!, intent, verifyBase, `${verifyBase}/failure`);
  const url = `${appUrl().replace(/\/$/, '')}/pay/esewa?${new URLSearchParams({ action: form.action, ...form.fields })}`;
  return json({ intent: intent.intent, gateway: method, amount: intent.amount / 100, url, form });
});
