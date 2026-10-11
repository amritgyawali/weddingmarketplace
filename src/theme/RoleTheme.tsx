import { createContext, useContext, type ReactNode } from 'react';

import type { UserRole } from '@/types/platform';

import { ROLE_THEMES, type RoleTheme } from './roles';

const RoleThemeContext = createContext<UserRole | null>(null);

/** Scopes palette + typography to one role's app. The customer theme is the default. */
export function RoleThemeProvider({ role, children }: { role: UserRole; children: ReactNode }) {
  return <RoleThemeContext.Provider value={role}>{children}</RoleThemeContext.Provider>;
}

/** The current role's theme, in the colour scheme on screen (light or dark). */
export const useRoleTheme = (): RoleTheme => ROLE_THEMES[useContext(RoleThemeContext) ?? 'customer'];
