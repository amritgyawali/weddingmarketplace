/**
 * health: is Vivah's backend up? The Better Stack monitor calls this every few
 * minutes (master plan §14), and it reaches the database through rpc_health,
 * so a paused or broken database shows as down, not just a live function.
 *
 *   GET → 200 { ok: true, db: "up", at } or 503 { ok: false, db: "down", at }
 *
 * Public and cheap: no secrets, no user data, never cached.
 */
import { anonKey, deno, supabaseUrl } from '../_shared/env.ts';
import { fail, json, preflight } from '../_shared/http.ts';

deno().serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  if (req.method !== 'GET' && req.method !== 'HEAD') return fail('Use GET', 405);

  let up = false;
  try {
    const res = await fetch(`${supabaseUrl()}/rest/v1/rpc/rpc_health`, {
      method: 'POST',
      headers: { apikey: anonKey(), 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(5000),
    });
    up = res.ok && ((await res.json()) as { ok?: boolean }).ok === true;
  } catch {
    up = false;
  }
  return json({ ok: up, db: up ? 'up' : 'down', at: new Date().toISOString() }, up ? 200 : 503, { 'Cache-Control': 'no-store' });
});
