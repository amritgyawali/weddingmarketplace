/**
 * What each platform staff role may do. Staff don't onboard with a trade:
 * their staff role (and, for support, their team) decides their permissions.
 *
 * Mirrored by `staff_permissions` in supabase/migrations/0005_personas.sql.
 */
import type { PlatformTeam, StaffRole } from '@/types/platform';

export const PERMISSIONS = [
  'project.view_all',
  'project.manage',
  'quote.send',
  'incident.manage',
  'emergency.start',
  'provider.verify',
  'payment.record_cash',
  'refund.approve',
  'payout.release',
  'payout.batch',
  'settings.edit',
  'user.suspend',
  'staff.manage',
  'broadcast.send',
  'audit.view',
  'demo.reset',
  'occasion.manage',
  'admin.full',
  'support.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const PERMISSION_SET = new Set<string>(PERMISSIONS);
export const isPermission = (x: string): x is Permission => PERMISSION_SET.has(x);

export const PERMISSION_LABELS: Record<Permission, string> = {
  'project.view_all': 'See every project',
  'project.manage': 'Manage projects (status, matching, quotes)',
  'quote.send': 'Send quotations',
  'incident.manage': 'Handle incidents',
  'emergency.start': 'Start emergency replacements',
  'provider.verify': 'Verify providers',
  'payment.record_cash': 'Record cash payments',
  'refund.approve': 'Approve refunds',
  'payout.release': 'Release payouts',
  'payout.batch': 'Run payout batches',
  'settings.edit': 'Edit rates and fees',
  'user.suspend': 'Suspend users',
  'staff.manage': 'Manage staff',
  'broadcast.send': 'Send broadcasts',
  'audit.view': 'Read the audit log',
  'demo.reset': 'Reset demo data',
  'occasion.manage': 'Add, edit and delete occasions',
  'admin.full': 'Edit, delete and configure everything (super admin console)',
  'support.manage': 'Answer help requests (help desk)',
};

const ALL = [...PERMISSIONS];

/**
 * The permission matrix (master plan §4.4). A coordinator's project rights
 * apply to their own projects; `PERMISSION_SCOPE` records that for the server.
 */
export const STAFF_PERMISSIONS: Record<StaffRole, readonly Permission[]> = {
  coordinator: ['project.view_all', 'project.manage', 'quote.send', 'incident.manage', 'emergency.start', 'support.manage'],
  support: ['project.view_all', 'incident.manage', 'emergency.start', 'broadcast.send', 'support.manage'],
  finance: ['project.view_all', 'payment.record_cash', 'refund.approve', 'payout.release', 'payout.batch', 'audit.view'],
  admin: ALL.filter((p) => p !== 'payout.release' && p !== 'payout.batch' && p !== 'occasion.manage' && p !== 'admin.full'),
  super_admin: ALL,
};

/** Extra permissions a team adds on top of the staff role. */
export const TEAM_PERMISSIONS: Partial<Record<PlatformTeam, readonly Permission[]>> = {
  'Vendor Success': ['provider.verify'],
};

/** Permissions limited to the staff member's own records for a role. */
export const PERMISSION_SCOPE: Partial<Record<StaffRole, Partial<Record<Permission, 'own'>>>> = {
  coordinator: { 'project.manage': 'own', 'quote.send': 'own' },
};

/** Permissions for a staff role and team. Unknown roles get none. */
export function permissionsFor(staffRole?: StaffRole, team?: PlatformTeam): Permission[] {
  const base = staffRole ? (STAFF_PERMISSIONS[staffRole] ?? []) : [];
  const extra = team ? (TEAM_PERMISSIONS[team] ?? []) : [];
  return [...new Set([...base, ...extra])];
}
