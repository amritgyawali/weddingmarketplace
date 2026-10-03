import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Guided tours; one per app that has one. */
export type TourId = 'couple';

interface TourState {
  /** Tours this device has finished or skipped. Kept across sign-outs: a tour is about the app, not the account. */
  seen: TourId[];
  /** The tour on screen now, if any. */
  running: TourId | null;
  /** Shows a tour unless one is already running. */
  start: (id: TourId) => void;
  /** Closes the running tour (finished or skipped) and remembers it. */
  finish: () => void;
  /** Forgets that a tour was seen, so it shows again on the next visit to its screen. */
  replay: (id: TourId) => void;
}

/** First-run guided tours, persisted per device apart from the couple's data. */
export const useTour = create<TourState>()(
  persist(
    (set, get) => ({
      seen: [],
      running: null,
      start: (id) => {
        if (!get().running) set({ running: id });
      },
      finish: () =>
        set((s) => ({ running: null, seen: s.running && !s.seen.includes(s.running) ? [...s.seen, s.running] : s.seen })),
      replay: (id) => set((s) => ({ seen: s.seen.filter((x) => x !== id) })),
    }),
    {
      name: 'vivah-tour',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ seen: s.seen }),
    },
  ),
);
