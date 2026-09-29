import { createContext, useContext, type ReactNode } from 'react';

import type { UserRole } from '@/types/platform';

import { ROLE_THEMES, type RoleTheme } from './roles';

const RoleThemeContext = createContext<RoleTheme>(ROLE_THEMES.customer);

/** Scopes palette + typography to one role's app. The customer theme is the default. */
export function RoleThemeProvider({ role, children }: { role: UserRole; children: ReactNode }) {
  return <RoleThemeContext.Provider value={ROLE_THEMES[role]}>{children}</RoleThemeContext.Provider>;
}

export const useRoleTheme = () => useContext(RoleThemeContext);
