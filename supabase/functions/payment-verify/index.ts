/**
 * payment-verify: the only place gateway money becomes a payment
 * (master plan §7.5). It asks the gateway itself (Khalti lookup, eSewa
 * status API) with our keys, then calls rpc_settle_payment with the service
 * role, which records the payment once however often this runs.
 *
 *   GET  /payment-verify/khalti/<intent>?pidx=…           Khalti's return
 *   GET  /payment-verify/esewa/<intent>?data=…            eSewa success
 *   GET  /payment-verify/esewa/<intent>/failure           eSewa failure
 *        → 302 to the intent's return address with ?intent=&status=&receipt=
 *   POST { "intent": uuid } (Authorization: Bearer <user JWT>)
 *        → { status, receiptNo, amount }   the app's "check again"
 *
 * Nothing in the redirect's query is trusted: the pidx and amount used are the
 * ones stored with the intent. Gateways call this without a user session, so
 * config.toml turns off JWT verification for it.
 */
import { appUrl, deno, esewaConfig, khaltiConfig, redis } from '../_shared/env.ts';
import { clientIp, fail, json, preflight } from '../_shared/http.ts';
import { esewaDataParam, esewaDecode, esewaLookup, khaltiLookup, type Lookup, parseVerifyPath, withResult } from '../_shared/payments.ts';
import { LIMITS, rateLimit } from '../_shared/ratelimit.ts';
import { serviceRpc, userRpc } from '../_shared/supabase.ts';

interface StoredIntent {
  id: string;
  method: 'KHALTI' | 'ESEWA';
  amount: number;
  orderRef: string;
  gatewayRef: string | null;
  returnTo: string | null;
  status: string;
  receiptNo: string | null;
  expiresAt: string;
}

interface Settled {
  status: string;
  receiptNo?: string | null;
  amount: number;
  duplicate?: boolean;
  problem?: string;
}

const SETTLED = new Set(['COMPLETED', 'REFUND_DUE']);

/** Asks the gateway about one intent and settles it. */
async function verify(intentId: string, hint: { esewaData?: string | null; failure?: boolean } = {}): Promise<Settled> {
  const intent = await serviceRpc<StoredIntent | null>('vivah_payment_intent', { p_intent: intentId });
  if (!intent) throw new Error('not found');
  if (SETTLED.has(intent.status)) return { status: intent.status, receiptNo: intent.receiptNo, amount: intent.amount, duplicate: true };

  const expired = Date.parse(intent.expiresAt) < Date.now();
  let lookup: Lookup;
  let txn: string | undefined;
  if (intent.method === 'KHALTI') {
    const cfg = khaltiConfig();
    if (!cfg) throw new Error('Khalti isn’t set up');
    if (!intent.gatewayRef) return settle(intent, { outcome: 'FAILED', amount: 0, raw: { reason: 'no pidx' } });
    lookup = await khaltiLookup(cfg, intent.gatewayRef);
    txn = lookup.gatewayTxn;
  } else {
    const cfg = esewaConfig();
    if (!cfg) throw new Error('eSewa isn’t set up');
    lookup = await esewaLookup(cfg, intent.orderRef, intent.amount, expired);
    if (hint.esewaData) {
      const decoded = await esewaDecode(hint.esewaData, cfg.secretKey);
      // A signed callback for this transaction gives us eSewa's transaction code for the receipt.
      if (decoded?.valid && decoded.body.transaction_uuid === intent.orderRef) txn = decoded.body.transaction_code;
    }
    // Back through the failure URL and eSewa has nothing: the couple gave up.
    if (hint.failure && lookup.outcome === 'PENDING' && (lookup.raw as { status?: string })?.status === 'NOT_FOUND') lookup = { ...lookup, outcome: 'CANCELLED' };
  }
  return settle(intent, { ...lookup, gatewayTxn: txn ?? lookup.gatewayTxn });
}

const settle = (intent: StoredIntent, l: Lookup) =>
  serviceRpc<Settled>('rpc_settle_payment', {
    p_intent: intent.id,
    p_outcome: l.outcome,
    p_amount: l.amount,
    p_gateway_ref: l.gatewayRef ?? null,
    p_gateway_txn: l.gatewayTxn ?? null,
    p_response: l.raw ?? null,
  });

const resultPage = () => `${appUrl().replace(/\/$/, '')}/pay/result`;

const redirect = (to: string) => new Response(null, { status: 302, headers: { Location: to, 'Cache-Control': 'no-store' } });

deno().serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

  const verdict = await rateLimit(redis(), `paycheck:${clientIp(req)}`, LIMITS.paymentChecksPerIp);
  if (!verdict.allowed) return json({ message: 'Too many checks. Try again in a few minutes.' }, 429, { 'Retry-After': String(verdict.retryAfter) });

  // The app asks again: only for the caller's own attempt.
  if (req.method === 'POST') {
    let intentId: unknown;
    try {
      intentId = ((await req.json()) as { intent?: unknown }).intent;
    } catch {
      return fail('Send JSON with an intent');
    }
    if (typeof intentId !== 'string' || !/^[0-9a-f-]{36}$/i.test(intentId)) return fail('Unknown payment');
    const mine = await userRpc<{ status: string } | null>(req, 'rpc_payment_status', { p_intent: intentId });
    if (!mine.ok) return fail(mine.message, mine.status);
    if (!mine.value) return fail('This payment isn’t yours or no longer exists', 404);
    try {
      const out = await verify(intentId.toLowerCase());
      return json({ status: out.status, receiptNo: out.receiptNo ?? null, amount: out.amount / 100, problem: out.problem ?? null });
    } catch {
      return fail('We couldn’t reach the payment gateway. Your money is safe; check again in a minute.', 502);
    }
  }

  if (req.method !== 'GET') return fail('Use GET or POST', 405);
  const where = parseVerifyPath(new URL(req.url).pathname);
  if (!where) return redirect(withResult(resultPage(), { status: 'unknown' }));

  let returnTo = resultPage();
  try {
    const stored = await serviceRpc<StoredIntent | null>('vivah_payment_intent', { p_intent: where.intent });
    if (!stored) return redirect(withResult(resultPage(), { status: 'unknown' }));
    returnTo = stored.returnTo || returnTo;
    const out = await verify(where.intent, { esewaData: where.gateway === 'esewa' ? esewaDataParam(req.url) : null, failure: where.failure });
    return redirect(withResult(returnTo, { intent: where.intent, status: out.status.toLowerCase(), receipt: out.receiptNo ?? undefined }));
  } catch {
    // The gateway or the database didn't answer: the app checks again from the result screen.
    return redirect(withResult(returnTo, { intent: where.intent, status: 'checking' }));
  }
});
