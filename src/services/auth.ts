import { signOut, usesEmailSignIn } from '@/backend/auth';
import { usesDirectRoleEntry } from '@/constants/env';
import { useAppStore } from '@/store/useAppStore';
import { useDb } from '@/store/useDb';
import { useSession } from '@/store/useSession';
import type { Account, UserRole } from '@/types/platform';

/** Opens a fixed local demo account from the role picker; never bypasses live authentication. Returns an error on refusal. */
export function enterDemoRole(role: UserRole | 'super_admin'): string | null {
  if (!usesDirectRoleEntry()) return 'Sign in to open your account.';
  const accountIds = {
    customer: 'acc_customer_demo',
    vendor: 'acc_vendor_demo',
    freelancer: 'acc_freelancer_demo',
    platform: 'acc_platform_demo',
    super_admin: 'acc_platform_admin',
  };
  const session = useSession.getState();
  const account = session.accounts.find((a) => a.id === accountIds[role]);
  const expectedRole = role === 'super_admin' ? 'platform' : role;
  if (!account || account.suspended || account.role !== expectedRole || (role === 'super_admin' && account.staffRole !== 'super_admin')) {
    return 'This demo account is unavailable. Ask an administrator to restore access.';
  }
  session.selectRole(expectedRole);
  session.setImpersonator(null);
  completeLogin(account);
  return null;
}

/**
 * Finishes sign-in for any role. Setting the session flips the protected
 * route guards in the root layout, which moves the user into their role's app.
 */
export function completeLogin(account: Account) {
  if (account.role === 'customer') {
    // Redeem invite codes entered before signing in (family joining a wedding).
    const pending = useAppStore.getState().joinedWeddings;
    const joined = pending.map((code) => useDb.getState().joinWithCode(code, account)).find(Boolean) ?? undefined;
    // The demo couple already has a wedding project, so skip the questionnaire.
    const project = useDb.getState().projects.find((p) => p.customerId === account.id) ?? joined;
    useAppStore.getState().bindOwner(
      account,
      project
        ? { hasOnboarded: true, role: project.eventType === 'WEDDING' ? 'bride' : 'other', city: project.city, weddingDate: project.weddingDate }
        : { city: account.city },
    );
  }
  useSession.getState().login(account.id);
}

/** Side effects for a brand-new account before it signs in. */
export function onAccountCreated(account: Account) {
  const db = useDb.getState();
  if (account.role === 'vendor' || account.role === 'freelancer') db.submitForApproval(account);
  if (account.role === 'vendor') db.seedVendorWorkspace(account);
  if (account.role === 'customer') useAppStore.getState().bindOwner(account, { city: account.city, weddingDate: null });
  db.notify(account.id, 'Welcome to Vivah', account.role === 'customer' ? 'Explore venues, collect quotations and track everything in My Wedding.' : 'Your workspace is ready.');
}

/** Super admin: opens the app as another user, with a bar to come back. */
export function impersonate(account: Account) {
  const s = useSession.getState();
  const admin = s.accounts.find((a) => a.id === s.session?.accountId);
  if (!admin || admin.staffRole !== 'super_admin' || admin.id === account.id) return;
  useDb.getState().log({ id: admin.id, name: admin.name }, 'account.impersonate', 'account', account.id, `${account.role} · ${account.name}`);
  s.setImpersonator(s.impersonatorId ?? admin.id);
  completeLogin(account);
}

/** Ends "Sign in as" and returns to the super admin's own account. */
export function endImpersonation() {
  const s = useSession.getState();
  const admin = s.accounts.find((a) => a.id === s.impersonatorId);
  s.setImpersonator(null);
  if (admin) completeLogin(admin);
  else s.logout();
}

export function logout() {
  // With the Supabase backend the tokens go too; the demo has none.
  if (usesEmailSignIn()) void signOut();
  useSession.getState().logout();
}
