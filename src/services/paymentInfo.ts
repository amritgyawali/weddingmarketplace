/**
 * Plain-words payment information shared by the payment sheet, the receipts
 * list and the printable receipt: method names, what each status means, when
 * an instalment is due and what a payment covers. Pure: no React, no store.
 */
import { milestoneStatus, paymentSummary } from '@/services/pricing';
import type { MilestoneStatus, Payment, PaymentMethod, PaymentMilestone, Project } from '@/types/platform';
import { daysUntil, formatLongDate, formatNpr } from '@/utils/format';

/**
 * Seconds a payment screen stays open. If the payment isn't finished in time
 * the attempt is rejected (nothing is charged) and the person starts again,
 * so a stale amount or QR code is never paid.
 */
export const PAYMENT_WINDOW_SECONDS = 30;

/** Seconds left as "0:27". */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Method names as people know them. */
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  esewa: 'eSewa',
  khalti: 'Khalti',
  fonepay: 'Fonepay QR',
  connect_ips: 'ConnectIPS',
  ime_pay: 'IME Pay',
  card: 'Visa / Mastercard',
  bank_transfer: 'Bank transfer',
  cash: 'Cash',
};

/** What a payment record's status means, in one short label and one sentence. */
export const PAYMENT_STATUS_TEXT: Record<Payment['status'], { label: string; detail: string }> = {
  SUCCEEDED: { label: 'Successful', detail: 'Received in full and counted towards your payment plan.' },
  PENDING: { label: 'Being confirmed', detail: 'We’re waiting for the bank or wallet to confirm. This usually takes a few minutes.' },
  FAILED: { label: 'Failed', detail: 'The payment didn’t go through and nothing was charged. You can pay again.' },
  REFUNDED: { label: 'Refunded', detail: 'The full amount has been returned to you.' },
  PARTIALLY_REFUNDED: { label: 'Partly refunded', detail: 'Part of this payment has been returned to you.' },
};

/** Instalment status words for people (the enum stays as it is). */
export const MILESTONE_STATUS_TEXT: Record<MilestoneStatus, string> = {
  UPCOMING: 'Upcoming',
  DUE: 'Due soon',
  OVERDUE: 'Overdue',
  PARTIALLY_PAID: 'Partly paid',
  PAID: 'Paid',
  WAIVED: 'Waived',
};

/** "Due in 5 days", "Due today", "Overdue by 3 days", "Paid in full". */
export function milestoneDueText(m: PaymentMilestone): string {
  const status = milestoneStatus(m);
  if (status === 'PAID') return 'Paid in full';
  if (status === 'WAIVED') return 'Waived, nothing to pay';
  const d = daysUntil(m.due);
  if (d < 0) return `Overdue by ${-d} ${-d === 1 ? 'day' : 'days'}`;
  if (d === 0) return 'Due today';
  if (d === 1) return 'Due tomorrow';
  return `Due in ${d} days`;
}

/** One line on what an instalment is for, from its schedule rule. */
export function milestonePurpose(m: PaymentMilestone): string {
  switch (m.rule) {
    case 'on_confirmation':
      return 'Secures your bookings and blocks the dates with every provider.';
    case 'days_before_event':
      return 'Lets providers buy materials and prepare for your celebration.';
    case 'on_event_day':
      return 'Paid on the day, as the celebration takes place.';
    case 'after_completion':
      return 'The final balance, paid once everything has been delivered.';
    default:
      return 'Part of the payment plan in your accepted quotation.';
  }
}

/** A label and a value, for the "What you’re paying for" box and the receipt. */
export interface PaymentDetail {
  label: string;
  value: string;
}

/** Everything a couple should see before paying an instalment. Amounts are NPR (what is charged). */
export function milestonePaymentDetails(project: Project, m: PaymentMilestone, payNow: number): PaymentDetail[] {
  const summary = paymentSummary(project);
  const outstanding = Math.max(0, m.amount - m.paidAmount);
  const afterThis = Math.max(0, summary.outstanding - payNow);
  const rows: PaymentDetail[] = [
    { label: 'Celebration', value: `${project.title} · ${project.code}` },
    { label: 'Instalment', value: m.percent ? `${m.label} (${m.percent}% of the total)` : m.label },
    { label: 'Due date', value: `${formatLongDate(m.due)} · ${milestoneDueText(m)}` },
    { label: 'Instalment amount', value: formatNpr(m.amount) },
  ];
  if (m.paidAmount > 0) rows.push({ label: 'Already paid', value: formatNpr(m.paidAmount) });
  if (payNow < outstanding) rows.push({ label: 'Left on this instalment after paying', value: formatNpr(outstanding - payNow) });
  rows.push({ label: 'Total for the celebration', value: `${formatNpr(summary.total)} incl. 13% VAT` });
  rows.push({ label: 'Still to pay after this', value: formatNpr(afterThis) });
  if (project.coordinatorName) rows.push({ label: 'Your coordinator', value: project.coordinatorName });
  return rows;
}
