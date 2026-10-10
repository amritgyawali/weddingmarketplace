import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Unsent form drafts. A half-written review, enquiry or task is kept in
 * memory and on the device (AsyncStorage), so it is still there after the
 * person leaves the screen or the app closes. Drafts are temporary: they
 * expire after three days and are removed once the form is submitted.
 *
 * Keys should include the account id, e.g. `review:<accountId>:<providerId>`.
 */
const PREFIX = 'vivah.draft.';
const TTL_MS = 3 * 24 * 60 * 60 * 1000;
const WRITE_DELAY_MS = 400;

interface Stored {
  at: number;
  value: unknown;
}

const memory = new Map<string, Stored>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const waiting = new Set<() => void>();
let loaded = false;

const fresh = (d: Stored | undefined) => !!d && Date.now() - d.at < TTL_MS;

/** Reads every saved draft into memory. Called once at app start. */
export async function loadDrafts() {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX));
    const rows = keys.length ? await AsyncStorage.multiGet(keys) : [];
    const expired: string[] = [];
    for (const [k, raw] of rows) {
      const key = k.slice(PREFIX.length);
      if (!raw || memory.has(key)) continue;
      try {
        const d = JSON.parse(raw) as Stored;
        if (fresh(d)) memory.set(key, d);
        else expired.push(k);
      } catch {
        expired.push(k);
      }
    }
    if (expired.length) AsyncStorage.multiRemove(expired).catch(() => {});
  } catch {
    // Storage unavailable: drafts then only last while the app is open.
  }
  loaded = true;
  waiting.forEach((fn) => fn());
  waiting.clear();
}

/** The saved draft for `key`, if there is a fresh one. */
export function readDraft<T>(key: string): T | undefined {
  const d = memory.get(key);
  return fresh(d) ? (d!.value as T) : undefined;
}

/** Saves a draft (written to the device a moment after the last change). */
export function saveDraft(key: string, value: unknown) {
  const d = { at: Date.now(), value };
  memory.set(key, d);
  clearTimeout(timers.get(key));
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      AsyncStorage.setItem(PREFIX + key, JSON.stringify(d)).catch(() => {});
    }, WRITE_DELAY_MS),
  );
}

/** Forgets a draft, e.g. after the form was submitted. */
export function clearDraft(key: string) {
  memory.delete(key);
  clearTimeout(timers.get(key));
  timers.delete(key);
  AsyncStorage.removeItem(PREFIX + key).catch(() => {});
}

/**
 * `useState` that is kept as a draft under `key` (no key: plain state).
 * Returns the value, a setter, and `clear()` to call after a successful
 * submit. A value equal to `initial` is not stored, so an untouched form
 * leaves nothing behind.
 */
export function useDraft<T>(key: string | null, initial: T): [T, (next: T | ((prev: T) => T)) => void, () => void] {
  const initialRef = useRef(initial);
  const touched = useRef(false);
  const [value, setValue] = useState<T>(() => (key ? (readDraft<T>(key) ?? initial) : initial));

  // A form opened in the first moments after launch, before drafts were read.
  useEffect(() => {
    if (!key || loaded) return;
    const apply = () => {
      const saved = readDraft<T>(key);
      if (saved !== undefined && !touched.current) setValue(saved);
    };
    waiting.add(apply);
    return () => {
      waiting.delete(apply);
    };
  }, [key]);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      touched.current = true;
      setValue((prev) => {
        const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        if (key) {
          if (JSON.stringify(v) === JSON.stringify(initialRef.current)) clearDraft(key);
          else saveDraft(key, v);
        }
        return v;
      });
    },
    [key],
  );

  const clear = useCallback(() => {
    if (key) clearDraft(key);
    touched.current = false;
    setValue(initialRef.current);
  }, [key]);

  return [value, set, clear];
}
