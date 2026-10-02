import type { PhotoKey } from '@/constants/images';

/**
 * The service taxonomy the whole platform runs on. A customer requirement,
 * a provider listing, a quote line, a booking, crew roles, review criteria and
 * budget allocation all reference one of these ids.
 */

export type RequirementField =
  | { key: string; label: string; kind: 'number'; default: number; min?: number; max?: number; step?: number; suffix?: string }
  | { key: string; label: string; kind: 'toggle'; default: boolean }
  | { key: string; label: string; kind: 'choice'; options: string[]; default: string };

export interface CrewRole {
  role: string;
  /** Crew needed for a typical booking of this service. */
  default: number;
  /** Typical freelancer day pay in NPR. */
  pay: number;
  equipment?: string[];
}

export interface ServiceDef {
  id: string;
  name: string;
  /** Ionicons glyph. */
  icon: string;
  group: ServiceGroupId;
  image: PhotoKey;
  /** How providers price it (drives quote units and estimates). */
  unit: 'per event' | 'per day' | 'per plate' | 'per person' | 'per car' | 'per card' | 'per package';
  /** Local price range in NPR for one unit. */
  priceRange: [number, number];
  /** Share of an overall budget when this service is selected (normalised). */
  budgetShare: number;
  styles: string[];
  fields: RequirementField[];
  crew: CrewRole[];
  reviewCriteria: string[];
  /** Deliverables created automatically when a booking is confirmed. */
  deliverables?: { title: string; kind: DeliverableKind; qty?: number; unit?: string; dueDays: number }[];
  /** Popular — shown first in the requirement builder. */
  core?: boolean;
}

export type DeliverableKind = 'photos' | 'film' | 'highlight' | 'teaser' | 'album' | 'raw' | 'design' | 'other';

export type ServiceGroupId =
  | 'venue'
  | 'photo-video'
  | 'beauty'
  | 'decor'
  | 'food'
  | 'entertainment'
  | 'fashion'
  | 'rituals'
  | 'logistics'
  | 'vehicles'
  | 'stationery';

export const SERVICE_GROUPS: { id: ServiceGroupId; title: string; subtitle: string; image: PhotoKey; bg: string }[] = [
  { id: 'venue', title: 'Venues', subtitle: 'Party palaces, banquets, hotels & resorts', image: 'venueLawn', bg: '#D8DFFA' },
  { id: 'photo-video', title: 'Photo & Video', subtitle: 'Photography, films, drone, live streaming', image: 'photographerCeremony', bg: '#F6D8C6' },
  { id: 'beauty', title: 'Makeup & Mehendi', subtitle: 'Bridal makeup, hair, mehendi artists', image: 'makeupBridePortrait', bg: '#E0B0AB' },
  { id: 'decor', title: 'Planning & Decor', subtitle: 'Planners, decorators, florists, lighting', image: 'decorMandapFloral', bg: '#F6B796' },
  { id: 'food', title: 'Food & Cake', subtitle: 'Catering, cakes, bartending', image: 'venueGardenPavilion', bg: '#F4E3B8' },
  { id: 'entertainment', title: 'Music & Entertainment', subtitle: 'DJ, Panche Baja, live band, MC, sound', image: 'ideaReceptionToast', bg: '#D9E7F2' },
  { id: 'fashion', title: 'Wear & Jewellery', subtitle: 'Bridal wear, Daura Suruwal, jewellery', image: 'ideaBrideParasol', bg: '#F3CCD8' },
  { id: 'rituals', title: 'Pandit & Rituals', subtitle: 'Purohit, puja samagri', image: 'ideaCeremonyHands', bg: '#F2D2BD' },
  { id: 'logistics', title: 'Transport & Logistics', subtitle: 'Wedding cars, buses, stay, security', image: 'ideaCoupleGardenWalk', bg: '#D6E4D4' },
  { id: 'vehicles', title: 'Vehicles', subtitle: 'Decorated cars, jeeps, buses, baggi and doli', image: 'venueResortSunset', bg: '#DCE3EC' },
  { id: 'stationery', title: 'Invitations & Gifts', subtitle: 'Cards, e-invites, favours', image: 'virtualPlanningCouple', bg: '#F3D6C4' },
];

const PHOTO_CRITERIA = ['Photo quality', 'Communication', 'Punctuality', 'Professionalism', 'Delivery speed'];
const DEFAULT_CRITERIA = ['Quality', 'Communication', 'Punctuality', 'Value for money'];

export const SERVICES: ServiceDef[] = [
  // Venue & food
  {
    id: 'venue',
    name: 'Party Palace / Venue',
    icon: 'business-outline',
    group: 'venue',
    image: 'venueGardenEstate',
    unit: 'per event',
    priceRange: [60_000, 800_000],
    budgetShare: 0.16,
    core: true,
    styles: ['Indoor', 'Outdoor', 'Garden', 'Lakeside', 'Heritage', 'Hotel', 'Resort'],
    fields: [
      { key: 'setting', label: 'Setting', kind: 'choice', options: ['Indoor', 'Outdoor', 'Both'], default: 'Both' },
      { key: 'rooms', label: 'Guest rooms needed', kind: 'number', default: 0, min: 0, max: 200, step: 5 },
      { key: 'parking', label: 'Parking for guests', kind: 'toggle', default: true },
      { key: 'in_house_catering', label: 'In-house catering', kind: 'toggle', default: true },
    ],
    crew: [{ role: 'Venue Manager', default: 1, pay: 0 }],
    reviewCriteria: ['Food', 'Venue', 'Cleanliness', 'Service', 'Parking'],
  },
  {
    id: 'catering',
    name: 'Catering',
    icon: 'restaurant-outline',
    group: 'food',
    image: 'venueGardenPavilion',
    unit: 'per plate',
    priceRange: [850, 3_000],
    budgetShare: 0.3,
    core: true,
    styles: ['Nepali thali', 'Newari bhoj', 'North Indian', 'Continental', 'Chinese', 'Live counters'],
    fields: [
      { key: 'menu', label: 'Menu', kind: 'choice', options: ['Veg', 'Non-veg', 'Veg + Non-veg'], default: 'Veg + Non-veg' },
      { key: 'service', label: 'Service style', kind: 'choice', options: ['Buffet', 'Plated', 'Family style'], default: 'Buffet' },
      { key: 'live_counters', label: 'Live counters', kind: 'number', default: 2, min: 0, max: 10 },
      { key: 'welcome_drinks', label: 'Welcome drinks & snacks', kind: 'toggle', default: true },
    ],
    crew: [
      { role: 'Chef', default: 2, pay: 4_000 },
      { role: 'Server', default: 10, pay: 1_500 },
    ],
    reviewCriteria: ['Taste', 'Presentation', 'Hygiene', 'Service', 'Value for money'],
  },
  {
    id: 'cake',
    name: 'Cake & Desserts',
    icon: 'ice-cream-outline',
    group: 'food',
    image: 'ideaReceptionToast',
    unit: 'per event',
    priceRange: [5_000, 45_000],
    budgetShare: 0.006,
    styles: ['Classic tiered', 'Floral', 'Modern minimal', 'Dessert table'],
    fields: [
      { key: 'tiers', label: 'Tiers', kind: 'number', default: 3, min: 1, max: 7 },
      { key: 'dessert_table', label: 'Dessert table', kind: 'toggle', default: false },
    ],
    crew: [],
    reviewCriteria: ['Taste', 'Design', 'Punctuality', 'Value for money'],
  },
  {
    id: 'bartending',
    name: 'Bar & Bartending',
    icon: 'wine-outline',
    group: 'food',
    image: 'ideaReceptionToast',
    unit: 'per event',
    priceRange: [20_000, 120_000],
    budgetShare: 0.015,
    styles: ['Mocktails only', 'Full bar', 'Signature cocktails'],
    fields: [{ key: 'bartenders', label: 'Bartenders', kind: 'number', default: 2, min: 1, max: 10 }],
    crew: [{ role: 'Bartender', default: 2, pay: 3_000 }],
    reviewCriteria: DEFAULT_CRITERIA,
  },
  // Photo & video
  {
    id: 'photography',
    name: 'Photography',
    icon: 'camera-outline',
    group: 'photo-video',
    image: 'photographerCeremony',
    unit: 'per event',
    priceRange: [35_000, 180_000],
    budgetShare: 0.07,
    core: true,
    styles: ['Traditional', 'Candid', 'Cinematic', 'Documentary', 'Luxury', 'Natural', 'Minimal'],
    fields: [
      { key: 'photographers', label: 'Photographers', kind: 'number', default: 2, min: 1, max: 6 },
      { key: 'coverage_hours', label: 'Coverage hours', kind: 'number', default: 10, min: 2, max: 24, suffix: 'hrs' },
      { key: 'edited_photos', label: 'Edited photos', kind: 'number', default: 400, min: 50, max: 2000, step: 50 },
      { key: 'album', label: 'Printed album', kind: 'toggle', default: true },
      { key: 'same_team_all_events', label: 'Same team for every event', kind: 'toggle', default: true },
    ],
    crew: [
      { role: 'Photographer', default: 2, pay: 8_000, equipment: ['Full-frame camera', '24-70mm lens'] },
      { role: 'Assistant Photographer', default: 1, pay: 4_000 },
      { role: 'Editor', default: 1, pay: 6_000 },
    ],
    reviewCriteria: PHOTO_CRITERIA,
    deliverables: [
      { title: 'Sneak-peek photos', kind: 'photos', qty: 30, unit: 'photos', dueDays: 3 },
      { title: 'Edited photos', kind: 'photos', qty: 400, unit: 'photos', dueDays: 30 },
      { title: 'Printed album', kind: 'album', qty: 1, unit: 'album', dueDays: 60 },
    ],
  },
  {
    id: 'videography',
    name: 'Videography',
    icon: 'videocam-outline',
    group: 'photo-video',
    image: 'photographerTeam',
    unit: 'per event',
    priceRange: [40_000, 200_000],
    budgetShare: 0.06,
    core: true,
    styles: ['Cinematic', 'Documentary', 'Traditional', 'Music-video', 'Same-day edit'],
    fields: [
      { key: 'videographers', label: 'Videographers', kind: 'number', default: 2, min: 1, max: 5 },
      { key: 'highlight_minutes', label: 'Highlight film', kind: 'number', default: 4, min: 1, max: 15, suffix: 'min' },
      { key: 'full_film', label: 'Full wedding film', kind: 'toggle', default: true },
      { key: 'raw_footage', label: 'Raw footage handover', kind: 'toggle', default: false },
    ],
    crew: [
      { role: 'Videographer', default: 2, pay: 9_000, equipment: ['4K cinema camera', 'Gimbal'] },
      { role: 'Editor', default: 1, pay: 8_000 },
    ],
    reviewCriteria: ['Film quality', 'Communication', 'Punctuality', 'Professionalism', 'Delivery speed'],
    deliverables: [
      { title: 'Teaser', kind: 'teaser', qty: 1, unit: 'min', dueDays: 7 },
      { title: 'Highlight film', kind: 'highlight', qty: 4, unit: 'min', dueDays: 30 },
      { title: 'Full wedding film', kind: 'film', qty: 1, unit: 'film', dueDays: 60 },
    ],
  },
  {
    id: 'drone',
    name: 'Drone Coverage',
    icon: 'airplane-outline',
    group: 'photo-video',
    image: 'venueCliffside',
    unit: 'per event',
    priceRange: [10_000, 40_000],
    budgetShare: 0.012,
    styles: ['Aerial stills', 'Cinematic aerials', 'FPV'],
    fields: [{ key: 'flight_hours', label: 'Flight hours', kind: 'number', default: 2, min: 1, max: 8, suffix: 'hrs' }],
    crew: [{ role: 'Drone Operator', default: 1, pay: 8_000, equipment: ['Drone (DJI Mavic / Air)', 'Flight permit'] }],
    reviewCriteria: ['Footage quality', 'Safety', 'Punctuality', 'Professionalism'],
  },
  {
    id: 'pre-wedding',
    name: 'Pre-wedding Shoot',
    icon: 'heart-outline',
    group: 'photo-video',
    image: 'ideaCoupleGardenWalk',
    unit: 'per package',
    priceRange: [25_000, 150_000],
    budgetShare: 0.025,
    styles: ['Outdoor', 'Heritage', 'Mountain', 'Lakeside', 'Studio', 'Cinematic'],
    fields: [
      { key: 'locations', label: 'Locations', kind: 'number', default: 2, min: 1, max: 5 },
      { key: 'outfits', label: 'Outfit changes', kind: 'number', default: 3, min: 1, max: 8 },
      { key: 'video', label: 'Include video', kind: 'toggle', default: true },
    ],
    crew: [
      { role: 'Photographer', default: 1, pay: 8_000 },
      { role: 'Videographer', default: 1, pay: 9_000 },
    ],
    reviewCriteria: PHOTO_CRITERIA,
    deliverables: [{ title: 'Pre-wedding photos', kind: 'photos', qty: 80, unit: 'photos', dueDays: 14 }],
  },
  {
    id: 'live-streaming',
    name: 'Live Streaming',
    icon: 'radio-outline',
    group: 'photo-video',
    image: 'photographerTeam',
    unit: 'per event',
    priceRange: [15_000, 60_000],
    budgetShare: 0.01,
    styles: ['Single camera', 'Multi-camera'],
    fields: [
      { key: 'cameras', label: 'Cameras', kind: 'number', default: 2, min: 1, max: 5 },
      { key: 'platform', label: 'Stream to', kind: 'choice', options: ['YouTube', 'Facebook', 'Private link'], default: 'YouTube' },
    ],
    crew: [{ role: 'Streaming Technician', default: 1, pay: 6_000 }],
    reviewCriteria: ['Stream quality', 'Reliability', 'Punctuality'],
  },
  {
    id: 'photo-booth',
    name: 'Photo Booth',
    icon: 'images-outline',
    group: 'photo-video',
    image: 'ideaReceptionToast',
    unit: 'per event',
    priceRange: [12_000, 45_000],
    budgetShare: 0.006,
    styles: ['Instant prints', '360° booth', 'GIF booth'],
    fields: [{ key: 'hours', label: 'Hours', kind: 'number', default: 3, min: 1, max: 8 }],
    crew: [{ role: 'Booth Attendant', default: 1, pay: 2_500 }],
    reviewCriteria: DEFAULT_CRITERIA,
  },
  {
    id: 'album',
    name: 'Albums & Prints',
    icon: 'book-outline',
    group: 'photo-video',
    image: 'ideaBrideParasol',
    unit: 'per package',
    priceRange: [12_000, 70_000],
    budgetShare: 0.01,
    styles: ['Flush-mount', 'Leather', 'Canvas', 'Magazine'],
    fields: [
      { key: 'sheets', label: 'Sheets', kind: 'number', default: 40, min: 10, max: 120, step: 5 },
      { key: 'copies', label: 'Copies', kind: 'number', default: 2, min: 1, max: 6 },
    ],
    crew: [],
    reviewCriteria: DEFAULT_CRITERIA,
    deliverables: [{ title: 'Album design proof', kind: 'design', qty: 1, unit: 'proof', dueDays: 21 }],
  },
  // Decor & planning
  {
    id: 'decoration',
    name: 'Decoration',
    icon: 'flower-outline',
    group: 'decor',
    image: 'decorMandapFloral',
    unit: 'per event',
    priceRange: [40_000, 600_000],
    budgetShare: 0.1,
    core: true,
    styles: ['Traditional', 'Floral', 'Luxury', 'Minimal', 'Royal', 'Modern'],
    fields: [
      { key: 'mandap', label: 'Mandap / jagge', kind: 'toggle', default: true },
      { key: 'stage', label: 'Reception stage', kind: 'toggle', default: true },
      { key: 'entrance', label: 'Entrance gate', kind: 'toggle', default: true },
      { key: 'flowers', label: 'Flowers', kind: 'choice', options: ['Fresh', 'Artificial', 'Mixed'], default: 'Fresh' },
    ],
    crew: [
      { role: 'Decorator', default: 1, pay: 6_000 },
      { role: 'Decor Staff', default: 6, pay: 2_000 },
    ],
    reviewCriteria: ['Design', 'Execution', 'Punctuality', 'Value for money'],
    deliverables: [{ title: 'Decor concept & mood board', kind: 'design', qty: 1, unit: 'concept', dueDays: -30 }],
  },
  {
    id: 'florist',
    name: 'Florist',
    icon: 'rose-outline',
    group: 'decor',
    image: 'decorMandapFloral',
    unit: 'per event',
    priceRange: [15_000, 150_000],
    budgetShare: 0.02,
    styles: ['Marigold (sayapatri)', 'Roses', 'Orchids', 'Seasonal mix'],
    fields: [
      { key: 'garlands', label: 'Garlands (mala)', kind: 'number', default: 4, min: 0, max: 50 },
      { key: 'car_decor', label: 'Car decoration', kind: 'toggle', default: true },
    ],
    crew: [{ role: 'Florist', default: 2, pay: 2_500 }],
    reviewCriteria: DEFAULT_CRITERIA,
  },
  {
    id: 'lighting',
    name: 'Lighting',
    icon: 'bulb-outline',
    group: 'decor',
    image: 'decorMandapNight',
    unit: 'per event',
    priceRange: [20_000, 150_000],
    budgetShare: 0.015,
    styles: ['Fairy lights', 'Stage lighting', 'Architectural', 'Dance floor'],
    fields: [{ key: 'dance_floor', label: 'LED dance floor', kind: 'toggle', default: false }],
    crew: [{ role: 'Lighting Technician', default: 2, pay: 3_500 }],
    reviewCriteria: DEFAULT_CRITERIA,
  },
  {
    id: 'tent-stage',
    name: 'Tent & Stage',
    icon: 'home-outline',
    group: 'decor',
    image: 'venueOutdoorMandap',
    unit: 'per event',
    priceRange: [25_000, 250_000],
    budgetShare: 0.02,
    styles: ['Pandal', 'German hangar', 'Open-side canopy'],
    fields: [{ key: 'area_sqft', label: 'Area', kind: 'number', default: 3000, min: 500, max: 20000, step: 500, suffix: 'sq ft' }],
    crew: [{ role: 'Rigging Crew', default: 6, pay: 2_000 }],
    reviewCriteria: DEFAULT_CRITERIA,
  },
  {
    id: 'planner',
    name: 'Wedding Planner / Coordinator',
    icon: 'clipboard-outline',
    group: 'decor',
    image: 'plannerTeam',
    unit: 'per package',
    priceRange: [50_000, 600_000],
    budgetShare: 0.04,
    styles: ['Full planning', 'Partial planning', 'Day-of coordination'],
    fields: [{ key: 'coordinators', label: 'On-site coordinators', kind: 'number', default: 2, min: 1, max: 10 }],
    crew: [{ role: 'Coordinator', default: 2, pay: 5_000 }],
    reviewCriteria: ['Organisation', 'Communication', 'Problem solving', 'Value for money'],
  },
  // Beauty
  {
    id: 'makeup',
    name: 'Bridal Makeup',
    icon: 'color-palette-outline',
    group: 'beauty',
    image: 'makeupBridePortrait',
    unit: 'per event',
    priceRange: [12_000, 90_000],
    budgetShare: 0.03,
    core: true,
    styles: ['Natural', 'Glam', 'HD', 'Airbrush', 'Traditional Nepali'],
    fields: [
      { key: 'bride_looks', label: 'Bridal looks', kind: 'number', default: 2, min: 1, max: 6 },
      { key: 'family_members', label: 'Family members', kind: 'number', default: 4, min: 0, max: 30 },
      { key: 'trial', label: 'Trial session', kind: 'toggle', default: true },
    ],
    crew: [
      { role: 'Makeup Artist', default: 1, pay: 10_000, equipment: ['Pro makeup kit'] },
      { role: 'Hair Stylist', default: 1, pay: 5_000 },
    ],
    reviewCriteria: ['Look', 'Longevity', 'Hygiene', 'Punctuality', 'Behaviour'],
  },
  {
    id: 'mehendi',
    name: 'Mehendi Artist',
    icon: 'hand-left-outline',
    group: 'beauty',
    image: 'mehndiHands',
    unit: 'per event',
    priceRange: [5_000, 45_000],
    budgetShare: 0.01,
    styles: ['Traditional', 'Arabic', 'Minimal', 'Portrait'],
    fields: [
      { key: 'guests', label: 'Guest hands', kind: 'number', default: 20, min: 0, max: 200, step: 5 },
      { key: 'organic', label: 'Organic henna', kind: 'toggle', default: true },
    ],
    crew: [{ role: 'Mehendi Artist', default: 2, pay: 3_500 }],
    reviewCriteria: ['Design', 'Speed', 'Colour', 'Behaviour'],
  },
  // Entertainment
  {
    id: 'dj',
    name: 'DJ',
    icon: 'musical-notes-outline',
    group: 'entertainment',
    image: 'ideaReceptionToast',
    unit: 'per event',
    priceRange: [15_000, 90_000],
    budgetShare: 0.02,
    core: true,
    styles: ['Nepali pop', 'Bollywood', 'EDM', 'Retro', 'Mixed'],
    fields: [
      { key: 'hours', label: 'Hours', kind: 'number', default: 4, min: 1, max: 10 },
      { key: 'sound_included', label: 'Sound system included', kind: 'toggle', default: true },
    ],
    crew: [{ role: 'DJ', default: 1, pay: 12_000 }],
    reviewCriteria: ['Music', 'Crowd energy', 'Punctuality', 'Equipment'],
  },
  {
    id: 'panche-baja',
    name: 'Panche Baja',
    icon: 'megaphone-outline',
    group: 'entertainment',
    image: 'ideaCeremonyHands',
    unit: 'per event',
    priceRange: [12_000, 45_000],
    budgetShare: 0.01,
    styles: ['Traditional 9-piece', 'Naumati Baja', 'Band + Panche Baja'],
    fields: [{ key: 'players', label: 'Players', kind: 'number', default: 9, min: 5, max: 15 }],
    crew: [{ role: 'Musician', default: 9, pay: 1_500 }],
    reviewCriteria: ['Music', 'Punctuality', 'Behaviour', 'Value for money'],
  },
  {
    id: 'live-band',
    name: 'Live Band & Singers',
    icon: 'mic-outline',
    group: 'entertainment',
    image: 'ideaReceptionToast',
    unit: 'per event',
    priceRange: [30_000, 250_000],
    budgetShare: 0.02,
    styles: ['Acoustic', 'Nepali folk', 'Ghazal', 'Rock/pop'],
    fields: [{ key: 'sets', label: 'Sets', kind: 'number', default: 2, min: 1, max: 4 }],
    crew: [],
    reviewCriteria: ['Performance', 'Punctuality', 'Sound', 'Value for money'],
  },
  {
    id: 'mc',
    name: 'MC / Host',
    icon: 'chatbubbles-outline',
    group: 'entertainment',
    image: 'ideaReceptionToast',
    unit: 'per event',
    priceRange: [10_000, 60_000],
    budgetShare: 0.008,
    styles: ['Nepali', 'Bilingual', 'Formal', 'Fun & games'],
    fields: [{ key: 'language', label: 'Language', kind: 'choice', options: ['Nepali', 'English', 'Bilingual'], default: 'Bilingual' }],
    crew: [{ role: 'MC', default: 1, pay: 10_000 }],
    reviewCriteria: ['Energy', 'Language', 'Punctuality'],
  },
  {
    id: 'choreographer',
    name: 'Choreographer',
    icon: 'body-outline',
    group: 'entertainment',
    image: 'ideaReceptionToast',
    unit: 'per package',
    priceRange: [15_000, 80_000],
    budgetShare: 0.008,
    styles: ['Couple dance', 'Family performances', 'Flash mob'],
    fields: [{ key: 'songs', label: 'Songs', kind: 'number', default: 4, min: 1, max: 15 }],
    crew: [{ role: 'Choreographer', default: 1, pay: 6_000 }],
    reviewCriteria: DEFAULT_CRITERIA,
  },
  {
    id: 'sound',
    name: 'Sound System',
    icon: 'volume-high-outline',
    group: 'entertainment',
    image: 'venueLuxuryStage',
    unit: 'per event',
    priceRange: [15_000, 80_000],
    budgetShare: 0.012,
    styles: ['Speech only', 'Party sound', 'Concert grade'],
    fields: [{ key: 'wireless_mics', label: 'Wireless mics', kind: 'number', default: 2, min: 0, max: 10 }],
    crew: [{ role: 'Sound Engineer', default: 1, pay: 4_000 }],
    reviewCriteria: ['Sound quality', 'Reliability', 'Punctuality'],
  },
  {
    id: 'led-screen',
    name: 'LED Screens',
    icon: 'tv-outline',
    group: 'entertainment',
    image: 'venueLuxuryStage',
    unit: 'per event',
    priceRange: [20_000, 120_000],
    budgetShare: 0.01,
    styles: ['Stage backdrop', 'Side screens', 'Outdoor wall'],
    fields: [{ key: 'screens', label: 'Screens', kind: 'number', default: 2, min: 1, max: 6 }],
    crew: [{ role: 'AV Technician', default: 1, pay: 3_500 }],
    reviewCriteria: DEFAULT_CRITERIA,
  },
  // Fashion
  {
    id: 'bridal-wear',
    name: 'Bridal Wear',
    icon: 'shirt-outline',
    group: 'fashion',
    image: 'ideaBrideParasol',
    unit: 'per package',
    priceRange: [25_000, 400_000],
    budgetShare: 0.06,
    styles: ['Red saree', 'Lehenga', 'Gunyu Cholo', 'Haku Patasi', 'Designer'],
    fields: [
      { key: 'outfits', label: 'Outfits', kind: 'number', default: 3, min: 1, max: 8 },
      { key: 'rental', label: 'Rental ok', kind: 'toggle', default: false },
    ],
    crew: [],
    reviewCriteria: ['Quality', 'Fit', 'Service', 'Value for money'],
  },
  {
    id: 'groom-wear',
    name: 'Groom Wear',
    icon: 'shirt-outline',
    group: 'fashion',
    image: 'ideaCoupleGardenWalk',
    unit: 'per package',
    priceRange: [15_000, 150_000],
    budgetShare: 0.025,
    styles: ['Daura Suruwal', 'Sherwani', 'Suit / Tux', 'Nepali Dhaka topi set'],
    fields: [{ key: 'outfits', label: 'Outfits', kind: 'number', default: 2, min: 1, max: 5 }],
    crew: [],
    reviewCriteria: ['Quality', 'Fit', 'Service', 'Value for money'],
  },
  {
    id: 'jewellery',
    name: 'Jewellery',
    icon: 'diamond-outline',
    group: 'fashion',
    image: 'ideaCeremonyHands',
    unit: 'per package',
    priceRange: [50_000, 1_500_000],
    budgetShare: 0.07,
    styles: ['Tilhari & Pote', 'Gold set', 'Kundan', 'Diamond', 'Rental'],
    fields: [{ key: 'sets', label: 'Sets', kind: 'number', default: 2, min: 1, max: 6 }],
    crew: [],
    reviewCriteria: ['Craftsmanship', 'Purity/Trust', 'Service', 'Value for money'],
  },
  // Rituals
  {
    id: 'pandit',
    name: 'Pandit / Purohit',
    icon: 'flame-outline',
    group: 'rituals',
    image: 'ideaCeremonyHands',
    unit: 'per event',
    priceRange: [8_000, 45_000],
    budgetShare: 0.01,
    styles: ['Brahmin/Chhetri', 'Newari (Gubhaju/Bajracharya)', 'Maithili', 'Arya Samaj'],
    fields: [
      { key: 'rituals', label: 'Rituals', kind: 'choice', options: ['Wedding only', 'Full (Tilak to Bidai)', 'Pasni / Bratabandha'], default: 'Full (Tilak to Bidai)' },
      { key: 'samagri', label: 'Include puja samagri', kind: 'toggle', default: true },
    ],
    crew: [{ role: 'Assistant Purohit', default: 1, pay: 3_000 }],
    reviewCriteria: ['Knowledge', 'Punctuality', 'Explanation', 'Behaviour'],
  },
  // Logistics
  {
    id: 'transport',
    name: 'Wedding Cars & Transport',
    icon: 'car-outline',
    group: 'logistics',
    image: 'ideaCoupleGardenWalk',
    unit: 'per car',
    priceRange: [6_000, 40_000],
    budgetShare: 0.02,
    styles: ['Decorated sedan', 'Luxury SUV', 'Vintage', 'Guest bus'],
    fields: [
      { key: 'cars', label: 'Cars', kind: 'number', default: 3, min: 0, max: 30 },
      { key: 'buses', label: 'Buses for janti', kind: 'number', default: 1, min: 0, max: 10 },
    ],
    crew: [{ role: 'Driver', default: 4, pay: 2_500 }],
    reviewCriteria: ['Vehicle condition', 'Punctuality', 'Driver behaviour'],
  },
  {
    id: 'accommodation',
    name: 'Guest Accommodation',
    icon: 'bed-outline',
    group: 'logistics',
    image: 'venueResortSunset',
    unit: 'per person',
    priceRange: [2_500, 15_000],
    budgetShare: 0.03,
    styles: ['Budget hotel', 'Boutique', 'Resort'],
    fields: [{ key: 'rooms', label: 'Rooms', kind: 'number', default: 10, min: 1, max: 200 }],
    crew: [],
    reviewCriteria: ['Cleanliness', 'Location', 'Service', 'Value for money'],
  },
  {
    id: 'security',
    name: 'Security & Event Staff',
    icon: 'shield-checkmark-outline',
    group: 'logistics',
    image: 'plannerTeam',
    unit: 'per person',
    priceRange: [1_500, 5_000],
    budgetShare: 0.006,
    styles: ['Security guards', 'Ushers', 'Valet'],
    fields: [{ key: 'staff', label: 'Staff', kind: 'number', default: 4, min: 1, max: 40 }],
    crew: [{ role: 'Event Staff', default: 4, pay: 1_800 }],
    reviewCriteria: DEFAULT_CRITERIA,
  },
  {
    id: 'generator',
    name: 'Generator & Power Backup',
    icon: 'flash-outline',
    group: 'logistics',
    image: 'venueLawn',
    unit: 'per event',
    priceRange: [8_000, 50_000],
    budgetShare: 0.005,
    styles: ['Silent generator', 'Inverter'],
    fields: [{ key: 'kva', label: 'Capacity', kind: 'number', default: 62, min: 10, max: 500, step: 5, suffix: 'kVA' }],
    crew: [{ role: 'Technician', default: 1, pay: 2_500 }],
    reviewCriteria: ['Reliability', 'Punctuality', 'Value for money'],
  },
  {
    id: 'furniture-rental',
    name: 'Furniture & Rentals',
    icon: 'cube-outline',
    group: 'logistics',
    image: 'venueGardenPavilion',
    unit: 'per event',
    priceRange: [10_000, 120_000],
    budgetShare: 0.01,
    styles: ['Banquet chairs', 'Lounge', 'Royal sofa'],
    fields: [{ key: 'chairs', label: 'Chairs', kind: 'number', default: 200, min: 0, max: 2000, step: 50 }],
    crew: [],
    reviewCriteria: DEFAULT_CRITERIA,
  },
  // Stationery & gifts
  {
    id: 'invitation',
    name: 'Invitation Cards',
    icon: 'mail-outline',
    group: 'stationery',
    image: 'virtualPlanningCouple',
    unit: 'per card',
    priceRange: [40, 600],
    budgetShare: 0.01,
    styles: ['Traditional', 'Minimal', 'Floral', 'Laser-cut', 'Digital'],
    fields: [
      { key: 'cards', label: 'Cards', kind: 'number', default: 300, min: 0, max: 3000, step: 50 },
      { key: 'digital', label: 'Digital e-invite', kind: 'toggle', default: true },
    ],
    crew: [],
    reviewCriteria: ['Design', 'Print quality', 'Delivery speed'],
    deliverables: [{ title: 'Card design proof', kind: 'design', qty: 1, unit: 'proof', dueDays: -60 }],
  },
  {
    id: 'gifts',
    name: 'Gifts & Favours',
    icon: 'gift-outline',
    group: 'stationery',
    image: 'ideaReceptionToast',
    unit: 'per person',
    priceRange: [150, 3_000],
    budgetShare: 0.01,
    styles: ['Sweets box', 'Handicrafts', 'Dhaka accessories', 'Custom hampers'],
    fields: [{ key: 'units', label: 'Units', kind: 'number', default: 150, min: 10, max: 2000, step: 10 }],
    crew: [],
    reviewCriteria: DEFAULT_CRITERIA,
  },
  // Vehicles (rental fleets and vehicle owners)
  {
    id: 'wedding-car',
    name: 'Decorated Wedding Car',
    icon: 'car-sport-outline',
    group: 'vehicles',
    image: 'ideaCoupleGardenWalk',
    unit: 'per car',
    priceRange: [8_000, 45_000],
    budgetShare: 0.02,
    styles: ['Decorated sedan', 'Luxury sedan', 'Convertible', 'Electric car', 'Flower decoration'],
    fields: [
      { key: 'cars', label: 'Cars', kind: 'number', default: 1, min: 1, max: 20 },
      { key: 'decoration', label: 'Flower decoration', kind: 'toggle', default: true },
      { key: 'hours', label: 'Hours', kind: 'number', default: 8, min: 2, max: 24, suffix: 'h' },
    ],
    crew: [{ role: 'Driver', default: 1, pay: 2_500 }],
    reviewCriteria: ['Vehicle condition', 'Decoration', 'Punctuality', 'Driver behaviour'],
  },
  {
    id: 'luxury-car',
    name: 'Luxury Car & SUV Hire',
    icon: 'car-outline',
    group: 'vehicles',
    image: 'venueResortSunset',
    unit: 'per day',
    priceRange: [15_000, 80_000],
    budgetShare: 0.015,
    styles: ['Land Cruiser', 'Prado', 'Mercedes', 'BMW', 'Range Rover'],
    fields: [
      { key: 'cars', label: 'Cars', kind: 'number', default: 2, min: 1, max: 20 },
      { key: 'chauffeur', label: 'With chauffeur', kind: 'toggle', default: true },
    ],
    crew: [{ role: 'Driver', default: 2, pay: 3_000 }],
    reviewCriteria: ['Vehicle condition', 'Punctuality', 'Driver behaviour', 'Value for money'],
  },
  {
    id: 'bus-hire',
    name: 'Bus & Coach Hire (Janti)',
    icon: 'bus-outline',
    group: 'vehicles',
    image: 'venueLawn',
    unit: 'per day',
    priceRange: [12_000, 60_000],
    budgetShare: 0.015,
    styles: ['Tourist bus', 'Hiace / micro', 'Deluxe coach', 'Sofa bus'],
    fields: [
      { key: 'buses', label: 'Buses', kind: 'number', default: 2, min: 1, max: 20 },
      { key: 'seats', label: 'Seats per bus', kind: 'choice', options: ['15', '25', '35', '45'], default: '35' },
    ],
    crew: [{ role: 'Driver', default: 2, pay: 3_000 }],
    reviewCriteria: ['Vehicle condition', 'Punctuality', 'Driver behaviour', 'Comfort'],
  },
  {
    id: 'jeep-hire',
    name: 'Jeep & 4x4 Hire',
    icon: 'speedometer-outline',
    group: 'vehicles',
    image: 'venueCliffside',
    unit: 'per day',
    priceRange: [8_000, 25_000],
    budgetShare: 0.01,
    styles: ['Scorpio', 'Bolero', 'Thar', 'Hilux'],
    fields: [{ key: 'jeeps', label: 'Jeeps', kind: 'number', default: 2, min: 1, max: 20 }],
    crew: [{ role: 'Driver', default: 2, pay: 2_500 }],
    reviewCriteria: ['Vehicle condition', 'Punctuality', 'Driver behaviour'],
  },
  {
    id: 'baggi',
    name: 'Baggi, Doli & Vintage Car',
    icon: 'ribbon-outline',
    group: 'vehicles',
    image: 'ideaBrideParasol',
    unit: 'per event',
    priceRange: [20_000, 150_000],
    budgetShare: 0.01,
    styles: ['Horse carriage (baggi)', 'Traditional doli', 'Vintage car', 'Open jeep'],
    fields: [
      { key: 'kind', label: 'Ride', kind: 'choice', options: ['Baggi', 'Doli', 'Vintage car', 'Open jeep'], default: 'Baggi' },
      { key: 'route_km', label: 'Procession route', kind: 'number', default: 2, min: 1, max: 20, suffix: 'km' },
    ],
    crew: [{ role: 'Driver', default: 1, pay: 3_000 }],
    reviewCriteria: ['Decoration', 'Punctuality', 'Handling', 'Value for money'],
  },
];

export const SERVICE_BY_ID: Record<string, ServiceDef> = Object.fromEntries(SERVICES.map((s) => [s.id, s]));
export const findService = (id: string): ServiceDef | undefined => SERVICE_BY_ID[id];
export const serviceName = (id: string) => SERVICE_BY_ID[id]?.name ?? id;
export const servicesInGroup = (group: ServiceGroupId) => SERVICES.filter((s) => s.group === group);
export const CORE_SERVICES = SERVICES.filter((s) => s.core).map((s) => s.id);

/** Freelancer roles across all services (for gig skills and profiles). */
export const CREW_ROLES = [...new Set(SERVICES.flatMap((s) => s.crew.map((c) => c.role)).filter((r) => r !== 'Venue Manager'))].sort();

/** Crew plan a booking of this service needs, scaled by the requirement details. */
export function crewPlanFor(serviceId: string, details: Record<string, string | number | boolean> = {}): { role: string; count: number; pay: number; equipment: string[] }[] {
  const def = SERVICE_BY_ID[serviceId];
  if (!def) return [];
  return def.crew
    .filter((c) => c.pay > 0)
    .map((c) => {
      let count = c.default;
      if (c.role === 'Photographer' && typeof details.photographers === 'number') count = details.photographers;
      if (c.role === 'Videographer' && typeof details.videographers === 'number') count = details.videographers;
      if (c.role === 'Bartender' && typeof details.bartenders === 'number') count = details.bartenders;
      if (c.role === 'Coordinator' && typeof details.coordinators === 'number') count = details.coordinators;
      if (c.role === 'Event Staff' && typeof details.staff === 'number') count = details.staff;
      if (c.role === 'Driver' && typeof details.cars === 'number') count = Math.max(1, details.cars + Number(details.buses ?? 0));
      else if (c.role === 'Driver' && typeof details.buses === 'number') count = Math.max(1, details.buses);
      else if (c.role === 'Driver' && typeof details.jeeps === 'number') count = Math.max(1, details.jeeps);
      if (c.role === 'Musician' && typeof details.players === 'number') count = details.players;
      return { role: c.role, count, pay: c.pay, equipment: c.equipment ?? [] };
    })
    .filter((c) => c.count > 0);
}

/** Default requirement details for a service. */
export const defaultDetails = (serviceId: string): Record<string, string | number | boolean> =>
  Object.fromEntries((SERVICE_BY_ID[serviceId]?.fields ?? []).map((f) => [f.key, f.default]));
