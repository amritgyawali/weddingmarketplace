import { buildSeedData } from '@/data/seed';
import { DEFAULT_TERMS, nextQuoteNumber, quoteTotals, TAX_RATE } from '@/services/quotes';
import { DEFAULT_SCHEDULE } from '@/services/pricing';
import { findVendor } from '@/data/vendors';
import { findVenue } from '@/data/venues';
import type { Account, AppNotification, Lead, LeadStatus, PlatformSettings, Quotation } from '@/types/platform';
import { addDays, uid } from '@/utils/format';

import { accountById, type Actor, currentActor, type GetDb, now, ownersOf, type SetDb, today } from './helpers';
import { staffDenied } from './personas';

export interface CoreActions {
  notify: (to: string, title: string, body: string, href?: string, kind?: AppNotification['kind']) => void;
  markNotificationsRead: (account: Account) => void;
  markNotificationRead: (id: string) => void;
  log: (actor: Actor, action: string, entity: string, entityId: string, detail?: string) => void;
  /** Staff need `settings.edit`; vendors buying a promotion pass. Returns an error to show, or null. */
  updateSettings: (patch: Partial<PlatformSettings>) => string | null;
  /** Admins only (`demo.reset`). Returns an error to show, or null. */
  resetDemo: () => string | null;

  createLead: (input: Omit<Lead, 'id' | 'createdAt' | 'status'>) => Lead;
  setLeadStatus: (id: string, status: LeadStatus) => void;
  updateLead: (id: string, patch: Partial<Lead>) => void;
  addLeadNote: (id: string, text: string, by: string) => void;
  seedVendorWorkspace: (account: Account) => void;
}

/** Auto-quote for unclaimed listings so couples always get a response. */
function autoQuoteFor(lead: Lead, existingNumbers: string[]): Quotation {
  const venue = lead.listingKind === 'venue' ? findVenue(lead.listingId) : undefined;
  const vendor = lead.listingKind === 'vendor' ? findVendor(lead.listingId) : undefined;
  const guests = lead.guests ?? 250;
  const fnCount = Math.max(1, lead.functions.length);
  const items = venue
    ? [
        { id: uid('qi'), title: `Venue rental (${fnCount} function${fnCount > 1 ? 's' : ''})`, qty: fnCount, rate: venue.rentalCost, serviceId: 'venue' },
        { id: uid('qi'), title: 'Veg + non-veg buffet (per plate)', qty: guests, rate: venue.nonVegPerPlate, serviceId: 'catering' },
      ]
    : (vendor?.packages.slice(0, 2).map((p) => ({ id: uid('qi'), title: `${p.name} package (${p.unit})`, description: p.includes.join(', '), qty: 1, rate: p.price, serviceId: vendor.subcategoryId })) ?? []);
  const base = { discount: 0, serviceFee: 0, taxRate: TAX_RATE, notes: 'Thank you for your enquiry! This is our standard package — reply to customise it.', terms: DEFAULT_TERMS, validUntil: addDays(today(), 15), schedule: DEFAULT_SCHEDULE };
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
    version: 1,
    items,
    ...base,
    status: 'sent',
    versions: [{ version: 1, items, ...base, total: quoteTotals({ items, ...base }).total, sentAt: now() }],
    createdAt: now(),
    updatedAt: now(),
  };
}

export const coreActions = (set: SetDb, get: GetDb): CoreActions => ({
  notify: (to, title, body, href, kind) => {
    // Muted kinds are still recorded but arrive already read (no badge). Emergencies always ring.
    const muted = !!kind && kind !== 'emergency' && !!accountById(to)?.prefs?.muted.includes(kind);
    set((s) => ({ notifications: [{ id: uid('n'), to, title, body, href, kind, at: now(), read: muted }, ...s.notifications].slice(0, 300) }));
  },

  markNotificationsRead: (account) =>
    set((s) => ({ notifications: s.notifications.map((n) => (n.to === account.id || n.to === account.role ? { ...n, read: true } : n)) })),

  markNotificationRead: (id) => set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),

  log: (actor, action, entity, entityId, detail) =>
    set((s) => ({ audit: [{ id: uid('au'), at: now(), actorId: actor.id, actorName: actor.name, action, entity, entityId, detail }, ...s.audit].slice(0, 500) })),

  updateSettings: (patch) => {
    const denied = staffDenied('settings.edit', get);
    if (denied) return denied;
    set((s) => ({ settings: { ...s.settings, ...patch } }));
    get().log(currentActor(), 'settings.update', 'settings', 'platform', Object.keys(patch).join(', '));
    return null;
  },

  resetDemo: () => {
    set(buildSeedData());
    return null;
  },

  // Provider CRM leads
  createLead: (input) => {
    const lead: Lead = { ...input, id: uid('ld'), status: 'new', priority: input.priority ?? 'medium', history: [{ status: 'new', at: now() }], createdAt: now() };
    set((s) => ({ leads: [lead, ...s.leads] }));
    const owners = ownersOf(lead.listingId);
    owners.forEach((o) => get().notify(o.id, `New lead: ${lead.customerName}`, `${lead.functions.join(', ')} · ${lead.guests ?? '—'} guests`, `/business/lead/${lead.id}`, 'lead'));
    get().notify('platform', 'New enquiry on the marketplace', `${lead.customerName} → ${lead.listingName}`, undefined, 'lead');
    if (!owners.length) {
      // Unclaimed listing: respond with the catalogue package after a short delay.
      setTimeout(() => {
        const quote = autoQuoteFor(lead, get().quotes.map((q) => q.number));
        set((s) => ({ quotes: [quote, ...s.quotes], leads: s.leads.map((l) => (l.id === lead.id ? { ...l, status: 'quoted' } : l)) }));
        get().notify(lead.customerId, `Quotation from ${lead.listingName}`, `${quote.number} is ready to review.`, `/quote/${quote.id}`, 'quote');
      }, 4000);
    }
    return lead;
  },

  setLeadStatus: (id, status) =>
    set((s) => ({ leads: s.leads.map((l) => (l.id === id ? { ...l, status, history: [...(l.history ?? []), { status, at: now() }] } : l)) })),

  updateLead: (id, patch) => set((s) => ({ leads: s.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),

  addLeadNote: (id, text, by) =>
    set((s) => ({ leads: s.leads.map((l) => (l.id === id ? { ...l, notes: [{ id: uid('ln'), text, by, at: now() }, ...(l.notes ?? [])] } : l)) })),

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
      eventDate: addDays(today(), offset),
      guests,
      functions: fns,
      message: 'Namaste! Please share availability and your best package.',
      status,
      source: 'marketplace',
      priority: 'medium',
      createdAt: now(),
    });
    set((s) => ({
      leads: [
        sample('Barsha Thapa', '9800000131', 80, ['Wedding', 'Reception'], 300, 'new'),
        sample('Sujata Rai', '9800000132', 45, ['Engagement'], 150, 'new'),
        sample('Priyanka Shah', '9800000133', 110, ['Mehendi', 'Wedding'], 220, 'contacted'),
        ...s.leads,
      ],
    }));
    get().notify(account.id, 'Welcome to Vivah for Business', 'You have 3 new leads waiting for a quotation.', '/business/leads', 'lead');
  },
});
