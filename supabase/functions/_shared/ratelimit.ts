/**
 * Fixed-window rate limits on Upstash Redis over its REST API (free tier:
 * 500k commands a month; each check is one pipelined request with two
 * commands). Used for OTP sends and signed uploads (master plan §7.6).
 *
 * Without Upstash configured the check allows the request and says so, so
 * local development works; Supabase Auth's own limits still apply to OTPs.
 */

export interface Redis {
  url: string;
  token: string;
}

export interface Limit {
  /** Requests allowed per window. */
  limit: number;
  windowSeconds: number;
}

export interface Verdict {
  allowed: boolean;
  count: number;
  remaining: number;
  /** Seconds until the window resets (for Retry-After). */
  retryAfter: number;
  configured: boolean;
}

/** Counts one request against `key` and says whether it is within the limit. */
export async function rateLimit(redis: Redis | null, key: string, rule: Limit, now = Date.now(), fetchImpl: typeof fetch = fetch): Promise<Verdict> {
  const window = Math.floor(now / 1000 / rule.windowSeconds);
  const retryAfter = rule.windowSeconds - (Math.floor(now / 1000) % rule.windowSeconds);
  if (!redis) return { allowed: true, count: 0, remaining: rule.limit, retryAfter, configured: false };
  const bucket = `rl:${key}:${window}`;
  try {
    const res = await fetchImpl(`${redis.url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${redis.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCR', bucket],
        ['EXPIRE', bucket, String(rule.windowSeconds), 'NX'],
      ]),
    });
    if (!res.ok) throw new Error(`Upstash ${res.status}`);
    const out = (await res.json()) as { result?: number; error?: string }[];
    const count = Number(out[0]?.result ?? 0);
    return { allowed: count <= rule.limit, count, remaining: Math.max(0, rule.limit - count), retryAfter, configured: true };
  } catch {
    // Redis down: allow rather than lock everyone out of sign-in.
    return { allowed: true, count: 0, remaining: rule.limit, retryAfter, configured: true };
  }
}

/** The limits Vivah uses, in one place. */
export const LIMITS = {
  otpPerEmail: { limit: 3, windowSeconds: 600 },
  otpPerIp: { limit: 10, windowSeconds: 600 },
  uploadsPerUser: { limit: 60, windowSeconds: 3600 },
  paymentsPerUser: { limit: 20, windowSeconds: 3600 },
  paymentChecksPerIp: { limit: 120, windowSeconds: 600 },
} satisfies Record<string, Limit>;
