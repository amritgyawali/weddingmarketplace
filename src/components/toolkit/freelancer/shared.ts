import { useFreelancerWorkspace } from '@/hooks/useWorkspace';
import { useAccount } from '@/store/useSession';

export interface JobRef {
  id: string;
  label: string;
  date: string;
  city: string;
  time?: string;
  role: string;
  pay: number;
  organiser: string;
}

/** Every job this freelancer holds: booking assignments plus hired marketplace gigs. */
export function useJobs() {
  const account = useAccount();
  const ws = useFreelancerWorkspace(account);
  const fromAssignments: JobRef[] = ws.assignments
    .filter((a) => !['CANCELLED', 'EMERGENCY_REPLACEMENT'].includes(a.assignment.status))
    .map(({ project, booking, assignment }) => ({
      id: assignment.id,
      label: `${project.customerName.split(' ')[0]}${project.partnerName ? ` & ${project.partnerName.split(' ')[0]}` : ''} · ${assignment.role}`,
      date: assignment.date,
      city: project.city,
      time: assignment.startTime,
      role: assignment.role,
      pay: assignment.pay,
      organiser: booking.providerName,
    }));
  const fromGigs: JobRef[] = ws.standalone.map((g) => ({ id: g.id, label: `${g.title}`, date: g.date, city: g.city, time: g.startTime, role: g.skill, pay: g.pay, organiser: g.postedByName }));
  const jobs = [...fromAssignments, ...fromGigs].sort((a, b) => a.date.localeCompare(b.date));
  return { account, ws, jobs };
}
