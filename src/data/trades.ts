/**
 * Provider trades. The 38 services in `services.ts` stay the source of truth;
 * trades group them for onboarding tiles, navigation headings and copy, and
 * each service declares the capabilities it grants. Vendors and freelancers
 * share this taxonomy (a freelancer's trade is derived from their crew roles).
 *
 * Mirrored by `service_capabilities` in supabase/migrations/0005_personas.sql.
 */
import type { PhotoKey } from '@/constants/images';

import type { ProviderCapability } from './capabilities';
import { SERVICES } from './services';

export type TradeId = 'venue' | 'photo' | 'beauty' | 'decor' | 'food' | 'music' | 'av' | 'fashion' | 'rituals' | 'transport' | 'stationery' | 'planning';

/** How a business is set up; decides team and venue tools. */
export type BusinessForm = 'venue' | 'studio' | 'shop' | 'solo';

export type EssentialField =
  | { key: string; label: string; kind: 'text'; placeholder?: string }
  | { key: string; label: string; kind: 'number'; suffix?: string }
  | { key: string; label: string; kind: 'money' }
  | { key: string; label: string; kind: 'toggle' }
  | { key: string; label: string; kind: 'choice'; options: string[]; multi?: boolean };

export interface TradeDef {
  id: TradeId;
  label: string;
  /** One line under the onboarding tile. */
  blurb: string;
  icon: string;
  image: PhotoKey;
  /** Services in this trade; `core` ones are pre-checked in onboarding. */
  services: string[];
  core: string[];
  /** Services from other trades that businesses in this trade often add. */
  neighbours: string[];
  /** The form most businesses in this trade have. */
  defaultForm: BusinessForm;
  /** What "site visits" are called in this trade. */
  meetings: string;
  /** Two or three answers needed to go live (onboarding step 4). */
  essentials: EssentialField[];
}

export const TRADES: TradeDef[] = [
  {
    id: 'venue',
    label: 'Venue',
    blurb: 'Party palaces, banquets, hotels and gardens',
    icon: 'business-outline',
    image: 'venueLawn',
    services: ['venue'],
    core: ['venue'],
    neighbours: ['catering', 'decoration', 'tent-stage', 'accommodation'],
    defaultForm: 'venue',
    meetings: 'Site visits',
    essentials: [
      { key: 'seated', label: 'Largest hall, seated guests', kind: 'number', suffix: 'guests' },
      { key: 'floating', label: 'Largest hall, floating guests', kind: 'number', suffix: 'guests' },
      { key: 'inHouseCatering', label: 'In-house catering', kind: 'toggle' },
      { key: 'parking', label: 'Car parking spaces', kind: 'number', suffix: 'cars' },
    ],
  },
  {
    id: 'photo',
    label: 'Photo and film',
    blurb: 'Photography, films, drone, albums',
    icon: 'camera-outline',
    image: 'photographerCeremony',
    services: ['photography', 'videography', 'drone', 'pre-wedding', 'live-streaming', 'photo-booth', 'album'],
    core: ['photography', 'videography'],
    neighbours: ['live-streaming', 'photo-booth', 'album'],
    defaultForm: 'studio',
    meetings: 'Client meetings',
    essentials: [
      { key: 'startingPackage', label: 'Starting package price', kind: 'money' },
      { key: 'deliveryWeeks', label: 'Full delivery time', kind: 'number', suffix: 'weeks' },
      { key: 'styles', label: 'Styles', kind: 'choice', options: ['Candid', 'Traditional', 'Cinematic', 'Documentary', 'Fine art'], multi: true },
    ],
  },
  {
    id: 'beauty',
    label: 'Beauty',
    blurb: 'Bridal makeup, hair and mehendi',
    icon: 'color-palette-outline',
    image: 'makeupBridePortrait',
    services: ['makeup', 'mehendi'],
    core: ['makeup'],
    neighbours: ['bridal-wear', 'jewellery'],
    defaultForm: 'solo',
    meetings: 'Trials',
    essentials: [
      { key: 'looks', label: 'Looks offered', kind: 'choice', options: ['Bridal', 'Party', 'Engagement', 'Airbrush', 'HD', 'Hair styling'], multi: true },
      { key: 'trialPolicy', label: 'Trial policy', kind: 'choice', options: ['Free trial', 'Paid trial', 'No trials'] },
      { key: 'travelCharge', label: 'Travel charge outside the valley', kind: 'money' },
    ],
  },
  {
    id: 'decor',
    label: 'Decor and floral',
    blurb: 'Mandap, stage, flowers, lighting, tents',
    icon: 'flower-outline',
    image: 'decorMandapFloral',
    services: ['decoration', 'florist', 'lighting', 'tent-stage', 'furniture-rental'],
    core: ['decoration'],
    neighbours: ['florist', 'lighting', 'tent-stage'],
    defaultForm: 'studio',
    meetings: 'Design meetings',
    essentials: [
      { key: 'themes', label: 'Themes offered', kind: 'choice', options: ['Traditional', 'Floral', 'Royal', 'Minimal', 'Rustic', 'Newari', 'Pastel'], multi: true },
      { key: 'leadDays', label: 'Setup lead time', kind: 'number', suffix: 'days' },
      { key: 'coverage', label: 'Cities you cover', kind: 'text', placeholder: 'e.g. Kathmandu valley, Pokhara' },
    ],
  },
  {
    id: 'food',
    label: 'Catering and cake',
    blurb: 'Bhoj, buffets, cakes and bar',
    icon: 'restaurant-outline',
    image: 'venueGardenPavilion',
    services: ['catering', 'cake', 'bartending'],
    core: ['catering'],
    neighbours: ['cake', 'bartending', 'furniture-rental'],
    defaultForm: 'studio',
    meetings: 'Tastings',
    essentials: [
      { key: 'cuisines', label: 'Cuisines', kind: 'choice', options: ['Nepali', 'Newari', 'Thakali', 'Indian', 'Continental', 'Chinese'], multi: true },
      { key: 'minPlates', label: 'Minimum plates', kind: 'number', suffix: 'plates' },
      { key: 'vegPlate', label: 'Veg plate from', kind: 'money' },
      { key: 'nonVegPlate', label: 'Non-veg plate from', kind: 'money' },
    ],
  },
  {
    id: 'music',
    label: 'Music and entertainment',
    blurb: 'DJ, panche baja, bands, MC',
    icon: 'musical-notes-outline',
    image: 'ideaReceptionToast',
    services: ['dj', 'panche-baja', 'live-band', 'mc', 'choreographer'],
    core: ['dj'],
    neighbours: ['sound', 'lighting', 'led-screen'],
    defaultForm: 'solo',
    meetings: 'Planning calls',
    essentials: [
      { key: 'genres', label: 'Genres', kind: 'choice', options: ['Nepali pop', 'Lok dohori', 'Bollywood', 'Western', 'Classical', 'Newari'], multi: true },
      { key: 'setHours', label: 'Standard set length', kind: 'number', suffix: 'hours' },
      { key: 'ownGear', label: 'I bring my own sound system', kind: 'toggle' },
    ],
  },
  {
    id: 'av',
    label: 'Sound, light and AV',
    blurb: 'Sound, LED walls, generators',
    icon: 'flash-outline',
    image: 'venueLuxuryStage',
    services: ['sound', 'led-screen', 'generator'],
    core: ['sound'],
    neighbours: ['lighting', 'live-streaming', 'dj'],
    defaultForm: 'studio',
    meetings: 'Site checks',
    essentials: [
      { key: 'maxKva', label: 'Largest generator or load you handle', kind: 'number', suffix: 'kVA' },
      { key: 'crew', label: 'Technicians per event', kind: 'number', suffix: 'people' },
    ],
  },
  {
    id: 'fashion',
    label: 'Fashion',
    blurb: 'Bridal wear, daura suruwal, jewellery',
    icon: 'shirt-outline',
    image: 'ideaBrideParasol',
    services: ['bridal-wear', 'groom-wear', 'jewellery'],
    core: ['bridal-wear'],
    neighbours: ['groom-wear', 'jewellery', 'makeup'],
    defaultForm: 'shop',
    meetings: 'Fittings',
    essentials: [
      { key: 'mode', label: 'Rent or sell', kind: 'choice', options: ['Sell', 'Rent', 'Both'] },
      { key: 'fittings', label: 'Fitting appointments', kind: 'toggle' },
      { key: 'leadDays', label: 'Delivery lead time', kind: 'number', suffix: 'days' },
    ],
  },
  {
    id: 'rituals',
    label: 'Rituals',
    blurb: 'Purohit, puja and samagri',
    icon: 'bonfire-outline',
    image: 'ideaCeremonyHands',
    services: ['pandit'],
    core: ['pandit'],
    neighbours: ['panche-baja'],
    defaultForm: 'solo',
    meetings: 'Consultations',
    essentials: [
      { key: 'ceremonies', label: 'Ceremonies performed', kind: 'choice', options: ['Wedding', 'Bratabandha', 'Pasni', 'Nwaran', 'Griha pravesh', 'Puja'], multi: true },
      { key: 'languages', label: 'Languages', kind: 'choice', options: ['Nepali', 'Sanskrit', 'Maithili', 'Newari', 'Hindi'], multi: true },
    ],
  },
  {
    id: 'transport',
    label: 'Transport and stay',
    blurb: 'Wedding cars, buses, rooms, security',
    icon: 'car-outline',
    image: 'ideaCoupleGardenWalk',
    services: ['transport', 'accommodation', 'security'],
    core: ['transport'],
    neighbours: ['accommodation', 'security'],
    defaultForm: 'studio',
    meetings: 'Route checks',
    essentials: [
      { key: 'vehicles', label: 'Vehicles in your fleet', kind: 'number', suffix: 'vehicles' },
      { key: 'largestSeats', label: 'Largest vehicle', kind: 'number', suffix: 'seats' },
    ],
  },
  {
    id: 'stationery',
    label: 'Stationery and gifts',
    blurb: 'Cards, e-invites, favours',
    icon: 'mail-outline',
    image: 'virtualPlanningCouple',
    services: ['invitation', 'gifts'],
    core: ['invitation'],
    neighbours: ['gifts', 'album'],
    defaultForm: 'shop',
    meetings: 'Design meetings',
    essentials: [
      { key: 'minOrder', label: 'Minimum order', kind: 'number', suffix: 'cards' },
      { key: 'proofDays', label: 'First proof in', kind: 'number', suffix: 'days' },
    ],
  },
  {
    id: 'planning',
    label: 'Planning',
    blurb: 'Wedding planners and coordinators',
    icon: 'clipboard-outline',
    image: 'plannerTeam',
    services: ['planner'],
    core: ['planner'],
    neighbours: ['decoration', 'mc'],
    defaultForm: 'studio',
    meetings: 'Client meetings',
    essentials: [
      { key: 'eventsPerMonth', label: 'Events you can run per month', kind: 'number', suffix: 'events' },
      { key: 'coverage', label: 'Cities you cover', kind: 'text', placeholder: 'e.g. Kathmandu valley' },
    ],
  },
];

export const TRADE_BY_ID = Object.fromEntries(TRADES.map((t) => [t.id, t])) as Record<TradeId, TradeDef>;

/** The trade a service belongs to (every service belongs to exactly one). */
export const tradeOf = (serviceId: string): TradeDef | undefined => TRADES.find((t) => t.services.includes(serviceId));

const MEDIA_ALL: ProviderCapability[] = ['media.camera', 'media.deliverables', 'media.gallery', 'media.card_backup', 'media.shot_list', 'media.editing_queue'];
const FOOD_ALL: ProviderCapability[] = ['food.menu', 'food.per_plate', 'food.tastings', 'food.final_headcount'];
const BEAUTY_ALL: ProviderCapability[] = ['beauty.trials', 'beauty.product_kit', 'beauty.looks'];
const FASHION_ALL: ProviderCapability[] = ['fashion.catalogue', 'fashion.fittings', 'fashion.rentals'];

/** The capabilities each service grants. The registry check fails if a service is missing. */
export const SERVICE_CAPABILITIES: Record<string, ProviderCapability[]> = {
  venue: ['space.halls', 'space.capacity', 'space.site_visits', 'space.in_house_catering'],
  catering: FOOD_ALL,
  cake: ['food.menu', 'food.tastings'],
  bartending: ['food.menu', 'food.per_plate'],
  photography: MEDIA_ALL,
  videography: MEDIA_ALL,
  drone: ['media.camera', 'media.deliverables', 'media.card_backup'],
  'pre-wedding': MEDIA_ALL,
  'live-streaming': ['media.camera', 'av.gear', 'av.power_load'],
  'photo-booth': ['media.camera', 'media.gallery', 'av.power_load'],
  album: ['media.deliverables', 'media.editing_queue', 'stationery.proofs'],
  decoration: ['decor.themes', 'decor.rental_inventory', 'decor.setup_teardown', 'decor.suppliers'],
  florist: ['decor.themes', 'decor.setup_teardown', 'decor.suppliers'],
  lighting: ['decor.rental_inventory', 'decor.setup_teardown', 'av.gear', 'av.power_load'],
  'tent-stage': ['decor.rental_inventory', 'decor.setup_teardown', 'decor.suppliers'],
  'furniture-rental': ['decor.rental_inventory', 'decor.setup_teardown'],
  planner: ['decor.themes', 'decor.suppliers'],
  makeup: BEAUTY_ALL,
  mehendi: BEAUTY_ALL,
  dj: ['music.gear', 'music.requests', 'music.setlist', 'av.power_load'],
  'panche-baja': ['music.gear', 'music.setlist'],
  'live-band': ['music.gear', 'music.requests', 'music.setlist', 'av.power_load'],
  mc: ['music.requests', 'music.setlist'],
  choreographer: ['music.setlist'],
  sound: ['av.gear', 'av.power_load'],
  'led-screen': ['av.gear', 'av.power_load'],
  generator: ['av.gear', 'av.power_load'],
  'bridal-wear': FASHION_ALL,
  'groom-wear': FASHION_ALL,
  jewellery: ['fashion.catalogue', 'fashion.rentals'],
  pandit: ['rituals.muhurta', 'rituals.samagri'],
  transport: ['logistics.fleet', 'logistics.routes'],
  accommodation: ['logistics.rooms'],
  security: ['logistics.routes'],
  invitation: ['stationery.proofs', 'stationery.print_runs'],
  gifts: ['stationery.proofs', 'stationery.print_runs'],
};

/** Every vendor and freelancer gets these. */
export const CORE_CAPABILITIES: ProviderCapability[] = ['core.leads', 'core.quotes', 'core.bookings', 'core.calendar', 'core.finance', 'core.reviews', 'core.portfolio'];

/** Capabilities a business form adds on top of its services. */
export const FORM_CAPABILITIES: Record<BusinessForm, ProviderCapability[]> = {
  venue: ['team.members', 'team.roster', 'team.hire_crew'],
  studio: ['team.members', 'team.roster', 'team.hire_crew'],
  shop: [],
  solo: [],
};

export const BUSINESS_FORMS: { id: BusinessForm; label: string; blurb: string }[] = [
  { id: 'venue', label: 'Venue', blurb: 'Halls or grounds families book' },
  { id: 'studio', label: 'Team business', blurb: 'Staff or crew you send to events' },
  { id: 'shop', label: 'Shop', blurb: 'Products to sell or rent' },
  { id: 'solo', label: 'Just me', blurb: 'You do the work yourself' },
];

/** Crew role → the services that use it (a freelancer's trade is derived from these). */
export const SERVICES_BY_CREW_ROLE: Record<string, string[]> = SERVICES.reduce<Record<string, string[]>>((acc, s) => {
  for (const c of s.crew) acc[c.role] = [...(acc[c.role] ?? []), s.id];
  return acc;
}, {});
