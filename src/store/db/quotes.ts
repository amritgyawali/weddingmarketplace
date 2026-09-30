/**
 * Versioned quotations. A sent version is frozen into `versions`; any later
 * change creates the next version, so the customer can always compare V1/V2/V3.
 */
import { findProvider } from '@/data/providers';
import { findService, serviceName } from '@/data/services';
import { findVendor } from '@/data/vendors';
import { buildMilestones, splitBooking } from '@/services/pricing';
import { DEFAULT_TERMS, lineTotal, nextQuoteNumber, quoteTotals, snapshot, TAX_RATE } from '@/services/quotes';
import { useSession } from '@/store/useSession';
import type { PricingModel, Project, Quotation, QuoteItem, ServiceBooking } from '@/types/platform';
import { addDays, formatMoney, uid } from '@/utils/format';

import { bookingDates, currentActor, firstDate, type GetDb, lastDate, mapProject, now, type SetDb, today } from './helpers';
import { staffDenied } from './personas';

export interface QuoteActions {
  saveQuote: (quote: Quotation) => void;
  /** Platform quotes need `quote.send` (coordinators: their own projects). Returns an error to show, or null. */
  sendQuote: (id: string, changeSummary?: string) => string | null;
  reviseQuote: (id: string) => void;
  markQuoteViewed: (id: string) => void;
  respondToQuote: (id: string, action: 'accept' | 'decline' | 'revision', note?: string) => void;
  draftProjectQuote: (projectId: string) => Quotation | null;
}

/** Customer-facing line for a booking: price per unit in the service's own unit. */
function lineForBooking(b: ServiceBooking, project: Project): QuoteItem {
  const def = findService(b.serviceId);
  const dates = bookingDates(project, b);
  const events = project.events.filter((e) => b.eventIds.includes(e.id));
  const perPlate = def?.unit === 'per plate' || def?.unit === 'per person';
  const qty = perPlate ? events.reduce((s, e) => s + e.guests, 0) || project.guests : 1;
  return {
    id: uid('qi'),
    title: `${serviceName(b.serviceId)} — ${b.providerName}`,
    description: `${events.map((e) => e.name).join(', ')}${dates.length ? '' : ' (dates TBC)'}${b.packageName ? ` · ${b.packageName} package` : ''}`,
    qty,
    rate: Math.round(b.agreedPrice / qty),
    unit: perPlate ? 'plate' : undefined,
    serviceId: b.serviceId,
    requirementId: b.requirementId,
    providerId: b.providerId,
    providerName: b.providerName,
    cost: Math.round(b.providerCost / qty),
    pricingModel: b.pricingModel,
    modelRate: b.modelRate,
  };
}

/** Economics for a quote line once accepted. */
function splitForLine(item: QuoteItem, settings: { commissionRate: number; markupRate: number; leadFee: number }) {
  const model: PricingModel = item.pricingModel ?? 'COMMISSION';
  const rate = item.modelRate ?? (model === 'MARKUP' ? settings.markupRate : model === 'LEAD_FEE' ? settings.leadFee : settings.commissionRate);
  const price = lineTotal(item);
  if (model === 'MARKUP') {
    const providerCost = Math.round((item.cost ?? item.rate / (1 + rate)) * item.qty);
    return { model, rate, split: { agreedPrice: price, providerCost, platformFee: price - providerCost, providerPayable: providerCost } };
  }
  return { model, rate, split: splitBooking(model, rate, { customerPrice: price }) };
}

export const quoteActions = (set: SetDb, get: GetDb): QuoteActions => ({
  saveQuote: (quote) =>
    set((s) => {
      const exists = s.quotes.some((q) => q.id === quote.id);
      const next = { ...quote, updatedAt: now() };
      return { quotes: exists ? s.quotes.map((q) => (q.id === quote.id ? next : q)) : [next, ...s.quotes] };
    }),

  sendQuote: (id, changeSummary) => {
    const quote = get().quotes.find((q) => q.id === id);
    if (!quote) return 'This quotation no longer exists';
    if (quote.fromKind === 'platform') {
      const denied = staffDenied('quote.send', get, get().projects.find((p) => p.id === quote.projectId));
      if (denied) return denied;
    }
    const version = snapshot(quote, changeSummary);
    set((s) => ({
      quotes: s.quotes.map((q) => (q.id === id ? { ...q, status: 'sent', revisionNote: undefined, versions: [...q.versions.filter((v) => v.version !== q.version), version], updatedAt: now() } : q)),
      leads: s.leads.map((l) => (l.id === quote.leadId ? { ...l, status: 'quoted' } : l)),
      projects: quote.projectId
        ? mapProject(s.projects, quote.projectId, (p) => ({
            ...p,
            status: 'QUOTE_SENT',
            statusHistory: p.status === 'QUOTE_SENT' ? p.statusHistory : [...p.statusHistory, { status: 'QUOTE_SENT', at: now(), by: currentActor().name, note: `v${quote.version}` }],
            requirements: p.requirements.map((r) => (quote.items.some((i) => i.requirementId === r.id) && r.status !== 'CONFIRMED' ? { ...r, status: 'QUOTED' } : r)),
          }))
        : s.projects,
    }));
    const total = quoteTotals(quote).total;
    get().notify(quote.customerId, quote.version > 1 ? `Updated quotation (v${quote.version})` : `Quotation from ${quote.fromName}`, `${quote.number} · ${formatMoney(total)}`, `/quote/${id}`, 'quote');
    const thread = get().threads.find((t) => t.projectId && t.projectId === quote.projectId && t.kind === 'project');
    const actor = currentActor();
    if (thread) get().sendMessage(thread.id, { id: actor.id, name: actor.name, role: quote.fromKind === 'platform' ? 'platform' : 'vendor' }, `${quote.number} (v${quote.version})`, 'quote', { quoteId: id }, { silent: true });
    get().log(actor, 'quote.send', 'quote', id, `v${quote.version} · ${formatMoney(total)}`);
    return null;
  },

  reviseQuote: (id) =>
    set((s) => ({
      quotes: s.quotes.map((q) => (q.id === id && q.status !== 'draft' ? { ...q, version: q.versions.length + 1, status: 'draft', validUntil: addDays(today(), 10), updatedAt: now() } : q)),
    })),

  markQuoteViewed: (id) => {
    const quote = get().quotes.find((q) => q.id === id);
    if (!quote || quote.status !== 'sent') return;
    set((s) => ({ quotes: s.quotes.map((q) => (q.id === id ? { ...q, status: 'viewed' } : q)) }));
    const project = get().projects.find((p) => p.id === quote.projectId);
    const to = quote.fromKind === 'platform' ? (project?.coordinatorId ?? 'platform') : quote.fromId;
    get().notify(to, `${quote.customerName} viewed ${quote.number}`, `Version ${quote.version} was opened.`, quote.fromKind === 'platform' ? `/platform/quote/${id}` : `/business/quote/${id}`, 'quote');
  },

  respondToQuote: (id, action, note) => {
    const quote = get().quotes.find((q) => q.id === id);
    if (!quote) return;
    const status = action === 'accept' ? 'accepted' : action === 'decline' ? 'declined' : 'revision';
    const vendorTo = quote.fromKind === 'platform' ? (get().projects.find((p) => p.id === quote.projectId)?.coordinatorId ?? 'platform') : quote.fromId;
    const response = { action, note, at: now() };
    set((s) => ({
      quotes: s.quotes.map((q) =>
        q.id === id
          ? {
              ...q,
              status,
              revisionNote: action === 'revision' ? note : q.revisionNote,
              acceptedVersion: action === 'accept' ? q.version : q.acceptedVersion,
              versions: q.versions.map((v) => (v.version === q.version ? { ...v, response } : v)),
              updatedAt: now(),
            }
          : q,
      ),
    }));

    if (action !== 'accept') {
      set((s) => ({
        leads: s.leads.map((l) => (l.id === quote.leadId ? { ...l, status: action === 'decline' ? 'lost' : 'negotiating' } : l)),
        projects: quote.projectId
          ? mapProject(s.projects, quote.projectId, (p) => {
              const next = action === 'decline' ? 'QUOTE_REJECTED' : 'CUSTOMER_NEGOTIATING';
              return { ...p, status: next, statusHistory: [...p.statusHistory, { status: next, at: now(), by: quote.customerName, note }] };
            })
          : s.projects,
      }));
      get().notify(
        vendorTo,
        action === 'decline' ? `${quote.customerName} declined ${quote.number}` : `Changes requested on ${quote.number}`,
        note || 'Open the quotation to respond.',
        quote.fromKind === 'platform' ? `/platform/quote/${id}` : `/business/quote/${id}`,
        'quote',
      );
      return;
    }

    // Accepted
    const settings = get().settings;
    const total = quoteTotals(quote).total;
    const customer = useSession.getState().accounts.find((a) => a.id === quote.customerId);
    let project = quote.projectId ? get().projects.find((p) => p.id === quote.projectId) : undefined;
    if (!project && customer) project = get().ensureCustomerProject(customer, { weddingDate: quote.eventDate, city: quote.city });
    if (!project) return;
    const projectId = project.id;

    if (quote.fromKind === 'vendor') {
      // Direct marketplace booking with a vendor (platform takes commission).
      const vendor = findVendor(quote.listingId ?? '');
      const serviceId = quote.category === 'venues' ? 'venue' : (vendor?.subcategoryId ?? quote.items[0]?.serviceId ?? 'planner');
      let req = project.requirements.find((r) => r.serviceId === serviceId && r.status !== 'CANCELLED');
      if (!req) {
        get().addRequirement(projectId, serviceId, project.events.map((e) => e.id));
        req = get().projects.find((p) => p.id === projectId)!.requirements.find((r) => r.serviceId === serviceId)!;
      }
      const price = quoteTotals({ ...quote, taxRate: 0 }).total;
      const split = splitBooking('COMMISSION', settings.commissionRate, { customerPrice: price });
      const provider = findProvider(quote.listingId ?? '');
      const booking: ServiceBooking = {
        id: uid('bk'),
        requirementId: req.id,
        serviceId,
        providerId: quote.listingId ?? quote.fromId,
        providerName: quote.fromName,
        providerAccountId: quote.fromId.startsWith('acc_') ? quote.fromId : undefined,
        eventIds: req.eventIds,
        ...split,
        pricingModel: 'COMMISSION',
        modelRate: settings.commissionRate,
        status: 'PROPOSED',
        providerResponse: 'accepted',
        crew: [],
        assignments: [],
        deliverables: [],
        quoteId: id,
        createdAt: now(),
      };
      void provider;
      set((s) => ({
        projects: mapProject(s.projects, projectId, (p) => ({
          ...p,
          bookings: [...p.bookings, booking],
          milestones: [...p.milestones, ...buildMilestones(quote.schedule, total, { confirmed: today(), event: quote.eventDate, lastEvent: quote.eventDate }, id).map((m) => ({ ...m, label: `${quote.fromName} — ${m.label.toLowerCase()}` }))],
          status: p.status === 'NEW' || p.status === 'REVIEWING' || p.status === 'QUOTE_SENT' ? 'CONFIRMED' : p.status,
          statusHistory: p.status === 'CONFIRMED' ? p.statusHistory : [...p.statusHistory, { status: 'CONFIRMED', at: now(), by: quote.customerName }],
        })),
        leads: s.leads.map((l) => (l.id === quote.leadId ? { ...l, status: 'won' } : l)),
        quotes: s.quotes.map((q) => (q.id === id ? { ...q, projectId } : q)),
      }));
      get().confirmBooking(projectId, booking.id);
      get().notify(vendorTo, `${quote.customerName} accepted ${quote.number}`, 'The booking is now in your projects.', `/business/booking/${booking.id}`, 'booking');
      get().notify('platform', 'Direct booking confirmed', `${quote.customerName} booked ${quote.fromName} · ${formatMoney(total)}`, undefined, 'booking');
      get().log({ id: quote.customerId, name: quote.customerName }, 'quote.accept', 'quote', id, `v${quote.version}`);
      return;
    }

    // Platform package: every priced line becomes (or updates) a confirmed booking.
    const bookingIds: string[] = [];
    set((s) => ({
      projects: mapProject(s.projects, projectId, (p) => {
        let bookings = [...p.bookings];
        for (const item of quote.items) {
          if (!item.providerId || !item.serviceId) continue;
          const { model, rate, split } = splitForLine(item, settings);
          const existing = bookings.find((b) => b.providerId === item.providerId && b.serviceId === item.serviceId && b.status !== 'CANCELLED');
          if (existing) {
            bookings = bookings.map((b) => (b === existing ? { ...b, ...split, pricingModel: model, modelRate: rate, quoteId: id } : b));
            bookingIds.push(existing.id);
          } else {
            const provider = findProvider(item.providerId);
            const req = p.requirements.find((r) => r.id === item.requirementId) ?? p.requirements.find((r) => r.serviceId === item.serviceId);
            const booking: ServiceBooking = {
              id: uid('bk'),
              requirementId: req?.id,
              serviceId: item.serviceId,
              providerId: item.providerId,
              providerName: item.providerName ?? provider?.name ?? 'Provider',
              providerAccountId: useSession.getState().accounts.find((a) => a.role === 'vendor' && a.listingId === item.providerId)?.id,
              eventIds: req?.eventIds ?? p.events.map((e) => e.id),
              ...split,
              pricingModel: model,
              modelRate: rate,
              status: 'PROPOSED',
              providerResponse: 'accepted',
              crew: [],
              assignments: [],
              deliverables: [],
              quoteId: id,
              createdAt: now(),
            };
            bookings = [...bookings, booking];
            bookingIds.push(booking.id);
          }
        }
        const milestones = [
          ...p.milestones.filter((m) => m.quoteId !== id),
          ...buildMilestones(quote.schedule, total, { confirmed: today(), event: firstDate(p), lastEvent: lastDate(p) }, id),
        ];
        return {
          ...p,
          bookings,
          milestones,
          status: 'CONFIRMED',
          statusHistory: [...p.statusHistory, { status: 'CONFIRMED', at: now(), by: quote.customerName, note: `Accepted ${quote.number} v${quote.version}` }],
        };
      }),
      revenue: [
        ...(quote.serviceFee || quote.discount ? [{ id: uid('rev'), kind: 'SERVICE_FEE' as const, amount: quote.serviceFee - quote.discount, projectId, note: `Service fee ${formatMoney(quote.serviceFee)} − package discount ${formatMoney(quote.discount)}`, at: now() }] : []),
        ...s.revenue,
      ],
    }));
    // Bookings whose provider already confirmed availability become confirmed now.
    const latest = get().projects.find((p) => p.id === projectId)!;
    for (const bid of bookingIds) {
      const b = latest.bookings.find((x) => x.id === bid);
      if (b && b.providerResponse !== 'pending') get().confirmBooking(projectId, bid);
    }
    get().notify(project.customerId, 'Your wedding is confirmed', `Payment schedule is ready — first instalment ${formatMoney(Math.round((total * (quote.schedule[0]?.percent ?? 30)) / 100))}.`, '/my-wedding?tab=payments', 'booking');
    get().notify(vendorTo, `${quote.customerName} accepted ${quote.number}`, `v${quote.version} · ${formatMoney(total)}`, `/platform/project/${projectId}`, 'quote');
    get().log({ id: quote.customerId, name: quote.customerName }, 'quote.accept', 'quote', id, `v${quote.version} · ${formatMoney(total)}`);
  },

  draftProjectQuote: (projectId) => {
    const project = get().projects.find((p) => p.id === projectId);
    if (!project) return null;
    const existing = get().quotes.find((q) => q.projectId === projectId && q.fromKind === 'platform' && q.status !== 'declined' && q.status !== 'superseded');
    if (existing) return existing;
    const lines = project.bookings.filter((b) => b.status !== 'CANCELLED').map((b) => lineForBooking(b, project));
    const settings = get().settings;
    const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
    const quote: Quotation = {
      id: uid('qt'),
      number: nextQuoteNumber(get().quotes.map((q) => q.number)),
      fromKind: 'platform',
      fromId: 'platform',
      fromName: 'Vivah Weddings',
      category: 'platform',
      projectId,
      customerId: project.customerId,
      customerName: project.customerName,
      eventDate: firstDate(project),
      city: project.city,
      title: lines.length > 3 ? 'Complete wedding package' : `${lines.map((l) => serviceName(l.serviceId ?? '')).join(' + ') || 'Wedding'} quotation`,
      version: 1,
      items: lines,
      discount: lines.length >= 5 ? Math.round((subtotal * 0.025) / 1000) * 1000 : 0,
      serviceFee: Math.max(10_000, Math.round((subtotal * settings.serviceFeeRate) / 1000) * 1000),
      taxRate: TAX_RATE,
      notes: `Your ${project.eventType === 'WEDDING' ? 'wedding' : 'event'} package, coordinated end-to-end by ${project.coordinatorName ?? 'your Vivah coordinator'}. One quotation, one payment schedule — we manage every provider for you.`,
      terms: DEFAULT_TERMS,
      validUntil: addDays(today(), 10),
      schedule: [
        { label: 'Booking confirmation', percent: 30, rule: 'on_confirmation' },
        { label: '15 days before event', percent: 50, rule: 'days_before_event', days: 15 },
        { label: 'After completion', percent: 20, rule: 'after_completion', days: 3 },
      ],
      status: 'draft',
      versions: [],
      createdAt: now(),
      updatedAt: now(),
    };
    set((s) => ({
      quotes: [quote, ...s.quotes],
      projects: mapProject(s.projects, projectId, (p) =>
        p.status === 'QUOTE_PREPARED' || p.status === 'QUOTE_SENT' ? p : { ...p, status: 'QUOTE_PREPARED', statusHistory: [...p.statusHistory, { status: 'QUOTE_PREPARED', at: now(), by: currentActor().name }] },
      ),
    }));
    return quote;
  },
});

/** Add a booking's line to a draft quote (quote builder "add from bookings"). */
export const quoteLineForBooking = lineForBooking;
export { findService };
