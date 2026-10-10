/**
 * Publishing what a super admin changes in the console to every device
 * (Supabase builds; supabase/migrations/0021_app_content.sql).
 *
 * The store stays the app's source while it runs: the console writes to it
 * exactly as in the demo, and this module mirrors three of its parts with the
 * server (the content, the text overrides and the feature switches).
 *
 *   - Every device asks `rpc_app_config` for the current revision when the
 *     app opens, when it returns to the foreground and every 45 seconds while
 *     it is open; a new revision replaces the three parts in the store, so
 *     the screens re-render with the change.
 *   - A super admin's device sends a changed part a moment after the edit.
 *
 * The demo (`mock`) never calls this: there the store is the whole backend.
 */
import { AppState } from 'react-native';

import { ENV, usesSupabase } from '@/constants/env';
import type { TextOverrides } from '@/i18n/runtime';
import { normalizeContent } from '@/services/content';
import { useDb } from '@/store/useDb';
import { useSession } from '@/store/useSession';
import type { AppContent } from '@/types/content';

import { getAccessToken } from './auth';
import { rpc } from './supabase';
import { failResult, okResult, type Result } from './types';

const POLL_MS = 45_000;
const PUSH_DELAY_MS = 600;

/** The parts of the store the server carries to every device. */
interface Published {
  content: AppContent;
  textOverrides: TextOverrides;
  featureFlags: Record<string, boolean>;
}

interface AppConfig {
  revision: number;
  /** Absent when the device already has this revision. */
  content?: unknown;
  texts?: unknown;
  flags?: unknown;
}

const isRecord = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** Text overrides as the server sent them, with anything malformed dropped. */
export function readTexts(raw: unknown): TextOverrides {
  const out: TextOverrides = {};
  if (!isRecord(raw)) return out;
  for (const [source, value] of Object.entries(raw)) {
    if (!source.trim() || !isRecord(value)) continue;
    const en = typeof value.en === 'string' && value.en.trim() ? value.en : undefined;
    const ne = typeof value.ne === 'string' && value.ne.trim() ? value.ne : undefined;
    if (en || ne) out[source] = { ...(en ? { en } : {}), ...(ne ? { ne } : {}) };
  }
  return out;
}

/** Feature switches as the server sent them. */
export function readFlags(raw: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (isRecord(raw)) for (const [id, on] of Object.entries(raw)) if (typeof on === 'boolean') out[id] = on;
  return out;
}

/** The console configuration, for signed-in users and visitors alike. */
async function fetchAppConfig(known?: number): Promise<Result<AppConfig>> {
  if (!ENV.supabaseUrl || !ENV.supabasePublishableKey) return failResult('The Supabase backend isn’t configured');
  try {
    const token = (await getAccessToken()) ?? ENV.supabasePublishableKey;
    const res = await fetch(`${ENV.supabaseUrl}/rest/v1/rpc/rpc_app_config`, {
      method: 'POST',
      headers: { apikey: ENV.supabasePublishableKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_known: known ?? null }),
    });
    const body: unknown = await res.json();
    if (!res.ok || !isRecord(body) || typeof body.revision !== 'number') return failResult(`Request failed (${res.status})`);
    return okResult(body as unknown as AppConfig);
  } catch {
    return failResult('No connection. Check your internet and try again.');
  }
}

const published = (): Published => {
  const s = useDb.getState();
  return { content: s.content, textOverrides: s.textOverrides, featureFlags: s.featureFlags };
};

const canPublish = () => {
  const s = useSession.getState();
  const me = s.accounts.find((a) => a.id === s.session?.accountId);
  return me?.role === 'platform' && me.staffRole === 'super_admin';
};

/**
 * Keeps this device's content, text overrides and feature switches in step
 * with the server until the returned function is called. Does nothing in the
 * demo. `onError` is told when a super admin's change couldn't be published.
 */
export function startContentSync(onError: (message: string) => void): () => void {
  if (!usesSupabase()) return () => {};

  /** What the server is known to hold; a part of the store that differs from it was edited here. */
  let synced = published();
  let revision: number | undefined;
  /** False until the first answer: nothing is sent before the server's state is known. */
  let ready = false;
  let busy = false;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastError = '';

  const dirty = () => {
    const now = published();
    return now.content !== synced.content || now.textOverrides !== synced.textOverrides || now.featureFlags !== synced.featureFlags;
  };

  async function pull() {
    if (busy || stopped) return;
    busy = true;
    try {
      // Local changes nobody may publish (a demo reset by another admin) are replaced by the server's copy.
      const r = await fetchAppConfig(ready && !dirty() ? revision : undefined);
      if (!r.ok || stopped) return;
      revision = r.value.revision;
      if (r.value.content !== undefined) {
        const local = published();
        const server: Published = { content: normalizeContent(r.value.content), textOverrides: readTexts(r.value.texts), featureFlags: readFlags(r.value.flags) };
        // Keep the store's own objects where nothing changed, so nothing re-renders for it.
        synced = {
          content: same(local.content, server.content) ? local.content : server.content,
          textOverrides: same(local.textOverrides, server.textOverrides) ? local.textOverrides : server.textOverrides,
          featureFlags: same(local.featureFlags, server.featureFlags) ? local.featureFlags : server.featureFlags,
        };
        useDb.setState(synced);
      }
      ready = true;
    } finally {
      busy = false;
    }
  }

  async function push() {
    if (stopped || !ready || !dirty() || !canPublish()) return;
    if (busy) return schedule();
    busy = true;
    try {
      const now = published();
      const sends: [keyof Published, string, Record<string, unknown>][] = [
        ['content', 'rpc_save_app_content', { p_content: now.content }],
        ['textOverrides', 'rpc_save_text_overrides', { p_texts: now.textOverrides }],
        ['featureFlags', 'rpc_save_feature_flags', { p_flags: now.featureFlags }],
      ];
      for (const [part, fn, args] of sends) {
        if (now[part] === synced[part]) continue;
        const r = await rpc<number>(fn, args);
        if (!r.ok) {
          // Say it once, not after every keystroke; the next change or the next check tries again.
          if (r.error !== lastError) onError(`Saved on this device, but not published yet: ${r.error}`);
          lastError = r.error;
          return;
        }
        lastError = '';
        // Another super admin published in between: read their changes on the next check.
        revision = revision !== undefined && r.value === revision + 1 ? r.value : undefined;
        synced = { ...synced, [part]: now[part] };
      }
    } finally {
      busy = false;
      if (dirty() && !lastError) schedule();
    }
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void push(), PUSH_DELAY_MS);
  }

  const check = () => (ready && dirty() && canPublish() ? void push() : void pull());

  const unsubscribe = useDb.subscribe(() => {
    if (!ready || !dirty()) return;
    if (canPublish()) schedule();
    else void pull();
  });
  const appState = AppState.addEventListener('change', (status) => {
    if (status === 'active') check();
  });
  const poll = setInterval(() => {
    if (AppState.currentState === 'active') check();
  }, POLL_MS);
  void pull();

  return () => {
    stopped = true;
    unsubscribe();
    appState.remove();
    clearInterval(poll);
    if (timer) clearTimeout(timer);
  };
}
