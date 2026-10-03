/**
 * The shared on-device "backend" for all four apps. Every cross-role workflow
 * is an action here so the chain requirement → matching → quote → booking →
 * crew/gig → execution → payment → payout → review stays consistent. In
 * production each action becomes an API call against supabase/migrations.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { VEHICLE_SERVICES } from '@/data/occasions';
import { buildSeedData } from '@/data/seed';
import { occasionOf } from '@/services/experience';
import { generateTasks, WEDDING_ONLY_TASKS } from '@/services/planner';
import { lazyStorage } from '@/store/lazyStorage';
import type { Account } from '@/types/platform';

import { adminActions, type AdminActions } from './admin';
import { chatActions, type ChatActions, clearReplyTimers } from './chat';
import { coreActions, type CoreActions } from './core';
import { financeActions, type FinanceActions } from './finance';
import { gigActions, type GigActions } from './gigs';
import { personaActions, type PersonaActions, staffDenied } from './personas';
import { plannerActions, type PlannerActions } from './planner';
import { projectActions, type ProjectActions } from './projects';
import { quoteActions, type QuoteActions } from './quotes';
import { clearSocialTimers, socialActions, type SocialActions } from './social';
import { supportActions, type SupportActions } from './support';
import { toolkitActions, type ToolkitActions } from './toolkit';
import { trustActions, type TrustActions } from './trust';
import type { DbData } from './types';

export type { DbData } from './types';
export type Db = DbData & CoreActions & QuoteActions & ProjectActions & FinanceActions & GigActions & ChatActions & TrustActions & PlannerActions & ToolkitActions & PersonaActions & AdminActions & SocialActions & SupportActions;

const DATA_KEYS = Object.keys(buildSeedData()) as (keyof DbData)[];

/**
 * v5: the vehicles trade. Built-in occasions saved before it get the vehicle
 * services their current definition lists (weddings and "something else" list
 * every service); the super admin collections start empty. Celebrations that
 * aren't weddings (a pasni, a bratabandha) lose the wedding-only checklist
 * items they were created with ("guest list, bride and groom side") and get
 * their own.
 */
function addVehicles(data: DbData): DbData {
  const seed = new Map(buildSeedData().occasions.map((o) => [o.id, o]));
  return {
    ...data,
    projects: (data.projects ?? []).map((p) => {
      const occasion = occasionOf(p, data.occasions).id;
      if (occasion === 'wedding' || occasion === 'engagement' || !p.tasks.some((t) => WEDDING_ONLY_TASKS.has(t.title))) return p;
      const kept = p.tasks.filter((t) => t.status !== 'TODO' || !WEDDING_ONLY_TASKS.has(t.title));
      const services = p.requirements.filter((r) => r.status !== 'CANCELLED').map((r) => r.serviceId);
      const fresh = generateTasks(p.weddingDate, services, p.customerName, p.coordinatorName, occasion).filter((t) => !kept.some((k) => k.title === t.title));
      return { ...p, tasks: [...kept, ...fresh] };
    }),
    occasions: (data.occasions ?? []).map((o) => {
      const def = o.builtIn ? seed.get(o.id) : undefined;
      if (!def) return o;
      const extra = VEHICLE_SERVICES.filter((s) => def.services.includes(s) && !o.services.includes(s));
      return extra.length ? { ...o, services: [...o.services, ...extra] } : o;
    }),
    featureFlags: data.featureFlags ?? {},
    textOverrides: data.textOverrides ?? {},
    announcements: data.announcements ?? [],
  };
}

/** Adds seed projects and tool records an older install doesn't have, and the nwaran function to the built-in newborn occasion. Nothing existing is changed. */
function addSeedRecords(data: DbData): DbData {
  const seed = buildSeedData();
  const has = <T extends { id: string }>(list: T[] | undefined) => new Set((list ?? []).map((x) => x.id));
  const projects = has(data.projects);
  const entries = has(data.toolEntries);
  return {
    ...data,
    projects: [...(data.projects ?? []), ...seed.projects.filter((p) => !projects.has(p.id))],
    toolEntries: [...(data.toolEntries ?? []), ...seed.toolEntries.filter((e) => !entries.has(e.id))],
    occasions: (data.occasions ?? seed.occasions).map((o) => (o.id === 'newborn' && o.builtIn && !o.eventTypes.includes('NWARAN') ? { ...o, eventTypes: [...o.eventTypes.slice(0, 1), 'NWARAN', ...o.eventTypes.slice(1)] } : o)),
  };
}

/** v6: the social hub collections, with the demo businesses' accounts, inbox and posts. Nothing existing is changed. */
function addSocial(data: DbData): DbData {
  const seed = buildSeedData();
  return {
    ...data,
    socialAccounts: data.socialAccounts ?? seed.socialAccounts,
    socialThreads: data.socialThreads ?? seed.socialThreads,
    socialMessages: data.socialMessages ?? seed.socialMessages,
    socialPosts: data.socialPosts ?? seed.socialPosts,
    socialSettings: data.socialSettings ?? seed.socialSettings,
  };
}

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
      ...toolkitActions(set, get),
      ...personaActions(set, get),
      ...adminActions(set, get),
      ...socialActions(set, get),
      ...supportActions(set, get),
      resetDemo: () => {
        const denied = staffDenied('demo.reset', get);
        if (denied) return denied;
        clearReplyTimers();
        clearSocialTimers();
        // Bug reports are real feedback, not demo data: they survive a reset.
        set({ ...buildSeedData(), bugReports: get().bugReports });
        return null;
      },
    }),
    {
      name: 'vivah-db',
      // v3: Nepal orchestration model (projects → requirements → bookings → crew).
      // v4: adds the newborn demo project, the new demo tool records and the nwaran function (additive).
      // v5: vehicle services on the built-in occasions; feature flags, text overrides, announcements (additive).
      // v6: the social hub (connected networks, unified inbox, posts), seeded for the demo businesses (additive).
      version: 6,
      storage: lazyStorage<DbData>(),
      partialize: (s) => Object.fromEntries(DATA_KEYS.map((k) => [k, s[k]])) as unknown as DbData,
      migrate: (persisted, version) => {
        if (version < 3) return buildSeedData() as Db;
        let data = persisted as DbData;
        if (version < 4) data = addSeedRecords(data);
        if (version < 5) data = addVehicles(data);
        if (version < 6) data = addSocial(data);
        return data as Db;
      },
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
