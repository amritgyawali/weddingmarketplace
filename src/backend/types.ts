/**
 * The core loop as one interface, so the same screens can run on the
 * on-device demo backend or on Supabase (master plan §7.2):
 *
 *   screens → store actions (unchanged) → Backend
 *                                          ├─ mock: the zustand store (demo, Expo Go)
 *                                          └─ supabase: the RPCs in supabase/migrations/0011
 *
 * Every method resolves to a Result instead of throwing, so a refusal from
 * either side reaches the screen as a message. Amounts are whole rupees here;
 * the Supabase adapter converts to paisa.
 */
import type { PlanInput } from '@/services/planner';
import type { PaymentMethod, ProjectStatus } from '@/types/platform';

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const okResult = <T>(value: T): Result<T> => ({ ok: true, value });
export const failResult = <T = never>(error: string): Result<T> => ({ ok: false, error });

export type BackendKind = 'mock' | 'supabase';

export interface Backend {
  kind: BackendKind;
  /** The couple's plan becomes a project; resolves to its id. */
  submitPlan(input: PlanInput): Promise<Result<string>>;
  setProjectStatus(projectId: string, status: ProjectStatus, note?: string): Promise<Result<void>>;
  assignCoordinator(projectId: string, coordinatorId: string): Promise<Result<void>>;
  /** Sends the working version; totals are computed on the server side. */
  sendQuote(quoteId: string, changeSummary?: string): Promise<Result<void>>;
  /** Starts version N+1; resolves to the new version number. */
  reviseQuote(quoteId: string): Promise<Result<number>>;
  respondToQuote(quoteId: string, action: 'accept' | 'decline' | 'revision', note?: string): Promise<Result<void>>;
  confirmBooking(projectId: string, bookingId: string): Promise<Result<void>>;
  cancelBooking(projectId: string, bookingId: string, reason: string): Promise<Result<void>>;
  /** Cash and bank transfers are recorded by finance; gateways by the server after verification. */
  recordPayment(projectId: string, milestoneId: string, amount: number, method: PaymentMethod, reference?: string): Promise<Result<string>>;
  releasePayable(payableId: string, kind: 'provider' | 'freelancer', reference?: string): Promise<Result<void>>;
  /** Resolves to the refund request's id where the backend returns one. */
  requestRefund(paymentId: string, amount: number, reason: string): Promise<Result<string | null>>;
  decideRefund(refundId: string, approve: boolean): Promise<Result<void>>;
}
