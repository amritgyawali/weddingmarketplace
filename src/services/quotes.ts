import type { QuoteItem, QuoteVersion, Quotation } from '@/types/platform';

import { VAT_RATE } from './pricing';

/** Nepal VAT (13%). */
export const TAX_RATE = VAT_RATE;
/** @deprecated use TAX_RATE */
export const GST_RATE = VAT_RATE;

export interface QuoteTotals {
  subtotal: number;
  discount: number;
  serviceFee: number;
  taxable: number;
  tax: number;
  total: number;
  /** Internal: provider cost of the lines that carry one. */
  cost: number;
  /** Internal: platform margin = taxable − cost. */
  margin: number;
}

type Totalable = Pick<Quotation, 'items' | 'discount' | 'taxRate'> & { serviceFee?: number };

/** Single source of truth for quote arithmetic (all amounts rounded to rupees). */
export function quoteTotals(q: Totalable): QuoteTotals {
  const subtotal = q.items.reduce((sum, i) => sum + lineTotal(i), 0);
  const discount = Math.min(Math.max(0, q.discount), subtotal);
  const serviceFee = Math.max(0, q.serviceFee ?? 0);
  const taxable = subtotal - discount + serviceFee;
  const tax = Math.round(taxable * q.taxRate);
  const cost = q.items.reduce((sum, i) => sum + Math.max(0, i.qty) * Math.max(0, i.cost ?? i.rate), 0);
  return { subtotal, discount, serviceFee, taxable, tax, total: taxable + tax, cost, margin: taxable - cost };
}

export const lineTotal = (i: QuoteItem) => Math.round(Math.max(0, i.qty) * Math.max(0, i.rate));

/** QT-2026-0042 style numbers, unique within the existing set. */
export function nextQuoteNumber(existing: string[]): string {
  const year = new Date().getFullYear();
  const max = existing
    .map((n) => Number(n.split('-')[2]))
    .filter((n) => Number.isFinite(n))
    .reduce((a, b) => Math.max(a, b), 0);
  return `QT-${year}-${String(max + 1).padStart(4, '0')}`;
}

/** Freeze the current working copy as a version record. */
export function snapshot(q: Quotation, changeSummary?: string): QuoteVersion {
  return {
    version: q.version,
    items: q.items.map((i) => ({ ...i })),
    discount: q.discount,
    serviceFee: q.serviceFee,
    taxRate: q.taxRate,
    notes: q.notes,
    terms: q.terms,
    validUntil: q.validUntil,
    schedule: q.schedule,
    total: quoteTotals(q).total,
    sentAt: new Date().toISOString(),
    changeSummary,
  };
}

/** Human summary of what changed between two versions (used on the version timeline). */
export function diffVersions(prev: Pick<QuoteVersion, 'items' | 'discount' | 'serviceFee' | 'total'>, next: Pick<QuoteVersion, 'items' | 'discount' | 'serviceFee' | 'total'>): string[] {
  const out: string[] = [];
  const key = (i: QuoteItem) => i.serviceId ?? i.title;
  for (const item of next.items) {
    const before = prev.items.find((p) => key(p) === key(item));
    if (!before) out.push(`Added ${item.title}`);
    else if (lineTotal(before) !== lineTotal(item)) out.push(`${item.title}: ${lineTotal(before).toLocaleString('en-US')} → ${lineTotal(item).toLocaleString('en-US')}`);
  }
  for (const item of prev.items) if (!next.items.some((n) => key(n) === key(item))) out.push(`Removed ${item.title}`);
  if (prev.discount !== next.discount) out.push(`Discount ${prev.discount.toLocaleString('en-US')} → ${next.discount.toLocaleString('en-US')}`);
  if (prev.serviceFee !== next.serviceFee) out.push(`Service fee ${prev.serviceFee.toLocaleString('en-US')} → ${next.serviceFee.toLocaleString('en-US')}`);
  const delta = next.total - prev.total;
  if (delta) out.push(`Total ${delta > 0 ? '+' : '−'}${Math.abs(delta).toLocaleString('en-US')}`);
  return out;
}

/** Starter line items per category so vendors can send a quote in seconds (NPR). */
export const QUOTE_TEMPLATES: Record<string, Omit<QuoteItem, 'id'>[]> = {
  venues: [
    { title: 'Party palace rental (per function)', qty: 1, rate: 180_000, serviceId: 'venue' },
    { title: 'Veg + non-veg buffet (per plate)', qty: 500, rate: 1_250, serviceId: 'catering' },
    { title: 'Stage, jagge & lighting package', qty: 1, rate: 90_000, serviceId: 'decoration' },
  ],
  'photo-video': [
    { title: 'Candid + traditional photography (per event)', qty: 2, rate: 45_000, serviceId: 'photography' },
    { title: 'Cinematic wedding film', qty: 1, rate: 90_000, serviceId: 'videography' },
    { title: 'Premium album (40 sheets)', qty: 1, rate: 25_000, serviceId: 'album' },
  ],
  beauty: [
    { title: 'Bridal HD makeup & hair', qty: 1, rate: 35_000, serviceId: 'makeup' },
    { title: 'Family makeup (per person)', qty: 4, rate: 3_500, serviceId: 'makeup' },
  ],
  decor: [
    { title: 'Jagge / mandap design & florals', qty: 1, rate: 150_000, serviceId: 'decoration' },
    { title: 'Stage & entrance decor', qty: 1, rate: 80_000, serviceId: 'decoration' },
    { title: 'On-site coordination team', qty: 2, rate: 15_000, serviceId: 'planner' },
  ],
  food: [
    { title: 'Buffet (per plate)', qty: 400, rate: 1_150, serviceId: 'catering' },
    { title: 'Live counters', qty: 3, rate: 15_000, serviceId: 'catering' },
  ],
  entertainment: [
    { title: 'DJ with sound & lights (per night)', qty: 1, rate: 45_000, serviceId: 'dj' },
    { title: 'Panche Baja (9 players)', qty: 1, rate: 25_000, serviceId: 'panche-baja' },
  ],
  platform: [
    { title: 'Wedding coordination & planning fee', qty: 1, rate: 45_000, serviceId: 'planner' },
    { title: 'Wedding-day execution crew (per day)', qty: 3, rate: 20_000, serviceId: 'planner' },
  ],
  default: [
    { title: 'Service package', qty: 1, rate: 50_000 },
    { title: 'Travel & logistics', qty: 1, rate: 8_000 },
  ],
};

export const DEFAULT_TERMS =
  '30% advance to confirm the booking, 50% fifteen days before the event and the balance after completion. Prices valid for 15 days. 13% VAT included in the total. Date changes are free once if requested 60+ days before the event.';
