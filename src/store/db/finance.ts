/**
 * Customer payments (milestones → payments → receipts) and payouts
 * (payables → releases) are separate ledgers; disputes can freeze payouts.
 */
import { milestoneStatus } from '@/services/pricing';
import type { Dispute, Invoice, Payment, PaymentMethod, Refund } from '@/types/platform';
import { formatMoney, uid } from '@/utils/format';

import { accountById, currentActor, type GetDb, mapProject, nextNumber, now, type SetDb } from './helpers';
import { staffDenied, staffOnly } from './personas';

export interface FinanceActions {
  payMilestone: (projectId: string, milestoneId: string, amount: number, method: PaymentMethod, payerName: string) => Payment | null;
  /** Staff with refund approval only. Returns an error to show, or null. */
  waiveMilestone: (projectId: string, milestoneId: string) => string | null;
  /** Finance and super admins only (`payout.release`). Returns an error to show, or null. */
  releasePayable: (id: string, reference?: string) => string | null;
  holdPayable: (id: string, reason: string) => string | null;
  markPayableReady: (id: string) => void;
  /** Open and processed refunds of a payment never exceed it. Returns an error to show, or null. */
  requestRefund: (paymentId: string, amount: number, reason: string) => string | null;
  /** Finance and admins only (`refund.approve`). Returns an error to show, or null. */
  decideRefund: (id: string, approve: boolean) => string | null;
  raiseDispute: (input: Omit<Dispute, 'id' | 'at' | 'status' | 'log' | 'paymentFrozen'> & { freeze?: boolean }) => Dispute;
  updateDispute: (id: string, status: Dispute['status'], note: string, opts?: { resolution?: string; unfreeze?: boolean }) => string | null;
  saveInvoice: (invoice: Invoice) => void;
  contribute: (itemId: string, name: string, amount: number, method: PaymentMethod, message?: string) => void;
}

const METHOD_PREFIX: Record<PaymentMethod, string> = {
  esewa: 'ESW',
  khalti: 'KHT',
  fonepay: 'FNP',
  connect_ips: 'CIPS',
  ime_pay: 'IME',
  bank_transfer: 'BANK',
  card: 'CARD',
  cash: 'CASH',
};

const reference = (method: PaymentMethod) => `${METHOD_PREFIX[method]}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

export const financeActions = (set: SetDb, get: GetDb): FinanceActions => ({
  payMilestone: (projectId, milestoneId, amount, method, payerName) => {
    // Cash is recorded by finance staff only (AGENTS.md §1); everyone else pays through a gateway.
    if (method === 'cash' && staffOnly('payment.record_cash', get)) return null;
    const project = get().projects.find((p) => p.id === projectId);
    const milestone = project?.milestones.find((m) => m.id === milestoneId);
    if (!project || !milestone || amount <= 0) return null;
    const payment: Payment = {
      id: uid('pmt'),
      projectId,
      milestoneId,
      amount,
      method,
      reference: reference(method),
      receiptNo: nextNumber('RCPT', get().payments.map((p) => p.receiptNo)),
      status: 'SUCCEEDED',
      refunded: 0,
      payerName,
      at: now(),
    };
    set((s) => ({
      payments: [payment, ...s.payments],
      projects: mapProject(s.projects, projectId, (p) => ({
        ...p,
        milestones: p.milestones.map((m) => {
          if (m.id !== milestoneId) return m;
          const paidAmount = Math.min(m.amount, m.paidAmount + amount);
          return { ...m, paidAmount, status: milestoneStatus({ ...m, paidAmount }) };
        }),
      })),
      files: [
        { id: uid('f'), projectId, folder: '06-Invoices', name: `Receipt ${payment.receiptNo}.pdf`, kind: 'pdf', storage: 'drive', visibility: 'customer', uploadedBy: 'System', at: now() },
        ...s.files,
      ],
    }));
    get().notify(project.coordinatorId ?? 'platform', `Payment received · ${project.code}`, `${payerName} paid ${formatMoney(amount)} via ${method.replace('_', ' ')}`, `/platform/project/${projectId}?tab=payments`, 'payment');
    if (currentActor().id !== project.customerId) {
      get().notify(project.customerId, 'Payment recorded', `${formatMoney(amount)} · receipt ${payment.receiptNo}`, '/my-wedding?tab=payments', 'payment');
    }
    get().log({ id: 'gateway', name: method }, 'payment.succeeded', 'payment', payment.id, `${formatMoney(amount)} for ${milestone.label}`);
    return payment;
  },

  waiveMilestone: (projectId, milestoneId) => {
    const denied = staffOnly('refund.approve', get);
    if (denied) return denied;
    set((s) => ({ projects: mapProject(s.projects, projectId, (p) => ({ ...p, milestones: p.milestones.map((m) => (m.id === milestoneId ? { ...m, status: 'WAIVED' } : m)) })) }));
    get().log(currentActor(), 'milestone.waive', 'project', projectId, milestoneId);
    return null;
  },

  releasePayable: (id, ref) => {
    const denied = staffOnly('payout.release', get);
    if (denied) return denied;
    const payable = get().payables.find((p) => p.id === id);
    if (!payable) return 'This payout no longer exists';
    if (payable.status === 'PAID' || payable.status === 'ON_HOLD' || payable.status === 'CANCELLED') return `This payout is ${payable.status.toLowerCase().replace('_', ' ')} and can’t be released`;
    set((s) => ({ payables: s.payables.map((p) => (p.id === id ? { ...p, status: 'PAID', paidAt: now(), reference: ref ?? reference('bank_transfer') } : p)) }));
    const to = payable.payeeKind === 'freelancer' ? payable.payeeId : (accountById(payable.payeeId)?.id ?? payable.payeeId);
    get().notify(to, 'Payout released', `${formatMoney(payable.amount)} · ${payable.label}`, payable.payeeKind === 'freelancer' ? '/freelancer/earnings' : '/business/finance', 'payment');
    get().log(currentActor(), 'payable.release', 'payable', id, formatMoney(payable.amount));
    return null;
  },

  holdPayable: (id, reason) => {
    const denied = staffOnly(['payout.release', 'refund.approve'], get);
    if (denied) return denied;
    set((s) => ({ payables: s.payables.map((p) => (p.id === id && p.status !== 'PAID' ? { ...p, status: 'ON_HOLD', holdReason: reason } : p)) }));
    get().log(currentActor(), 'payable.hold', 'payable', id, reason);
    return null;
  },

  markPayableReady: (id) => set((s) => ({ payables: s.payables.map((p) => (p.id === id && p.status !== 'PAID' ? { ...p, status: 'READY', holdReason: undefined } : p)) })),

  requestRefund: (paymentId, amount, reason) => {
    const payment = get().payments.find((p) => p.id === paymentId);
    if (!payment) return 'This payment no longer exists';
    const value = Math.round(amount);
    if (!(value > 0)) return 'Enter an amount above zero';
    if (!reason.trim()) return 'Give a reason for the refund';
    // Mirrors cap_refunds() in 0010: requests still open count too, so the same money can't be asked for twice.
    const taken = get().refunds.filter((r) => r.paymentId === paymentId && r.status !== 'REJECTED').reduce((s, r) => s + r.amount, 0);
    if (taken + value > payment.amount) return `Refunds would exceed the payment: ${formatMoney(taken)} of ${formatMoney(payment.amount)} is already refunded or requested`;
    const refund: Refund = { id: uid('rf'), paymentId, projectId: payment.projectId, amount: value, reason: reason.trim(), status: 'REQUESTED', requestedBy: currentActor().name, at: now() };
    set((s) => ({ refunds: [refund, ...s.refunds] }));
    get().notify('platform', 'Refund requested', `${formatMoney(value)} · ${reason.trim()}`, '/platform/finance?tab=refunds', 'payment');
    return null;
  },

  decideRefund: (id, approve) => {
    const denied = staffOnly('refund.approve', get);
    if (denied) return denied;
    const refund = get().refunds.find((r) => r.id === id);
    if (!refund) return 'This refund request no longer exists';
    set((s) => ({
      refunds: s.refunds.map((r) => (r.id === id ? { ...r, status: approve ? 'PROCESSED' : 'REJECTED', processedAt: now() } : r)),
      payments: approve
        ? s.payments.map((p) => {
            if (p.id !== refund.paymentId) return p;
            const refunded = p.refunded + refund.amount;
            return { ...p, refunded, status: refunded >= p.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED' };
          })
        : s.payments,
    }));
    const project = get().projects.find((p) => p.id === refund.projectId);
    if (project) get().notify(project.customerId, approve ? 'Refund processed' : 'Refund declined', `${formatMoney(refund.amount)} · ${refund.reason}`, '/my-wedding?tab=payments', 'payment');
    get().log(currentActor(), approve ? 'refund.process' : 'refund.reject', 'refund', id, formatMoney(refund.amount));
    return null;
  },

  raiseDispute: (input) => {
    const dispute: Dispute = { ...input, id: uid('dsp'), at: now(), status: 'OPEN', paymentFrozen: !!input.freeze, log: [{ at: now(), by: input.raisedByName, text: `Raised: ${input.reason}` }] };
    set((s) => ({
      disputes: [dispute, ...s.disputes],
      payables: input.freeze && input.bookingId ? s.payables.map((p) => (p.bookingId === input.bookingId && p.status !== 'PAID' ? { ...p, status: 'ON_HOLD', holdReason: 'Dispute open' } : p)) : s.payables,
    }));
    const project = get().projects.find((p) => p.id === input.projectId);
    get().notify(project?.coordinatorId ?? 'platform', `Dispute opened · ${project?.code ?? ''}`, input.reason, `/platform/finance?tab=disputes`, 'payment');
    return dispute;
  },

  updateDispute: (id, status, note, opts = {}) => {
    const denied = staffDenied(['refund.approve', 'incident.manage'], get);
    if (denied) return denied;
    const dispute = get().disputes.find((d) => d.id === id);
    if (!dispute) return 'This dispute no longer exists';
    const actor = currentActor();
    set((s) => ({
      disputes: s.disputes.map((d) =>
        d.id === id ? { ...d, status, resolution: opts.resolution ?? d.resolution, paymentFrozen: opts.unfreeze ? false : d.paymentFrozen, log: [...d.log, { at: now(), by: actor.name, text: note }] } : d,
      ),
      payables: opts.unfreeze && dispute.bookingId ? s.payables.map((p) => (p.bookingId === dispute.bookingId && p.status === 'ON_HOLD' ? { ...p, status: 'READY', holdReason: undefined } : p)) : s.payables,
    }));
    get().notify(dispute.raisedById, `Dispute ${status.toLowerCase()}`, note, undefined, 'payment');
    get().log(actor, 'dispute.update', 'dispute', id, status);
    return null;
  },

  saveInvoice: (invoice) =>
    set((s) => ({ invoices: s.invoices.some((i) => i.id === invoice.id) ? s.invoices.map((i) => (i.id === invoice.id ? invoice : i)) : [invoice, ...s.invoices] })),

  contribute: (itemId, name, amount, method, message) => {
    const item = get().registry.find((r) => r.id === itemId);
    if (!item) return;
    const payment: Payment = {
      id: uid('pmt'),
      projectId: item.projectId,
      registryItemId: itemId,
      amount,
      method,
      reference: reference(method),
      receiptNo: nextNumber('GIFT', get().payments.map((p) => p.receiptNo)),
      status: 'SUCCEEDED',
      refunded: 0,
      payerName: name,
      at: now(),
    };
    set((s) => ({
      payments: [payment, ...s.payments],
      registry: s.registry.map((r) => (r.id === itemId ? { ...r, contributions: [...r.contributions, { id: uid('c'), name, amount, message, at: now(), thanked: false }] } : r)),
    }));
    const project = get().projects.find((p) => p.id === item.projectId);
    if (project) get().notify(project.customerId, `${name} contributed`, `${formatMoney(amount)} to ${item.title}${message ? ` — “${message}”` : ''}`, '/registry', 'payment');
  },
});
