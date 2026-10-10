import { useSession } from '@/store/useSession';
import type { Account, Project, ServiceBooking } from '@/types/platform';
import { toISODate } from '@/utils/format';

import type { Db } from './index';

/** Signature of the zustand `set` function for the DB store. */
export type SetDb = (partial: Partial<Db> | ((s: Db) => Partial<Db>)) => void;
/** Signature of the zustand `get` function for the DB store. */
export type GetDb = () => Db;

/** Current time as an ISO timestamp, used for created/updated stamps. */
export const now = () => new Date().toISOString();
/** Today's date as yyyy-mm-dd (local). */
export const today = () => toISODate(new Date());

/** Actor recorded on audit entries and status history. */
export interface Actor {
  id: string;
  name: string;
}

/** Actor used for automated changes that no signed-in person made. */
export const SYSTEM: Actor = { id: 'system', name: 'Vivah' };

/** Finds an account by id in the session store; undefined when the id is missing or unknown. */
export const accountById = (id?: string): Account | undefined => (id ? useSession.getState().accounts.find((a) => a.id === id) : undefined);
/** The signed-in account as an audit actor, or `SYSTEM` when nobody is signed in. */
export const currentActor = (): Actor => {
  const s = useSession.getState();
  const a = s.accounts.find((x) => x.id === s.session?.accountId);
  return a ? { id: a.id, name: a.name } : SYSTEM;
};

/** Vendor accounts that manage a catalogue listing. */
export const ownersOf = (listingId: string) => useSession.getState().accounts.filter((a) => a.role === 'vendor' && a.listingId === listingId);

/** Replace one project immutably. */
export const mapProject = (projects: Project[], id: string, fn: (p: Project) => Project) =>
  projects.map((p) => (p.id === id ? { ...fn(p), updatedAt: now() } : p));

/** Replace one booking inside a project immutably. */
export const mapBooking = (p: Project, bookingId: string, fn: (b: ServiceBooking) => ServiceBooking): Project => ({
  ...p,
  bookings: p.bookings.map((b) => (b.id === bookingId ? fn(b) : b)),
});

/** Dated events a booking covers, earliest first. */
export const bookingDates = (p: Project, b: Pick<ServiceBooking, 'eventIds'>) =>
  [...new Set(p.events.filter((e) => b.eventIds.includes(e.id) && e.date && e.status !== 'cancelled').map((e) => e.date!))].sort();

/** Earliest date of the project's live (not cancelled) events, falling back to the wedding date. */
export const firstDate = (p: Project) =>
  p.events
    .filter((e) => e.date && e.status !== 'cancelled')
    .map((e) => e.date!)
    .sort()[0] ?? p.weddingDate;

/** Latest date of the project's live (not cancelled) events, falling back to the wedding date. */
export const lastDate = (p: Project) =>
  p.events
    .filter((e) => e.date && e.status !== 'cancelled')
    .map((e) => e.date!)
    .sort()
    .slice(-1)[0] ?? p.weddingDate;

/** Receipt / invoice style numbers: RCPT-2026-0145. */
export const nextNumber = (prefix: string, existing: string[]) => {
  const year = new Date().getFullYear();
  const max = existing.map((n) => Number(n.split('-').pop())).filter(Number.isFinite).reduce((a, b) => Math.max(a, b), 100);
  return `${prefix}-${year}-${String(max + 1).padStart(4, '0')}`;
};
