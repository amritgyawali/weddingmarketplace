/**
 * The demo backend: the on-device zustand store. Store actions stay the
 * source of truth for the demo and Expo Go; this adapter only gives them the
 * Backend shape (a Result instead of a void or an error string).
 */
import { useDb } from '@/store/useDb';
import { useSession } from '@/store/useSession';

import { type Backend, failResult, okResult, type Result } from './types';

const done = (error: string | null | undefined): Result<void> => (error ? failResult(error) : okResult(undefined));

const signedIn = () => {
  const s = useSession.getState();
  return s.accounts.find((a) => a.id === s.session?.accountId);
};

export const mockBackend: Backend = {
  kind: 'mock',
  async submitPlan(input) {
    const account = signedIn();
    if (!account || account.role !== 'customer') return failResult('Sign in as a couple to plan a celebration');
    return okResult(useDb.getState().submitPlan(account, input).id);
  },
  async setProjectStatus(projectId, status, note) {
    return done(useDb.getState().setProjectStatus(projectId, status, note));
  },
  async assignCoordinator(projectId, coordinatorId) {
    const coordinator = useSession.getState().accounts.find((a) => a.id === coordinatorId && a.role === 'platform');
    if (!coordinator) return failResult('Pick a coordinator from the operations team');
    return done(useDb.getState().assignCoordinator(projectId, { id: coordinator.id, name: coordinator.name }));
  },
  async sendQuote(quoteId, changeSummary) {
    return done(useDb.getState().sendQuote(quoteId, changeSummary));
  },
  async reviseQuote(quoteId) {
    useDb.getState().reviseQuote(quoteId);
    const quote = useDb.getState().quotes.find((q) => q.id === quoteId);
    return quote ? okResult(quote.version) : failResult('This quotation no longer exists');
  },
  async respondToQuote(quoteId, action, note) {
    if (!useDb.getState().quotes.some((q) => q.id === quoteId)) return failResult('This quotation no longer exists');
    useDb.getState().respondToQuote(quoteId, action, note);
    return okResult(undefined);
  },
  async confirmBooking(projectId, bookingId) {
    useDb.getState().confirmBooking(projectId, bookingId);
    return okResult(undefined);
  },
  async cancelBooking(projectId, bookingId, reason) {
    if (!reason.trim()) return failResult('Give a reason for the cancellation');
    useDb.getState().cancelBooking(projectId, bookingId, reason);
    return okResult(undefined);
  },
  async recordPayment(projectId, milestoneId, amount, method) {
    const project = useDb.getState().projects.find((p) => p.id === projectId);
    const payment = useDb.getState().payMilestone(projectId, milestoneId, amount, method, project?.customerName ?? 'Customer');
    return payment ? okResult(payment.id) : failResult('The payment could not be recorded');
  },
  async releasePayable(payableId, _kind, reference) {
    return done(useDb.getState().releasePayable(payableId, reference));
  },
  async requestRefund(paymentId, amount, reason) {
    const error = useDb.getState().requestRefund(paymentId, amount, reason);
    return error ? failResult(error) : okResult(null);
  },
  async decideRefund(refundId, approve) {
    return done(useDb.getState().decideRefund(refundId, approve));
  },
};
