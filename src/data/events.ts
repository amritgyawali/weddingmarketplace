import type { EventType } from '@/types/platform';

export interface EventTypeDef {
  id: EventType;
  label: string;
  icon: string;
  /** Default start time (24h). */
  start: string;
  /** Share of the main guest list usually invited. */
  guestShare: number;
  /** Services couples usually need for this function. */
  suggestedServices: string[];
  /** Run-sheet template: [time, title, owner]. */
  runSheet: [string, string, string][];
  /** Shown first in the planner (wedding functions); the rest are life events. */
  wedding: boolean;
}

export const EVENT_TYPES: EventTypeDef[] = [
  {
    id: 'WEDDING',
    label: 'Wedding',
    icon: 'heart',
    start: '10:00',
    guestShare: 1,
    wedding: true,
    suggestedServices: ['venue', 'catering', 'photography', 'videography', 'decoration', 'makeup', 'pandit', 'panche-baja', 'transport'],
    runSheet: [
      ['08:00', 'Decor final walkthrough', 'Decorator'],
      ['08:30', 'Bride makeup & styling', 'Makeup artist'],
      ['10:00', 'Janti departs with Panche Baja', 'Coordinator'],
      ['11:00', 'Janti welcome & Swagat', 'Family'],
      ['11:30', 'Swayambar & Kanyadan', 'Pandit'],
      ['13:00', 'Lunch service opens', 'Catering'],
      ['15:00', 'Sindoor-halne & Saptapadi', 'Pandit'],
      ['17:00', 'Bidai', 'Family'],
    ],
  },
  {
    id: 'ENGAGEMENT',
    label: 'Engagement (Sagai)',
    icon: 'diamond',
    start: '11:00',
    guestShare: 0.5,
    wedding: true,
    suggestedServices: ['venue', 'catering', 'photography', 'decoration', 'makeup'],
    runSheet: [
      ['11:00', 'Guests arrive', 'Coordinator'],
      ['12:00', 'Ring exchange & Sagun', 'Family'],
      ['12:30', 'Lunch', 'Catering'],
      ['14:00', 'Family portraits', 'Photographer'],
    ],
  },
  {
    id: 'PRE_WEDDING',
    label: 'Pre-wedding Shoot',
    icon: 'camera',
    start: '06:00',
    guestShare: 0,
    wedding: true,
    suggestedServices: ['pre-wedding', 'makeup', 'drone'],
    runSheet: [
      ['05:30', 'Makeup & first outfit', 'Makeup artist'],
      ['06:30', 'Sunrise location', 'Photographer'],
      ['10:00', 'Second location & outfit', 'Photographer'],
    ],
  },
  {
    id: 'MEHENDI',
    label: 'Mehendi',
    icon: 'hand-left',
    start: '11:00',
    guestShare: 0.35,
    wedding: true,
    suggestedServices: ['mehendi', 'decoration', 'catering', 'photography', 'dj'],
    runSheet: [
      ['11:00', 'Mehendi artists set up', 'Mehendi team'],
      ['12:00', 'Bride mehendi begins', 'Mehendi artist'],
      ['13:30', 'Lunch & music', 'Catering'],
      ['16:00', 'Guest mehendi wraps up', 'Coordinator'],
    ],
  },
  {
    id: 'HALDI',
    label: 'Haldi',
    icon: 'sunny',
    start: '09:00',
    guestShare: 0.3,
    wedding: true,
    suggestedServices: ['decoration', 'photography', 'catering'],
    runSheet: [
      ['09:00', 'Haldi setup', 'Decorator'],
      ['10:00', 'Haldi ceremony', 'Family'],
      ['11:30', 'Brunch', 'Catering'],
    ],
  },
  {
    id: 'SANGEET',
    label: 'Sangeet',
    icon: 'musical-notes',
    start: '18:00',
    guestShare: 0.6,
    wedding: true,
    suggestedServices: ['venue', 'dj', 'choreographer', 'sound', 'lighting', 'catering', 'photography'],
    runSheet: [
      ['18:00', 'Sound check & lights', 'DJ'],
      ['19:30', 'Family performances', 'Choreographer'],
      ['21:00', 'Couple performance', 'Couple'],
      ['21:30', 'DJ night', 'DJ'],
    ],
  },
  {
    id: 'RECEPTION',
    label: 'Reception',
    icon: 'wine',
    start: '18:00',
    guestShare: 1.1,
    wedding: true,
    suggestedServices: ['venue', 'catering', 'photography', 'videography', 'decoration', 'dj', 'makeup', 'lighting'],
    runSheet: [
      ['18:00', 'Guests arrive, welcome drinks', 'Catering'],
      ['19:00', 'Couple entry', 'Coordinator'],
      ['19:30', 'Stage photographs', 'Photographer'],
      ['20:00', 'Dinner', 'Catering'],
      ['22:30', 'Send-off', 'Coordinator'],
    ],
  },
  {
    id: 'POST_WEDDING',
    label: 'Post-wedding Shoot',
    icon: 'images',
    start: '07:00',
    guestShare: 0,
    wedding: true,
    suggestedServices: ['photography', 'videography', 'drone'],
    runSheet: [['07:00', 'Couple shoot', 'Photographer']],
  },
  {
    id: 'RELIGIOUS_CEREMONY',
    label: 'Puja / Religious Ceremony',
    icon: 'flame',
    start: '08:00',
    guestShare: 0.25,
    wedding: true,
    suggestedServices: ['pandit', 'catering', 'photography'],
    runSheet: [
      ['08:00', 'Puja setup', 'Pandit'],
      ['09:00', 'Puja', 'Pandit'],
      ['11:00', 'Prasad & lunch', 'Catering'],
    ],
  },
  {
    id: 'WELCOME_DINNER',
    label: 'Welcome Dinner',
    icon: 'restaurant',
    start: '19:00',
    guestShare: 0.4,
    wedding: true,
    suggestedServices: ['venue', 'catering', 'live-band'],
    runSheet: [['19:00', 'Dinner', 'Catering']],
  },
  {
    id: 'BACHELOR_PARTY',
    label: 'Bachelor / Bachelorette',
    icon: 'sparkles',
    start: '19:00',
    guestShare: 0.1,
    wedding: true,
    suggestedServices: ['venue', 'dj', 'bartending'],
    runSheet: [['19:00', 'Party', 'Friends']],
  },
  {
    id: 'BRIDAL_SHOWER',
    label: 'Bridal Shower',
    icon: 'rose',
    start: '15:00',
    guestShare: 0.1,
    wedding: true,
    suggestedServices: ['decoration', 'cake', 'photography'],
    runSheet: [['15:00', 'Shower games & high tea', 'Friends']],
  },
  {
    id: 'AFTER_PARTY',
    label: 'After-party',
    icon: 'moon',
    start: '22:00',
    guestShare: 0.2,
    wedding: true,
    suggestedServices: ['dj', 'bartending'],
    runSheet: [['22:00', 'After-party', 'DJ']],
  },
  {
    id: 'NWARAN',
    label: 'Nwaran (Naming ceremony)',
    icon: 'happy',
    start: '09:00',
    guestShare: 0.5,
    wedding: false,
    suggestedServices: ['pandit', 'catering', 'photography'],
    runSheet: [
      ['09:00', 'Purification puja', 'Pandit'],
      ['10:00', 'Naming and the baby’s first sun', 'Family'],
      ['11:00', 'Blessings and lunch', 'Catering'],
    ],
  },
  {
    id: 'PASNI',
    label: 'Pasni (Rice Feeding)',
    icon: 'happy',
    start: '10:00',
    guestShare: 1,
    wedding: false,
    suggestedServices: ['venue', 'catering', 'photography', 'pandit', 'decoration'],
    runSheet: [
      ['10:00', 'Puja & first rice feeding', 'Pandit'],
      ['11:30', 'Blessings (tika)', 'Family'],
      ['12:30', 'Lunch', 'Catering'],
    ],
  },
  {
    id: 'BRATABANDHA',
    label: 'Bratabandha',
    icon: 'flame',
    start: '07:00',
    guestShare: 1,
    wedding: false,
    suggestedServices: ['venue', 'catering', 'photography', 'pandit', 'panche-baja'],
    runSheet: [
      ['07:00', 'Kshaurakarma (head shaving)', 'Pandit'],
      ['09:00', 'Janai ceremony', 'Pandit'],
      ['11:00', 'Bhiksha & blessings', 'Family'],
      ['13:00', 'Lunch', 'Catering'],
    ],
  },
  { id: 'ANNIVERSARY', label: 'Anniversary', icon: 'heart-circle', start: '18:30', guestShare: 1, wedding: false, suggestedServices: ['venue', 'catering', 'photography', 'cake', 'dj'], runSheet: [['18:30', 'Celebration', 'Coordinator']] },
  { id: 'BABY_SHOWER', label: 'Baby Shower', icon: 'balloon', start: '15:00', guestShare: 1, wedding: false, suggestedServices: ['decoration', 'cake', 'photography', 'catering'], runSheet: [['15:00', 'Baby shower', 'Family']] },
  { id: 'BIRTHDAY', label: 'Birthday', icon: 'balloon', start: '17:00', guestShare: 1, wedding: false, suggestedServices: ['venue', 'cake', 'decoration', 'photography', 'dj'], runSheet: [['17:00', 'Cake cutting', 'Family']] },
  { id: 'CORPORATE_EVENT', label: 'Corporate Event', icon: 'briefcase', start: '09:00', guestShare: 1, wedding: false, suggestedServices: ['venue', 'catering', 'sound', 'led-screen', 'photography'], runSheet: [['09:00', 'Registration', 'Coordinator']] },
  { id: 'OTHER', label: 'Other / Custom', icon: 'calendar', start: '11:00', guestShare: 1, wedding: false, suggestedServices: ['venue', 'catering', 'photography'], runSheet: [] },
];

export const EVENT_TYPE_BY_ID = Object.fromEntries(EVENT_TYPES.map((e) => [e.id, e])) as Record<EventType, EventTypeDef>;
export const eventLabel = (t: EventType) => EVENT_TYPE_BY_ID[t]?.label ?? t;

/** What couples usually pick in step 1 of "Plan my wedding". */
export const PLAN_STARTERS: EventType[] = ['WEDDING', 'ENGAGEMENT', 'PASNI', 'PRE_WEDDING', 'RECEPTION', 'BRATABANDHA', 'OTHER'];

export const GUEST_BANDS = [
  { id: '<100', label: 'Under 100', value: 80 },
  { id: '100-300', label: '100 – 300', value: 200 },
  { id: '300-500', label: '300 – 500', value: 400 },
  { id: '500-1000', label: '500 – 1,000', value: 700 },
  { id: '1000+', label: '1,000+', value: 1200 },
] as const;

export type GuestBand = (typeof GUEST_BANDS)[number]['id'];
export const bandFor = (guests: number): GuestBand =>
  guests < 100 ? '<100' : guests < 300 ? '100-300' : guests < 500 ? '300-500' : guests < 1000 ? '500-1000' : '1000+';

/** Nepali (Bikram Sambat) month names, for display alongside AD dates. */
export const BS_MONTHS = ['Baisakh', 'Jestha', 'Asar', 'Shrawan', 'Bhadra', 'Asoj', 'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'];

/**
 * Approximate BS month for an AD date. Nepali months start mid-month
 * (Baisakh ≈ 14 April). Good enough to label wedding seasons; exact
 * conversion needs the official calendar table.
 */
export function bsMonthLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  // Month index where Baisakh starts in mid-April (AD month 4, day ~14).
  const shifted = (m - 4 + 12 + (d >= 15 ? 0 : -1)) % 12;
  const bsYear = y + 56 + (m > 4 || (m === 4 && d >= 14) ? 1 : 0);
  return `${BS_MONTHS[(shifted + 12) % 12]} ${bsYear}`;
}

/** Nepal's peak wedding seasons (Mangsir, Magh, Falgun, Baisakh). */
export const isPeakSeason = (iso: string) => ['Mangsir', 'Magh', 'Falgun', 'Baisakh'].includes(bsMonthLabel(iso).split(' ')[0]);
