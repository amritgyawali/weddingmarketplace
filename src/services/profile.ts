/**
 * Profile edits for every role: what a person may change about themselves
 * and how it is cleaned before it is saved (on the device by
 * `useSession.updateMyProfile`, on Supabase by rpc_update_my_profile in
 * supabase/migrations/0022_profile_support.sql, which applies the same rules).
 */
import { CITIES } from '@/data/cities';
import type { Account } from '@/types/platform';

/** The fields a person edits on Edit profile. Phone (how they sign in), role and verification are changed by the Vivah team. */
export type ProfilePatch = Partial<Pick<Account, 'name' | 'email' | 'city' | 'photo' | 'businessName' | 'bio' | 'headline' | 'experienceYears' | 'languages'>>;

export const PROFILE_LIMITS = {
  nameMin: 2,
  nameMax: 60,
  businessMax: 80,
  headlineMax: 80,
  bioMax: 600,
  experienceMax: 60,
  languagesMax: 8,
} as const;

/** Cities a profile can be in (Nepal cities and towns, not provinces or "All Nepal"). */
export const PROFILE_CITIES = CITIES.filter((c) => c.group !== 'state' && c.id !== 'all').map((c) => c.name);

export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

const tidy = (value: string) => value.trim().replace(/\s+/g, ' ');

/**
 * Cleans an edit for this account. Returns the fields to save, or the first
 * problem to show. Fields that don't apply to the role are dropped.
 */
export function cleanProfile(patch: ProfilePatch, account: Pick<Account, 'role'>): { value?: ProfilePatch; error?: string } {
  const value: ProfilePatch = {};
  if (patch.name !== undefined) {
    const name = tidy(patch.name);
    if (name.length < PROFILE_LIMITS.nameMin) return { error: 'Enter your name' };
    if (name.length > PROFILE_LIMITS.nameMax) return { error: `Keep your name under ${PROFILE_LIMITS.nameMax} characters` };
    value.name = name;
  }
  if (patch.email !== undefined) {
    const email = patch.email.trim().toLowerCase();
    if (email && !isEmail(email)) return { error: 'Enter a valid email, like name@example.com' };
    value.email = email || undefined;
  }
  if (patch.city !== undefined) {
    if (!PROFILE_CITIES.includes(patch.city)) return { error: 'Pick a city in Nepal' };
    value.city = patch.city;
  }
  if (patch.photo !== undefined) {
    const photo = patch.photo?.trim();
    if (photo && !/^(https:|file:|content:|ph:|blob:|vivah-file:|data:image\/)/.test(photo)) return { error: 'That photo can’t be used' };
    value.photo = photo || undefined;
  }
  if (account.role === 'vendor' && patch.businessName !== undefined) {
    const business = tidy(patch.businessName);
    if (business.length < 2) return { error: 'Enter your business name' };
    value.businessName = business.slice(0, PROFILE_LIMITS.businessMax);
  }
  if (account.role === 'vendor' || account.role === 'freelancer') {
    if (patch.bio !== undefined) value.bio = patch.bio.trim().slice(0, PROFILE_LIMITS.bioMax) || undefined;
  }
  if (account.role === 'freelancer') {
    if (patch.headline !== undefined) value.headline = tidy(patch.headline).slice(0, PROFILE_LIMITS.headlineMax) || undefined;
    if (patch.experienceYears !== undefined) {
      const years = Math.round(Number(patch.experienceYears));
      if (!Number.isFinite(years) || years < 0 || years > PROFILE_LIMITS.experienceMax) return { error: 'Enter your years of experience (0 to 60)' };
      value.experienceYears = years;
    }
    if (patch.languages !== undefined) value.languages = [...new Set(patch.languages.map(tidy).filter(Boolean))].slice(0, PROFILE_LIMITS.languagesMax);
  }
  return { value };
}
