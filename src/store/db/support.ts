/**
 * Bug reports from shake to report. Anyone can send one, signed in or not, in
 * every build; super admins read them in the console (Super admin → Bug
 * reports), mark them fixed or dismissed and delete them. On Supabase builds
 * the same use cases are rpc_submit_bug_report and friends
 * (supabase/migrations/0019_bug_reports.sql).
 */
import { useSession } from '@/store/useSession';
import type { BugReport, BugReportRecord, BugReportStatus } from '@/types/platform';
import { uid } from '@/utils/format';

import { currentActor, type GetDb, now, type SetDb } from './helpers';
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
}

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
});
