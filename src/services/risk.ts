/**
 * Risk detection for coordinators — the same rules as the `project_risks`
 * view in supabase/migrations/0003, evaluated on-device.
 */
import { findProvider } from '@/data/providers';
import { serviceName } from '@/data/services';
import { milestoneStatus } from '@/services/pricing';
import type { Gig, Project, Quotation } from '@/types/platform';
import { daysUntil, formatShortDate } from '@/utils/format';

export type RiskKind =
  | 'PROVIDER_UNCONFIRMED'
  | 'CREW_UNFILLED'
  | 'PAYMENT_OVERDUE'
  | 'EVENT_WITHIN_48H'
  | 'SERVICE_UNFILLED'
  | 'PROVIDER_CANCELLATION_HISTORY'
  | 'DELIVERABLE_OVERDUE'
  | 'EMERGENCY'
  | 'NO_COORDINATOR'
  | 'QUOTE_EXPIRING'
  | 'OPEN_INCIDENT';

export interface RiskFlag {
  id: string;
  projectId: string;
  projectCode: string;
  kind: RiskKind;
  severity: 'high' | 'medium' | 'low';
  message: string;
  refId?: string;
}

const ACTIVE_ASSIGNMENT = ['ASSIGNED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'];
const CLOSED = ['COMPLETED', 'CLOSED', 'CANCELLED', 'QUOTE_REJECTED'];

export function firstEventDate(project: Project, eventIds?: string[]): string | undefined {
  return project.events
    .filter((e) => e.date && e.status !== 'cancelled' && (!eventIds || eventIds.includes(e.id)))
    .map((e) => e.date!)
    .sort()[0];
}

export function projectRisks(project: Project, ctx: { gigs?: Gig[]; quotes?: Quotation[] } = {}): RiskFlag[] {
  if (CLOSED.includes(project.status)) return [];
  const flags: RiskFlag[] = [];
  const add = (kind: RiskKind, severity: RiskFlag['severity'], message: string, refId?: string) =>
    flags.push({ id: `${project.id}:${kind}:${refId ?? ''}`, projectId: project.id, projectCode: project.code, kind, severity, message, refId });

  if (project.managedBy === 'platform' && !project.coordinatorId) add('NO_COORDINATOR', 'high', 'No coordinator assigned');

  for (const b of project.bookings) {
    if (b.status === 'CANCELLED') continue;
    const first = firstEventDate(project, b.eventIds);
    const days = first ? daysUntil(first) : 999;
    if ((b.status === 'PROPOSED' || b.status === 'HELD') && days <= 30) {
      add('PROVIDER_UNCONFIRMED', days <= 7 ? 'high' : 'medium', `${b.providerName} hasn't confirmed ${serviceName(b.serviceId)}`, b.id);
    }
    for (const c of b.crew) {
      if (c.staffing !== 'marketplace') continue;
      const filled = b.assignments.filter((a) => a.crewId === c.id && ACTIVE_ASSIGNMENT.includes(a.status)).length;
      if (filled < c.count && b.status !== 'PROPOSED') {
        add('CREW_UNFILLED', days <= 3 ? 'high' : days <= 14 ? 'medium' : 'low', `${c.role}: ${c.count - filled} of ${c.count} not assigned`, c.id);
      }
    }
    for (const a of b.assignments) {
      if (a.status === 'EMERGENCY_REPLACEMENT' && !b.assignments.some((x) => x.replacesId === a.id && ACTIVE_ASSIGNMENT.includes(x.status))) {
        add('EMERGENCY', 'high', `Emergency: replace ${a.role} (${a.workerName})`, a.id);
      }
    }
    const provider = findProvider(b.providerId);
    if (provider && provider.internal.cancellationRate >= 0.15 && b.status !== 'COMPLETED') {
      add('PROVIDER_CANCELLATION_HISTORY', 'medium', `${b.providerName} cancels ${Math.round(provider.internal.cancellationRate * 100)}% of bookings`, b.id);
    }
    for (const d of b.deliverables) {
      if (d.status !== 'APPROVED' && d.status !== 'DELIVERED' && daysUntil(d.due) < 0) {
        add('DELIVERABLE_OVERDUE', 'medium', `${d.title} overdue since ${formatShortDate(d.due)}`, d.id);
      }
    }
  }

  for (const m of project.milestones) {
    if (milestoneStatus(m) === 'OVERDUE') add('PAYMENT_OVERDUE', 'high', `${m.label} overdue (${formatShortDate(m.due)})`, m.id);
  }

  for (const e of project.events) {
    if (e.date && e.status === 'planned') {
      const d = daysUntil(e.date);
      if (d >= 0 && d <= 2) add('EVENT_WITHIN_48H', 'medium', `${e.name} ${d === 0 ? 'is today' : d === 1 ? 'is tomorrow' : 'in 2 days'}`, e.id);
    }
  }

  for (const r of project.requirements) {
    if (r.status === 'CONFIRMED' || r.status === 'CANCELLED') continue;
    const first = firstEventDate(project, r.eventIds);
    const days = first ? daysUntil(first) : 999;
    add('SERVICE_UNFILLED', days <= 14 ? 'high' : days <= 45 ? 'medium' : 'low', `${serviceName(r.serviceId)} still unfilled`, r.id);
  }

  for (const i of project.incidents) if (i.status === 'open') add('OPEN_INCIDENT', i.severity === 'high' ? 'high' : 'medium', i.title, i.id);

  for (const q of ctx.quotes ?? []) {
    if (q.projectId === project.id && (q.status === 'sent' || q.status === 'viewed')) {
      const d = daysUntil(q.validUntil);
      if (d >= 0 && d <= 3) add('QUOTE_EXPIRING', 'low', `${q.number} expires ${d === 0 ? 'today' : `in ${d} days`}`, q.id);
    }
  }

  for (const g of ctx.gigs ?? []) {
    if (g.projectId === project.id && g.status === 'open' && g.emergency) add('EMERGENCY', 'high', `Emergency gig open: ${g.title}`, g.id);
  }

  const order = { high: 0, medium: 1, low: 2 };
  return flags.sort((a, b) => order[a.severity] - order[b.severity]);
}

export const RISK_ICONS: Record<RiskKind, string> = {
  PROVIDER_UNCONFIRMED: 'hourglass-outline',
  CREW_UNFILLED: 'people-outline',
  PAYMENT_OVERDUE: 'card-outline',
  EVENT_WITHIN_48H: 'alarm-outline',
  SERVICE_UNFILLED: 'alert-circle-outline',
  PROVIDER_CANCELLATION_HISTORY: 'warning-outline',
  DELIVERABLE_OVERDUE: 'cloud-download-outline',
  EMERGENCY: 'medkit-outline',
  NO_COORDINATOR: 'person-add-outline',
  QUOTE_EXPIRING: 'time-outline',
  OPEN_INCIDENT: 'flash-outline',
};
