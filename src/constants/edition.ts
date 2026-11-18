/**
 * App editions: one codebase, one Play Store app per user type.
 *
 * `EXPO_PUBLIC_APP_EDITION` picks the edition at build time (the EAS profiles
 * `production-vendor`, `production-freelancer`, `production-staff` and
 * `production-admin` set it; `app.config.js` reads the same variable for the
 * package name, app name, icon and permissions, and `metro.config.js` leaves
 * the other apps' routes out of the bundle). Unset, the app is `all`: every
 * role app in one binary, as before (development, web console, the original
 * `com.vivah.marketplace` listing).
 */
import type { Account, UserRole } from '@/types/platform';

export type AppEdition = 'all' | 'vendor' | 'freelancer' | 'staff' | 'admin';

const EDITIONS: readonly AppEdition[] = ['all', 'vendor', 'freelancer', 'staff', 'admin'];

const raw = process.env.EXPO_PUBLIC_APP_EDITION?.trim().toLowerCase();

/** The edition this binary was built as. */
export const EDITION: AppEdition = EDITIONS.includes(raw as AppEdition) ? (raw as AppEdition) : 'all';

/** True for a single-user-type app (anything but `all`). */
export const isSingleRoleEdition = EDITION !== 'all';

/** The one role a single-role edition signs in; null for `all`. */
export const EDITION_ROLE: UserRole | null =
  EDITION === 'vendor' ? 'vendor' : EDITION === 'freelancer' ? 'freelancer' : EDITION === 'staff' || EDITION === 'admin' ? 'platform' : null;

/** Store name and landing copy for each single-role edition. */
export const EDITION_INFO: Record<Exclude<AppEdition, 'all'>, { appName: string; title: string; who: string; points: string[] }> = {
  vendor: {
    appName: 'Vivah for Business',
    title: 'Grow your wedding business',
    who: 'For venues, studios, caterers, decorators and every wedding business in Nepal.',
    points: ['Leads and enquiries in one inbox', 'Quotations, bookings and payment schedules', 'Crew, calendar, payouts and reviews'],
  },
  freelancer: {
    appName: 'Vivah Freelancer',
    title: 'Find wedding work near you',
    who: 'For photographers, makeup artists, DJs and wedding crew.',
    points: ['Gigs, invites and emergency jobs', 'GPS check-in and the day’s run sheet', 'Earnings, calendar and your portfolio'],
  },
  staff: {
    appName: 'Vivah Staff',
    title: 'Run every celebration',
    who: 'For Vivah coordinators, support and finance teams.',
    points: ['Today view, leads and project console', 'Matching, quotations and approvals', 'Wedding-day control room and help desk'],
  },
  admin: {
    appName: 'Vivah Admin',
    title: 'Full control of Vivah',
    who: 'For Vivah super admins only.',
    points: ['Every account, record and feature switch', 'Content studio, texts and announcements', 'Bug reports, audit log and operations'],
  },
};

/** The landing copy for this binary; null for `all`. */
export const editionInfo = EDITION === 'all' ? null : EDITION_INFO[EDITION];

/** Whether this binary may open the given account's app. */
export function editionAllows(account: Pick<Account, 'role' | 'staffRole'> | null | undefined): boolean {
  if (EDITION === 'all') return true;
  if (!account) return false;
  switch (EDITION) {
    case 'vendor':
    case 'freelancer':
      return account.role === EDITION;
    case 'staff':
      return account.role === 'platform' && account.staffRole !== 'super_admin';
    case 'admin':
      return account.role === 'platform' && account.staffRole === 'super_admin';
  }
}

/** The refusal shown when an account belongs to another edition's app. */
export function editionRefusal(account: Pick<Account, 'role' | 'staffRole'>): string {
  if (EDITION === 'staff' && account.staffRole === 'super_admin') return 'Super admins sign in with the Vivah Admin app.';
  if (EDITION === 'admin' && account.role === 'platform') return 'This isn’t a super admin account. Vivah staff sign in with the Vivah Staff app.';
  const app =
    account.role === 'customer' ? 'the Vivah app for couples'
    : account.role === 'vendor' ? 'Vivah for Business'
    : account.role === 'freelancer' ? 'Vivah Freelancer'
    : account.staffRole === 'super_admin' ? 'Vivah Admin'
    : 'Vivah Staff';
  return `This account belongs to another app. Sign in with ${app}.`;
}

/** "Sign in as" another user needs every role app in the binary. */
export const canImpersonate = () => EDITION === 'all';
