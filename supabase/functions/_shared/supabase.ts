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

const serviceHeaders = () => ({ apikey: serviceKey(), Authorization: `Bearer ${serviceKey()}`, 'Content-Type': 'application/json' });

/** Every file under a folder of a private bucket, walking sub-folders (Storage lists one level at a time). */
export async function listFiles(bucket: string, folder: string): Promise<string[]> {
  const files: string[] = [];
  const pending = [folder.replace(/\/$/, '')];
  while (pending.length) {
    const prefix = pending.pop()!;
    for (let offset = 0; ; offset += 100) {
      const res = await fetch(`${supabaseUrl()}/storage/v1/object/list/${bucket}`, {
        method: 'POST',
        headers: serviceHeaders(),
        body: JSON.stringify({ prefix, limit: 100, offset }),
      });
      if (!res.ok) throw new Error(`list ${prefix}: ${res.status}`);
      const page = (await res.json()) as { name: string; id: string | null }[];
      // Folders come back with no id.
      for (const item of page) (item.id ? files : pending).push(`${prefix}/${item.name}`);
      if (page.length < 100) break;
    }
  }
  return files;
}

/** Removes files from a bucket, 100 at a time. */
export async function removeFiles(bucket: string, paths: string[]): Promise<void> {
  for (let i = 0; i < paths.length; i += 100) {
    const res = await fetch(`${supabaseUrl()}/storage/v1/object/${bucket}`, {
      method: 'DELETE',
      headers: serviceHeaders(),
      body: JSON.stringify({ prefixes: paths.slice(i, i + 100) }),
    });
    if (!res.ok) throw new Error(`remove: ${res.status}`);
  }
}

/**
 * Soft-deletes an auth user: they can't sign in again and their email is
 * freed, but the user row stays, so the profile (and the bookings and
 * payments pointing at it) are kept.
 */
export async function softDeleteUser(userId: string): Promise<void> {
  const res = await fetch(`${supabaseUrl()}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: serviceHeaders(),
    body: JSON.stringify({ should_soft_delete: true }),
  });
  if (!res.ok && res.status !== 404) throw new Error(`auth delete: ${res.status}`);
}
