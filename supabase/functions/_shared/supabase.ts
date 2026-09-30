/** Calls into Supabase from an Edge Function over REST (no SDK). */
import { anonKey, serviceKey, supabaseUrl } from './env.ts';

/** The signed-in caller, from their Authorization header; null when it isn't a valid session. */
export async function callerId(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const res = await fetch(`${supabaseUrl()}/auth/v1/user`, { headers: { apikey: anonKey(), Authorization: auth } });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string };
  return user.id ?? null;
}

/** Calls a SQL function with the service role (server side only). */
export async function serviceRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${supabaseUrl()}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: serviceKey(), Authorization: `Bearer ${serviceKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${fn}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}
