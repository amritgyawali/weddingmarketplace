/**
 * The shared on-device "backend" for all four apps. Every cross-role workflow
 * is an action here so the chain requirement → matching → quote → booking →
 * crew/gig → execution → payment → payout → review stays consistent. In
 * production each action becomes an API call against supabase/migrations.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { buildSeedData } from '@/data/seed';
import type { Account } from '@/types/platform';

import { chatActions, type ChatActions, clearReplyTimers } from './chat';
import { coreActions, type CoreActions } from './core';
import { financeActions, type FinanceActions } from './finance';
import { gigActions, type GigActions } from './gigs';
import { plannerActions, type PlannerActions } from './planner';
import { projectActions, type ProjectActions } from './projects';
import { quoteActions, type QuoteActions } from './quotes';
import { trustActions, type TrustActions } from './trust';
import type { DbData } from './types';

export type { DbData } from './types';
export type Db = DbData & CoreActions & QuoteActions & ProjectActions & FinanceActions & GigActions & ChatActions & TrustActions & PlannerActions;

const DATA_KEYS = Object.keys(buildSeedData()) as (keyof DbData)[];

export const useDb = create<Db>()(
  persist(
    (set, get) => ({
      ...buildSeedData(),
      ...coreActions(set, get),
      ...quoteActions(set, get),
      ...projectActions(set, get),
      ...financeActions(set, get),
      ...gigActions(set, get),
      ...chatActions(set, get),
      ...trustActions(set, get),
      ...plannerActions(set, get),
      resetDemo: () => {
        clearReplyTimers();
        set(buildSeedData());
      },
    }),
    {
      name: 'vivah-db',
      // v3: Nepal orchestration model (projects → requirements → bookings → crew).
      version: 3,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => Object.fromEntries(DATA_KEYS.map((k) => [k, s[k]])) as unknown as DbData,
      migrate: (persisted, version) => (version < 3 ? buildSeedData() : (persisted as DbData)) as Db,
    },
  ),
);

/**
 * Notifications addressed to the account directly or to its whole role.
 * Selects the stable array and filters in render — returning a fresh array
 * from a zustand selector would re-render forever.
 */
export function useInbox(account: Account) {
  const notifications = useDb((s) => s.notifications);
  return notifications.filter((n) => n.to === account.id || n.to === account.role);
}

/** Threads this account is a member of (platform staff see every thread). */
export function useThreads(account: Account) {
  const threads = useDb((s) => s.threads);
  const messages = useDb((s) => s.messages);
  const mine = threads.filter((t) => account.role === 'platform' || t.members.some((m) => m.id === account.id || (account.listingId && m.id === `listing_${account.listingId}`)));
  return mine
    .map((t) => {
      const list = messages.filter((m) => m.threadId === t.id);
      return { thread: t, last: list[list.length - 1], unread: list.filter((m) => !m.readBy.includes(account.id)).length };
    })
    .sort((a, b) => b.thread.lastAt.localeCompare(a.thread.lastAt));
}

export function useUnreadMessageCount(account: Account) {
  return useThreads(account).reduce((s, t) => s + (t.thread.archivedBy.includes(account.id) ? 0 : t.unread), 0);
}
