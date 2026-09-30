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
  const text = await res.text();
  if (!res.ok) throw new Error(`${fn}: ${res.status} ${text}`);
  // Functions returning void answer with an empty body.
  return (text ? JSON.parse(text) : null) as T;
}

/** Calls a SQL function as the signed-in caller (their JWT), so RLS and the function's own checks apply. */
export async function userRpc<T>(req: Request, fn: string, args: Record<string, unknown>): Promise<{ ok: true; value: T } | { ok: false; status: number; message: string }> {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return { ok: false, status: 401, message: 'Sign in again to continue' };
  const res = await fetch(`${supabaseUrl()}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: anonKey(), Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const message = body && typeof body === 'object' && 'message' in body ? String((body as { message: unknown }).message) : `Request failed (${res.status})`;
    return { ok: false, status: res.status === 401 ? 401 : 400, message };
  }
  return { ok: true, value: body as T };
}
