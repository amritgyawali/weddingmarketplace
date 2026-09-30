import { useCustomerWorkspace } from '@/hooks/useWorkspace';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { addDays, today } from '@/utils/format';

import { useToolOwner } from '../core';

/** The couple's wedding context for toolkit screens (works before a plan exists too). */
export function useWedding() {
  const account = useAccount();
  const owner = useToolOwner();
  const { project } = useCustomerWorkspace(account.id);
  const allGuests = useDb((s) => s.guests);
  const guests = project ? allGuests.filter((g) => g.projectId === project.id) : [];
  const date = project?.weddingDate ?? addDays(today(), 180);
  const events = (project?.events ?? []).filter((e) => e.status !== 'cancelled');
  return {
    account,
    owner,
    project,
    guests,
    date,
    city: project?.city ?? account.city ?? 'Kathmandu',
    guestCount: project?.guests ?? 300,
    events,
    eventNames: events.length ? events.map((e) => e.name) : ['Wedding', 'Reception'],
    names: project ? [project.customerName.split(' ')[0], project.partnerName?.split(' ')[0]].filter(Boolean).join(' & ') : account.name,
  };
}
