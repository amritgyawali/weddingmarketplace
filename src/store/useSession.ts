import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEMO_ACCOUNTS } from '@/data/seed';
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
  logout: () => void;
}

const normalizePhone = (p: string) => p.replace(/\D/g, '').slice(-10);

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

      logout: () => set({ session: null }),
    }),
    {
      name: 'vivah-session',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ accounts: s.accounts, session: s.session, lastAccountId: s.lastAccountId, selectedRole: s.selectedRole }),
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
