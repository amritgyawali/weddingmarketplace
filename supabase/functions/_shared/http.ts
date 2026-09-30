/** Small HTTP helpers shared by the Edge Functions (no dependencies). */

export const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json', ...headers } });

/** A refusal the app shows as-is (`message`, like PostgREST errors). */
export const fail = (message: string, status = 400) => json({ message }, status);

export const preflight = (req: Request) => (req.method === 'OPTIONS' ? new Response('ok', { headers: CORS }) : null);

/** The caller's IP as seen by Supabase's edge (for rate limits only). */
export const clientIp = (req: Request) => (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';

/** Constant-time comparison for shared secrets. */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
