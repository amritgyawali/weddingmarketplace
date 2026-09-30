/**
 * Khalti ePayment and eSewa ePay v2 (master plan §7.5), as pure functions the
 * payment-initiate and payment-verify Edge Functions call. Amounts inside Vivah
 * are paisa (bigint in SQL); Khalti also takes paisa, eSewa takes rupees.
 *
 * The rule both gateways share: a redirect back from the gateway proves
 * nothing. Only the gateway's own lookup (Khalti /epayment/lookup, eSewa
 * transaction status), made with our keys, decides whether money is recorded.
 *
 * Sandbox (checked against the live sandboxes on 30 Sep 2026):
 *   Khalti  https://dev.khalti.com/api/v2   test IDs 9800000000–9800000005, MPIN 1111, OTP 987654
 *   eSewa   https://rc-epay.esewa.com.np    product EPAYTEST, secret 8gBm/:&EnhH.1/q,
 *           IDs 9711111111–9711111114, password Nepal@123, token 123456
 */

export type Gateway = 'khalti' | 'esewa';
export type Outcome = 'COMPLETED' | 'PENDING' | 'FAILED' | 'CANCELLED' | 'EXPIRED';

export const isGateway = (x: unknown): x is Gateway => x === 'khalti' || x === 'esewa';

/** The SQL payment_method for each gateway. */
export const SQL_METHOD: Record<Gateway, 'KHALTI' | 'ESEWA'> = { khalti: 'KHALTI', esewa: 'ESEWA' };

/** What rpc_begin_payment returns. */
export interface Intent {
  intent: string;
  orderRef: string;
  amount: number;
  label: string;
  customer?: { name?: string | null; email?: string | null; phone?: string | null };
}

export interface KhaltiConfig {
  secretKey: string;
  baseUrl: string;
}

export interface EsewaConfig {
  productCode: string;
  secretKey: string;
  formUrl: string;
  statusUrl: string;
}

export const KHALTI_SANDBOX = 'https://dev.khalti.com/api/v2';
export const ESEWA_SANDBOX = { productCode: 'EPAYTEST', secretKey: '8gBm/:&EnhH.1/q', formUrl: 'https://rc-epay.esewa.com.np/api/epay/main/v2/form', statusUrl: 'https://rc.esewa.com.np/api/epay/transaction/status/' };
export const ESEWA_LIVE = { formUrl: 'https://epay.esewa.com.np/api/epay/main/v2/form', statusUrl: 'https://esewa.com.np/api/epay/transaction/status/' };

// ─── Money ──────────────────────────────────────────────────────────────────

/** eSewa's rupee amount: "42375" or "42375.5" — the exact string that is signed. */
export const rupeesString = (paisa: number) => {
  const r = paisa / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/0$/, '');
};

/** A gateway's rupee amount (number or string) back to paisa. */
export const toPaisa = (rupees: unknown) => Math.round(Number(rupees) * 100);

// ─── Khalti ─────────────────────────────────────────────────────────────────

/** Khalti rejects malformed phones, so only a Nepali mobile number is sent. */
const nepaliMobile = (phone?: string | null) => {
  const digits = (phone ?? '').replace(/\D/g, '').replace(/^977/, '');
  return /^9[78]\d{8}$/.test(digits) ? digits : undefined;
};

export function khaltiInitiateBody(intent: Intent, returnUrl: string, websiteUrl: string) {
  const c = intent.customer ?? {};
  const info = { name: c.name || undefined, email: c.email || undefined, phone: nepaliMobile(c.phone) };
  return {
    return_url: returnUrl,
    website_url: websiteUrl,
    amount: intent.amount,
    purchase_order_id: intent.orderRef,
    purchase_order_name: intent.label.slice(0, 100),
    ...(info.name || info.email || info.phone ? { customer_info: info } : {}),
  };
}

/** Khalti lookup status → our outcome. Only "Completed" is money. */
export function khaltiOutcome(status: unknown): Outcome {
  switch (status) {
    case 'Completed':
      return 'COMPLETED';
    case 'Pending':
    case 'Initiated':
      return 'PENDING';
    case 'User canceled':
      return 'CANCELLED';
    case 'Expired':
      return 'EXPIRED';
    default:
      return 'FAILED'; // Refunded, Partially Refunded, anything new
  }
}

export interface Lookup {
  outcome: Outcome;
  /** Paisa, as the gateway reports it. */
  amount: number;
  gatewayRef?: string;
  gatewayTxn?: string;
  raw: unknown;
}

export async function khaltiLookup(cfg: KhaltiConfig, pidx: string, fetchImpl: typeof fetch = fetch): Promise<Lookup> {
  const res = await fetchImpl(`${cfg.baseUrl.replace(/\/$/, '')}/epayment/lookup/`, {
    method: 'POST',
    headers: { Authorization: `Key ${cfg.secretKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ pidx }),
  });
  const body = (await res.json().catch(() => ({}))) as { status?: string; total_amount?: number; transaction_id?: string | null; pidx?: string; detail?: string };
  // Khalti answers Expired and User canceled with HTTP 400 and a status.
  if (!res.ok && !body.status) throw new Error(`Khalti lookup ${res.status}: ${body.detail ?? ''}`);
  return { outcome: khaltiOutcome(body.status), amount: Number(body.total_amount ?? 0), gatewayRef: body.pidx ?? pidx, gatewayTxn: body.transaction_id ?? undefined, raw: body };
}

// ─── eSewa ──────────────────────────────────────────────────────────────────

const b64 = (buf: ArrayBuffer) => {
  let s = '';
  for (const byte of new Uint8Array(buf)) s += String.fromCharCode(byte);
  return btoa(s);
};

/** HMAC-SHA256, base64 (Web Crypto: Deno and Node). */
export async function hmacBase64(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

/** eSewa signs `name=value` pairs of the signed fields, in order, joined by commas. */
export const esewaMessage = (fields: Record<string, unknown>, names: string) =>
  names
    .split(',')
    .map((n) => `${n}=${fields[n] ?? ''}`)
    .join(',');

export async function esewaForm(cfg: EsewaConfig, intent: Intent, successUrl: string, failureUrl: string) {
  const total = rupeesString(intent.amount);
  const fields: Record<string, string> = {
    amount: total,
    tax_amount: '0', // VAT is already inside the milestone amount
    total_amount: total,
    transaction_uuid: intent.orderRef,
    product_code: cfg.productCode,
    product_service_charge: '0',
    product_delivery_charge: '0',
    success_url: successUrl,
    failure_url: failureUrl,
    signed_field_names: 'total_amount,transaction_uuid,product_code',
  };
  fields.signature = await hmacBase64(esewaMessage(fields, fields.signed_field_names), cfg.secretKey);
  return { action: cfg.formUrl, fields };
}

export interface EsewaCallback {
  transaction_code?: string;
  status?: string;
  total_amount?: string | number;
  transaction_uuid?: string;
  product_code?: string;
  signed_field_names?: string;
  signature?: string;
}

/** Decodes the `data` eSewa appends to the success URL; `valid` says whether its signature is ours. */
export async function esewaDecode(data: string, secretKey: string): Promise<{ body: EsewaCallback; valid: boolean } | null> {
  try {
    const body = JSON.parse(atob(data.replace(/-/g, '+').replace(/_/g, '/'))) as EsewaCallback;
    if (!body.signed_field_names || !body.signature) return { body, valid: false };
    const expected = await hmacBase64(esewaMessage(body as Record<string, unknown>, body.signed_field_names), secretKey);
    return { body, valid: expected === body.signature };
  } catch {
    return null;
  }
}

/** eSewa status → our outcome. NOT_FOUND means the couple never finished (or eSewa hasn't caught up yet). */
export function esewaOutcome(status: unknown, expired: boolean): Outcome {
  switch (status) {
    case 'COMPLETE':
      return 'COMPLETED';
    case 'PENDING':
    case 'AMBIGUOUS':
      return 'PENDING';
    case 'CANCELED':
      return 'CANCELLED';
    case 'NOT_FOUND':
      return expired ? 'EXPIRED' : 'PENDING';
    default:
      return 'FAILED'; // FULL_REFUND, PARTIAL_REFUND
  }
}

export async function esewaLookup(cfg: EsewaConfig, orderRef: string, paisa: number, expired: boolean, fetchImpl: typeof fetch = fetch): Promise<Lookup> {
  const q = new URLSearchParams({ product_code: cfg.productCode, total_amount: rupeesString(paisa), transaction_uuid: orderRef });
  const res = await fetchImpl(`${cfg.statusUrl}?${q}`);
  if (!res.ok) throw new Error(`eSewa status ${res.status}`);
  const body = (await res.json()) as { status?: string; total_amount?: number | string; ref_id?: string | null; transaction_uuid?: string };
  if (body.transaction_uuid && body.transaction_uuid !== orderRef) throw new Error('eSewa answered for another transaction');
  return { outcome: esewaOutcome(body.status, expired), amount: toPaisa(body.total_amount ?? 0), gatewayRef: body.ref_id ?? undefined, raw: body };
}

// ─── Where the browser goes back to ──────────────────────────────────────────

/**
 * Only our own app and web addresses: the app's scheme, Expo Go during
 * development, the web app, localhost, and hosts listed in
 * PAYMENT_RETURN_HOSTS. Anything else would make payment-verify an open redirect.
 */
export function safeReturnTo(url: unknown, appUrl: string, extraHosts: string[] = []): string | null {
  if (typeof url !== 'string' || url.length > 500) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol === 'vivah:' || u.protocol === 'exp:' || u.protocol === 'exps:') return url;
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const hosts = new Set([new URL(appUrl).hostname, 'localhost', '127.0.0.1', ...extraHosts.map((h) => h.trim()).filter(Boolean)]);
  if (u.protocol === 'http:' && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') return null;
  return hosts.has(u.hostname) ? url : null;
}

/** The return address with the result added to its query. */
export function withResult(returnTo: string, params: Record<string, string | undefined>) {
  const extra = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v!)}`)
    .join('&');
  if (!extra) return returnTo;
  const [base, hash] = returnTo.split('#');
  return `${base}${base.includes('?') ? '&' : '?'}${extra}${hash !== undefined ? `#${hash}` : ''}`;
}

/** payment-verify/<gateway>/<intent>[/failure] from the request path. */
export function parseVerifyPath(pathname: string): { gateway: Gateway; intent: string; failure: boolean } | null {
  const m = pathname.match(/payment-verify\/(khalti|esewa)\/([0-9a-f-]{36})(\/failure)?\/?$/i);
  return m ? { gateway: m[1].toLowerCase() as Gateway, intent: m[2].toLowerCase(), failure: !!m[3] } : null;
}

/**
 * eSewa appends `?data=…` to the success URL even when it already has a query,
 * so the value is found wherever it is.
 */
export function esewaDataParam(rawUrl: string) {
  const m = rawUrl.match(/[?&]data=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
