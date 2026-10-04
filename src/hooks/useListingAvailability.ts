import { dailyCapacity, listingAvailability } from '@/services/customerPlanning';
import { useDb } from '@/store/useDb';
import { useSession } from '@/store/useSession';

/** Shares the vendor's published calendar with customers viewing the same listing. */
export function useListingAvailability(listingId: string) {
  const entries = useDb((s) => s.availability);
  const rules = useDb((s) => s.availabilityRules);
  const accounts = useSession((s) => s.accounts);
  const owner = accounts.find((a) => a.role === 'vendor' && a.listingId === listingId);
  const ids = [listingId, ...(owner ? [owner.id] : [])];
  const capacity = dailyCapacity(owner);
  return {
    published: !!owner?.tradeProfile?.eventsPerDay || entries.some((e) => ids.includes(e.ownerId)) || rules.some((r) => ids.includes(r.ownerId)),
    onDate: (date: string) => listingAvailability(ids, date, entries, rules, capacity),
  };
}
