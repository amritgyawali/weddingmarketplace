/**
 * send-otp: emails a one-time sign-in code (owner decision: email OTP only in
 * year one, no SMS). Rate-limited per email and per IP on Upstash before it
 * asks Supabase Auth to send, so nobody can flood an inbox or the 3,000-a-month
 * email allowance. Public (no JWT): this is how people sign in.
 *
 *   POST { "email": "aakriti@example.com" } → 200 { "sent": true }
 */
import { anonKey, deno, redis, supabaseUrl } from '../_shared/env.ts';
import { clientIp, fail, json, preflight } from '../_shared/http.ts';
import { LIMITS, rateLimit } from '../_shared/ratelimit.ts';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

deno().serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  if (req.method !== 'POST') return fail('Use POST', 405);

  let email = '';
  try {
    email = String(((await req.json()) as { email?: unknown }).email ?? '').trim().toLowerCase();
  } catch {
    return fail('Send JSON with an email');
  }
  if (!EMAIL.test(email) || email.length > 254) return fail('Enter a valid email address');

  const r = redis();
  const [byEmail, byIp] = await Promise.all([rateLimit(r, `otp:email:${email}`, LIMITS.otpPerEmail), rateLimit(r, `otp:ip:${clientIp(req)}`, LIMITS.otpPerIp)]);
  const blocked = !byEmail.allowed ? byEmail : !byIp.allowed ? byIp : null;
  if (blocked) return json({ message: `Too many codes requested. Try again in ${Math.ceil(blocked.retryAfter / 60)} minutes.` }, 429, { 'Retry-After': String(blocked.retryAfter) });

  const res = await fetch(`${supabaseUrl()}/auth/v1/otp`, {
    method: 'POST',
    headers: { apikey: anonKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, create_user: true }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { msg?: string; message?: string };
    return fail(body.msg ?? body.message ?? 'We couldn’t send the code. Try again in a minute.', res.status === 429 ? 429 : 400);
  }
  return json({ sent: true });
});
