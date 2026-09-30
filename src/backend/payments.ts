/**
 * Online payments with Khalti and eSewa (master plan §7.5). The app never
 * decides that money arrived: payment-initiate starts an attempt whose amount
 * the server works out, the couple pays on the gateway, and payment-verify asks
 * the gateway before anything is recorded. The gateway sends the browser back
 * to /pay/result (web) or vivah://pay/result (phones), which checks the
 * attempt again, so a lost redirect never loses a payment.
 *
 * With the mock backend none of this runs: the demo keeps its simulated
 * gateways in PaymentSheet.
 */
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { ENV, usesSupabase } from '@/constants/env';
import type { PaymentMethod } from '@/types/platform';

import { getAccessToken } from './auth';
import { failResult, okResult, type Result } from './types';

export type Gateway = Extract<PaymentMethod, 'khalti' | 'esewa'>;

/** Gateways this build can take real (sandbox or live) payments with. */
export const ONLINE_GATEWAYS: Gateway[] = ['khalti', 'esewa'];

export const isOnlineGateway = (m: PaymentMethod): m is Gateway => (ONLINE_GATEWAYS as PaymentMethod[]).includes(m);

/** True when payments go through the real gateways instead of the demo. */
export const onlinePaymentsReady = () => usesSupabase();

/** Where the gateway sends the couple back to (checked against an allow-list on the server). */
export const paymentReturnUrl = () =>
  Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.origin}/pay/result` : Linking.createURL('pay/result');

export type PaymentState = 'completed' | 'pending' | 'initiated' | 'failed' | 'cancelled' | 'expired' | 'refund_due' | 'checking' | 'unknown';

export interface Started {
  intent: string;
  gateway: Gateway;
  /** Rupees, as the server worked it out. */
  amount: number;
  url: string;
  form?: { action: string; fields: Record<string, string> };
}

export interface Checked {
  status: PaymentState;
  receiptNo: string | null;
  amount: number;
  problem?: string | null;
}

async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<Result<T>> {
  if (!ENV.supabaseUrl) return failResult('Online payments aren’t set up in this build');
  const token = await getAccessToken();
  if (!token) return failResult('Sign in again to pay');
  try {
    const res = await fetch(`${ENV.supabaseUrl}/functions/v1/${name}`, {
      method: 'POST',
      headers: { apikey: ENV.supabasePublishableKey ?? '', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const out = (await res.json().catch(() => ({}))) as T & { message?: string };
    if (!res.ok) return failResult(out.message || `Payment request failed (${res.status})`);
    return okResult(out);
  } catch {
    return failResult('No connection. Check your internet and try again.');
  }
}

/** Posts eSewa's signed form from the web page itself (eSewa only accepts a form POST). */
function submitForm(form: NonNullable<Started['form']>) {
  const el = document.createElement('form');
  el.method = 'POST';
  el.action = form.action;
  for (const [name, value] of Object.entries(form.fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    el.appendChild(input);
  }
  document.body.appendChild(el);
  el.submit();
}

/**
 * Starts paying a milestone and opens the gateway. `amount` (rupees) is only a
 * request for a part payment; the server caps it at what is owed.
 */
export async function startOnlinePayment(milestoneId: string, gateway: Gateway, amount?: number): Promise<Result<Started>> {
  const started = await callFunction<Started>('payment-initiate', { milestoneId, method: gateway, amount: amount ?? null, returnTo: paymentReturnUrl() });
  if (!started.ok) return started;
  const s = started.value;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (s.form) submitForm(s.form);
    else window.location.assign(s.url);
  } else {
    await Linking.openURL(s.url);
  }
  return started;
}

/** Asks the server to check an attempt with the gateway again (after a return, or "check again"). */
export async function checkOnlinePayment(intent: string): Promise<Result<Checked>> {
  const out = await callFunction<Omit<Checked, 'status'> & { status: string }>('payment-verify', { intent });
  return out.ok ? okResult({ ...out.value, status: out.value.status.toLowerCase() as PaymentState }) : out;
}

/** Words for a result, shared by the sheet and the result screen. */
export const PAYMENT_STATE_TEXT: Record<PaymentState, { title: string; body: string }> = {
  completed: { title: 'Payment received', body: 'Your receipt is ready and has been emailed to you.' },
  pending: { title: 'Waiting for the gateway', body: 'The gateway hasn’t confirmed yet. Check again in a minute; you won’t be charged twice.' },
  initiated: { title: 'Not paid yet', body: 'Finish paying in the gateway, then check again.' },
  checking: { title: 'Checking your payment', body: 'We couldn’t reach the gateway just now. Check again in a minute.' },
  failed: { title: 'Payment didn’t go through', body: 'Nothing was recorded. Try again or pick another method.' },
  cancelled: { title: 'Payment cancelled', body: 'Nothing was charged. You can pay whenever you’re ready.' },
  expired: { title: 'Payment link expired', body: 'Start the payment again to get a new link.' },
  refund_due: { title: 'We received your payment', body: 'It couldn’t be applied to this milestone, so our finance team will refund or apply it within 2 working days.' },
  unknown: { title: 'We couldn’t find that payment', body: 'Open your payments to see what was recorded.' },
};

/** Sandbox test accounts, shown in test builds only. */
export const SANDBOX_HINT: Record<Gateway, string> = {
  khalti: 'Test mode: Khalti ID 9800000000, MPIN 1111, OTP 987654.',
  esewa: 'Test mode: eSewa ID 9711111111, password Nepal@123, token 123456.',
};
