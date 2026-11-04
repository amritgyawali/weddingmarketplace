/** Small HTTP helpers shared by the Edge Functions (no dependencies). */

export const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Sent with every answer: answers can carry personal data, so no cache keeps them and no browser guesses their type. */
export const SECURITY_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, ...SECURITY_HEADERS, 'Content-Type': 'application/json', ...headers } });

/** A refusal the app shows as-is (`message`, like PostgREST errors). */
export const fail = (message: string, status = 400) => json({ message }, status);

export const preflight = (req: Request) => (req.method === 'OPTIONS' ? new Response('ok', { headers: CORS }) : null);

/** The caller's IP as seen by Supabase's edge (for rate limits only). */
export const clientIp = (req: Request) => (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';

/**
 * Constant-time comparison for shared secrets and signatures. It always walks
 * the longer string, so the time taken says nothing about where the strings
 * differ or how long the secret is.
 */
export function safeEqual(a: string, b: string) {
  const n = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
