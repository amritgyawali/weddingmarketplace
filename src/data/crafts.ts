/**
 * Freelancer crafts. The crew roles in `services.ts` stay the source of truth
 * (a freelancer's skills are crew roles, and their trade and capabilities are
 * derived through `SERVICES_BY_CREW_ROLE`). Crafts group those roles for the
 * sign-up tiles and decide the craft profile, the rate model and the kinds of
 * equipment a freelancer is asked about. A DJ is never asked for lenses.
 *
 * Every crew role belongs to exactly one craft (the registry check fails otherwise).
 * Mirrored by `crafts` in supabase/migrations/0006_freelancer_crafts.sql.
 */
import type { PhotoKey } from '@/constants/images';
import type { Equipment } from '@/types/platform';

import type { EssentialField } from './trades';

export type CraftId = 'photo' | 'editor' | 'beauty' | 'music' | 'decor' | 'food' | 'driver' | 'technician' | 'rituals' | 'crew';

/** How a craft is usually paid; the first rate asked for and shown. */
export type CraftRate = 'day' | 'event' | 'package';

export interface CraftDef {
  id: CraftId;
  label: string;
  /** One line under the sign-up tile. */
  blurb: string;
  icon: string;
  image: PhotoKey;
  /** Crew roles in this craft; the first is the usual primary skill. */
  skills: string[];
  /** Crew roles from other crafts that people in this craft often also take. */
  neighbours: string[];
  rate: CraftRate;
  /** Equipment kinds the profile asks about. Empty means no equipment section. */
  equipment: Equipment['kind'][];
  /** Placeholder for the "add equipment" field. */
  kitHint?: string;
  /** The craft profile: a few answers organisers look at before hiring. */
  profile: EssentialField[];
}

export const CRAFTS: CraftDef[] = [
  {
    id: 'photo',
    label: 'Photo and film',
    blurb: 'Photographers, videographers, drone',
    icon: 'camera-outline',
    image: 'photographerCeremony',
    skills: ['Photographer', 'Videographer', 'Assistant Photographer', 'Drone Operator', 'Booth Attendant'],
    neighbours: ['Editor', 'Streaming Technician'],
    rate: 'day',
    equipment: ['camera', 'lens', 'flash', 'drone', 'gimbal', 'light', 'audio'],
    kitHint: 'e.g. Sony A7 IV, 24-70mm f/2.8 GM',
    profile: [
      { key: 'bodies', label: 'Camera bodies you shoot with', kind: 'text', placeholder: 'e.g. Sony A7 IV and A7 III' },
      { key: 'styles', label: 'Styles', kind: 'choice', options: ['Candid', 'Traditional', 'Cinematic', 'Documentary', 'Fine art'], multi: true },
      { key: 'droneLicence', label: 'I hold a CAAN drone permit', kind: 'toggle' },
      { key: 'turnaroundDays', label: 'Sneak peeks or rough cut within', kind: 'number', suffix: 'days' },
    ],
  },
  {
    id: 'editor',
    label: 'Editing',
    blurb: 'Photo retouching and film editing',
    icon: 'color-wand-outline',
    image: 'expertDesk',
    skills: ['Editor'],
    neighbours: ['Photographer', 'Videographer'],
    rate: 'package',
    equipment: ['kit', 'other'],
    kitHint: 'e.g. MacBook Pro M3, colour-calibrated monitor',
    profile: [
      { key: 'software', label: 'Software', kind: 'choice', options: ['Lightroom', 'Photoshop', 'Premiere Pro', 'DaVinci Resolve', 'Final Cut Pro', 'After Effects'], multi: true },
      { key: 'turnaroundDays', label: 'Usual turnaround', kind: 'number', suffix: 'days' },
    ],
  },
  {
    id: 'beauty',
    label: 'Makeup and mehendi',
    blurb: 'Bridal makeup, hair and mehendi',
    icon: 'color-palette-outline',
    image: 'makeupArtists',
    skills: ['Makeup Artist', 'Hair Stylist', 'Mehendi Artist'],
    neighbours: [],
    rate: 'event',
    equipment: ['kit'],
    kitHint: 'e.g. Airbrush kit, ring light',
    profile: [
      { key: 'brands', label: 'Product brands you use', kind: 'text', placeholder: 'e.g. MAC, Huda Beauty, Kryolan' },
      { key: 'hygiene', label: 'Hygiene practices', kind: 'choice', options: ['Fresh sponges per client', 'Sanitised brushes', 'Disposable applicators', 'Patch test offered'], multi: true },
      { key: 'trialPolicy', label: 'Trial policy', kind: 'choice', options: ['Free trial', 'Paid trial', 'No trials'] },
    ],
  },
  {
    id: 'music',
    label: 'Music and hosting',
    blurb: 'DJs, musicians, MCs, choreographers',
    icon: 'musical-notes-outline',
    image: 'ideaReceptionToast',
    skills: ['DJ', 'Musician', 'MC', 'Choreographer'],
    neighbours: ['Sound Engineer', 'Lighting Technician'],
    rate: 'event',
    equipment: ['audio', 'light', 'other'],
    kitHint: 'e.g. Pioneer DDJ-1000, 2 × JBL PRX 815',
    profile: [
      { key: 'genres', label: 'Genres', kind: 'choice', options: ['Nepali pop', 'Lok dohori', 'Bollywood', 'Western', 'Classical', 'Newari'], multi: true },
      { key: 'setHours', label: 'Standard set length', kind: 'number', suffix: 'hours' },
      { key: 'ownGear', label: 'I bring my own sound system', kind: 'toggle' },
    ],
  },
  {
    id: 'decor',
    label: 'Decor and floral',
    blurb: 'Decorators, florists, rigging crew',
    icon: 'flower-outline',
    image: 'decorMandapFloral',
    skills: ['Decorator', 'Florist', 'Decor Staff', 'Rigging Crew'],
    neighbours: ['Lighting Technician'],
    rate: 'day',
    equipment: ['kit', 'vehicle'],
    kitHint: 'e.g. Tool kit, pickup van',
    profile: [
      { key: 'specialities', label: 'Specialities', kind: 'choice', options: ['Mandap', 'Stage', 'Fresh flowers', 'Entrance', 'Newari', 'Balloon'], multi: true },
      { key: 'helpers', label: 'Helpers you can bring', kind: 'number', suffix: 'people' },
    ],
  },
  {
    id: 'food',
    label: 'Kitchen and service',
    blurb: 'Chefs, servers and bartenders',
    icon: 'restaurant-outline',
    image: 'venueGardenPavilion',
    skills: ['Chef', 'Server', 'Bartender'],
    neighbours: ['Event Staff'],
    rate: 'day',
    equipment: [],
    profile: [
      { key: 'cuisines', label: 'Cuisines', kind: 'choice', options: ['Nepali', 'Newari', 'Thakali', 'Indian', 'Continental', 'Chinese'], multi: true },
      { key: 'hygieneCert', label: 'I hold a food hygiene certificate', kind: 'toggle' },
    ],
  },
  {
    id: 'driver',
    label: 'Driving',
    blurb: 'Wedding cars, janti buses, pickups',
    icon: 'car-outline',
    image: 'ideaCoupleGardenWalk',
    skills: ['Driver'],
    neighbours: ['Event Staff'],
    rate: 'day',
    equipment: ['vehicle'],
    kitHint: 'e.g. Hyundai Creta, 5 seats',
    profile: [
      { key: 'vehicle', label: 'Vehicle you drive', kind: 'text', placeholder: 'e.g. Toyota Hiace, own' },
      { key: 'seats', label: 'Seats', kind: 'number', suffix: 'seats' },
      { key: 'licence', label: 'Licence categories', kind: 'choice', options: ['A · motorbike', 'B · car, jeep, van', 'F · minibus', 'G · bus, truck'], multi: true },
    ],
  },
  {
    id: 'technician',
    label: 'Sound, light and AV',
    blurb: 'Sound, lighting, streaming, power',
    icon: 'flash-outline',
    image: 'venueLuxuryStage',
    skills: ['Sound Engineer', 'Lighting Technician', 'AV Technician', 'Streaming Technician', 'Technician'],
    neighbours: ['DJ'],
    rate: 'day',
    equipment: ['audio', 'light', 'other'],
    kitHint: 'e.g. Behringer X32 mixer, 8 × LED par',
    profile: [
      { key: 'gear', label: 'Gear you bring', kind: 'text', placeholder: 'e.g. mixer, wireless mics, cabling' },
      { key: 'maxKva', label: 'Largest load you handle', kind: 'number', suffix: 'kVA' },
    ],
  },
  {
    id: 'rituals',
    label: 'Rituals',
    blurb: 'Assistant purohits for puja and ceremonies',
    icon: 'bonfire-outline',
    image: 'ideaCeremonyHands',
    skills: ['Assistant Purohit'],
    neighbours: ['Musician'],
    rate: 'event',
    equipment: [],
    profile: [
      { key: 'ceremonies', label: 'Ceremonies you assist', kind: 'choice', options: ['Wedding', 'Bratabandha', 'Pasni', 'Nwaran', 'Griha pravesh', 'Puja'], multi: true },
      { key: 'languages', label: 'Languages', kind: 'choice', options: ['Nepali', 'Sanskrit', 'Maithili', 'Newari', 'Hindi'], multi: true },
    ],
  },
  {
    id: 'crew',
    label: 'Event crew',
    blurb: 'Coordinators, ushers and event staff',
    icon: 'people-outline',
    image: 'plannerTeam',
    skills: ['Coordinator', 'Event Staff'],
    neighbours: ['Server', 'Driver'],
    rate: 'day',
    equipment: [],
    profile: [
      { key: 'eventsWorked', label: 'Events worked', kind: 'number', suffix: 'events' },
      { key: 'firstAid', label: 'I have first-aid training', kind: 'toggle' },
    ],
  },
];

export const CRAFT_BY_ID = Object.fromEntries(CRAFTS.map((c) => [c.id, c])) as Record<CraftId, CraftDef>;

/** The craft a crew role belongs to. */
export const craftOf = (skill: string | undefined): CraftDef | undefined => (skill ? CRAFTS.find((c) => c.skills.includes(skill)) : undefined);

/** Label for a craft's rate ("per day", "per event", "per project"). */
export const RATE_LABEL: Record<CraftRate, string> = { day: 'per day', event: 'per event', package: 'per project' };
