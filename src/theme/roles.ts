import { colors, fonts as manrope, type FontWeight } from '@/constants/theme';
import type { UserRole } from '@/types/platform';

export interface RolePalette {
  primary: string;
  primaryDark: string;
  onPrimary: string;
  soft: string;
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textStrong: string;
  muted: string;
  subtle: string;
  header: string;
  onHeader: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
}

export interface RoleTheme {
  role: UserRole;
  label: string;
  tagline: string;
  dark: boolean;
  fonts: Record<FontWeight, string>;
  c: RolePalette;
  gradient: readonly [string, string, ...string[]];
  cardRadius: number;
}

const jakarta: Record<FontWeight, string> = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
};

const grotesk: Record<FontWeight, string> = {
  regular: 'SpaceGrotesk_400Regular',
  medium: 'SpaceGrotesk_500Medium',
  semibold: 'SpaceGrotesk_600SemiBold',
  bold: 'SpaceGrotesk_700Bold',
  extrabold: 'SpaceGrotesk_700Bold',
};

const inter: Record<FontWeight, string> = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
};

export const ROLE_THEMES: Record<UserRole, RoleTheme> = {
  customer: {
    role: 'customer',
    label: 'Couple',
    tagline: 'Plan your wedding, discover venues & vendors',
    dark: false,
    fonts: manrope,
    c: {
      primary: colors.primary,
      primaryDark: colors.primaryDark,
      onPrimary: colors.white,
      soft: colors.primarySoft,
      bg: colors.bgSoft,
      surface: colors.white,
      surfaceAlt: colors.bgMuted,
      border: colors.border,
      text: colors.text,
      textStrong: colors.textStrong,
      muted: colors.textMuted,
      subtle: colors.textSubtle,
      header: colors.white,
      onHeader: colors.heading,
      success: colors.success,
      warning: '#D97706',
      danger: colors.danger,
      info: '#2563EB',
    },
    gradient: ['#E8317A', '#FA8C5E'],
    cardRadius: 16,
  },
  vendor: {
    role: 'vendor',
    label: 'Vendor',
    tagline: 'Venues & wedding businesses — leads, quotes, projects',
    dark: false,
    fonts: jakarta,
    c: {
      primary: '#0F766E',
      primaryDark: '#115E59',
      onPrimary: '#FFFFFF',
      soft: '#E3F4F1',
      bg: '#F3F6F5',
      surface: '#FFFFFF',
      surfaceAlt: '#EEF3F2',
      border: '#DDE7E4',
      text: '#1F2937',
      textStrong: '#0B1B19',
      muted: '#64748B',
      subtle: '#94A3B8',
      header: '#0F766E',
      onHeader: '#FFFFFF',
      success: '#16A34A',
      warning: '#D97706',
      danger: '#DC2626',
      info: '#0284C7',
    },
    gradient: ['#0F766E', '#14B8A6'],
    cardRadius: 14,
  },
  freelancer: {
    role: 'freelancer',
    label: 'Freelancer',
    tagline: 'Photographers, makeup artists, crew — find wedding gigs',
    dark: true,
    fonts: grotesk,
    c: {
      primary: '#F5A524',
      primaryDark: '#D98A0B',
      onPrimary: '#111418',
      soft: '#2A2416',
      bg: '#0C0F14',
      surface: '#161B22',
      surfaceAlt: '#1F2630',
      border: '#2A323D',
      text: '#E6EAF0',
      textStrong: '#FFFFFF',
      muted: '#98A2B3',
      subtle: '#667085',
      header: '#0C0F14',
      onHeader: '#FFFFFF',
      success: '#34D399',
      warning: '#FBBF24',
      danger: '#F87171',
      info: '#60A5FA',
    },
    gradient: ['#F5A524', '#F97316'],
    cardRadius: 20,
  },
  platform: {
    role: 'platform',
    label: 'Platform Team',
    tagline: 'Vivah operations — planners, approvals & wedding execution',
    dark: false,
    fonts: inter,
    c: {
      primary: '#4F46E5',
      primaryDark: '#3730A3',
      onPrimary: '#FFFFFF',
      soft: '#EEF0FF',
      bg: '#F4F5FA',
      surface: '#FFFFFF',
      surfaceAlt: '#F0F1F7',
      border: '#E3E5EF',
      text: '#1F2433',
      textStrong: '#0E1122',
      muted: '#6B7185',
      subtle: '#9AA0B4',
      header: '#1B1745',
      onHeader: '#FFFFFF',
      success: '#16A34A',
      warning: '#D97706',
      danger: '#DC2626',
      info: '#0EA5E9',
    },
    gradient: ['#1B1745', '#4F46E5'],
    cardRadius: 12,
  },
};

const TONES: Record<string, 'info' | 'muted' | 'warning' | 'danger' | 'success' | 'primary'> = {
  // neutral / informational
  new: 'info', open: 'info', applied: 'info', planned: 'info', upcoming: 'info', viewed: 'info', quoted: 'info', planning: 'info',
  reviewing: 'info', matching: 'info', matching_providers: 'info', quote_prepared: 'info', invited: 'info', responded: 'info',
  document_submitted: 'info', saved: 'info', suggested: 'info', proposed: 'info', available: 'info', meeting: 'info', accrued: 'info',
  todo: 'muted', draft: 'muted', low: 'muted', not_started: 'muted', unverified: 'muted', archived: 'muted', superseded: 'muted', expired: 'muted',
  withdrawn: 'muted', closed: 'muted', waived: 'muted', void: 'muted',
  // attention
  pending: 'warning', contacted: 'warning', sent: 'warning', shortlisted: 'warning', revision: 'warning', due: 'warning', doing: 'warning',
  in_progress: 'warning', medium: 'warning', held: 'warning', tentative: 'warning', waiting: 'warning', needs_clarification: 'warning',
  quote_sent: 'warning', customer_negotiating: 'warning', negotiating: 'warning', under_review: 'warning', ready_for_review: 'warning',
  revision_requested: 'warning', partially_paid: 'warning', on_hold: 'warning', requested: 'warning', investigating: 'warning', maybe: 'warning',
  flagged: 'warning', partially_signed: 'warning', quote_received: 'warning', assigned: 'warning', checked_in: 'primary',
  // problems
  live: 'danger', delayed: 'danger', lost: 'danger', declined: 'danger', rejected: 'danger', cancelled: 'danger', high: 'danger', urgent: 'danger',
  execution: 'danger', overdue: 'danger', failed: 'danger', no_show: 'danger', emergency_replacement: 'danger', quote_rejected: 'danger',
  suspended: 'danger', removed: 'danger', unavailable: 'danger', no: 'danger', booked_out: 'danger', dispute: 'danger',
  // good
  won: 'success', accepted: 'success', booked: 'success', hired: 'success', paid: 'success', done: 'success', completed: 'success',
  approved: 'success', resolved: 'success', filled: 'success', confirmed: 'success', verified: 'success', delivered: 'success', ready: 'success',
  succeeded: 'success', processed: 'success', yes: 'success', published: 'success', signed: 'success', selected: 'success',
};

/** Colour for any workflow status string, shared by every role's status pills. */
export function statusTone(status: string, t: RoleTheme): { fg: string; bg: string } {
  const alpha = (hex: string) => `${hex}${t.dark ? '33' : '1A'}`;
  const tone = TONES[status.toLowerCase()];
  const fg = tone === 'info' ? t.c.info : tone === 'warning' ? t.c.warning : tone === 'danger' ? t.c.danger : tone === 'success' ? t.c.success : tone === 'primary' ? t.c.primary : t.c.muted;
  return { fg, bg: alpha(fg) };
}

/** "QUOTE_SENT" / "in_progress" → "Quote sent" / "In progress". */
export const statusLabel = (s: string) => {
  const text = s.replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
};
