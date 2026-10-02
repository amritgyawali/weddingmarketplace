import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import type { PersistStorage, StorageValue } from 'zustand/middleware';

const pending = new Map<string, { value: StorageValue<unknown>; timer: ReturnType<typeof setTimeout> }>();

function write(name: string) {
  const job = pending.get(name);
  if (!job) return;
  pending.delete(name);
  clearTimeout(job.timer);
  AsyncStorage.setItem(name, JSON.stringify(job.value)).catch(() => {});
}

/** Writes every queued store at once (the app is going to the background). */
export function flushStorage() {
  [...pending.keys()].forEach(write);
}

AppState.addEventListener('change', (state) => {
  if (state !== 'active') flushStorage();
});
if (Platform.OS === 'web' && typeof window !== 'undefined') window.addEventListener('beforeunload', flushStorage);

/**
 * AsyncStorage for zustand `persist` that saves a moment after the last
 * change instead of on every change. Serialising the whole demo database on
 * each tap kept the JS thread busy, so taps that came right after an action
 * were dropped or delayed. Writes still happen within half a second, and at
 * once when the app goes to the background.
 */
export function lazyStorage<T>(delay = 400): PersistStorage<T> {
  return {
    getItem: async (name) => {
      const raw = await AsyncStorage.getItem(name);
      return raw ? (JSON.parse(raw) as StorageValue<T>) : null;
    },
    setItem: (name, value) => {
      const job = pending.get(name);
      if (job) clearTimeout(job.timer);
      pending.set(name, { value: value as StorageValue<unknown>, timer: setTimeout(() => write(name), delay) });
    },
    removeItem: async (name) => {
      const job = pending.get(name);
      if (job) clearTimeout(job.timer);
      pending.delete(name);
      await AsyncStorage.removeItem(name);
    },
  };
}
