import { useDb } from '@/store/useDb';
import type { Account, Gig, GigApplication } from '@/types/platform';

/**
 * Role-scoped views over the shared store. Each hook selects stable arrays and
 * filters during render (the React Compiler memoises the result).
 */
export function useVendorWorkspace(account: Account) {
  const leads = useDb((s) => s.leads);
  const quotes = useDb((s) => s.quotes);
  const projects = useDb((s) => s.projects);
  const gigs = useDb((s) => s.gigs);

  const myLeads = leads.filter((l) => l.listingId === account.listingId);
  const myQuotes = quotes.filter((q) => q.fromId === account.id);
  const myProjects = projects.filter((p) =>
    p.vendors.some((v) => v.vendorAccountId === account.id || (!!account.listingId && v.listingId === account.listingId)),
  );
  const myGigs = gigs.filter((g) => g.postedById === account.id);
  return { leads: myLeads, quotes: myQuotes, projects: myProjects, gigs: myGigs };
}

export function useFreelancerWorkspace(account: Account) {
  const gigs = useDb((s) => s.gigs);
  const payouts = useDb((s) => s.payouts);
  const projects = useDb((s) => s.projects);

  const applied = gigs.filter((g) => g.applications.some((a) => a.freelancerId === account.id));
  const open = gigs.filter((g) => g.status === 'open' && !g.applications.some((a) => a.freelancerId === account.id));
  const myPayouts = payouts.filter((p) => p.freelancerId === account.id);
  return { gigs, open, applied, payouts: myPayouts, projects };
}

export function useCustomerWorkspace(accountId: string) {
  const projects = useDb((s) => s.projects);
  const quotes = useDb((s) => s.quotes);
  const project = projects.find((p) => p.customerId === accountId) ?? null;
  const myQuotes = quotes.filter((q) => q.customerId === accountId && q.status !== 'draft');
  return { project, quotes: myQuotes };
}

/** The applicant record for this freelancer on a gig, if any. */
export const myApplication = (gig: Gig, accountId: string): GigApplication | undefined =>
  gig.applications.find((a) => a.freelancerId === accountId);
