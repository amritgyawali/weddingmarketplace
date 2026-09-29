import { findProvider } from '@/data/providers';
import { useDb } from '@/store/useDb';
import type { Account, Assignment, Gig, Project, ServiceBooking } from '@/types/platform';
import { daysUntil } from '@/utils/format';

/**
 * Role-scoped views over the shared store. Each hook selects stable arrays and
 * filters during render (the React Compiler memoises the result).
 */

export interface BookingRef {
  project: Project;
  booking: ServiceBooking;
}

export interface AssignmentRef extends BookingRef {
  assignment: Assignment;
}

/** Does this vendor account own the booking (claimed listing or explicit account)? */
export const ownsBooking = (account: Account, b: ServiceBooking) => b.providerAccountId === account.id || (!!account.listingId && b.providerId === account.listingId);

export function useVendorWorkspace(account: Account) {
  const leads = useDb((s) => s.leads);
  const quotes = useDb((s) => s.quotes);
  const projects = useDb((s) => s.projects);
  const gigs = useDb((s) => s.gigs);
  const payables = useDb((s) => s.payables);
  const reviews = useDb((s) => s.reviews);
  const deals = useDb((s) => s.deals);
  const staff = useDb((s) => s.staff);

  const bookings: BookingRef[] = projects.flatMap((project) => project.bookings.filter((b) => ownsBooking(account, b)).map((booking) => ({ project, booking })));
  const requests = bookings.filter((r) => r.booking.providerResponse === 'pending' && r.booking.status !== 'CANCELLED');
  return {
    leads: leads.filter((l) => l.listingId === account.listingId),
    quotes: quotes.filter((q) => q.fromId === account.id),
    bookings,
    requests,
    projects: [...new Map(bookings.map((b) => [b.project.id, b.project])).values()],
    gigs: gigs.filter((g) => g.postedById === account.id),
    payables: payables.filter((p) => p.payeeId === account.id || (!!account.listingId && p.payeeId === account.listingId)),
    reviews: reviews.filter((r) => r.targetId === account.listingId && r.status !== 'removed'),
    deals: deals.filter((d) => d.providerId === account.listingId),
    staff: staff.filter((m) => m.orgAccountId === account.id),
    listing: account.listingId ? findProvider(account.listingId) : undefined,
  };
}

export function useFreelancerWorkspace(account: Account) {
  const gigs = useDb((s) => s.gigs);
  const payables = useDb((s) => s.payables);
  const projects = useDb((s) => s.projects);
  const reviews = useDb((s) => s.reviews);

  const skills = account.skills ?? [];
  const mine = (g: Gig) => g.applications.find((a) => a.freelancerId === account.id);
  const assignments: AssignmentRef[] = projects.flatMap((project) =>
    project.bookings.flatMap((booking) => booking.assignments.filter((a) => a.workerId === account.id).map((assignment) => ({ project, booking, assignment }))),
  );
  const open = gigs.filter((g) => g.status === 'open' && daysUntil(g.date) >= 0 && !mine(g));
  return {
    gigs,
    open,
    matched: open.filter((g) => skills.includes(g.skill)),
    invited: open.filter((g) => g.invited?.includes(account.id)),
    applied: gigs.filter((g) => !!mine(g)),
    /** Gig jobs that are not tied to a booking assignment. */
    standalone: gigs.filter((g) => {
      const a = mine(g);
      return a && !a.assignmentId && ['hired', 'confirmed', 'checked_in', 'completed'].includes(a.status);
    }),
    assignments,
    upcoming: assignments.filter((x) => daysUntil(x.assignment.date) >= 0 && !['CANCELLED', 'COMPLETED', 'EMERGENCY_REPLACEMENT', 'NO_SHOW'].includes(x.assignment.status)).sort((a, b) => a.assignment.date.localeCompare(b.assignment.date)),
    payables: payables.filter((p) => p.payeeId === account.id),
    reviews: reviews.filter((r) => r.targetId === account.id && r.status === 'published'),
  };
}

/** The couple's project: their own, or one they joined as a collaborator. */
export function useCustomerWorkspace(accountId: string) {
  const projects = useDb((s) => s.projects);
  const quotes = useDb((s) => s.quotes);
  const own = projects.filter((p) => p.customerId === accountId).sort((a, b) => Number(a.status === 'CANCELLED') - Number(b.status === 'CANCELLED') || b.createdAt.localeCompare(a.createdAt));
  const joined = projects.filter((p) => p.collaborators.some((c) => c.accountId === accountId));
  const project = own[0] ?? joined[0] ?? null;
  return {
    project,
    projects: [...own, ...joined],
    isCollaborator: !own.length && !!joined.length,
    quotes: quotes.filter((q) => (q.customerId === accountId || (project && q.projectId === project.id)) && q.status !== 'draft'),
  };
}

/** The applicant record for this freelancer on a gig, if any. */
export const myApplication = (gig: { applications: { freelancerId: string }[] }, accountId: string) => gig.applications.find((a) => a.freelancerId === accountId);

export function findAssignment(projects: Project[], assignmentId: string): AssignmentRef | null {
  for (const project of projects)
    for (const booking of project.bookings) {
      const assignment = booking.assignments.find((a) => a.id === assignmentId);
      if (assignment) return { project, booking, assignment };
    }
  return null;
}

export function findBooking(projects: Project[], bookingId: string): BookingRef | null {
  for (const project of projects) {
    const booking = project.bookings.find((b) => b.id === bookingId);
    if (booking) return { project, booking };
  }
  return null;
}
