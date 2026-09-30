/**
 * The signed-in user's own records on Supabase: who they are (rpc_me), the
 * first-time sign-up (rpc_complete_signup), and mirroring them into the
 * app's local Account so the role apps keep working unchanged.
 */
import type { Account, UserRole } from '@/types/platform';

import type { Me } from './auth';
import { rpc } from './supabase';
import type { Result } from './types';

export const fetchMe = () => rpc<Me>('rpc_me', {});

/** What sign-up sends for each role (the fields rpc_complete_signup reads). */
export type SignupProfile = Partial<Pick<Account, 'name' | 'phone' | 'city' | 'businessName' | 'panVat' | 'services' | 'primaryService' | 'businessForm' | 'teamSize' | 'tradeProfile' | 'skills' | 'primarySkill' | 'dayRate' | 'eventRate' | 'bio' | 'travelRadiusKm' | 'team' | 'staffRole'>> & { partnerName?: string };

export const completeSignup = (role: UserRole, profile: SignupProfile, accessCode?: string): Promise<Result<Me>> =>
  rpc<Me>('rpc_complete_signup', { p_role: role, p_profile: profile, p_access_code: accessCode ?? null });

const STAFF: Record<string, NonNullable<Account['staffRole']>> = {
  SUPER_ADMIN: 'super_admin',
  PLATFORM_ADMIN: 'admin',
  FINANCE: 'finance',
  SUPPORT: 'support',
  WEDDING_COORDINATOR: 'coordinator',
};

/** The role app a Supabase user belongs in, or null while staff wait for approval. */
export function roleOf(me: Me): UserRole | null {
  const roles = me.roles ?? [];
  if (roles.some((r) => r in STAFF)) return 'platform';
  if (roles.includes('SERVICE_PROVIDER')) return 'vendor';
  if (roles.includes('FREELANCER')) return 'freelancer';
  if (roles.includes('CUSTOMER')) return 'customer';
  return null;
}

/** The local Account for a Supabase user (same id as their auth user). */
export function accountFromMe(me: Me, role: UserRole): Account {
  const roles = me.roles ?? [];
  const staffRole = Object.entries(STAFF).find(([r]) => roles.includes(r))?.[1];
  return {
    id: me.id!,
    role,
    name: me.name ?? 'Vivah user',
    phone: me.phone ?? '',
    email: me.email ?? undefined,
    city: me.city ?? 'Kathmandu',
    createdAt: new Date().toISOString(),
    verified: role === 'customer' || role === 'platform',
    suspended: me.suspended || undefined,
    ...(role === 'vendor' && me.provider
      ? { businessName: me.provider.businessName, listingKind: me.provider.services[0] === 'venue' ? ('venue' as const) : ('vendor' as const), listingId: me.provider.providerId ?? undefined, services: me.provider.services, primaryService: me.provider.services[0], businessForm: (me.provider.businessForm ?? undefined) as Account['businessForm'] }
      : {}),
    ...(role === 'freelancer' && me.freelancer
      ? { skills: me.freelancer.skills, primarySkill: me.freelancer.primarySkill ?? undefined, dayRate: me.freelancer.dayRate ?? undefined, eventRate: me.freelancer.eventRate ?? undefined, bio: me.freelancer.bio ?? undefined, travelRadiusKm: me.freelancer.travelRadiusKm, available: true }
      : {}),
    ...(role === 'platform' ? { staffRole, team: (me.staffTeam ?? undefined) as Account['team'] } : {}),
  };
}
