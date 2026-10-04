import { PHASE_DUE } from '@/data/checklist';
import type { OccasionDef } from '@/data/occasions';
import type { ChecklistTask, VendorPackage } from '@/types';
import type { Account, AvailabilityEntry, AvailabilityRule, AvailabilityStatus, EventType, Project } from '@/types/platform';
import { roundMoney } from '@/services/pricing';
import { fromISODate } from '@/utils/format';

/** Keeps existing guide ids while compressing overdue preparation into today's work. */
export function guideSections(tasks: ChecklistTask[], days: number | null) {
  const remaining = days === null ? null : Math.max(0, days);
  const groups = new Map<number, ChecklistTask[]>();
  for (const task of tasks) {
    const before = PHASE_DUE[task.phase];
    const offset = remaining === null ? 0 : Math.max(0, remaining - before);
    groups.set(offset, [...(groups.get(offset) ?? []), task]);
  }
  return [...groups].sort(([a], [b]) => a - b).map(([offset, items]) => ({
    id: String(offset),
    label: remaining === null ? 'Start here' : offset === 0 ? 'Do now' : offset === remaining ? 'On the event day' : `In ${offset} days`,
    tasks: items,
  }));
}

/** Only functions in the selected occasion are offered, including admin-created occasions. */
export function relatedEvents(occasion: OccasionDef) {
  const extras: Record<string, EventType[]> = { wedding: ['OTHER'], engagement: ['RECEPTION', 'OTHER'], anniversary: ['RECEPTION', 'OTHER'], baby_shower: ['OTHER'], newborn: ['OTHER'], bratabandha: ['RECEPTION', 'OTHER'], birthday: ['OTHER'], corporate: ['RECEPTION', 'OTHER'], other: [] };
  return [...new Set([...occasion.eventTypes, ...(extras[occasion.id] ?? [])])];
}

/** A listing estimate uses the functions assigned to its service and explicit quantities. It is not a quotation. */
export function personalizedPackagePrice(pkg: VendorPackage, serviceId: string, project: Project | null): number | null {
  if (!project) return null;
  const req = project.requirements.find((r) => r.serviceId === serviceId && r.status !== 'CANCELLED');
  const events = project.events.filter((e) => e.status !== 'cancelled' && (!req || req.eventIds.includes(e.id)));
  if (!events.length) return null;
  const details = req?.details ?? {};
  const quantity = (key: string, fallback: number) => {
    const value = Number(details[key]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };
  const unit = pkg.unit.toLowerCase();
  let multiplier = 1;
  if (/plate|person/.test(unit)) multiplier = events.reduce((sum, e) => sum + e.guests, 0);
  else if (/event|day|function/.test(unit)) multiplier = events.length;
  else if (/card/.test(unit)) multiplier = quantity('cards', Math.ceil(project.guests * 0.6));
  else if (/car/.test(unit)) multiplier = quantity('cars', 1);
  else if (/hour/.test(unit)) multiplier = quantity('hours', pkg.hours ?? 8) * events.length;
  // Optional priced extras are added only when the requirement supplies a price.
  const extras = Number(details.addOnTotal ?? 0);
  return roundMoney(pkg.price * multiplier + (Number.isFinite(extras) && extras > 0 ? extras : 0));
}

/** Capacity defaults conservatively to one until the business publishes its daily limit. */
export function dailyCapacity(account?: Account): number {
  const value = Number(account?.tradeProfile?.eventsPerDay);
  return Number.isInteger(value) && value >= 1 && value <= 100 ? value : 1;
}

/** Public calendar status from real entries and weekly rules, with distinct booking reservations counted once. */
export function listingAvailability(ownerIds: string[], date: string, entries: AvailabilityEntry[], rules: AvailabilityRule[], capacity: number): { status: AvailabilityStatus; remaining: number } {
  const own = entries.filter((e) => ownerIds.includes(e.ownerId) && e.date === date);
  const weekly = rules.filter((r) => ownerIds.includes(r.ownerId) && r.weekday === fromISODate(date).getDay());
  if ([...own, ...weekly].some((e) => e.status === 'UNAVAILABLE')) return { status: 'UNAVAILABLE', remaining: 0 };
  const booked = new Set(own.filter((e) => e.status === 'BOOKED' || e.status === 'HELD').map((e) => e.refId ?? e.id)).size;
  const remaining = Math.max(0, capacity - booked);
  if (!remaining || weekly.some((r) => r.status === 'BOOKED' || r.status === 'HELD')) return { status: 'BOOKED', remaining: 0 };
  return { status: [...own, ...weekly].some((e) => e.status === 'TENTATIVE') ? 'TENTATIVE' : 'AVAILABLE', remaining };
}
