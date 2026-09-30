/** Edge Function configuration from Supabase secrets (`supabase secrets set`). */
import type { Redis } from './ratelimit.ts';

/** Deno's runtime, typed locally so these files also load in Node for the tests. */
export const deno = () => (globalThis as unknown as { Deno: { env: { get(name: string): string | undefined }; serve(handler: (req: Request) => Response | Promise<Response>): void } }).Deno;

export const env = (name: string) => {
  const v = deno().env.get(name);
  return v && v.trim() ? v.trim() : undefined;
};

/** Supabase sets these three itself. */
export const supabaseUrl = () => env('SUPABASE_URL') ?? '';
export const anonKey = () => env('SUPABASE_ANON_KEY') ?? '';
export const serviceKey = () => env('SUPABASE_SERVICE_ROLE_KEY') ?? '';

export const redis = (): Redis | null => {
  const url = env('UPSTASH_REDIS_REST_URL');
  const token = env('UPSTASH_REDIS_REST_TOKEN');
  return url && token ? { url, token } : null;
};

export const appUrl = () => env('APP_URL') ?? 'https://vivah.com.np';

/** Where Edge Functions are reachable (gateway return addresses point here). */
export const functionsUrl = () => env('FUNCTIONS_URL') ?? `${supabaseUrl().replace(/\/$/, '')}/functions/v1`;

/** Khalti ePayment; null until KHALTI_SECRET_KEY is set. Sandbox unless KHALTI_BASE_URL says otherwise. */
export const khaltiConfig = () => {
  const secretKey = env('KHALTI_SECRET_KEY');
  return secretKey ? { secretKey, baseUrl: env('KHALTI_BASE_URL') ?? 'https://dev.khalti.com/api/v2' } : null;
};

/**
 * eSewa ePay v2. With the test product code (EPAYTEST) eSewa's published test
 * secret is used, so the sandbox works with no keys at all; a live product
 * code needs ESEWA_SECRET_KEY and the live base URL.
 */
export const esewaConfig = () => {
  const productCode = env('ESEWA_PRODUCT_CODE') ?? 'EPAYTEST';
  const sandbox = productCode === 'EPAYTEST';
  const secretKey = env('ESEWA_SECRET_KEY') ?? (sandbox ? '8gBm/:&EnhH.1/q' : undefined);
  if (!secretKey) return null;
  const base = (env('ESEWA_BASE_URL') ?? (sandbox ? 'https://rc-epay.esewa.com.np' : 'https://epay.esewa.com.np')).replace(/\/$/, '');
  const statusUrl = env('ESEWA_STATUS_URL') ?? (base.includes('rc-epay') ? 'https://rc.esewa.com.np/api/epay/transaction/status/' : 'https://esewa.com.np/api/epay/transaction/status/');
  return { productCode, secretKey, formUrl: `${base}/api/epay/main/v2/form`, statusUrl };
};

/** Extra web hosts the browser may be sent back to after paying (e.g. a Vercel preview). */
export const paymentReturnHosts = () => (env('PAYMENT_RETURN_HOSTS') ?? '').split(',').map((h) => h.trim()).filter(Boolean);
