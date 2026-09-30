import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEMO_ACCOUNTS, DEMO_PERSONA_KEYS } from '@/data/seed';
import type { Account, UserRole } from '@/types/platform';
import { uid } from '@/utils/format';

interface Session {
  accountId: string;
  role: UserRole;
}

interface SessionState {
  accounts: Account[];
  session: Session | null;
  /** Survives logout so screens mid-unmount can still resolve their account. */
  lastAccountId: string | null;
  /** Remembers the role picked on the "Who are you?" screen. */
  selectedRole: UserRole | null;
  selectRole: (role: UserRole) => void;
  findAccount: (phone: string, role: UserRole) => Account | undefined;
  login: (accountId: string) => void;
  register: (input: Omit<Account, 'id' | 'createdAt' | 'verified'>) => Account;
  updateAccount: (id: string, patch: Partial<Account>) => void;
  /** Removes the account from this device and signs out (right to erasure). */
  deleteAccount: (id: string) => void;
  logout: () => void;
}

const normalizePhone = (p: string) => p.replace(/\D/g, '').slice(-10);

/**
 * Brings the demo accounts of an older install up to date: adds demo accounts
 * it doesn't have yet and copies the demo persona fields onto the existing
 * ones. Other accounts are left alone.
 */
export function syncDemoAccounts(accounts: Account[]): Account[] {
  const byId = new Map(DEMO_ACCOUNTS.map((a) => [a.id, a]));
  const synced = accounts.map((a) => {
    const demo = byId.get(a.id);
    if (!demo) return a;
    const persona = Object.fromEntries(DEMO_PERSONA_KEYS.filter((k) => demo[k] !== undefined).map((k) => [k, demo[k]]));
    return { ...a, ...persona };
  });
  const missing = DEMO_ACCOUNTS.filter((d) => !accounts.some((a) => a.id === d.id));
  return [...synced, ...missing];
}

/**
 * Mock auth: accounts live on-device and any number verifies with the demo OTP.
 * Replace `login`/`register` with your auth provider (Supabase, Firebase, …).
 */
export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      accounts: DEMO_ACCOUNTS,
      session: null,
      lastAccountId: null,
      selectedRole: null,

      selectRole: (selectedRole) => set({ selectedRole }),

      findAccount: (phone, role) =>
        get().accounts.find((a) => a.role === role && normalizePhone(a.phone) === normalizePhone(phone)),

      login: (accountId) => {
        const account = get().accounts.find((a) => a.id === accountId);
        if (account) set({ session: { accountId, role: account.role }, lastAccountId: accountId });
      },

      register: (input) => {
        const account: Account = {
          ...input,
          phone: normalizePhone(input.phone),
          id: uid(`acc_${input.role}`),
          createdAt: new Date().toISOString(),
          // Couples are verified via OTP; businesses & freelancers need platform approval.
          verified: input.role === 'customer' || input.role === 'platform',
        };
        set((s) => ({ accounts: [...s.accounts, account] }));
        return account;
      },

      updateAccount: (id, patch) =>
        set((s) => ({ accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),

      deleteAccount: (id) =>
        set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id), session: s.session?.accountId === id ? null : s.session, lastAccountId: s.lastAccountId === id ? null : s.lastAccountId })),

      logout: () => set({ session: null }),
    }),
    {
      name: 'vivah-session',
      // v2: persona fields on the demo accounts (services, business form, primary skill, super admin).
      // v3: the Phoolbari Decor demo account.
      version: 3,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ accounts: s.accounts, session: s.session, lastAccountId: s.lastAccountId, selectedRole: s.selectedRole }),
      migrate: (persisted, version) => {
        const s = persisted as Partial<SessionState>;
        return (version < 3 && s.accounts ? { ...s, accounts: syncDemoAccounts(s.accounts) } : s) as SessionState;
      },
    },
  ),
);

/** The signed-in account (null when logged out). */
export const useCurrentAccount = () =>
  useSession((s) => (s.session ? s.accounts.find((a) => a.id === s.session!.accountId) ?? null : null));

/**
 * Non-null account for screens that only render inside a role app. During
 * logout a screen may render once more before its protected route unmounts,
 * so this falls back to the last signed-in account instead of throwing.
 */
export const useAccount = (): Account =>
  useSession((s) => {
    const id = s.session?.accountId ?? s.lastAccountId;
    return s.accounts.find((a) => a.id === id) ?? s.accounts[0];
  });
