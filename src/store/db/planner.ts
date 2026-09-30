/** Couple planning tools and business extras: guests, RSVP, seating, budget, website, registry, boards, contracts, shortlist, staff, deals. */
import type {
  BudgetLine,
  Contract,
  Deal,
  Guest,
  GuestInvite,
  InspirationBoard,
  PortfolioItem,
  ProviderPackage,
  RegistryItem,
  SeatingElement,
  SeatingLayout,
  ShortlistEntry,
  StaffMember,
  WeddingWebsite,
} from '@/types/platform';
import { shortCode, uid } from '@/utils/format';

import { currentActor, type GetDb, now, type SetDb } from './helpers';

export interface PlannerActions {
  addGuest: (guest: Omit<Guest, 'id' | 'code' | 'invites'> & { eventIds?: string[] }) => Guest;
  updateGuest: (id: string, patch: Partial<Guest>) => void;
  removeGuest: (id: string) => void;
  importGuests: (projectId: string, rows: { name: string; phone?: string; email?: string; side?: Guest['side']; category?: string; plusOnes?: number }[], eventIds: string[]) => number;
  setInvite: (guestId: string, eventId: string, patch: Partial<GuestInvite>) => void;
  toggleInvite: (guestId: string, eventId: string) => void;
  sendInvites: (projectId: string, eventId: string, guestIds: string[]) => void;
  respondRsvp: (code: string, responses: { eventId: string; rsvp: GuestInvite['rsvp']; attending: number; meal?: string }[], answers?: Record<string, string>, dietary?: string[]) => Guest | null;
  checkInGuest: (guestId: string, eventId: string) => void;

  saveSeating: (layout: SeatingLayout) => void;
  addSeatingElement: (projectId: string, eventId: string, el: Omit<SeatingElement, 'id'>) => void;
  moveSeatingElement: (eventId: string, elementId: string, x: number, y: number) => void;
  removeSeatingElement: (eventId: string, elementId: string) => void;
  assignSeat: (guestId: string, eventId: string, tableId: string | null) => void;
  autoSeat: (projectId: string, eventId: string) => number;

  addBudgetLine: (line: Omit<BudgetLine, 'id'>) => void;
  updateBudgetLine: (id: string, patch: Partial<BudgetLine>) => void;
  removeBudgetLine: (id: string) => void;

  saveWebsite: (site: WeddingWebsite) => void;
  recordWebsiteView: (slug: string) => void;

  addRegistryItem: (item: Omit<RegistryItem, 'id' | 'contributions'>) => void;
  updateRegistryItem: (id: string, patch: Partial<RegistryItem>) => void;
  removeRegistryItem: (id: string) => void;
  markContributionThanked: (itemId: string, contributionId: string) => void;

  addBoard: (projectId: string, name: string) => string;
  toggleBoardItem: (boardId: string, itemId: string) => void;
  renameBoard: (boardId: string, name: string) => void;
  deleteBoard: (boardId: string) => void;

  signContract: (contractId: string, party: Contract['signatures'][number]['party'], name: string, path?: string) => void;
  saveContract: (contract: Contract) => void;

  toggleShortlist: (accountId: string, providerId: string) => boolean;
  updateShortlist: (accountId: string, providerId: string, patch: Partial<ShortlistEntry>) => void;

  saveStaff: (member: StaffMember) => void;
  removeStaff: (id: string) => void;
  saveDeal: (deal: Deal) => void;
  redeemDeal: (id: string) => void;
  savePackage: (pkg: ProviderPackage) => void;
  removePackage: (id: string) => void;
  addPortfolioItem: (item: Omit<PortfolioItem, 'id' | 'order'>) => void;
  updatePortfolioItem: (id: string, patch: Partial<PortfolioItem>) => void;
  removePortfolioItem: (id: string) => void;
  movePortfolioItem: (id: string, delta: number) => void;
}

const defaultInvite = (eventId: string): GuestInvite => ({ eventId, rsvp: 'pending', attending: 0 });

export const plannerActions = (set: SetDb, get: GetDb): PlannerActions => ({
  // Guests & RSVP
  addGuest: ({ eventIds = [], ...input }) => {
    const guest: Guest = { ...input, id: uid('gst'), code: shortCode(6), invites: eventIds.map(defaultInvite) };
    set((s) => ({ guests: [...s.guests, guest] }));
    return guest;
  },

  updateGuest: (id, patch) => set((s) => ({ guests: s.guests.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
  removeGuest: (id) => set((s) => ({ guests: s.guests.filter((g) => g.id !== id) })),

  importGuests: (projectId, rows, eventIds) => {
    const existing = new Set(get().guests.filter((g) => g.projectId === projectId).map((g) => `${g.name.toLowerCase()}|${g.phone ?? ''}`));
    const fresh: Guest[] = rows
      .filter((r) => r.name.trim() && !existing.has(`${r.name.trim().toLowerCase()}|${r.phone ?? ''}`))
      .map((r) => ({
        id: uid('gst'),
        projectId,
        name: r.name.trim(),
        phone: r.phone,
        email: r.email,
        side: r.side ?? 'both',
        category: r.category ?? 'Friends',
        vip: false,
        plusOnes: r.plusOnes ?? 0,
        children: 0,
        dietary: [],
        accommodation: false,
        transport: false,
        code: shortCode(6),
        invites: eventIds.map(defaultInvite),
      }));
    set((s) => ({ guests: [...s.guests, ...fresh] }));
    return fresh.length;
  },

  setInvite: (guestId, eventId, patch) =>
    set((s) => ({
      guests: s.guests.map((g) =>
        g.id === guestId ? { ...g, invites: g.invites.some((i) => i.eventId === eventId) ? g.invites.map((i) => (i.eventId === eventId ? { ...i, ...patch } : i)) : [...g.invites, { ...defaultInvite(eventId), ...patch }] } : g,
      ),
    })),

  toggleInvite: (guestId, eventId) =>
    set((s) => ({
      guests: s.guests.map((g) => (g.id === guestId ? { ...g, invites: g.invites.some((i) => i.eventId === eventId) ? g.invites.filter((i) => i.eventId !== eventId) : [...g.invites, defaultInvite(eventId)] } : g)),
    })),

  sendInvites: (projectId, eventId, guestIds) =>
    set((s) => ({
      guests: s.guests.map((g) =>
        g.projectId === projectId && guestIds.includes(g.id) ? { ...g, invites: g.invites.map((i) => (i.eventId === eventId ? { ...i, sentAt: i.sentAt ?? now() } : i)) } : g,
      ),
    })),

  respondRsvp: (code, responses, answers, dietary) => {
    const guest = get().guests.find((g) => g.code === code.trim().toUpperCase());
    if (!guest) return null;
    set((s) => ({
      guests: s.guests.map((g) =>
        g.id === guest.id
          ? {
              ...g,
              answers: { ...(g.answers ?? {}), ...(answers ?? {}) },
              dietary: dietary ?? g.dietary,
              invites: g.invites.map((i) => {
                const r = responses.find((x) => x.eventId === i.eventId);
                return r ? { ...i, rsvp: r.rsvp, attending: r.rsvp === 'no' ? 0 : r.attending, meal: r.meal, respondedAt: now(), openedAt: i.openedAt ?? now() } : i;
              }),
            }
          : g,
      ),
    }));
    const project = get().projects.find((p) => p.id === guest.projectId);
    if (project) get().notify(project.customerId, `RSVP from ${guest.name}`, responses.map((r) => `${project.events.find((e) => e.id === r.eventId)?.name ?? 'Event'}: ${r.rsvp}`).join(' · '), '/guests', 'system');
    return get().guests.find((g) => g.id === guest.id) ?? null;
  },

  checkInGuest: (guestId, eventId) => get().setInvite(guestId, eventId, { checkedInAt: now() }),

  // Seating
  saveSeating: (layout) => set((s) => ({ seating: [...s.seating.filter((l) => l.eventId !== layout.eventId), layout] })),

  addSeatingElement: (projectId, eventId, el) =>
    set((s) => {
      const layout = s.seating.find((l) => l.eventId === eventId) ?? { eventId, projectId, elements: [] };
      return { seating: [...s.seating.filter((l) => l.eventId !== eventId), { ...layout, elements: [...layout.elements, { ...el, id: uid('el') }] }] };
    }),

  moveSeatingElement: (eventId, elementId, x, y) =>
    set((s) => ({ seating: s.seating.map((l) => (l.eventId === eventId ? { ...l, elements: l.elements.map((e) => (e.id === elementId ? { ...e, x: Math.round(x), y: Math.round(y) } : e)) } : l)) })),

  removeSeatingElement: (eventId, elementId) =>
    set((s) => ({
      seating: s.seating.map((l) => (l.eventId === eventId ? { ...l, elements: l.elements.filter((e) => e.id !== elementId) } : l)),
      guests: s.guests.map((g) => ({ ...g, invites: g.invites.map((i) => (i.eventId === eventId && i.tableId === elementId ? { ...i, tableId: undefined } : i)) })),
    })),

  assignSeat: (guestId, eventId, tableId) => get().setInvite(guestId, eventId, { tableId: tableId ?? undefined }),

  /** Seats attending guests by side and group: VIPs to VIP tables, households together. */
  autoSeat: (projectId, eventId) => {
    const layout = get().seating.find((l) => l.eventId === eventId);
    if (!layout) return 0;
    const tables = layout.elements.filter((e) => e.capacity > 0);
    const load = new Map(tables.map((t) => [t.id, 0]));
    const guests = get().guests.filter((g) => g.projectId === projectId);
    guests.forEach((g) => {
      const inv = g.invites.find((i) => i.eventId === eventId);
      if (inv?.tableId) load.set(inv.tableId, (load.get(inv.tableId) ?? 0) + Math.max(1, inv.attending));
    });
    const waiting = guests
      .filter((g) => {
        const inv = g.invites.find((i) => i.eventId === eventId);
        return inv && !inv.tableId && inv.rsvp !== 'no';
      })
      .sort((a, b) => Number(b.vip) - Number(a.vip) || a.side.localeCompare(b.side) || (a.household ?? a.category).localeCompare(b.household ?? b.category));
    let seated = 0;
    const updates = new Map<string, string>();
    for (const g of waiting) {
      const size = Math.max(1, g.invites.find((i) => i.eventId === eventId)?.attending || 1 + g.plusOnes);
      const pool = tables.filter((t) => (g.vip ? t.vip : !t.vip) || (g.vip && !tables.some((x) => x.vip)));
      const table = [...(pool.length ? pool : tables)].sort((a, b) => (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0)).find((t) => (load.get(t.id) ?? 0) + size <= t.capacity);
      if (!table) continue;
      load.set(table.id, (load.get(table.id) ?? 0) + size);
      updates.set(g.id, table.id);
      seated++;
    }
    set((s) => ({ guests: s.guests.map((g) => (updates.has(g.id) ? { ...g, invites: g.invites.map((i) => (i.eventId === eventId ? { ...i, tableId: updates.get(g.id) } : i)) } : g)) }));
    return seated;
  },

  // Budget
  addBudgetLine: (line) => set((s) => ({ budget: [...s.budget, { ...line, id: uid('bl') }] })),
  updateBudgetLine: (id, patch) => set((s) => ({ budget: s.budget.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),
  removeBudgetLine: (id) => set((s) => ({ budget: s.budget.filter((b) => b.id !== id) })),

  // Website
  saveWebsite: (site) => set((s) => ({ websites: [...s.websites.filter((w) => w.projectId !== site.projectId), { ...site, updatedAt: now() }] })),
  recordWebsiteView: (slug) => set((s) => ({ websites: s.websites.map((w) => (w.slug === slug ? { ...w, views: w.views + 1 } : w)) })),

  // Registry
  addRegistryItem: (item) => set((s) => ({ registry: [...s.registry, { ...item, id: uid('reg'), contributions: [] }] })),
  updateRegistryItem: (id, patch) => set((s) => ({ registry: s.registry.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
  removeRegistryItem: (id) => set((s) => ({ registry: s.registry.filter((r) => r.id !== id) })),
  markContributionThanked: (itemId, contributionId) =>
    set((s) => ({ registry: s.registry.map((r) => (r.id === itemId ? { ...r, contributions: r.contributions.map((c) => (c.id === contributionId ? { ...c, thanked: !c.thanked } : c)) } : r)) })),

  // Inspiration boards
  addBoard: (projectId, name) => {
    const board: InspirationBoard = { id: uid('bd'), projectId, name: name.trim() || 'New board', items: [] };
    set((s) => ({ boards: [...s.boards, board] }));
    return board.id;
  },
  toggleBoardItem: (boardId, itemId) =>
    set((s) => ({ boards: s.boards.map((b) => (b.id === boardId ? { ...b, items: b.items.includes(itemId) ? b.items.filter((x) => x !== itemId) : [itemId, ...b.items] } : b)) })),
  renameBoard: (boardId, name) => set((s) => ({ boards: s.boards.map((b) => (b.id === boardId ? { ...b, name } : b)) })),
  deleteBoard: (boardId) => set((s) => ({ boards: s.boards.filter((b) => b.id !== boardId) })),

  // Contracts
  signContract: (contractId, party, name, path) => {
    set((s) => ({
      contracts: s.contracts.map((c) => {
        if (c.id !== contractId) return c;
        const signatures = [...c.signatures.filter((x) => x.party !== party), { party, name, at: now(), path }];
        const status: Contract['status'] = signatures.length >= 3 ? 'signed' : 'partially_signed';
        return { ...c, signatures, status };
      }),
    }));
    const contract = get().contracts.find((c) => c.id === contractId);
    if (contract?.status === 'signed') {
      const project = get().projects.find((p) => p.id === contract.projectId);
      if (project) get().notify(project.customerId, 'Contract fully signed', contract.title, '/contracts', 'booking');
    }
    get().log(currentActor(), 'contract.sign', 'contract', contractId, party);
  },
  saveContract: (contract) => set((s) => ({ contracts: s.contracts.some((c) => c.id === contract.id) ? s.contracts.map((c) => (c.id === contract.id ? contract : c)) : [contract, ...s.contracts] })),

  // Shortlist
  toggleShortlist: (accountId, providerId) => {
    const list = get().shortlists[accountId] ?? [];
    const exists = list.some((e) => e.providerId === providerId);
    const next = exists ? list.filter((e) => e.providerId !== providerId) : [{ providerId, status: 'saved' as const, tags: [], addedAt: now() }, ...list];
    set((s) => ({ shortlists: { ...s.shortlists, [accountId]: next } }));
    return !exists;
  },
  updateShortlist: (accountId, providerId, patch) =>
    set((s) => ({ shortlists: { ...s.shortlists, [accountId]: (s.shortlists[accountId] ?? []).map((e) => (e.providerId === providerId ? { ...e, ...patch } : e)) } })),

  // Business
  saveStaff: (member) => set((s) => ({ staff: s.staff.some((m) => m.id === member.id) ? s.staff.map((m) => (m.id === member.id ? member : m)) : [...s.staff, member] })),
  removeStaff: (id) => set((s) => ({ staff: s.staff.filter((m) => m.id !== id) })),
  saveDeal: (deal) => set((s) => ({ deals: s.deals.some((d) => d.id === deal.id) ? s.deals.map((d) => (d.id === deal.id ? deal : d)) : [deal, ...s.deals] })),
  redeemDeal: (id) => set((s) => ({ deals: s.deals.map((d) => (d.id === id ? { ...d, redemptions: d.redemptions + 1 } : d)) })),

  savePackage: (pkg) => set((s) => ({ packages: s.packages.some((p) => p.id === pkg.id) ? s.packages.map((p) => (p.id === pkg.id ? pkg : p)) : [...s.packages, pkg] })),
  removePackage: (id) => set((s) => ({ packages: s.packages.filter((p) => p.id !== id) })),
  addPortfolioItem: (item) =>
    set((s) => {
      const next = [{ ...item, id: uid('pf'), order: -1 }, ...s.portfolio];
      const mine = next.filter((p) => p.providerId === item.providerId).sort((a, b) => a.order - b.order);
      const order = new Map(mine.map((p, i) => [p.id, i]));
      return { portfolio: next.map((p) => (order.has(p.id) ? { ...p, order: order.get(p.id)! } : p)) };
    }),
  updatePortfolioItem: (id, patch) => set((s) => ({ portfolio: s.portfolio.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
  removePortfolioItem: (id) => set((s) => ({ portfolio: s.portfolio.filter((p) => p.id !== id) })),
  movePortfolioItem: (id, delta) =>
    set((s) => {
      const item = s.portfolio.find((p) => p.id === id);
      if (!item) return {};
      const mine = s.portfolio.filter((p) => p.providerId === item.providerId).sort((a, b) => a.order - b.order);
      const idx = mine.findIndex((p) => p.id === id);
      const target = Math.max(0, Math.min(mine.length - 1, idx + delta));
      const [moved] = mine.splice(idx, 1);
      mine.splice(target, 0, moved);
      const order = new Map(mine.map((p, i) => [p.id, i]));
      return { portfolio: s.portfolio.map((p) => (order.has(p.id) ? { ...p, order: order.get(p.id)! } : p)) };
    }),
});
