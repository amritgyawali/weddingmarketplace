import { ROLE_NAMES } from '@/components/admin/shared';
import type { BugReportRecord, BugReportStatus, UserRole } from '@/types/platform';

/** The status pill for a bug report (StatusPill colours by its own status names). */
export const BUG_PILL: Record<BugReportStatus, { status: string; label: string }> = {
  new: { status: 'new', label: 'New' },
  fixed: { status: 'resolved', label: 'Fixed' },
  dismissed: { status: 'closed', label: 'Dismissed' },
};

/** "Aakriti Shrestha · Couple", or "Signed out". */
export const reporterLine = (r: BugReportRecord) => (r.account ? `${r.account.name} · ${ROLE_NAMES[r.account.role as UserRole] ?? r.account.role}` : 'Signed out');
