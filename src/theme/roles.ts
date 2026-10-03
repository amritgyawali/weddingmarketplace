import { colors, fonts as mukta, type FontWeight } from '@/constants/theme';
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
  /** Control boundaries (inputs, toggles, outline buttons): 3 : 1 on the background. */
  borderStrong: string;
  /** Champagne: thin rules, the active tab mark, ratings. Never text on light surfaces. */
  accent: string;
  /** Champagne deep enough for text on light surfaces. */
  accentText: string;
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

const neutral = {
  bg: colors.bg,
  surface: colors.white,
  surfaceAlt: colors.bgSoft,
  border: colors.border,
  borderStrong: colors.borderStrong,
  accent: colors.gold,
  accentText: colors.goldDeep,
  text: colors.text,
  textStrong: colors.textStrong,
  muted: colors.textMuted,
  subtle: colors.textSubtle,
  header: colors.white,
  onHeader: colors.heading,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
  info: colors.info,
} as const;

/**
 * One design system, four apps. Every role shares the "Royal Nepali Luxury"
 * palette (ivory and pearl neutrals, espresso ink, champagne accents), the
 * type, the spacing and the component shapes. Couple, business and
 * freelancer apps share the burgundy accent; the staff console uses the
 * deeper wine so a coordinator can tell at a glance which app they are in.
 */
export const ROLE_THEMES: Record<UserRole, RoleTheme> = {
  customer: {
    role: 'customer',
    label: 'Couple',
    tagline: 'Plan the wedding, compare venues and vendors, pay in one place',
    dark: false,
    fonts: mukta,
    c: {
      ...neutral,
      primary: colors.primary,
      primaryDark: colors.primaryDark,
      onPrimary: colors.white,
      soft: colors.primarySoft,
      header: colors.white,
      onHeader: colors.heading,
    },
    gradient: [colors.primary, colors.primary],
    cardRadius: 10,
  },
  vendor: {
    role: 'vendor',
    label: 'Venue or business',
    tagline: 'Leads, quotations, bookings and payouts for your business',
    dark: false,
    fonts: mukta,
    c: {
      ...neutral,
      primary: colors.primary,
      primaryDark: colors.primaryDark,
      onPrimary: colors.white,
      soft: colors.primarySoft,
    },
    gradient: [colors.primary, colors.primary],
    cardRadius: 10,
  },
  freelancer: {
    role: 'freelancer',
    label: 'Freelancer',
    tagline: 'Photographers, makeup artists and crew: find wedding work',
    dark: false,
    fonts: mukta,
    c: {
      ...neutral,
      primary: colors.primary,
      primaryDark: colors.primaryDark,
      onPrimary: colors.white,
      soft: colors.primarySoft,
    },
    gradient: [colors.primary, colors.primary],
    cardRadius: 10,
  },
  platform: {
    role: 'platform',
    label: 'Vivah staff',
    tagline: 'Coordination, approvals, finance and wedding-day operations',
    dark: false,
    fonts: mukta,
    c: {
      ...neutral,
      primary: colors.wine,
      primaryDark: colors.wineDeep,
      onPrimary: colors.white,
      soft: colors.wineSoft,
    },
    gradient: [colors.wine, colors.wine],
    cardRadius: 8,
  },
};

/**
 * Small marks that tell roles apart where several meet on one screen (chat
 * bubbles, member chips). Accents stay burgundy; these are only for labels.
 */
export const ROLE_MARK: Record<UserRole, string> = {
  customer: colors.primary,
  vendor: colors.goldDeep,
  freelancer: colors.roseDeep,
  platform: colors.wine,
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
