/**
 * Marketplace economics: the four business models, payment schedules,
 * milestone status and payables. Customer payments and provider/freelancer
 * payouts are computed separately and never share a record.
 */
import type {
  MilestoneStatus,
  Payable,
  PaymentMilestone,
  PricingModel,
  Project,
  ScheduleStep,
  ServiceBooking,
} from '@/types/platform';
import { daysUntil, fromISODate, toISODate, uid } from '@/utils/format';

/** Nepal VAT. */
export const VAT_RATE = 0.13;

export const PRICING_MODELS: { id: PricingModel; label: string; blurb: string; defaultRate: number; rateLabel: string }[] = [
  { id: 'COMMISSION', label: 'Commission', blurb: 'Customer pays the listed price; platform keeps a %', defaultRate: 0.1, rateLabel: 'Commission %' },
  { id: 'MARKUP', label: 'Markup', blurb: 'Provider quotes the platform; platform resells higher', defaultRate: 0.15, rateLabel: 'Markup %' },
  { id: 'LEAD_FEE', label: 'Lead fee', blurb: 'Provider pays a flat fee per qualified lead', defaultRate: 2000, rateLabel: 'Fee (NPR)' },
  { id: 'FREELANCER_MARGIN', label: 'Freelancer margin', blurb: 'Crew pay minus platform margin', defaultRate: 0.2, rateLabel: 'Margin %' },
];

export const pricingModel = (id: PricingModel) => PRICING_MODELS.find((m) => m.id === id)!;

export interface Split {
  agreedPrice: number;
  providerCost: number;
  platformFee: number;
  providerPayable: number;
}

/**
 * Split one booking.
 *  A  COMMISSION        customer 100,000 → provider 90,000, platform 10,000
 *  B  MARKUP            provider 70,000 → customer 80,500 (15%), platform 10,500
 *  C  LEAD_FEE          customer pays provider price; platform nets a flat fee
 *  D  FREELANCER_MARGIN client 10,000 → freelancer 8,000, platform 2,000
 */
export function splitBooking(model: PricingModel, rate: number, amounts: { customerPrice?: number; providerCost?: number }): Split {
  switch (model) {
    case 'MARKUP': {
      const providerCost = Math.round(amounts.providerCost ?? amounts.customerPrice ?? 0);
      const agreedPrice = Math.round(providerCost * (1 + rate));
      return { agreedPrice, providerCost, platformFee: agreedPrice - providerCost, providerPayable: providerCost };
    }
    case 'LEAD_FEE': {
      const agreedPrice = Math.round(amounts.customerPrice ?? amounts.providerCost ?? 0);
      const fee = Math.min(agreedPrice, Math.round(rate));
      return { agreedPrice, providerCost: agreedPrice, platformFee: fee, providerPayable: agreedPrice - fee };
    }
    case 'COMMISSION':
    case 'FREELANCER_MARGIN':
    default: {
      const agreedPrice = Math.round(amounts.customerPrice ?? amounts.providerCost ?? 0);
      const platformFee = Math.round(agreedPrice * rate);
      return { agreedPrice, providerCost: agreedPrice, platformFee, providerPayable: agreedPrice - platformFee };
    }
  }
}

/** Freelancer pay after the platform margin (model D). */
export const freelancerNet = (clientPay: number, margin = 0.2) => ({ pay: Math.round(clientPay * (1 - margin)), margin: Math.round(clientPay * margin) });

// Payment schedules
export const SCHEDULE_TEMPLATES: { id: string; label: string; steps: ScheduleStep[] }[] = [
  {
    id: '30-50-20',
    label: '30% · 50% · 20%',
    steps: [
      { label: 'Booking confirmation', percent: 30, rule: 'on_confirmation' },
      { label: '15 days before event', percent: 50, rule: 'days_before_event', days: 15 },
      { label: 'After completion', percent: 20, rule: 'after_completion', days: 3 },
    ],
  },
  {
    id: '50-50',
    label: '50% · 50%',
    steps: [
      { label: 'Booking confirmation', percent: 50, rule: 'on_confirmation' },
      { label: '7 days before event', percent: 50, rule: 'days_before_event', days: 7 },
    ],
  },
  {
    id: '25-25-40-10',
    label: '25% · 25% · 40% · 10%',
    steps: [
      { label: 'Booking confirmation', percent: 25, rule: 'on_confirmation' },
      { label: '60 days before event', percent: 25, rule: 'days_before_event', days: 60 },
      { label: '10 days before event', percent: 40, rule: 'days_before_event', days: 10 },
      { label: 'After delivery', percent: 10, rule: 'after_completion', days: 30 },
    ],
  },
  { id: 'full', label: 'Full payment', steps: [{ label: 'Full payment on confirmation', percent: 100, rule: 'on_confirmation' }] },
];

export const DEFAULT_SCHEDULE = SCHEDULE_TEMPLATES[0].steps;

const shift = (iso: string, days: number) => {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
};

export function dueDateFor(step: ScheduleStep, dates: { confirmed: string; event: string; lastEvent?: string }): string {
  switch (step.rule) {
    case 'on_confirmation':
      return shift(dates.confirmed, step.days ?? 3);
    case 'days_before_event': {
      const due = shift(dates.event, -(step.days ?? 7));
      return due < dates.confirmed ? shift(dates.confirmed, 3) : due;
    }
    case 'on_event_day':
      return dates.event;
    case 'after_completion':
      return shift(dates.lastEvent ?? dates.event, step.days ?? 3);
    default:
      return dates.event;
  }
}

/** Milestones for a total; the last step absorbs rounding so amounts sum exactly. */
export function buildMilestones(steps: ScheduleStep[], total: number, dates: { confirmed: string; event: string; lastEvent?: string }, quoteId?: string): PaymentMilestone[] {
  let allocated = 0;
  return steps.map((step, i) => {
    const amount = i === steps.length - 1 ? total - allocated : Math.round((total * step.percent) / 100);
    allocated += amount;
    const due = dueDateFor(step, dates);
    return {
      id: uid('pm'),
      label: step.label,
      percent: step.percent,
      amount,
      due,
      rule: step.rule,
      status: milestoneStatus({ due, amount, paidAmount: 0, status: 'UPCOMING' }),
      paidAmount: 0,
      quoteId,
    };
  });
}

/** Recomputed status: due within 7 days → DUE, past due → OVERDUE. */
export function milestoneStatus(m: Pick<PaymentMilestone, 'due' | 'amount' | 'paidAmount' | 'status'>): MilestoneStatus {
  if (m.status === 'WAIVED') return 'WAIVED';
  if (m.paidAmount >= m.amount) return 'PAID';
  const days = daysUntil(m.due);
  if (days < 0) return 'OVERDUE';
  if (m.paidAmount > 0) return 'PARTIALLY_PAID';
  return days <= 7 ? 'DUE' : 'UPCOMING';
}

export function paymentSummary(project: Pick<Project, 'milestones'>) {
  const total = project.milestones.reduce((s, m) => s + (m.status === 'WAIVED' ? 0 : m.amount), 0);
  const paid = project.milestones.reduce((s, m) => s + m.paidAmount, 0);
  const next = project.milestones
    .filter((m) => milestoneStatus(m) !== 'PAID' && m.status !== 'WAIVED')
    .sort((a, b) => a.due.localeCompare(b.due))[0];
  const overdue = project.milestones.filter((m) => milestoneStatus(m) === 'OVERDUE');
  return { total, paid, outstanding: Math.max(0, total - paid), next, overdue };
}

// Payables
/**
 * Provider payables for a confirmed booking: 40% released before the event
 * (so vendors can buy materials) and 60% after the event is completed. Held
 * automatically while a dispute is open.
 */
export function payablesForBooking(booking: ServiceBooking, project: Project): Payable[] {
  const firstEvent = project.events
    .filter((e) => booking.eventIds.includes(e.id) && e.date)
    .map((e) => e.date!)
    .sort()[0] ?? project.weddingDate;
  const before = Math.round(booking.providerPayable * 0.4);
  const base = {
    payeeKind: 'provider' as const,
    payeeId: booking.providerAccountId ?? booking.providerId,
    payeeName: booking.providerName,
    projectId: project.id,
    bookingId: booking.id,
  };
  return [
    { ...base, id: uid('pay'), label: `${booking.providerName} — pre-event release (40%)`, amount: before, status: 'ACCRUED', release: 'before_event', due: shift(firstEvent, -7) },
    { ...base, id: uid('pay'), label: `${booking.providerName} — final settlement (60%)`, amount: booking.providerPayable - before, status: 'ACCRUED', release: 'after_event', due: shift(firstEvent, 3) },
  ];
}

/** Payables that are now releasable given today's date and event state. */
export function releasable(p: Payable, project?: Project): boolean {
  if (p.status !== 'ACCRUED' && p.status !== 'READY') return false;
  if (p.release === 'after_event' && project) {
    const events = project.events.filter((e) => e.status !== 'cancelled');
    return events.length > 0 && events.every((e) => e.status === 'done' || (e.date && daysUntil(e.date) < 0));
  }
  return daysUntil(p.due) <= 0;
}

/** Project-level economics for the coordinator console. */
export function projectEconomics(project: Project) {
  const active = project.bookings.filter((b) => b.status !== 'CANCELLED');
  const gmv = active.reduce((s, b) => s + b.agreedPrice, 0);
  const providerCost = active.reduce((s, b) => s + b.providerPayable, 0);
  const platformFees = active.reduce((s, b) => s + b.platformFee, 0);
  const crewPay = active.flatMap((b) => b.assignments).filter((a) => a.status !== 'CANCELLED' && a.status !== 'EMERGENCY_REPLACEMENT').reduce((s, a) => s + a.pay, 0);
  const crewMargin = active.flatMap((b) => b.assignments).reduce((s, a) => s + a.margin, 0);
  return { gmv, providerCost, platformFees, crewPay, crewMargin, takeRate: gmv ? (platformFees + crewMargin) / gmv : 0 };
}
