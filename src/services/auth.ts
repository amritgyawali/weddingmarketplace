import { useAppStore } from '@/store/useAppStore';
import { useDb } from '@/store/useDb';
import { useSession } from '@/store/useSession';
import type { Account } from '@/types/platform';

/**
 * Finishes sign-in for any role. Setting the session flips the protected
 * route guards in the root layout, which moves the user into their role's app.
 */
export function completeLogin(account: Account) {
  if (account.role === 'customer') {
    // The demo couple already has a wedding project, so skip the questionnaire.
    const project = useDb.getState().projects.find((p) => p.customerId === account.id);
    useAppStore.getState().bindOwner(
      account,
      project
        ? { hasOnboarded: true, role: 'bride', city: project.city, weddingDate: project.weddingDate }
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
  db.notify(account.id, 'Welcome to Vivah 👋', account.role === 'customer' ? 'Explore venues, collect quotations and track everything in My Wedding.' : 'Your workspace is ready.');
}

export function logout() {
  useSession.getState().logout();
}
