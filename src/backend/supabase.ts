/**
 * The Supabase backend: each core-loop step is one RPC from
 * supabase/migrations/0011_core_rpc.sql, called over PostgREST with plain
 * fetch (no SDK until auth lands in P6). The server checks permissions,
 * computes money and writes the audit log; this adapter only converts rupees
 * to paisa and app enums to SQL enums.
 *
 * RLS needs a signed-in user: until P6 wires Supabase Auth, pass the access
 * token with setAccessToken(); without one every call is refused.
 */
import { ENV } from '@/constants/env';
import type { PaymentMethod } from '@/types/platform';

import { type Backend, failResult, okResult, type Result } from './types';

let accessToken: string | null = null;

/** The signed-in user's JWT (set by the auth layer in P6). */
export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

const METHOD: Record<PaymentMethod, string> = {
  esewa: 'ESEWA',
  khalti: 'KHALTI',
  fonepay: 'FONEPAY_QR',
  connect_ips: 'CONNECT_IPS',
  ime_pay: 'IME_PAY',
  bank_transfer: 'BANK_TRANSFER',
  card: 'CARD',
  cash: 'CASH',
};

const paisa = (rupees: number) => Math.round(rupees * 100);

/** Calls one RPC; a Postgres refusal comes back as its message. */
export async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<Result<T>> {
  if (!ENV.supabaseUrl || !ENV.supabasePublishableKey) return failResult('The Supabase backend isn’t configured (EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY)');
  if (!accessToken) return failResult('Sign in again to continue');
  try {
    const res = await fetch(`${ENV.supabaseUrl}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: ENV.supabasePublishableKey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    const text = await res.text();
    const body: unknown = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const message = body && typeof body === 'object' && 'message' in body ? String((body as { message: unknown }).message) : '';
      return failResult(message || `Request failed (${res.status})`);
    }
    return okResult(body as T);
  } catch {
    return failResult('No connection. Check your internet and try again.');
  }
}

const unit = <T>(r: Result<T>): Result<void> => (r.ok ? okResult(undefined) : r);

export const supabaseBackend: Backend = {
  kind: 'supabase',
  submitPlan: (input) => rpc<string>('rpc_submit_plan', { p_input: input }),
  setProjectStatus: async (projectId, status, note) => unit(await rpc('rpc_set_project_status', { p_project: projectId, p_status: status, p_note: note ?? null })),
  assignCoordinator: async (projectId, coordinatorId) => unit(await rpc('rpc_assign_coordinator', { p_project: projectId, p_coordinator: coordinatorId })),
  sendQuote: async (quoteId, changeSummary) => unit(await rpc('rpc_send_quote', { p_quote: quoteId, p_change_summary: changeSummary ?? null })),
  reviseQuote: (quoteId) => rpc<number>('rpc_revise_quote', { p_quote: quoteId }),
  respondToQuote: async (quoteId, action, note) => unit(await rpc('rpc_respond_to_quote', { p_quote: quoteId, p_action: action, p_note: note ?? null })),
  confirmBooking: async (_projectId, bookingId) => unit(await rpc('rpc_confirm_booking', { p_booking: bookingId })),
  cancelBooking: async (_projectId, bookingId, reason) => unit(await rpc('rpc_cancel_booking', { p_booking: bookingId, p_reason: reason })),
  recordPayment: (_projectId, milestoneId, amount, method, reference) =>
    rpc<string>('rpc_record_payment', { p_milestone: milestoneId, p_amount: paisa(amount), p_method: METHOD[method], p_gateway_ref: reference ?? null }),
  releasePayable: async (payableId, kind, reference) => unit(await rpc('rpc_release_payable', { p_kind: kind, p_payable: payableId, p_reference: reference ?? null })),
  requestRefund: (paymentId, amount, reason) => rpc<string>('rpc_request_refund', { p_payment: paymentId, p_amount: paisa(amount), p_reason: reason }),
  decideRefund: async (refundId, approve) => unit(await rpc('rpc_decide_refund', { p_refund: refundId, p_approve: approve })),
};
