/**
 * Customer occasions: what a family is celebrating. Each occasion decides the
 * functions offered, the services suggested and shown in the marketplace, the
 * planner modules and the words the app uses ("Pasni day", "family").
 *
 * These are the built-in defaults. The live list is `DbData.occasions`, which
 * a super admin can extend, edit or trim from the operations console.
 * Mirrored by `occasions` in supabase/migrations/0005_personas.sql.
 */
import type { EventType } from '@/types/platform';

import { PLANNER_MODULES, type PlannerModule } from './capabilities';
import { SERVICES } from './services';

export type BuiltInOccasionId = 'wedding' | 'engagement' | 'anniversary' | 'baby_shower' | 'newborn' | 'bratabandha' | 'birthday' | 'corporate' | 'other';
/** Built-in ids plus any id a super admin creates. */
export type OccasionId = BuiltInOccasionId | (string & {});

export type HonoureeKind = 'couple' | 'baby' | 'person' | 'org';

/** Words that change with the occasion. */
export interface OccasionVocab {
  /** "Wedding day", "Pasni day". */
  eventDay: string;
  /** "couple", "family", "team". */
  hosts: string;
  /** Planner title: "My wedding", "Pasni plan". */
  planTitle: string;
  /** "wedding", "celebration". */
  noun: string;
}

export type VocabKey = keyof OccasionVocab;

export interface OccasionDef {
  id: OccasionId;
  label: string;
  /** Short line under the onboarding tile. */
  blurb: string;
  icon: string;
  /** Functions offered, the first one is the main function. */
  eventTypes: EventType[];
  honourees: HonoureeKind;
  /** Services pre-selected when the plan is built. */
  defaultServices: string[];
  /** Services shown in the marketplace for this occasion; others are hidden. */
  services: string[];
  modules: PlannerModule[];
  /** Enables sait, samagri and pandit-first flows. */
  ritual: boolean;
  vocab: OccasionVocab;
  /** Tile order in onboarding. */
  order: number;
  /** Hidden from new plans when false; existing plans keep working. */
  active: boolean;
  /** Shipped with the app; "Reset demo data" restores the built-ins. */
  builtIn?: boolean;
  updatedAt?: string;
}

const ALL_SERVICES = SERVICES.map((s) => s.id);
const ALL_MODULES = [...PLANNER_MODULES];

const vocab = (eventDay: string, hosts: string, planTitle: string, noun: string): OccasionVocab => ({ eventDay, hosts, planTitle, noun });

export const BUILT_IN_OCCASIONS: OccasionDef[] = [
  {
    id: 'wedding',
    label: 'Wedding',
    blurb: 'Every function, from tilak to reception',
    icon: 'heart-outline',
    eventTypes: ['WEDDING', 'MEHENDI', 'HALDI', 'SANGEET', 'RECEPTION', 'ENGAGEMENT', 'PRE_WEDDING', 'POST_WEDDING'],
    honourees: 'couple',
    defaultServices: ['venue', 'catering', 'photography', 'videography', 'decoration', 'makeup', 'pandit', 'panche-baja'],
    services: ALL_SERVICES,
    modules: ['guests', 'seating', 'website', 'registry', 'invitations', 'janti', 'honeymoon', 'outfits', 'sait', 'samagri', 'tips', 'duties'],
    ritual: true,
    vocab: vocab('Wedding day', 'couple', 'My wedding', 'wedding'),
    order: 1,
    active: true,
    builtIn: true,
  },
  {
    id: 'engagement',
    label: 'Engagement',
    blurb: 'Sagai and ring ceremony',
    icon: 'diamond-outline',
    eventTypes: ['ENGAGEMENT'],
    honourees: 'couple',
    defaultServices: ['venue', 'catering', 'photography', 'decoration', 'makeup'],
    services: ['venue', 'catering', 'cake', 'photography', 'videography', 'photo-booth', 'decoration', 'florist', 'lighting', 'makeup', 'mehendi', 'dj', 'sound', 'live-band', 'mc', 'pandit', 'bridal-wear', 'groom-wear', 'jewellery', 'invitation', 'gifts', 'transport', 'planner'],
    modules: ['guests', 'invitations', 'website', 'outfits', 'sait', 'samagri', 'tips', 'duties'],
    ritual: true,
    vocab: vocab('Engagement day', 'couple', 'Our engagement', 'engagement'),
    order: 2,
    active: true,
    builtIn: true,
  },
  {
    id: 'anniversary',
    label: 'Anniversary',
    blurb: 'First, silver or golden, big or small',
    icon: 'heart-circle-outline',
    eventTypes: ['ANNIVERSARY'],
    honourees: 'couple',
    defaultServices: ['venue', 'catering', 'photography', 'cake', 'dj'],
    services: ['venue', 'catering', 'cake', 'bartending', 'photography', 'videography', 'photo-booth', 'decoration', 'florist', 'lighting', 'dj', 'live-band', 'sound', 'mc', 'invitation', 'gifts', 'accommodation', 'transport', 'planner'],
    modules: ['guests', 'seating', 'website', 'invitations', 'honeymoon', 'surprise'],
    ritual: false,
    vocab: vocab('Anniversary', 'couple', 'Our anniversary', 'celebration'),
    order: 3,
    active: true,
    builtIn: true,
  },
  {
    id: 'baby_shower',
    label: 'Baby shower',
    blurb: 'Godh bharai with family and friends',
    icon: 'balloon-outline',
    eventTypes: ['BABY_SHOWER'],
    honourees: 'couple',
    defaultServices: ['decoration', 'cake', 'photography', 'catering'],
    services: ['venue', 'decoration', 'florist', 'cake', 'catering', 'photography', 'photo-booth', 'makeup', 'mehendi', 'mc', 'invitation', 'gifts', 'planner'],
    modules: ['guests', 'invitations', 'registry', 'games'],
    ritual: false,
    vocab: vocab('Baby shower', 'family', 'Baby shower plan', 'celebration'),
    order: 4,
    active: true,
    builtIn: true,
  },
  {
    id: 'newborn',
    label: 'Newborn ceremony',
    blurb: 'Nwaran and pasni for the little one',
    icon: 'happy-outline',
    eventTypes: ['PASNI', 'RELIGIOUS_CEREMONY'],
    honourees: 'baby',
    defaultServices: ['pandit', 'photography', 'catering', 'decoration', 'cake'],
    services: ['pandit', 'venue', 'catering', 'cake', 'photography', 'videography', 'decoration', 'tent-stage', 'sound', 'invitation', 'gifts'],
    modules: ['guests', 'invitations', 'sait', 'samagri', 'tips', 'duties', 'keepsakes'],
    ritual: true,
    vocab: vocab('Pasni day', 'family', 'Pasni plan', 'celebration'),
    order: 5,
    active: true,
    builtIn: true,
  },
  {
    id: 'bratabandha',
    label: 'Bratabandha',
    blurb: 'Sacred thread ceremony',
    icon: 'bonfire-outline',
    eventTypes: ['BRATABANDHA'],
    honourees: 'person',
    defaultServices: ['pandit', 'venue', 'catering', 'photography', 'panche-baja'],
    services: ['pandit', 'venue', 'catering', 'photography', 'videography', 'panche-baja', 'decoration', 'tent-stage', 'sound', 'generator', 'invitation', 'transport', 'gifts'],
    modules: ['guests', 'invitations', 'sait', 'samagri', 'tips', 'duties'],
    ritual: true,
    vocab: vocab('Bratabandha day', 'family', 'Bratabandha plan', 'celebration'),
    order: 6,
    active: true,
    builtIn: true,
  },
  {
    id: 'birthday',
    label: 'Birthday',
    blurb: 'Kids’ parties to milestone birthdays',
    icon: 'gift-outline',
    eventTypes: ['BIRTHDAY'],
    honourees: 'person',
    defaultServices: ['venue', 'cake', 'decoration', 'photography', 'dj'],
    services: ['venue', 'cake', 'catering', 'bartending', 'decoration', 'lighting', 'photography', 'photo-booth', 'dj', 'live-band', 'sound', 'mc', 'invitation', 'gifts'],
    modules: ['guests', 'invitations', 'games'],
    ritual: false,
    vocab: vocab('Birthday', 'family', 'Birthday plan', 'party'),
    order: 7,
    active: true,
    builtIn: true,
  },
  {
    id: 'corporate',
    label: 'Corporate event',
    blurb: 'Launches, dinners and conferences',
    icon: 'briefcase-outline',
    eventTypes: ['CORPORATE_EVENT'],
    honourees: 'org',
    defaultServices: ['venue', 'catering', 'sound', 'led-screen', 'photography'],
    services: ['venue', 'catering', 'bartending', 'sound', 'led-screen', 'lighting', 'generator', 'photography', 'videography', 'live-streaming', 'mc', 'transport', 'accommodation', 'security', 'tent-stage', 'furniture-rental', 'invitation', 'gifts', 'planner'],
    modules: ['guests', 'seating', 'invitations', 'agenda'],
    ritual: false,
    vocab: vocab('Event day', 'team', 'Event plan', 'event'),
    order: 8,
    active: true,
    builtIn: true,
  },
  {
    id: 'other',
    label: 'Something else',
    blurb: 'Tell us what it is and pick your services',
    icon: 'add-circle-outline',
    eventTypes: ['OTHER'],
    honourees: 'person',
    defaultServices: ['venue', 'catering', 'photography'],
    services: ALL_SERVICES,
    modules: ALL_MODULES,
    ritual: false,
    vocab: vocab('Event day', 'family', 'My celebration', 'celebration'),
    order: 9,
    active: true,
    builtIn: true,
  },
];

export const DEFAULT_OCCASION_ID: BuiltInOccasionId = 'wedding';
/** Occasions that can never be deleted: the app falls back to them. */
export const PROTECTED_OCCASIONS: OccasionId[] = ['wedding', 'other'];

/** Fresh copies of the built-ins (seed data must not share references). */
export const builtInOccasions = (): OccasionDef[] => BUILT_IN_OCCASIONS.map((o) => ({ ...o, eventTypes: [...o.eventTypes], defaultServices: [...o.defaultServices], services: [...o.services], modules: [...o.modules], vocab: { ...o.vocab } }));

/** An occasion by id from a list (defaults to the built-ins). */
export const findOccasion = (id: string | undefined, list: OccasionDef[] = BUILT_IN_OCCASIONS): OccasionDef | undefined => (id ? list.find((o) => o.id === id) : undefined);

/** The built-in occasion whose functions include this event type (weddings first). */
export const occasionForEventType = (type: EventType, list: OccasionDef[] = BUILT_IN_OCCASIONS): OccasionDef =>
  list.find((o) => o.eventTypes[0] === type) ?? list.find((o) => o.eventTypes.includes(type)) ?? list.find((o) => o.id === DEFAULT_OCCASION_ID) ?? BUILT_IN_OCCASIONS[0];

/** Lower-case, underscored id for a new occasion label. */
export const occasionIdFor = (label: string) =>
  label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
