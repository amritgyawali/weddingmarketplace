/**
 * Sign-in for the Supabase backend (master plan §7.3). Owner decision: email
 * OTP only for the first year, so every role signs in with a 6-digit code
 * sent to their email (the send-otp Edge Function, rate-limited). Phone OTP
 * later is a new provider behind the same `AuthProvider` shape.
 *
 * The session (access + refresh token) is kept in SecureStore on phones and in
 * localStorage on the web, and refreshed shortly before it expires. With the
 * mock backend none of this runs: the demo keeps its phone + 1234 sign-in.
 */
import { Platform } from 'react-native';

import { ENV, usesSupabase } from '@/constants/env';

import { failResult, okResult, type Result } from './types';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  /** Epoch seconds. */
  expiresAt: number;
  userId: string;
  email?: string;
}

export interface AuthProvider {
  kind: 'email';
  /** Digits in the code. */
  codeLength: number;
  start(identifier: string): Promise<Result<void>>;
  verify(identifier: string, code: string): Promise<Result<AuthSession>>;
}

/** What rpc_me() returns (profile, roles and persona fields). */
export interface Me {
  signedUp: boolean;
  id?: string;
  name?: string;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  suspended?: boolean;
  roles?: string[];
  staffTeam?: string | null;
  staffRequest?: { status: 'PENDING' | 'APPROVED' | 'REJECTED'; team: string; staffRole: string } | null;
  freelancer?: { skills: string[]; primarySkill: string | null; dayRate: number | null; eventRate: number | null; bio: string | null; travelRadiusKm: number } | null;
  provider?: { orgId: string; businessName: string; providerId: string | null; businessForm: string | null; services: string[] } | null;
  /** The Terms and Privacy policy version last accepted (LEGAL_VERSION), or null. */
  legal?: string | null;
}

/** True when this build signs in through Supabase instead of the demo. */
export const usesEmailSignIn = () => usesSupabase();

const KEY = 'vivah.auth.session';

async function store() {
  if (Platform.OS === 'web') {
    return {
      get: async () => (typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY)),
      set: async (v: string) => localStorage.setItem(KEY, v),
      del: async () => localStorage.removeItem(KEY),
    };
  }
  const SecureStore = await import('expo-secure-store');
  return { get: () => SecureStore.getItemAsync(KEY), set: (v: string) => SecureStore.setItemAsync(KEY, v), del: () => SecureStore.deleteItemAsync(KEY) };
}

let current: AuthSession | null = null;
let loaded = false;

async function saveSession(s: AuthSession | null) {
  current = s;
  const st = await store();
  if (s) await st.set(JSON.stringify(s));
  else await st.del();
}

/** The saved session, if any (read once, then kept in memory). */
export async function loadSession(): Promise<AuthSession | null> {
  if (loaded) return current;
  loaded = true;
  try {
    const raw = await (await store()).get();
    current = raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    current = null;
  }
  return current;
}

const headers = () => ({ apikey: ENV.supabasePublishableKey ?? '', 'Content-Type': 'application/json' });

const toSession = (body: { access_token: string; refresh_token: string; expires_at?: number; expires_in?: number; user?: { id: string; email?: string } }): AuthSession => ({
  accessToken: body.access_token,
  refreshToken: body.refresh_token,
  expiresAt: body.expires_at ?? Math.floor(Date.now() / 1000) + (body.expires_in ?? 3600),
  userId: body.user?.id ?? '',
  email: body.user?.email,
});

async function post<T>(url: string, body: unknown, extra: Record<string, string> = {}): Promise<Result<T>> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { ...headers(), ...extra }, body: JSON.stringify(body) });
    const text = await res.text();
    const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    if (!res.ok) return failResult(String(data.message ?? data.msg ?? data.error_description ?? `Request failed (${res.status})`));
    return okResult(data as T);
  } catch {
    return failResult('No connection. Check your internet and try again.');
  }
}

export const emailOtp: AuthProvider = {
  kind: 'email',
  codeLength: 6,
  async start(email) {
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean)) return failResult('Enter a valid email address');
    const r = await post(`${ENV.supabaseUrl}/functions/v1/send-otp`, { email: clean });
    return r.ok ? okResult(undefined) : r;
  },
  async verify(email, code) {
    const r = await post<Parameters<typeof toSession>[0]>(`${ENV.supabaseUrl}/auth/v1/verify`, { type: 'email', email: email.trim().toLowerCase(), token: code.trim() });
    if (!r.ok) return failResult(/expired|invalid/i.test(r.error) ? 'That code is wrong or has expired. Ask for a new one.' : r.error);
    const session = toSession(r.value);
    await saveSession(session);
    return okResult(session);
  },
};

let refreshing: Promise<AuthSession | null> | null = null;

/** A valid access token, refreshed when it expires within a minute; null when signed out. */
export async function getAccessToken(): Promise<string | null> {
  const s = await loadSession();
  if (!s) return null;
  if (s.expiresAt - 60 > Date.now() / 1000) return s.accessToken;
  refreshing ??= (async () => {
    const r = await post<Parameters<typeof toSession>[0]>(`${ENV.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, { refresh_token: s.refreshToken });
    const next = r.ok ? toSession(r.value) : null;
    await saveSession(next);
    return next;
  })().finally(() => {
    refreshing = null;
  });
  return (await refreshing)?.accessToken ?? null;
}

/** Ends the session on the server and on this device. */
export async function signOut() {
  const s = await loadSession();
  if (s) {
    await fetch(`${ENV.supabaseUrl}/auth/v1/logout`, { method: 'POST', headers: { ...headers(), Authorization: `Bearer ${s.accessToken}` } }).catch(() => undefined);
  }
  await saveSession(null);
}
