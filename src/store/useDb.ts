/**
 * The shared "backend" for all four apps. Every cross-role workflow is an
 * action here, so the chain customer enquiry → vendor lead → quotation →
 * booking/project → gig → freelancer → execution → payout stays consistent.
 * In production each action becomes an API call; the UI already talks to it
 * through these functions only.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { findCategory } from '@/data/categories';
import {
  buildSeedApprovals,
  buildSeedGigs,
  buildSeedLeads,
  buildSeedNotifications,
  buildSeedPayouts,
  buildSeedProjects,
  buildSeedQuotes,
  day,
} from '@/data/seed';
import { VENDORS } from '@/data/vendors';
import { VENUES } from '@/data/venues';
import { DEFAULT_TERMS, GST_RATE, nextQuoteNumber, quoteTotals } from '@/services/quotes';
import { useSession } from '@/store/useSession';
import type {
  Account,
  AppNotification,
  ApplicationStatus,
  Approval,
  EventStatus,
  Gig,
  GigApplication,
  Incident,
  Lead,
  LeadStatus,
  PaymentMilestone,
  Payout,
  Project,
  ProjectTask,
  Quotation,
  RunStatus,
  TaskStatus,
} from '@/types/platform';
import { fromISODate, toISODate, uid } from '@/utils/format';

interface DbData {
  projects: Project[];
  quotes: Quotation[];
  leads: Lead[];
  gigs: Gig[];
  payouts: Payout[];
  approvals: Approval[];
  notifications: AppNotification[];
}

interface DbActions {
  notify: (to: string, title: string, body: string, href?: string) => void;
  markNotificationsRead: (account: Account) => void;

  createLead: (input: Omit<Lead, 'id' | 'createdAt' | 'status'>) => Lead;
  setLeadStatus: (id: string, status: LeadStatus) => void;

  saveQuote: (quote: Quotation) => void;
  sendQuote: (id: string) => void;
  markQuoteViewed: (id: string) => void;
  respondToQuote: (id: string, action: 'accept' | 'decline' | 'revision', note?: string) => void;

  ensureCustomerProject: (customer: Account, details?: { weddingDate?: string | null; city?: string; managedBy?: Project['managedBy']; geniePackageId?: string }) => Project;
  updateProject: (id: string, update: (p: Project) => Project) => void;
  addTask: (projectId: string, task: Omit<ProjectTask, 'id'>) => void;
  setTaskStatus: (projectId: string, taskId: string, status: TaskStatus) => void;
  setRunStatus: (projectId: string, eventId: string, itemId: string, status: RunStatus) => void;
  setEventStatus: (projectId: string, eventId: string, status: EventStatus) => void;
  reportIncident: (projectId: string, incident: Omit<Incident, 'id' | 'at' | 'status'>) => void;
  resolveIncident: (projectId: string, incidentId: string) => void;
  payMilestone: (projectId: string, milestoneId: string) => void;

  postGig: (gig: Omit<Gig, 'id' | 'createdAt' | 'status' | 'applications'>) => Gig;
  applyToGig: (gigId: string, application: Omit<GigApplication, 'id' | 'appliedAt' | 'status'>) => void;
  setApplicationStatus: (gigId: string, applicationId: string, status: ApplicationStatus) => void;
  checkIn: (gigId: string, applicationId: string) => void;
  checkOut: (gigId: string, applicationId: string) => void;
  cancelGig: (gigId: string) => void;

  submitForApproval: (account: Account) => void;
  decideApproval: (id: string, approve: boolean) => void;
  releasePayout: (id: string) => void;

  seedVendorWorkspace: (account: Account) => void;
  resetDemo: () => void;
}

export type Db = DbData & DbActions;

const seedData = (): DbData => ({
  projects: buildSeedProjects(),
  quotes: buildSeedQuotes(),
  leads: buildSeedLeads(),
  gigs: buildSeedGigs(),
  payouts: buildSeedPayouts(),
  approvals: buildSeedApprovals(),
  notifications: buildSeedNotifications(),
});

const now = () => new Date().toISOString();

/** Vendor accounts that manage a catalogue listing (they receive its leads). */
const ownersOf = (listingId: string) =>
  useSession.getState().accounts.filter((a) => a.role === 'vendor' && a.listingId === listingId);

/** Auto-quote for unclaimed listings so couples always get a response. */
function autoQuoteFor(lead: Lead, existingNumbers: string[]): Quotation {
  const venue = lead.listingKind === 'venue' ? VENUES.find((v) => v.id === lead.listingId) : undefined;
  const vendor = lead.listingKind === 'vendor' ? VENDORS.find((v) => v.id === lead.listingId) : undefined;
  const guests = lead.guests ?? 250;
  const fnCount = Math.max(1, lead.functions.length);
  const items = venue
    ? [
        { id: uid('qi'), title: `Venue rental (${fnCount} function${fnCount > 1 ? 's' : ''})`, qty: fnCount, rate: venue.rentalCost },
        { id: uid('qi'), title: 'Veg catering (per plate)', qty: guests, rate: venue.vegPerPlate },
      ]
    : (vendor?.packages.slice(0, 2).map((p) => ({ id: uid('qi'), title: `${p.name} package (${p.unit})`, description: p.includes.join(', '), qty: 1, rate: p.price })) ?? []);
  return {
    id: uid('qt'),
    number: nextQuoteNumber(existingNumbers),
    fromKind: 'vendor',
    fromId: `listing_${lead.listingId}`,
    fromName: lead.listingName,
    listingId: lead.listingId,
    category: venue ? 'venues' : (vendor?.categoryId ?? 'default'),
    leadId: lead.id,
    customerId: lead.customerId,
    customerName: lead.customerName,
    eventDate: lead.eventDate,
    city: lead.city,
    items,
    discount: 0,
    taxRate: GST_RATE,
    notes: 'Thank you for your enquiry! This is our standard package — reply to customise it.',
    terms: DEFAULT_TERMS,
    validUntil: day(15),
    status: 'sent',
    createdAt: now(),
    updatedAt: now(),
  };
}

const EVENT_TEMPLATES = ['Mehendi', 'Sangeet', 'Wedding', 'Reception'];

export const useDb = create<Db>()(
  persist(
    (set, get) => ({
      ...seedData(),

      notify: (to, title, body, href) =>
        set((s) => ({
          notifications: [{ id: uid('n'), to, title, body, href, at: now(), read: false }, ...s.notifications].slice(0, 200),
        })),

      markNotificationsRead: (account) =>
        set((s) => ({
          notifications: s.notifications.map((n) => (n.to === account.id || n.to === account.role ? { ...n, read: true } : n)),
        })),

      // ── Leads ─────────────────────────────────────────────────────────
      createLead: (input) => {
        const lead: Lead = { ...input, id: uid('ld'), status: 'new', createdAt: now() };
        set((s) => ({ leads: [lead, ...s.leads] }));
        const owners = ownersOf(lead.listingId);
        owners.forEach((o) =>
          get().notify(o.id, `New lead: ${lead.customerName}`, `${lead.functions.join(', ')} · ${lead.guests ?? '—'} guests`, `/business/lead/${lead.id}`),
        );
        get().notify('platform', 'New enquiry on marketplace', `${lead.customerName} → ${lead.listingName}`);

        if (!owners.length) {
          // Unclaimed listing: respond with the catalogue package after a short delay.
          setTimeout(() => {
            const quote = autoQuoteFor(lead, get().quotes.map((q) => q.number));
            set((s) => ({
              quotes: [quote, ...s.quotes],
              leads: s.leads.map((l) => (l.id === lead.id ? { ...l, status: 'quoted' } : l)),
            }));
            get().notify(lead.customerId, `Quotation from ${lead.listingName}`, `${quote.number} is ready to review.`, `/quote/${quote.id}`);
          }, 4000);
        }
        return lead;
      },

      setLeadStatus: (id, status) => set((s) => ({ leads: s.leads.map((l) => (l.id === id ? { ...l, status } : l)) })),

      // ── Quotations ────────────────────────────────────────────────────
      saveQuote: (quote) =>
        set((s) => {
          const exists = s.quotes.some((q) => q.id === quote.id);
          const next = { ...quote, updatedAt: now() };
          return { quotes: exists ? s.quotes.map((q) => (q.id === quote.id ? next : q)) : [next, ...s.quotes] };
        }),

      sendQuote: (id) => {
        const quote = get().quotes.find((q) => q.id === id);
        if (!quote) return;
        set((s) => ({
          quotes: s.quotes.map((q) => (q.id === id ? { ...q, status: 'sent', revisionNote: undefined, updatedAt: now() } : q)),
          leads: s.leads.map((l) => (l.id === quote.leadId ? { ...l, status: 'quoted' } : l)),
        }));
        const total = quoteTotals(quote).total;
        get().notify(quote.customerId, `Quotation from ${quote.fromName}`, `${quote.number} · ₹${total.toLocaleString('en-IN')}`, `/quote/${id}`);
      },

      markQuoteViewed: (id) => {
        const quote = get().quotes.find((q) => q.id === id);
        if (!quote || quote.status !== 'sent') return;
        set((s) => ({ quotes: s.quotes.map((q) => (q.id === id ? { ...q, status: 'viewed' } : q)) }));
        const to = quote.fromKind === 'platform' ? 'platform' : quote.fromId;
        get().notify(to, `${quote.customerName} viewed your quotation`, `${quote.number} was opened.`);
      },

      respondToQuote: (id, action, note) => {
        const quote = get().quotes.find((q) => q.id === id);
        if (!quote) return;
        const status = action === 'accept' ? 'accepted' : action === 'decline' ? 'declined' : 'revision';
        const vendorTo = quote.fromKind === 'platform' ? 'platform' : quote.fromId;

        if (action === 'accept') {
          const customer = useSession.getState().accounts.find((a) => a.id === quote.customerId);
          const project = quote.projectId
            ? get().projects.find((p) => p.id === quote.projectId)
            : customer
              ? get().ensureCustomerProject(customer, { weddingDate: quote.eventDate, city: quote.city })
              : undefined;
          const total = quoteTotals(quote).total;
          if (project && quote.fromKind === 'vendor') {
            const category = findCategory(quote.category)?.title ?? 'Vendor';
            const vendorAccountId = quote.fromId.startsWith('acc_') ? quote.fromId : undefined;
            const milestones: PaymentMilestone[] = [
              { id: uid('pm'), title: `${quote.fromName} — advance (30%)`, payee: quote.fromName, amount: Math.round(total * 0.3), due: day(7), status: 'due' },
              { id: uid('pm'), title: `${quote.fromName} — pre-event (50%)`, payee: quote.fromName, amount: Math.round(total * 0.5), due: quote.eventDate, status: 'upcoming' },
              { id: uid('pm'), title: `${quote.fromName} — balance (20%)`, payee: quote.fromName, amount: total - Math.round(total * 0.3) - Math.round(total * 0.5), due: quote.eventDate, status: 'upcoming' },
            ];
            get().updateProject(project.id, (p) => {
              const existing = p.vendors.find((v) => v.quoteId === quote.id || (quote.listingId && v.listingId === quote.listingId));
              const vendors = existing
                ? p.vendors.map((v) => (v === existing ? { ...v, status: 'booked' as const, amount: total, quoteId: quote.id, vendorAccountId } : v))
                : [...p.vendors, { id: uid('pv'), listingId: quote.listingId, vendorAccountId, name: quote.fromName, category, amount: total, status: 'booked' as const, quoteId: quote.id }];
              return { ...p, vendors, payments: [...p.payments, ...milestones], stage: p.stage === 'planning' ? 'booked' : p.stage };
            });
          }
          set((s) => ({
            quotes: s.quotes.map((q) => (q.id === id ? { ...q, status, projectId: project?.id ?? q.projectId, updatedAt: now() } : q)),
            leads: s.leads.map((l) => (l.id === quote.leadId ? { ...l, status: 'won' } : l)),
          }));
          get().notify(vendorTo, `🎉 ${quote.customerName} accepted ${quote.number}`, 'The booking has been added to your projects.', project && quote.fromKind === 'vendor' ? `/business/project/${project.id}` : undefined);
          get().notify('platform', 'Booking confirmed', `${quote.customerName} booked ${quote.fromName}`);
          return;
        }

        set((s) => ({
          quotes: s.quotes.map((q) => (q.id === id ? { ...q, status, revisionNote: note, updatedAt: now() } : q)),
          leads: s.leads.map((l) => (l.id === quote.leadId ? { ...l, status: action === 'decline' ? 'lost' : l.status } : l)),
        }));
        get().notify(
          vendorTo,
          action === 'decline' ? `${quote.customerName} declined ${quote.number}` : `Revision requested on ${quote.number}`,
          note || 'Open the quotation to respond.',
          quote.fromKind === 'platform' ? `/platform/quote/${id}` : `/business/quote/${id}`,
        );
      },

      // ── Projects ──────────────────────────────────────────────────────
      ensureCustomerProject: (customer, details = {}) => {
        const existing = get().projects.find((p) => p.customerId === customer.id);
        if (existing) {
          if (details.managedBy === 'platform' && existing.managedBy !== 'platform') {
            get().updateProject(existing.id, (p) => ({ ...p, managedBy: 'platform', plannerName: 'Kavya Menon', geniePackageId: details.geniePackageId }));
          }
          return get().projects.find((p) => p.id === existing.id)!;
        }
        const weddingDate = details.weddingDate ?? day(120);
        const code = `WED-${1060 + get().projects.length}`;
        const project: Project = {
          id: uid('prj'),
          code,
          title: `${customer.name.split(' ')[0]}'s Wedding`,
          customerId: customer.id,
          customerName: customer.name,
          customerPhone: customer.phone,
          city: details.city ?? customer.city,
          weddingDate,
          guests: 250,
          budget: 2500000,
          managedBy: details.managedBy ?? 'self',
          plannerName: details.managedBy === 'platform' ? 'Kavya Menon' : undefined,
          geniePackageId: details.geniePackageId,
          stage: 'planning',
          vendors: [],
          events: EVENT_TEMPLATES.map((name, i) => ({
            id: uid('ev'),
            name,
            date: (() => {
              const d = fromISODate(weddingDate);
              d.setDate(d.getDate() + i - 2);
              return toISODate(d);
            })(),
            startTime: name === 'Mehendi' ? '11:00' : name === 'Wedding' ? '15:00' : '19:00',
            venue: 'To be decided',
            guests: 250,
            status: 'planned',
            runSheet: [],
          })),
          tasks: [
            { id: uid('tk'), title: 'Shortlist venues', assignee: customer.name, assigneeRole: 'customer', due: day(14), status: 'todo', priority: 'high' },
            { id: uid('tk'), title: 'Set total wedding budget', assignee: customer.name, assigneeRole: 'customer', due: day(7), status: 'todo', priority: 'medium' },
          ],
          payments: [],
          incidents: [],
          createdAt: now(),
        };
        set((s) => ({ projects: [project, ...s.projects] }));
        get().notify('platform', `New wedding project ${code}`, `${customer.name} · ${project.city}`, `/platform/project/${project.id}`);
        return project;
      },

      updateProject: (id, update) => set((s) => ({ projects: s.projects.map((p) => (p.id === id ? update(p) : p)) })),

      addTask: (projectId, task) =>
        get().updateProject(projectId, (p) => ({ ...p, tasks: [{ ...task, id: uid('tk') }, ...p.tasks] })),

      setTaskStatus: (projectId, taskId, status) =>
        get().updateProject(projectId, (p) => ({ ...p, tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)) })),

      setRunStatus: (projectId, eventId, itemId, status) =>
        get().updateProject(projectId, (p) => ({
          ...p,
          events: p.events.map((e) =>
            e.id === eventId
              ? {
                  ...e,
                  status: e.status === 'planned' && status !== 'pending' ? 'live' : e.status,
                  runSheet: e.runSheet.map((r) => (r.id === itemId ? { ...r, status } : r)),
                }
              : e,
          ),
        })),

      setEventStatus: (projectId, eventId, status) => {
        get().updateProject(projectId, (p) => {
          const events = p.events.map((e) => (e.id === eventId ? { ...e, status } : e));
          const allDone = events.every((e) => e.status === 'done');
          const anyLive = events.some((e) => e.status === 'live');
          return { ...p, events, stage: allDone ? 'completed' : anyLive ? 'execution' : p.stage };
        });
        if (status === 'live') {
          const project = get().projects.find((p) => p.id === projectId);
          const event = project?.events.find((e) => e.id === eventId);
          if (project && event) get().notify(project.customerId, `${event.name} is live 🎊`, 'Follow the run sheet in My Wedding.', '/my-wedding');
        }
      },

      reportIncident: (projectId, incident) => {
        get().updateProject(projectId, (p) => ({
          ...p,
          incidents: [{ ...incident, id: uid('inc'), at: now(), status: 'open' }, ...p.incidents],
        }));
        const project = get().projects.find((p) => p.id === projectId);
        get().notify('platform', `Incident at ${project?.code ?? 'a wedding'}`, incident.title, `/platform/project/${projectId}`);
      },

      resolveIncident: (projectId, incidentId) =>
        get().updateProject(projectId, (p) => ({
          ...p,
          incidents: p.incidents.map((i) => (i.id === incidentId ? { ...i, status: 'resolved' } : i)),
        })),

      payMilestone: (projectId, milestoneId) => {
        const project = get().projects.find((p) => p.id === projectId);
        const milestone = project?.payments.find((m) => m.id === milestoneId);
        get().updateProject(projectId, (p) => ({
          ...p,
          payments: p.payments.map((m) => (m.id === milestoneId ? { ...m, status: 'paid', paidAt: now() } : m)),
        }));
        const vendor = project?.vendors.find((v) => v.name === milestone?.payee);
        if (vendor?.vendorAccountId && milestone) {
          get().notify(vendor.vendorAccountId, 'Payment received', `${project!.customerName} paid ₹${milestone.amount.toLocaleString('en-IN')} · ${milestone.title}`);
        }
      },

      // ── Gigs ──────────────────────────────────────────────────────────
      postGig: (input) => {
        const gig: Gig = { ...input, id: uid('gig'), status: 'open', applications: [], createdAt: now() };
        set((s) => ({ gigs: [gig, ...s.gigs] }));
        useSession
          .getState()
          .accounts.filter((a) => a.role === 'freelancer' && (a.skills ?? []).includes(gig.skill))
          .forEach((f) => get().notify(f.id, `New ${gig.skill} gig in ${gig.city}`, gig.title, `/freelancer/gig/${gig.id}`));
        return gig;
      },

      applyToGig: (gigId, application) => {
        set((s) => ({
          gigs: s.gigs.map((g) =>
            g.id === gigId
              ? { ...g, applications: [...g.applications, { ...application, id: uid('app'), appliedAt: now(), status: 'applied' }] }
              : g,
          ),
        }));
        const gig = get().gigs.find((g) => g.id === gigId);
        if (gig) {
          const to = gig.postedByKind === 'platform' ? 'platform' : gig.postedById;
          get().notify(to, `New applicant: ${application.freelancerName}`, gig.title, gig.postedByKind === 'platform' ? `/platform/gigs` : `/business/gig/${gig.id}`);
        }
      },

      setApplicationStatus: (gigId, applicationId, status) => {
        set((s) => ({
          gigs: s.gigs.map((g) => {
            if (g.id !== gigId) return g;
            const applications = g.applications.map((a) => (a.id === applicationId ? { ...a, status } : a));
            const hired = applications.filter((a) => a.status === 'hired' || a.status === 'completed').length;
            return { ...g, applications, status: g.status === 'open' && hired >= g.slots ? 'filled' : g.status };
          }),
        }));
        const gig = get().gigs.find((g) => g.id === gigId);
        const app = gig?.applications.find((a) => a.id === applicationId);
        if (gig && app && (status === 'hired' || status === 'rejected' || status === 'shortlisted')) {
          const title = status === 'hired' ? 'You’re hired! 🎉' : status === 'shortlisted' ? 'You’ve been shortlisted' : 'Application update';
          get().notify(app.freelancerId, title, gig.title, `/freelancer/job/${gig.id}`);
        }
      },

      checkIn: (gigId, applicationId) =>
        set((s) => ({
          gigs: s.gigs.map((g) =>
            g.id === gigId ? { ...g, applications: g.applications.map((a) => (a.id === applicationId ? { ...a, checkInAt: now() } : a)) } : g,
          ),
        })),

      checkOut: (gigId, applicationId) => {
        const gig = get().gigs.find((g) => g.id === gigId);
        const app = gig?.applications.find((a) => a.id === applicationId);
        if (!gig || !app) return;
        set((s) => ({
          gigs: s.gigs.map((g) => {
            if (g.id !== gigId) return g;
            const applications = g.applications.map((a) => (a.id === applicationId ? { ...a, checkOutAt: now(), status: 'completed' as const } : a));
            const allDone = applications.filter((a) => a.status === 'hired').length === 0;
            return { ...g, applications, status: allDone ? 'completed' : g.status };
          }),
          payouts: [
            { id: uid('po'), freelancerId: app.freelancerId, gigId, title: gig.title, amount: app.expectedPay || gig.pay, status: 'pending', date: day(0) },
            ...s.payouts,
          ],
        }));
        const to = gig.postedByKind === 'platform' ? 'platform' : gig.postedById;
        get().notify(to, `${app.freelancerName} checked out`, `${gig.title} — payout pending approval.`);
      },

      cancelGig: (gigId) => set((s) => ({ gigs: s.gigs.map((g) => (g.id === gigId ? { ...g, status: 'cancelled' } : g)) })),

      // ── Platform governance ───────────────────────────────────────────
      submitForApproval: (account) => {
        const approval: Approval = {
          id: uid('apv'),
          kind: account.role === 'vendor' ? 'vendor' : 'freelancer',
          subjectId: account.id,
          title: account.businessName ?? account.name,
          subtitle:
            account.role === 'vendor'
              ? `${findCategory(account.categoryId ?? '')?.title ?? 'Vendor'} · ${account.city}`
              : `${(account.skills ?? []).join(', ')} · ${account.city}`,
          details: [
            `Phone: ${account.phone}`,
            account.role === 'vendor' ? `Owner: ${account.name}` : `Day rate: ₹${(account.dayRate ?? 0).toLocaleString('en-IN')}`,
            account.listingId ? 'Claimed an existing marketplace listing' : 'New listing',
          ],
          status: 'pending',
          submittedAt: now(),
        };
        set((s) => ({ approvals: [approval, ...s.approvals] }));
        get().notify('platform', 'New verification request', `${approval.title} · ${approval.subtitle}`, '/platform/approvals');
      },

      decideApproval: (id, approve) => {
        const approval = get().approvals.find((a) => a.id === id);
        set((s) => ({ approvals: s.approvals.map((a) => (a.id === id ? { ...a, status: approve ? 'approved' : 'rejected' } : a)) }));
        if (!approval || approval.kind === 'review') return;
        useSession.getState().updateAccount(approval.subjectId, { verified: approve });
        get().notify(
          approval.subjectId,
          approve ? 'Your profile is verified ✅' : 'Verification needs attention',
          approve ? 'You now have the Verified badge on the marketplace.' : 'Please re-upload your documents and resubmit.',
        );
      },

      releasePayout: (id) => {
        const payout = get().payouts.find((p) => p.id === id);
        set((s) => ({ payouts: s.payouts.map((p) => (p.id === id ? { ...p, status: 'paid', date: day(0) } : p)) }));
        if (payout) get().notify(payout.freelancerId, 'Payout released 💸', `₹${payout.amount.toLocaleString('en-IN')} for ${payout.title}`, '/freelancer/earnings');
      },

      seedVendorWorkspace: (account) => {
        if (!account.listingId || get().leads.some((l) => l.listingId === account.listingId)) return;
        const listingName = account.businessName ?? account.name;
        const sample = (name: string, phone: string, offset: number, fns: string[], guests: number, status: LeadStatus): Lead => ({
          id: uid('ld'),
          listingKind: account.listingKind ?? 'vendor',
          listingId: account.listingId!,
          listingName,
          customerId: `acc_customer_${name.split(' ')[0].toLowerCase()}`,
          customerName: name,
          customerPhone: phone,
          city: account.city,
          eventDate: day(offset),
          guests,
          functions: fns,
          message: 'Hi! Please share availability and your best package.',
          status,
          createdAt: now(),
        });
        set((s) => ({
          leads: [
            sample('Tanvi Joshi', '9000000031', 80, ['Wedding', 'Reception'], 300, 'new'),
            sample('Aditi Rao', '9000000032', 45, ['Sangeet'], 150, 'new'),
            sample('Pooja Verma', '9000000033', 110, ['Mehendi', 'Wedding'], 220, 'contacted'),
            ...s.leads,
          ],
        }));
        get().notify(account.id, 'Welcome to Vivah for Business', 'You have 3 new leads waiting for a quotation.', '/business/leads');
      },

      resetDemo: () => set(seedData()),
    }),
    {
      name: 'vivah-db',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ projects, quotes, leads, gigs, payouts, approvals, notifications }) => ({
        projects,
        quotes,
        leads,
        gigs,
        payouts,
        approvals,
        notifications,
      }),
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
