/**
 * Bug reports and help requests.
 *
 * Bug reports come from shake to report. Anyone can send one, signed in or
 * not, in every build; super admins read them in the console (Super admin →
 * Bug reports), mark them fixed or dismissed and delete them. On Supabase
 * builds the same use cases are rpc_submit_bug_report and friends
 * (supabase/migrations/0019_bug_reports.sql).
 *
 * Help requests (Help and support) come from couples, businesses and
 * freelancers; staff with `support.manage` answer them at Platform → Help
 * desk. On Supabase builds they are rpc_open_support_ticket and friends
 * (supabase/migrations/0022_profile_support.sql).
 */
import { SUPPORT_LIMITS, SUPPORT_TOPIC_LABEL, supportHref } from '@/data/support';
import { useSession } from '@/store/useSession';
import type { Account, BugReport, BugReportRecord, BugReportStatus, SupportMessage, SupportPriority, SupportTicket, SupportTicketStatus, SupportTopic } from '@/types/platform';
import { uid } from '@/utils/format';

import { currentActor, type GetDb, nextNumber, now, type SetDb } from './helpers';
import { staffOnly } from './personas';

/** Reports kept on the device; the oldest go first. */
export const MAX_BUG_REPORTS = 200;
/** Only the newest reports keep their screenshot, so the saved data stays small. */
export const MAX_BUG_SCREENSHOTS = 20;
const MAX_DESCRIPTION = 4000;

export interface SupportActions {
  /** Saves a report from the report sheet and tells the super admins. Returns its id, or an error. */
  submitBugReport: (report: BugReport) => { id?: string; error?: string };
  /** Marks a report new, fixed or dismissed (super admins). Returns an error to show, or null. */
  setBugReportStatus: (id: string, status: BugReportStatus, note?: string) => string | null;
  /** Deletes reports (super admins). */
  removeBugReports: (ids: string[]) => string | null;
  /** Opens a help request for the signed-in person and tells the Vivah team. Returns its id, or an error to show. */
  openSupportTicket: (input: SupportTicketInput) => { id?: string; error?: string };
  /** Adds a message to a help request (its owner, or staff who answer help requests; staff may add internal notes). */
  replySupportTicket: (id: string, body: string, opts?: { internal?: boolean }) => string | null;
  /** Changes a request's status. Owners can only mark it solved or reopen it; staff can set any status. */
  setSupportTicketStatus: (id: string, status: SupportTicketStatus) => string | null;
  /** Gives a request to a staff member (or nobody), and its priority (staff who answer help requests). */
  assignSupportTicket: (id: string, staffId: string | null, priority?: SupportPriority) => string | null;
  /** The owner rates the help they got (1–5) once the request is resolved or closed. */
  rateSupportTicket: (id: string, rating: number, note?: string) => string | null;
}

export interface SupportTicketInput {
  topic: SupportTopic;
  subject: string;
  body: string;
  priority?: SupportPriority;
  projectId?: string;
}

const SUPPORT_BOT = { id: 'system', name: 'Vivah support', role: 'platform' as const };

const signedIn = (): Account | undefined => {
  const s = useSession.getState();
  return s.accounts.find((a) => a.id === s.session?.accountId);
};

const message = (author: { id: string; name: string; role: Account['role'] }, body: string, internal?: boolean): SupportMessage => ({
  id: uid('smsg'),
  at: now(),
  authorId: author.id,
  authorName: author.name,
  authorRole: author.role,
  body,
  ...(internal ? { internal: true } : {}),
});

/** Newest activity first. */
const byActivity = (list: SupportTicket[]) => [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

const OWNER_STATUSES = new Set<SupportTicketStatus>(['resolved', 'closed', 'open']);

export const supportActions = (set: SetDb, get: GetDb): SupportActions => ({
  submitBugReport: (report) => {
    const description = report.description?.trim() ?? '';
    if (!description) return { error: 'Describe what went wrong' };
    const record: BugReportRecord = {
      ...report,
      description: description.slice(0, MAX_DESCRIPTION),
      route: String(report.route ?? '/').slice(0, 300),
      id: uid('bug'),
      receivedAt: now(),
      status: 'new',
    };
    set((s) => ({
      bugReports: [record, ...s.bugReports].slice(0, MAX_BUG_REPORTS).map((r, i) => (i < MAX_BUG_SCREENSHOTS || !r.screenshot ? r : { ...r, screenshot: undefined })),
    }));
    const who = report.account?.name ?? 'Someone signed out';
    const admins = useSession.getState().accounts.filter((a) => a.role === 'platform' && a.staffRole === 'super_admin' && !a.suspended);
    for (const admin of admins) {
      get().notify(admin.id, 'New bug report', `${who} on ${record.route}: “${description.slice(0, 80)}”`, `/platform/admin/bug/${record.id}`, 'system');
    }
    return { id: record.id };
  },

  setBugReportStatus: (id, status, note) => {
    const denied = staffOnly('admin.full', get);
    if (denied) return denied;
    if (!get().bugReports.some((r) => r.id === id)) return 'Bug report not found';
    const actor = currentActor();
    const resolved = status === 'new' ? { resolvedBy: undefined, resolvedAt: undefined } : { resolvedBy: actor.name, resolvedAt: now() };
    set((s) => ({ bugReports: s.bugReports.map((r) => (r.id === id ? { ...r, status, ...resolved, note: note?.trim() || r.note } : r)) }));
    get().log(actor, `bug.${status}`, 'bug_report', id, note?.trim() || undefined);
    return null;
  },

  removeBugReports: (ids) => {
    const denied = staffOnly('admin.full', get);
    if (denied) return denied;
    if (!ids.length) return 'Select something to delete';
    const drop = new Set(ids);
    set((s) => ({ bugReports: s.bugReports.filter((r) => !drop.has(r.id)) }));
    get().log(currentActor(), 'bug.delete', 'bug_report', ids.length === 1 ? ids[0] : 'many', `${ids.length} deleted`);
    return null;
  },

  openSupportTicket: (input) => {
    const me = signedIn();
    if (!me) return { error: 'Sign in to ask for help' };
    if (me.role === 'platform') return { error: 'Staff answer help requests at Help desk' };
    const subject = input.subject.trim().replace(/\s+/g, ' ');
    const body = input.body.trim();
    if (!SUPPORT_TOPIC_LABEL[input.topic]) return { error: 'Pick what it is about' };
    if (subject.length < SUPPORT_LIMITS.subjectMin) return { error: 'Add a short subject' };
    if (body.length < SUPPORT_LIMITS.bodyMin) return { error: `Tell us a little more (at least ${SUPPORT_LIMITS.bodyMin} characters)` };
    const project = input.projectId ? get().projects.find((p) => p.id === input.projectId) : undefined;
    if (input.projectId && (!project || (project.customerId !== me.id && !project.collaborators.some((c) => c.accountId === me.id)))) return { error: 'That celebration isn’t yours' };
    const open = get().supportTickets.filter((t) => t.accountId === me.id && (t.status === 'open' || t.status === 'in_progress' || t.status === 'waiting'));
    if (open.length >= SUPPORT_LIMITS.openPerPerson) return { error: `You already have ${open.length} open requests. Add to one of them, or mark one solved.` };
    const at = now();
    const ticket: SupportTicket = {
      id: uid('sup'),
      code: nextNumber('SUP', get().supportTickets.map((t) => t.code)),
      accountId: me.id,
      accountName: me.businessName ? `${me.name} · ${me.businessName}` : me.name,
      role: me.role,
      topic: input.topic,
      subject: subject.slice(0, SUPPORT_LIMITS.subjectMax),
      priority: input.priority === 'urgent' || input.priority === 'high' ? input.priority : 'normal',
      status: 'open',
      ...(project ? { projectId: project.id } : {}),
      createdAt: at,
      updatedAt: at,
      messages: [
        message(me, body.slice(0, SUPPORT_LIMITS.bodyMax)),
        message(SUPPORT_BOT, input.priority === 'urgent' ? 'Thank you, we have your urgent request and someone will call you shortly. For anything on the day of a function, you can also call us any time.' : 'Thank you, we have your request. The team replies within two working hours, 9am to 7pm.'),
      ],
    };
    set((s) => ({ supportTickets: [ticket, ...s.supportTickets] }));
    get().notify('platform', `Help request ${ticket.code}`, `${ticket.accountName}: ${ticket.subject}`, `/platform/support/${ticket.id}`, 'message');
    get().log({ id: me.id, name: me.name }, 'support.open', 'support_ticket', ticket.id, `${ticket.topic} · ${ticket.priority}`);
    return { id: ticket.id };
  },

  replySupportTicket: (id, body, opts) => {
    const me = signedIn();
    if (!me) return 'Sign in to reply';
    const ticket = get().supportTickets.find((t) => t.id === id);
    if (!ticket) return 'Help request not found';
    const text = body.trim();
    if (!text) return 'Write a message first';
    const staff = me.role === 'platform';
    if (staff) {
      const denied = staffOnly('support.manage', get);
      if (denied) return denied;
    } else if (ticket.accountId !== me.id) return 'This request isn’t yours';
    if (!staff && ticket.status === 'closed') return 'This request is closed. Open a new one and we’ll pick it up.';
    const internal = staff && !!opts?.internal;
    const at = now();
    // A reply from the person reopens their request; a public answer from staff waits on them.
    const status: SupportTicketStatus = internal ? ticket.status : staff ? (ticket.status === 'closed' ? 'closed' : 'waiting') : 'open';
    set((s) => ({
      supportTickets: byActivity(
        s.supportTickets.map((t) =>
          t.id === id
            ? { ...t, status, updatedAt: at, resolvedAt: status === 'open' ? undefined : t.resolvedAt, ...(staff && !t.assignedTo ? { assignedTo: me.id, assignedName: me.name } : {}), messages: [...t.messages, { ...message(me, text.slice(0, SUPPORT_LIMITS.bodyMax), internal), at }] }
            : t,
        ),
      ),
    }));
    if (internal) return null;
    if (staff) get().notify(ticket.accountId, `Reply to ${ticket.code}`, `${me.name}: ${text.slice(0, 90)}`, supportHref(ticket.role, ticket.id), 'message');
    else get().notify(ticket.assignedTo ?? 'platform', `New message on ${ticket.code}`, `${me.name}: ${text.slice(0, 90)}`, `/platform/support/${ticket.id}`, 'message');
    get().log({ id: me.id, name: me.name }, 'support.reply', 'support_ticket', id);
    return null;
  },

  setSupportTicketStatus: (id, status) => {
    const me = signedIn();
    if (!me) return 'Sign in first';
    const ticket = get().supportTickets.find((t) => t.id === id);
    if (!ticket) return 'Help request not found';
    const staff = me.role === 'platform';
    if (staff) {
      const denied = staffOnly('support.manage', get);
      if (denied) return denied;
    } else {
      if (ticket.accountId !== me.id) return 'This request isn’t yours';
      if (!OWNER_STATUSES.has(status)) return 'Only the Vivah team can change that';
    }
    if (ticket.status === status) return null;
    const at = now();
    const done = status === 'resolved' || status === 'closed';
    const note = staff ? undefined : message(me, status === 'open' ? 'I still need help with this.' : 'Marked as solved. Thank you!');
    set((s) => ({
      supportTickets: byActivity(s.supportTickets.map((t) => (t.id === id ? { ...t, status, updatedAt: at, resolvedAt: done ? at : undefined, messages: note ? [...t.messages, note] : t.messages } : t))),
    }));
    if (staff && done) get().notify(ticket.accountId, `${ticket.code} is ${status === 'resolved' ? 'resolved' : 'closed'}`, status === 'resolved' ? 'Tell us how we did, or reply if you still need help.' : ticket.subject, supportHref(ticket.role, ticket.id), 'message');
    if (!staff && status === 'open') get().notify(ticket.assignedTo ?? 'platform', `${ticket.code} reopened`, `${ticket.accountName}: ${ticket.subject}`, `/platform/support/${ticket.id}`, 'message');
    get().log({ id: me.id, name: me.name }, `support.${status}`, 'support_ticket', id);
    return null;
  },

  assignSupportTicket: (id, staffId, priority) => {
    const denied = staffOnly('support.manage', get);
    if (denied) return denied;
    const ticket = get().supportTickets.find((t) => t.id === id);
    if (!ticket) return 'Help request not found';
    const staff = staffId ? useSession.getState().accounts.find((a) => a.id === staffId && a.role === 'platform' && !a.suspended) : undefined;
    if (staffId && !staff) return 'Pick someone on the Vivah team';
    if (priority && priority !== 'normal' && priority !== 'high' && priority !== 'urgent') return 'Unknown priority';
    set((s) => ({
      supportTickets: s.supportTickets.map((t) => (t.id === id ? { ...t, assignedTo: staff?.id, assignedName: staff?.name, ...(priority ? { priority } : {}), status: t.status === 'open' && staff ? 'in_progress' : t.status, updatedAt: now() } : t)),
    }));
    const actor = currentActor();
    if (staff && staff.id !== actor.id) get().notify(staff.id, `${ticket.code} is yours`, `${ticket.accountName}: ${ticket.subject}`, `/platform/support/${ticket.id}`, 'message');
    get().log(actor, 'support.assign', 'support_ticket', id, [staff?.name ?? 'nobody', priority].filter(Boolean).join(' · '));
    return null;
  },

  rateSupportTicket: (id, rating, note) => {
    const me = signedIn();
    const ticket = get().supportTickets.find((t) => t.id === id);
    if (!me || !ticket) return 'Help request not found';
    if (ticket.accountId !== me.id) return 'This request isn’t yours';
    if (ticket.status !== 'resolved' && ticket.status !== 'closed') return 'You can rate the help once it is solved';
    const stars = Math.round(rating);
    if (!(stars >= 1 && stars <= 5)) return 'Pick one to five stars';
    set((s) => ({ supportTickets: s.supportTickets.map((t) => (t.id === id ? { ...t, rating: stars, ratingNote: note?.trim().slice(0, 300) || undefined } : t)) }));
    if (ticket.assignedTo) get().notify(ticket.assignedTo, `${ticket.code} rated ${stars} of 5`, note?.trim() ? `“${note.trim().slice(0, 80)}”` : ticket.subject, `/platform/support/${ticket.id}`, 'review');
    get().log({ id: me.id, name: me.name }, 'support.rate', 'support_ticket', id, `${stars}/5`);
    return null;
  },
});
