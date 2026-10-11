/**
 * Help requests, in the demo or for real. The demo runs the store actions in
 * `store/db/support.ts`; Supabase builds call the RPCs in
 * supabase/migrations/0022_profile_support.sql and then mirror the caller's
 * requests (every request, for staff who answer them) into the store, so the
 * screens read the same `supportTickets` either way.
 */
import { usesSupabase } from '@/constants/env';
import { useDb } from '@/store/useDb';
import type { SupportPriority, SupportTicket, SupportTicketStatus, SupportTopic } from '@/types/platform';

import { rpc } from './supabase';

/** True on Supabase builds: help requests go to the server. */
export const supportLive = () => usesSupabase();

/** Re-reads the requests this person can see from the server (no-op in the demo). */
export async function syncSupportTickets(): Promise<string | null> {
  if (!supportLive()) return null;
  const res = await rpc<SupportTicket[]>('rpc_my_support_tickets', {});
  if (!res.ok) return res.error;
  useDb.getState().mirrorSupportTickets(res.value ?? []);
  return null;
}

async function run(server: () => ReturnType<typeof rpc>): Promise<string | null> {
  const res = await server();
  if (!res.ok) return res.error;
  return syncSupportTickets();
}

/** Opens a request. Returns its id, or an error to show. */
export async function openTicket(input: { topic: SupportTopic; subject: string; body: string; priority?: SupportPriority; projectId?: string }): Promise<{ id?: string; error?: string }> {
  if (!supportLive()) return useDb.getState().openSupportTicket(input);
  const res = await rpc<string>('rpc_open_support_ticket', { p_topic: input.topic, p_subject: input.subject, p_body: input.body, p_priority: input.priority ?? 'normal', p_project: input.projectId ?? null });
  if (!res.ok) return { error: res.error };
  await syncSupportTickets();
  return { id: res.value };
}

/** Replies to a request (staff may add an internal note). */
export const replyTicket = (id: string, body: string, internal = false) =>
  supportLive() ? run(() => rpc('rpc_reply_support_ticket', { p_id: id, p_body: body, p_internal: internal })) : Promise.resolve(useDb.getState().replySupportTicket(id, body, { internal }));

/** Marks a request solved, closed or open again (staff: any status). */
export const setTicketStatus = (id: string, status: SupportTicketStatus) =>
  supportLive() ? run(() => rpc('rpc_set_support_ticket_status', { p_id: id, p_status: status })) : Promise.resolve(useDb.getState().setSupportTicketStatus(id, status));

/** Gives a request to a staff member (or nobody) and sets its priority. */
export const assignTicket = (id: string, staffId: string | null, priority?: SupportPriority) =>
  supportLive() ? run(() => rpc('rpc_assign_support_ticket', { p_id: id, p_staff: staffId, p_priority: priority ?? null })) : Promise.resolve(useDb.getState().assignSupportTicket(id, staffId, priority));

/** The owner rates the help (1–5). */
export const rateTicket = (id: string, rating: number, note?: string) =>
  supportLive() ? run(() => rpc('rpc_rate_support_ticket', { p_id: id, p_rating: rating, p_note: note ?? null })) : Promise.resolve(useDb.getState().rateSupportTicket(id, rating, note));
