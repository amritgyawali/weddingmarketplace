/**
 * The capability catalogue: every atomic feature a provider or customer can
 * have. Screens ask `has('media.camera')`, never "is this a photographer?", so
 * adding a trade or an occasion is a data change, not a screen change.
 *
 * Mirrored by `capabilities` in supabase/migrations/0005_personas.sql.
 */

export const PROVIDER_CAPABILITIES = [
  // core: every vendor and freelancer
  'core.leads',
  'core.quotes',
  'core.bookings',
  'core.calendar',
  'core.finance',
  'core.reviews',
  'core.portfolio',
  // team: businesses with staff (form venue or studio)
  'team.members',
  'team.roster',
  'team.hire_crew',
  // space: venues
  'space.halls',
  'space.capacity',
  'space.site_visits',
  'space.in_house_catering',
  // media: photo and film
  'media.camera',
  'media.deliverables',
  'media.gallery',
  'media.card_backup',
  'media.shot_list',
  'media.editing_queue',
  // beauty
  'beauty.trials',
  'beauty.product_kit',
  'beauty.looks',
  // decor and floral
  'decor.themes',
  'decor.rental_inventory',
  'decor.setup_teardown',
  'decor.suppliers',
  // catering and cake
  'food.menu',
  'food.per_plate',
  'food.tastings',
  'food.final_headcount',
  // music and entertainment
  'music.gear',
  'music.requests',
  'music.setlist',
  // sound, light and AV
  'av.gear',
  'av.power_load',
  // fashion
  'fashion.catalogue',
  'fashion.fittings',
  'fashion.rentals',
  // rituals
  'rituals.muhurta',
  'rituals.samagri',
  // transport and stay
  'logistics.fleet',
  'logistics.routes',
  'logistics.rooms',
  // stationery and gifts
  'stationery.proofs',
  'stationery.print_runs',
] as const;

/**
 * Planner modules a customer's occasion switches on. Each becomes the
 * capability `plan.<module>`. Tools used by every occasion (shot list, music,
 * menu, contacts…) are not modules: they are always shown.
 */
export const PLANNER_MODULES = [
  'guests',
  'seating',
  'website',
  'registry',
  'invitations',
  'janti',
  'honeymoon',
  'outfits',
  'sait',
  'samagri',
  'tips',
  'duties',
  'keepsakes',
  'surprise',
  'games',
  'agenda',
] as const;

export type ProviderCapability = (typeof PROVIDER_CAPABILITIES)[number];
export type PlannerModule = (typeof PLANNER_MODULES)[number];
export type PlanCapability = `plan.${PlannerModule}`;
export type Capability = ProviderCapability | PlanCapability;

export const planCap = (m: PlannerModule): PlanCapability => `plan.${m}`;

/** Every capability, for validation and the registry check. */
export const CAPABILITIES: readonly Capability[] = [...PROVIDER_CAPABILITIES, ...PLANNER_MODULES.map(planCap)];

const CAPABILITY_SET = new Set<string>(CAPABILITIES);
export const isCapability = (x: string): x is Capability => CAPABILITY_SET.has(x);

/** Human labels for the planner modules (admin screens, occasion editor). */
export const PLANNER_MODULE_LABELS: Record<PlannerModule, string> = {
  guests: 'Guest list and RSVPs',
  seating: 'Seating',
  website: 'Event website',
  registry: 'Gift registry',
  invitations: 'Invitations',
  janti: 'Janti planner',
  honeymoon: 'Honeymoon or trip planner',
  outfits: 'Outfits and jewellery',
  sait: 'Sait finder',
  samagri: 'Puja samagri',
  tips: 'Tips and dakshina',
  duties: 'Family duties',
  keepsakes: 'Baby keepsakes',
  surprise: 'Surprise plan',
  games: 'Games and activities',
  agenda: 'Agenda',
};
