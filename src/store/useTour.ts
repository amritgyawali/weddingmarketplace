import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Guided tours; one per app that has one. */
export type TourId = 'couple';

interface TourState {
  /** Legacy device history, retained for callers that do not supply an account. */
  seen: TourId[];
  /** First-run guidance is remembered separately for each signed-in account. */
  seenAccounts: string[];
  activeAccountId: string | null;
  /** The tour on screen now, if any. */
  running: TourId | null;
  /** Shows a tour unless one is already running. */
  start: (id: TourId, accountId?: string) => void;
  /** Closes the running tour (finished or skipped) and remembers it. */
  finish: () => void;
  /** Forgets that a tour was seen, so it shows again on the next visit to its screen. */
  replay: (id: TourId, accountId?: string) => void;
}

/** First-run guided tours, persisted per device apart from the couple's data. */
export const useTour = create<TourState>()(
  persist(
    (set, get) => ({
      seen: [],
      seenAccounts: [],
      activeAccountId: null,
      running: null,
      start: (id, accountId) => {
        if (!get().running) set({ running: id, activeAccountId: accountId ?? null });
      },
      finish: () =>
        set((s) => ({ seenAccounts: s.activeAccountId ? [...new Set([...s.seenAccounts, s.activeAccountId])] : s.seenAccounts, activeAccountId: null, running: null, seen: s.running && !s.seen.includes(s.running) ? [...s.seen, s.running] : s.seen })),
      replay: (id, accountId) => set((s) => ({ seen: s.seen.filter((x) => x !== id), seenAccounts: accountId ? s.seenAccounts.filter((x) => x !== accountId) : [] })),
    }),
    {
      name: 'vivah-tour',
      version: 2,
      migrate: (saved) => ({ ...(saved as { seen?: TourId[] }), seenAccounts: [] }),
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ seen: s.seen, seenAccounts: s.seenAccounts }),
    },
  ),
);
