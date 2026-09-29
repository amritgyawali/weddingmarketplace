import { useSession } from '@/store/useSession';
import type { Account, Project, ServiceBooking } from '@/types/platform';
import { toISODate } from '@/utils/format';

import type { Db } from './index';

export type SetDb = (partial: Partial<Db> | ((s: Db) => Partial<Db>)) => void;
export type GetDb = () => Db;

export const now = () => new Date().toISOString();
export const today = () => toISODate(new Date());

/** Actor recorded on audit entries and status history. */
export interface Actor {
  id: string;
  name: string;
}

export const SYSTEM: Actor = { id: 'system', name: 'Vivah' };

export const accountById = (id?: string): Account | undefined => (id ? useSession.getState().accounts.find((a) => a.id === id) : undefined);
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

export const firstDate = (p: Project) =>
  p.events
    .filter((e) => e.date && e.status !== 'cancelled')
    .map((e) => e.date!)
    .sort()[0] ?? p.weddingDate;

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
