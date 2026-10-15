/**
 * Pure scoring and forecasting behind the "smart" toolkit tools: the couple's
 * health check and headcount forecast, a vendor's lead scores and revenue
 * forecast, a freelancer's gig fit and workload, and the ops team's money
 * reconciliation and commission simulator. No React, no store: plain values
 * in, plain values out, so every rule is testable (`npm run test:insights`)
 * and can move to the server unchanged. Money is whole NPR; dates yyyy-mm-dd.
 */
import { isPeakSeason } from '@/data/events';
import { milestoneStatus, roundMoney, splitBooking } from '@/services/pricing';
import type { Guest, LeadStatus, Payable, Payment, PricingModel, Project, ProjectEvent, Quotation, Refund, ReviewRecord } from '@/types/platform';
import { addDays, daysUntil, formatMoney, fromISODate } from '@/utils/format';

const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

/** Value at quantile `q` (0–1) of an ascending list, linearly interpolated. */
export function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const pos = clamp01(q) * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

// ─── Couple: wedding health check ───────────────────────────────────────────

export interface HealthInput {
  daysToGo: number;
  services: { confirmed: number; total: number };
  /** Services usually needed for the functions but not requested yet. */
  missingServices: number;
  tasks: { done: number; total: number };
  overdueMilestones: number;
  guests: { total: number; responded: number; invited: number };
  contracts: { signed: number; total: number };
  budget: number;
  /** What the confirmed and proposed bookings add up to. */
  committed: number;
}

export interface HealthPart {
  id: 'vendors' | 'payments' | 'tasks' | 'guests' | 'contracts' | 'budget';
  label: string;
  weight: number;
  /** 0–1 */
  value: number;
  detail: string;
}

export type HealthPace = 'ahead' | 'on_track' | 'behind' | 'done';

/**
 * How ready a celebration is, 0–100, from six weighted parts, and whether that
 * is ahead of or behind where couples usually are with this many days to go
 * (about a year of planning, most of it in the last six months).
 */
export function weddingHealth(i: HealthInput) {
  const vendorShare = i.services.total ? i.services.confirmed / i.services.total : 0;
  const missingPenalty = Math.min(0.3, i.missingServices * 0.1);
  const over = i.budget > 0 ? Math.max(0, i.committed - i.budget) / i.budget : 0;
  const parts: HealthPart[] = [
    {
      id: 'vendors',
      label: 'Vendors booked',
      weight: 30,
      value: clamp01(vendorShare - missingPenalty),
      detail: i.services.total ? `${i.services.confirmed} of ${i.services.total} services confirmed${i.missingServices ? `, ${i.missingServices} more usually needed` : ''}` : 'No services requested yet',
    },
    { id: 'payments', label: 'Payments on time', weight: 15, value: i.overdueMilestones ? Math.max(0, 1 - i.overdueMilestones * 0.5) : 1, detail: i.overdueMilestones ? `${i.overdueMilestones} payment${i.overdueMilestones > 1 ? 's' : ''} overdue` : 'Nothing overdue' },
    { id: 'tasks', label: 'Tasks done', weight: 15, value: i.tasks.total ? i.tasks.done / i.tasks.total : 0, detail: i.tasks.total ? `${i.tasks.done} of ${i.tasks.total} shared tasks done` : 'No tasks yet' },
    {
      id: 'guests',
      label: 'Guests and RSVPs',
      weight: 15,
      value: i.guests.total ? 0.4 * (i.guests.invited / i.guests.total) + 0.6 * (i.guests.invited ? i.guests.responded / i.guests.invited : 0) : 0,
      detail: i.guests.total ? `${i.guests.invited} of ${i.guests.total} invited, ${i.guests.responded} replied` : 'Guest list not started',
    },
    { id: 'contracts', label: 'Contracts signed', weight: 10, value: i.contracts.total ? i.contracts.signed / i.contracts.total : 0, detail: i.contracts.total ? `${i.contracts.signed} of ${i.contracts.total} signed` : 'No contracts yet' },
    { id: 'budget', label: 'Within budget', weight: 15, value: i.budget > 0 ? clamp01(1 - over * 2) : 0.5, detail: i.budget <= 0 ? 'Set a budget to track it' : over > 0 ? `${Math.round(over * 100)}% over budget` : 'Bookings fit the budget' },
  ];
  const score = Math.round(parts.reduce((s, p) => s + clamp01(p.value) * p.weight, 0));
  // Nobody is expected to be fully done before the day itself.
  const expected = Math.min(90, Math.round(100 * clamp01(1 - Math.max(0, i.daysToGo) / 365)));
  const pace: HealthPace = score >= 95 ? 'done' : score >= expected + 10 ? 'ahead' : score >= expected - 10 ? 'on_track' : 'behind';
  // Biggest gains first: weight × what is still missing.
  const gaps = [...parts].filter((p) => p.value < 0.999).sort((a, b) => b.weight * (1 - b.value) - a.weight * (1 - a.value));
  return { score, expected, pace, parts, gaps };
}

// ─── Couple: headcount forecast ─────────────────────────────────────────────

export interface TurnoutRates {
  /** Share of "maybe" heads who usually come (0–1). */
  maybe: number;
  /** Share of heads who never replied but usually come anyway (0–1). */
  pending: number;
  /** Extra plates on top of the forecast (0–1). */
  buffer: number;
}

export const DEFAULT_TURNOUT: TurnoutRates = { maybe: 0.5, pending: 0.7, buffer: 0.05 };

/** Heads a guest brings: the RSVP count when given, else the guest, plus-ones and children. */
export const guestHeads = (g: Pick<Guest, 'plusOnes' | 'children'>) => 1 + Math.max(0, g.plusOnes) + Math.max(0, g.children);

export interface HeadcountRow {
  eventId: string;
  name: string;
  date: string | null;
  planned: number;
  invited: number;
  yes: number;
  maybe: number;
  pending: number;
  no: number;
  /** Lowest: confirmed heads only. */
  floor: number;
  expected: number;
  /** Everyone not declined. */
  ceiling: number;
  /** Expected plus buffer, rounded up to a table of 10. */
  plates: number;
}

/**
 * Expected attendance per function from the RSVPs so far: yes counts in full,
 * maybe and no reply at the usual turnout, declines not at all.
 */
export function headcountForecast(guests: Guest[], events: Pick<ProjectEvent, 'id' | 'name' | 'date' | 'guests'>[], rates: TurnoutRates = DEFAULT_TURNOUT): HeadcountRow[] {
  return events.map((e) => {
    let yes = 0;
    let maybe = 0;
    let pending = 0;
    let no = 0;
    let invited = 0;
    for (const g of guests) {
      const inv = g.invites.find((x) => x.eventId === e.id);
      if (!inv) continue;
      invited += 1;
      const heads = inv.rsvp === 'yes' && inv.attending > 0 ? inv.attending : guestHeads(g);
      if (inv.rsvp === 'yes') yes += heads;
      else if (inv.rsvp === 'maybe') maybe += heads;
      else if (inv.rsvp === 'no') no += heads;
      else pending += heads;
    }
    const expected = Math.round(yes + maybe * clamp01(rates.maybe) + pending * clamp01(rates.pending));
    return {
      eventId: e.id,
      name: e.name,
      date: e.date,
      planned: e.guests,
      invited,
      yes,
      maybe,
      pending,
      no,
      floor: yes,
      expected,
      ceiling: yes + maybe + pending,
      plates: expected ? Math.ceil((expected * (1 + clamp01(rates.buffer))) / 10) * 10 : 0,
    };
  });
}

// ─── Couple: fair price check ───────────────────────────────────────────────

export type PriceVerdict = 'good' | 'fair' | 'high' | 'very_high';

/**
 * Where a quoted unit price sits against the market: the listed starting
 * prices of similar providers nearby, or the service's typical range when
 * there are too few of them.
 */
export function priceCheck(price: number, market: number[], range: [number, number]) {
  const samples = market.filter((n) => n > 0).sort((a, b) => a - b);
  const useRange = samples.length < 3;
  const [lo, hi] = range;
  const median = useRange ? Math.round((lo + hi) / 2) : Math.round(quantile(samples, 0.5));
  const p25 = useRange ? lo + (hi - lo) * 0.25 : quantile(samples, 0.25);
  const p75 = useRange ? lo + (hi - lo) * 0.75 : quantile(samples, 0.75);
  const percentile = useRange ? clamp01(hi > lo ? (price - lo) / (hi - lo) : 0.5) : samples.filter((n) => n < price).length / samples.length;
  const verdict: PriceVerdict = price <= p25 ? 'good' : price <= p75 ? 'fair' : price <= p75 * 1.25 ? 'high' : 'very_high';
  return { median, p25: Math.round(p25), p75: Math.round(p75), percentile, verdict, overMedian: Math.max(0, Math.round(price - median)), basis: useRange ? ('range' as const) : ('listings' as const), samples: samples.length };
}

// ─── Couple: marriage registration ──────────────────────────────────────────

/** Days after the wedding within which a marriage is registered without a late fee. */
export const REGISTRATION_DAYS = 35;

/** The last day to register without a late fee, and how many days are left. */
export function registrationDeadline(weddingIso: string) {
  const due = addDays(weddingIso, REGISTRATION_DAYS);
  return { due, daysLeft: daysUntil(due), started: daysUntil(weddingIso) <= 0 };
}

// ─── Couple: family vote ────────────────────────────────────────────────────

/** Votes per option and the leader(s), from `vote:<voterId>` → option index fields. */
export function tallyVotes(options: string[], fields: Record<string, string | number | boolean> | undefined) {
  const counts = options.map(() => 0);
  for (const [k, v] of Object.entries(fields ?? {})) {
    if (!k.startsWith('vote:')) continue;
    const i = Number(v);
    if (Number.isInteger(i) && i >= 0 && i < counts.length) counts[i] += 1;
  }
  const total = counts.reduce((s, n) => s + n, 0);
  const top = Math.max(0, ...counts);
  return { counts, total, leaders: total ? options.filter((_, i) => counts[i] === top) : [] };
}

/** Options typed one per line (or separated by commas), trimmed, de-duplicated, at most six. */
export const parseOptions = (text: string) => [...new Set(text.split(/[\n,|]/).map((s) => s.trim()).filter(Boolean))].slice(0, 6);

// ─── Vendor: lead scoring ───────────────────────────────────────────────────

export interface LeadLike {
  status: LeadStatus;
  eventDate: string;
  guests?: number;
  budget?: number;
  message?: string;
  source?: string;
  priority?: 'low' | 'medium' | 'high';
  createdAt: string;
  history?: { status: LeadStatus; at: string }[];
}

export interface LeadScoreContext {
  /** The vendor's listed starting price (one unit). */
  startingPrice: number;
  /** Hall capacity for venues. */
  capacity?: { min: number; max: number };
  /** Is the vendor free on the date? `undefined` when unknown. */
  free?: boolean;
  nowIso: string;
}

export type LeadBand = 'hot' | 'warm' | 'cold';

/**
 * How likely an open enquiry is to book, 0–100, with the reasons. Budget fit,
 * date (soon, peak, free), guest fit, how complete and how fresh the enquiry
 * is, and where it came from.
 */
export function leadScore(l: LeadLike, ctx: LeadScoreContext) {
  const reasons: string[] = [];
  let score = 40;
  if (l.budget && ctx.startingPrice) {
    const ratio = l.budget / ctx.startingPrice;
    if (ratio >= 1.2) {
      score += 18;
      reasons.push('Budget comfortably above your starting price');
    } else if (ratio >= 0.9) {
      score += 10;
      reasons.push('Budget matches your starting price');
    } else {
      score -= 12;
      reasons.push('Budget below your starting price');
    }
  } else reasons.push('No budget given');
  const days = Math.round((fromISODate(l.eventDate).getTime() - fromISODate(ctx.nowIso.slice(0, 10)).getTime()) / 86_400_000);
  if (days < 0) {
    score -= 40;
    reasons.push('Event date has passed');
  } else if (days <= 60) {
    score += 12;
    reasons.push('Event within two months: they must decide soon');
  } else if (days <= 240) score += 6;
  if (isPeakSeason(l.eventDate)) {
    score += 4;
    reasons.push('Peak-season date');
  }
  if (ctx.free === false) {
    score -= 25;
    reasons.push('You are already booked that day');
  }
  if (ctx.capacity && l.guests) {
    if (l.guests > ctx.capacity.max) {
      score -= 20;
      reasons.push(`${l.guests} guests is more than your ${ctx.capacity.max} capacity`);
    } else if (l.guests >= ctx.capacity.min) score += 6;
  }
  if ((l.message ?? '').trim().length >= 60) {
    score += 6;
    reasons.push('Detailed message');
  }
  if (l.source === 'referral' || l.source === 'walk_in') {
    score += 8;
    reasons.push(l.source === 'referral' ? 'Came by referral' : 'Walked in');
  }
  if (l.priority === 'high') score += 5;
  const stage: Partial<Record<LeadStatus, [number, string]>> = { responded: [4, 'They replied to you'], quoted: [8, 'Quote sent'], negotiating: [14, 'Already negotiating'], meeting: [16, 'Meeting booked'] };
  const boost = stage[l.status];
  if (boost) {
    score += boost[0];
    reasons.unshift(boost[1]);
  }
  const last = l.history?.length ? l.history[l.history.length - 1].at : l.createdAt;
  const idleDays = (new Date(ctx.nowIso).getTime() - new Date(last).getTime()) / 86_400_000;
  if (idleDays > 14) {
    score -= 10;
    reasons.push(`No movement for ${Math.round(idleDays)} days`);
  }
  const value = Math.max(0, Math.min(100, Math.round(score)));
  const band: LeadBand = value >= 65 ? 'hot' : value >= 45 ? 'warm' : 'cold';
  return { score: value, band, reasons };
}

// ─── Vendor: revenue forecast ───────────────────────────────────────────────

/** Typical chance an enquiry at each stage ends in a booking (editable per vendor). */
export const STAGE_ODDS: Record<LeadStatus, number> = { new: 0.1, contacted: 0.15, responded: 0.2, quoted: 0.35, negotiating: 0.5, meeting: 0.6, won: 1, lost: 0, archived: 0 };

/**
 * Income by month: payouts already scheduled (certain) plus open enquiries
 * weighted by their stage odds (likely), from the month of `fromIso`.
 */
export function revenueForecast(
  fromIso: string,
  months: number,
  certain: { date: string; amount: number }[],
  pipeline: { date: string; value: number; status: LeadStatus }[],
  odds: Partial<Record<LeadStatus, number>> = {},
) {
  const start = fromISODate(`${fromIso.slice(0, 7)}-01`);
  const keys = Array.from({ length: months }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const rows = keys.map((month) => ({ month, certain: 0, likely: 0, open: 0 }));
  const at = (iso: string) => keys.indexOf(iso.slice(0, 7));
  for (const c of certain) {
    const i = at(c.date);
    if (i >= 0) rows[i].certain += c.amount;
  }
  for (const p of pipeline) {
    const i = at(p.date);
    const chance = clamp01(odds[p.status] ?? STAGE_ODDS[p.status]);
    if (i < 0 || chance <= 0 || p.status === 'won') continue;
    rows[i].likely += Math.round(p.value * chance);
    rows[i].open += 1;
  }
  return rows.map((r) => ({ ...r, total: r.certain + r.likely }));
}

// ─── Vendor: conversion by segment ──────────────────────────────────────────

export interface ConversionRow {
  key: string;
  total: number;
  won: number;
  lost: number;
  open: number;
  /** Won out of decided (won + lost). */
  rate: number | null;
}

/** Won, lost and open enquiries grouped by any key, best converting first. */
export function conversionBy<T extends { status: LeadStatus }>(items: T[], keyOf: (x: T) => string): ConversionRow[] {
  const map = new Map<string, ConversionRow>();
  for (const x of items) {
    const key = keyOf(x);
    const row = map.get(key) ?? { key, total: 0, won: 0, lost: 0, open: 0, rate: null };
    row.total += 1;
    if (x.status === 'won') row.won += 1;
    else if (x.status === 'lost' || x.status === 'archived') row.lost += 1;
    else row.open += 1;
    map.set(key, row);
  }
  return [...map.values()].map((r) => ({ ...r, rate: r.won + r.lost ? r.won / (r.won + r.lost) : null })).sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1) || b.total - a.total);
}

/** Budget band for an enquiry, relative to the vendor's starting price. */
export function budgetBand(budget: number | undefined, startingPrice: number) {
  if (!budget) return 'No budget given';
  if (!startingPrice) return 'Budget given';
  const r = budget / startingPrice;
  return r < 0.9 ? 'Below your price' : r < 1.5 ? 'Around your price' : 'Well above your price';
}

/** First-reply speed band from the enquiry's history. */
export function replyBand(l: Pick<LeadLike, 'createdAt' | 'history'>) {
  const first = l.history?.find((h) => h.status !== 'new');
  if (!first) return 'Not answered yet';
  const hours = (new Date(first.at).getTime() - new Date(l.createdAt).getTime()) / 3_600_000;
  return hours <= 1 ? 'Within an hour' : hours <= 24 ? 'Same day' : 'After a day or more';
}

// ─── Demand by date (vendors and freelancers) ───────────────────────────────

export interface DateDemand {
  date: string;
  sait: boolean;
  saturday: boolean;
  peak: boolean;
  /** Enquiries and functions on that date in the area. */
  requests: number;
  /** 0–100 */
  demand: number;
  /** Suggested uplift on the normal price, in percent. */
  upliftPct: number;
}

/** How sought-after a date is: sait, Saturday, peak month and real requests for it. */
export function dateDemand(date: string, ctx: { sait: boolean; requests: number }): DateDemand {
  const saturday = fromISODate(date).getDay() === 6;
  const peak = isPeakSeason(date);
  const demand = Math.min(100, (ctx.sait ? 45 : 0) + (saturday ? 15 : 0) + (peak ? 15 : 0) + Math.min(25, ctx.requests * 8));
  const upliftPct = demand >= 75 ? 25 : demand >= 55 ? 15 : demand >= 35 ? 10 : 0;
  return { date, sait: ctx.sait, saturday, peak, requests: ctx.requests, demand, upliftPct };
}

// ─── Freelancer: gig fit ────────────────────────────────────────────────────

export interface GigFitInput {
  pay: number;
  hours: number;
  skill: string;
  date: string;
  emergency?: boolean;
  /** Road distance to the gig, null when local or unknown. */
  km: number | null;
}

export interface GigFitProfile {
  skills: string[];
  hourlyRate: number;
  dayRate: number;
  travelRadiusKm: number;
  /** Fuel and fares per km, both ways. */
  perKm: number;
  busy: boolean;
}

/**
 * What a gig is really worth to this freelancer: pay after travel, per hour
 * including travel time, against their own rates and calendar. Score 0–100.
 */
export function gigFit(g: GigFitInput, p: GigFitProfile) {
  const km = g.km ?? 0;
  const travelCost = Math.round(km * 2 * p.perKm);
  const travelHours = km / 35;
  const net = g.pay - travelCost;
  const hours = Math.max(1, g.hours) + travelHours * 2;
  const perHour = Math.round(net / hours);
  const benchmark = p.hourlyRate || (p.dayRate ? p.dayRate / 10 : 0);
  const reasons: string[] = [];
  let score = 50;
  if (p.skills.includes(g.skill)) {
    score += 15;
  } else {
    score -= 25;
    reasons.push('Not one of your skills');
  }
  if (benchmark) {
    const r = perHour / benchmark;
    score += Math.max(-25, Math.min(25, Math.round((r - 1) * 50)));
    reasons.push(r >= 1 ? 'Pays at or above your hourly rate after travel' : `${Math.round((1 - r) * 100)}% below your hourly rate after travel`);
  }
  if (g.km !== null && g.km > p.travelRadiusKm) {
    score -= 15;
    reasons.push(`${Math.round(g.km)} km away, beyond your ${p.travelRadiusKm} km radius`);
  }
  if (p.busy) {
    score -= 40;
    reasons.push('Clashes with a job or a blocked day');
  }
  if (g.emergency) {
    score += 5;
    reasons.push('Emergency cover: quick hire and higher pay');
  }
  if (isPeakSeason(g.date)) reasons.push('Peak season: your calendar may fill anyway');
  // A gig outside your skills is never a strong fit, however well it pays.
  const capped = p.skills.includes(g.skill) ? score : Math.min(score, 35);
  return { score: Math.max(0, Math.min(100, capped)), net, perHour, travelCost, reasons };
}

// ─── Freelancer: workload and rest ──────────────────────────────────────────

export interface WorkDay {
  date: string;
  start: string;
  end: string;
}

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Hours on a job; an end before the start runs past midnight. */
export const shiftHours = (start: string, end: string) => {
  const a = minutes(start);
  const b = minutes(end);
  return Math.round(((b > a ? b - a : b + 1440 - a) / 60) * 10) / 10;
};

/**
 * Streaks of back-to-back work days, late finishes and the busiest weeks, to
 * plan rest before the long peak-season runs.
 */
export function workloadSummary(days: WorkDay[]) {
  const dates = [...new Set(days.map((d) => d.date))].sort();
  let longest = 0;
  let run = 0;
  let longestEnd = '';
  dates.forEach((d, i) => {
    run = i > 0 && addDays(dates[i - 1], 1) === d ? run + 1 : 1;
    if (run > longest) {
      longest = run;
      longestEnd = d;
    }
  });
  const late = days.filter((d) => minutes(d.end) >= 22 * 60 || minutes(d.end) < minutes(d.start)).length;
  const weeks = new Map<string, { week: string; days: number; hours: number }>();
  for (const d of days) {
    const wd = (fromISODate(d.date).getDay() + 6) % 7;
    const week = addDays(d.date, -wd);
    const row = weeks.get(week) ?? { week, days: 0, hours: 0 };
    row.hours = Math.round((row.hours + shiftHours(d.start, d.end)) * 10) / 10;
    weeks.set(week, row);
  }
  for (const w of weeks.values()) w.days = dates.filter((d) => d >= w.week && d < addDays(w.week, 7)).length;
  return { workDays: dates.length, longestStreak: longest, longestStreakStart: longest ? addDays(longestEnd, -(longest - 1)) : '', lateFinishes: late, weeks: [...weeks.values()].sort((a, b) => a.week.localeCompare(b.week)) };
}

// ─── Platform: money reconciliation ─────────────────────────────────────────

export interface ReconIssue {
  id: string;
  projectId: string;
  kind: 'milestones' | 'booking_split' | 'payables' | 'overpaid' | 'refund' | 'payment_link';
  severity: 'high' | 'medium';
  title: string;
  detail: string;
  /** How far out, in NPR (absolute). */
  diff: number;
}

const acceptedTotal = (q: Quotation) => {
  const v = q.acceptedVersion ? q.versions.find((x) => x.version === q.acceptedVersion) : q.versions[q.versions.length - 1];
  return v?.total;
};

/**
 * Checks the money invariants of one project (AGENTS.md §5): accepted quote =
 * Σ milestones, booking price = payable + fee, payables = provider payable,
 * no milestone or payment over-collected, refunds within the payment.
 */
export function reconcileProject(p: Project, ctx: { quotes: Quotation[]; payments: Payment[]; payables: Payable[]; refunds: Refund[] }): ReconIssue[] {
  const out: ReconIssue[] = [];
  const accepted = ctx.quotes.filter((q) => q.projectId === p.id && q.status === 'accepted');
  for (const q of accepted) {
    const total = acceptedTotal(q);
    const linked = p.milestones.filter((m) => m.quoteId === q.id);
    const ms = (linked.length ? linked : accepted.length === 1 ? p.milestones : []).filter((m) => m.status !== 'WAIVED');
    if (total === undefined || !ms.length) continue;
    const sum = ms.reduce((s, m) => s + m.amount, 0);
    if (sum !== total)
      out.push({ id: `ms_${q.id}`, projectId: p.id, kind: 'milestones', severity: 'high', title: `${p.code}: milestones don’t add up to ${q.number}`, detail: `Quote v${q.acceptedVersion ?? q.versions.length} total ${formatMoney(total)}, milestones ${formatMoney(sum)}`, diff: Math.abs(total - sum) });
  }
  for (const b of p.bookings) {
    if (b.status === 'CANCELLED') continue;
    if (b.agreedPrice !== b.providerPayable + b.platformFee)
      out.push({ id: `split_${b.id}`, projectId: p.id, kind: 'booking_split', severity: 'high', title: `${p.code}: ${b.providerName} split is off`, detail: `Price ${formatMoney(b.agreedPrice)} ≠ payable ${formatMoney(b.providerPayable)} + fee ${formatMoney(b.platformFee)}`, diff: Math.abs(b.agreedPrice - b.providerPayable - b.platformFee) });
    const pay = ctx.payables.filter((x) => x.bookingId === b.id && x.payeeKind === 'provider' && x.status !== 'CANCELLED');
    if (['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(b.status) && pay.length) {
      const sum = pay.reduce((s, x) => s + x.amount, 0);
      if (sum !== b.providerPayable)
        out.push({ id: `pay_${b.id}`, projectId: p.id, kind: 'payables', severity: 'high', title: `${p.code}: payouts to ${b.providerName} don’t match`, detail: `Payouts ${formatMoney(sum)} vs provider payable ${formatMoney(b.providerPayable)}`, diff: Math.abs(sum - b.providerPayable) });
    }
  }
  for (const m of p.milestones) {
    if (m.paidAmount > m.amount)
      out.push({ id: `over_${m.id}`, projectId: p.id, kind: 'overpaid', severity: 'medium', title: `${p.code}: ${m.label} over-collected`, detail: `Paid ${formatMoney(m.paidAmount)} on ${formatMoney(m.amount)}`, diff: m.paidAmount - m.amount });
    const received = ctx.payments.filter((x) => x.projectId === p.id && x.milestoneId === m.id && x.status !== 'FAILED' && x.status !== 'PENDING').reduce((s, x) => s + x.amount - (x.refunded ?? 0), 0);
    if (received > 0 && Math.abs(received - m.paidAmount) > 1)
      out.push({ id: `link_${m.id}`, projectId: p.id, kind: 'payment_link', severity: 'medium', title: `${p.code}: ${m.label} paid amount differs from receipts`, detail: `Receipts ${formatMoney(received)}, milestone shows ${formatMoney(m.paidAmount)}`, diff: Math.abs(received - m.paidAmount) });
  }
  for (const pay of ctx.payments.filter((x) => x.projectId === p.id)) {
    const refunded = ctx.refunds.filter((r) => r.paymentId === pay.id && r.status !== 'REJECTED').reduce((s, r) => s + r.amount, 0);
    if (refunded > pay.amount)
      out.push({ id: `rf_${pay.id}`, projectId: p.id, kind: 'refund', severity: 'high', title: `${p.code}: refunds exceed ${pay.receiptNo}`, detail: `Refunds ${formatMoney(refunded)} on a ${formatMoney(pay.amount)} payment`, diff: refunded - pay.amount });
  }
  return out;
}

// ─── Platform: commission simulator ─────────────────────────────────────────

export interface Rates {
  commissionRate: number;
  markupRate: number;
  leadFee: number;
}

/**
 * Platform fee on the same bookings under the current and proposed rates.
 * The provider's price is held fixed, so a markup change moves the couple's
 * price and a commission change moves the provider's payout.
 */
export function simulateRates(bookings: { pricingModel: PricingModel; agreedPrice: number; providerCost: number; platformFee: number }[], next: Rates) {
  const rateFor = (m: PricingModel) => (m === 'MARKUP' ? next.markupRate : m === 'LEAD_FEE' ? next.leadFee : m === 'COMMISSION' ? next.commissionRate : null);
  const byModel = new Map<PricingModel, { model: PricingModel; count: number; current: number; proposed: number; customer: number; provider: number }>();
  for (const b of bookings) {
    const rate = rateFor(b.pricingModel);
    const s = rate === null ? null : splitBooking(b.pricingModel, rate, b.pricingModel === 'MARKUP' ? { providerCost: b.providerCost } : { customerPrice: b.agreedPrice });
    const row = byModel.get(b.pricingModel) ?? { model: b.pricingModel, count: 0, current: 0, proposed: 0, customer: 0, provider: 0 };
    row.count += 1;
    row.current += b.platformFee;
    row.proposed += s ? s.platformFee : b.platformFee;
    row.customer += s ? s.agreedPrice - b.agreedPrice : 0;
    row.provider += s ? s.providerPayable - (b.agreedPrice - b.platformFee) : 0;
    byModel.set(b.pricingModel, row);
  }
  const rows = [...byModel.values()].map((r) => ({ ...r, current: roundMoney(r.current), proposed: roundMoney(r.proposed) }));
  const current = rows.reduce((s, r) => s + r.current, 0);
  const proposed = rows.reduce((s, r) => s + r.proposed, 0);
  return { rows, current, proposed, delta: proposed - current };
}

// ─── Platform: satisfaction ─────────────────────────────────────────────────

/**
 * Net promoter style score from star reviews: 5★ promoters, 4★ passive,
 * 3★ and below detractors. Also the average and star distribution.
 */
export function satisfaction(reviews: Pick<ReviewRecord, 'overall'>[]) {
  const stars = [1, 2, 3, 4, 5].map((n) => reviews.filter((r) => Math.round(r.overall) === n).length);
  const n = reviews.length;
  const promoters = reviews.filter((r) => r.overall >= 4.75).length;
  const detractors = reviews.filter((r) => r.overall < 3.75).length;
  return { count: n, average: n ? reviews.reduce((s, r) => s + r.overall, 0) / n : 0, stars, promoters, detractors, nps: n ? Math.round(((promoters - detractors) / n) * 100) : 0 };
}

// ─── Platform: listing quality ──────────────────────────────────────────────

export interface ListingSignals {
  verified: boolean;
  hasPhoto: boolean;
  styles: number;
  reviewCount: number;
  rating: number;
  responseMinutes: number;
  priceListed: boolean;
  languages: number;
  packages: number;
  portfolio: number;
}

/** Profile completeness and trust, 0–100, with what to fix first. */
export function listingQuality(s: ListingSignals) {
  const checks: { label: string; weight: number; ok: boolean }[] = [
    { label: 'Verified', weight: 20, ok: s.verified },
    { label: 'Cover photo', weight: 10, ok: s.hasPhoto },
    { label: 'Price listed', weight: 10, ok: s.priceListed },
    { label: 'Packages added', weight: 10, ok: s.packages > 0 },
    { label: 'Portfolio albums', weight: 10, ok: s.portfolio >= 3 },
    { label: 'Five or more reviews', weight: 15, ok: s.reviewCount >= 5 },
    { label: 'Rated 4.3 or higher', weight: 10, ok: s.rating >= 4.3 },
    { label: 'Replies within an hour', weight: 10, ok: s.responseMinutes <= 60 },
    { label: 'Styles and languages', weight: 5, ok: s.styles > 0 && s.languages > 0 },
  ];
  return { score: checks.reduce((n, c) => n + (c.ok ? c.weight : 0), 0), missing: checks.filter((c) => !c.ok).sort((a, b) => b.weight - a.weight).map((c) => c.label) };
}

// ─── Platform: peak-date capacity ───────────────────────────────────────────

/** Functions per date (live projects only) and how many need each service. */
export function busyDates(projects: Project[], fromIso: string, days: number) {
  const until = addDays(fromIso, days);
  const map = new Map<string, { date: string; functions: number; byService: Record<string, number>; cities: Set<string> }>();
  for (const p of projects) {
    if (['CANCELLED', 'QUOTE_REJECTED', 'CLOSED'].includes(p.status)) continue;
    for (const e of p.events) {
      if (!e.date || e.status === 'cancelled' || e.date < fromIso || e.date > until) continue;
      const row = map.get(e.date) ?? { date: e.date, functions: 0, byService: {}, cities: new Set<string>() };
      row.functions += 1;
      row.cities.add(e.city || p.city);
      for (const r of p.requirements) if (r.status !== 'CANCELLED' && r.eventIds.includes(e.id)) row.byService[r.serviceId] = (row.byService[r.serviceId] ?? 0) + 1;
      map.set(e.date, row);
    }
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Milestones still to collect for a project (not paid or waived). */
export const openMilestones = (p: Project) => p.milestones.filter((m) => !['PAID', 'WAIVED'].includes(milestoneStatus(m)));
