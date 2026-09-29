import type { QuoteItem, Quotation } from '@/types/platform';

export const GST_RATE = 0.18;

export interface QuoteTotals {
  subtotal: number;
  discount: number;
  taxable: number;
  tax: number;
  total: number;
}

/** Single source of truth for quote arithmetic (all amounts rounded to rupees). */
export function quoteTotals(q: Pick<Quotation, 'items' | 'discount' | 'taxRate'>): QuoteTotals {
  const subtotal = q.items.reduce((sum, i) => sum + Math.max(0, i.qty) * Math.max(0, i.rate), 0);
  const discount = Math.min(Math.max(0, q.discount), subtotal);
  const taxable = subtotal - discount;
  const tax = Math.round(taxable * q.taxRate);
  return { subtotal, discount, taxable, tax, total: taxable + tax };
}

export const lineTotal = (i: QuoteItem) => Math.max(0, i.qty) * Math.max(0, i.rate);

/** QT-2026-0042 style numbers, unique within the existing set. */
export function nextQuoteNumber(existing: string[]): string {
  const year = new Date().getFullYear();
  const max = existing
    .map((n) => Number(n.split('-')[2]))
    .filter((n) => Number.isFinite(n))
    .reduce((a, b) => Math.max(a, b), 0);
  return `QT-${year}-${String(max + 1).padStart(4, '0')}`;
}

/** Starter line items per category so vendors can send a quote in seconds. */
export const QUOTE_TEMPLATES: Record<string, Omit<QuoteItem, 'id'>[]> = {
  venues: [
    { title: 'Venue rental (per function)', qty: 1, rate: 350000 },
    { title: 'Veg catering (per plate)', qty: 400, rate: 1400 },
    { title: 'Decor & lighting package', qty: 1, rate: 150000 },
  ],
  photographers: [
    { title: 'Candid photography (per day)', qty: 2, rate: 65000 },
    { title: 'Cinematic wedding film', qty: 1, rate: 90000 },
    { title: 'Premium photo album (40 sheets)', qty: 1, rate: 25000 },
  ],
  makeup: [
    { title: 'Bridal HD makeup', qty: 1, rate: 35000 },
    { title: 'Family makeup (per person)', qty: 4, rate: 4000 },
  ],
  'planning-decor': [
    { title: 'Mandap design & florals', qty: 1, rate: 180000 },
    { title: 'Stage & entrance decor', qty: 1, rate: 90000 },
    { title: 'On-site coordination team', qty: 2, rate: 20000 },
  ],
  platform: [
    { title: 'Genie planning fee', qty: 1, rate: 19999 },
    { title: 'Venue & vendor coordination', qty: 1, rate: 45000 },
    { title: 'Wedding-day execution crew (per day)', qty: 3, rate: 25000 },
  ],
  default: [
    { title: 'Service package', qty: 1, rate: 50000 },
    { title: 'Travel & logistics', qty: 1, rate: 8000 },
  ],
};

export const DEFAULT_TERMS =
  '30% advance to confirm booking, 50% one week before the event, balance on completion. Prices valid for 15 days. GST as applicable.';
