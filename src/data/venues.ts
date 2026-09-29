import type { PhotoKey } from '@/constants/images';
import type { CollectionId, Review, Venue, VenueType } from '@/types';
import { seeded } from '@/utils/random';

type Seed = [name: string, type: VenueType, locality: string];

/** Fictional venues grouped by city; attributes are generated deterministically. */
const SEEDS: Record<string, Seed[]> = {
  Bangalore: [
    ['Windflower Meadows Resort and Spa', 'Resort', 'Devanahalli'],
    ['The Banyan Grove Retreat', 'Resort', 'Kanakapura Road'],
    ['Royal Orchid Convention Centre', 'Banquet Hall', 'Yelahanka'],
    ['Silver Oak Farmhouse', 'Farmhouse', 'Sarjapur Road'],
    ['The Grand Aurum Hotel', '5 Star Hotel', 'MG Road'],
    ['Marigold Lawns', 'Lawn', 'Whitefield'],
    ['Sandalwood Kalyana Mantapa', 'Kalyana Mandapam', 'Jayanagar'],
  ],
  'Delhi NCR': [
    ['The Lotus Courtyard', 'Farmhouse', 'Chattarpur'],
    ['Emerald Greens', 'Lawn', 'Mehrauli'],
    ['Imperial Crest Hotel', '5 Star Hotel', 'Aerocity'],
    ['Sapphire Banquets', 'Banquet Hall', 'Rajouri Garden'],
    ['Aravali Rose Resort', 'Resort', 'Gurgaon'],
    ['The Ivory Pavilion', '4 Star Hotel', 'Noida'],
  ],
  Mumbai: [
    ['Seabreeze Grand', '5 Star Hotel', 'Juhu'],
    ['Palm Crest Resort', 'Resort', 'Lonavala'],
    ['The Pearl Banquets', 'Banquet Hall', 'Andheri'],
    ['Lakeside Lawns Powai', 'Lawn', 'Powai'],
    ['Harbour Lights Hotel', '4 Star Hotel', 'Navi Mumbai'],
    ['Monsoon Valley Retreat', 'Resort', 'Karjat'],
  ],
  Hyderabad: [
    ['Nizam Heritage Palace', 'Heritage Palace', 'Falaknuma'],
    ['Deccan Pearl Convention', 'Banquet Hall', 'Gachibowli'],
    ['Golconda Gardens', 'Lawn', 'Shamshabad'],
    ['Charminar Grand Hotel', '5 Star Hotel', 'Banjara Hills'],
    ['Kompally Green Farms', 'Farmhouse', 'Kompally'],
  ],
  Chennai: [
    ['Coromandel Beach Resort', 'Beach Venue', 'ECR'],
    ['Lakshmi Kalyana Mandapam', 'Kalyana Mandapam', 'T Nagar'],
    ['Marina Crown Hotel', '5 Star Hotel', 'Guindy'],
    ['Jasmine Gardens', 'Lawn', 'OMR'],
  ],
  Kolkata: [
    ['The Raj Bari', 'Heritage Palace', 'Alipore'],
    ['Hooghly Riverside Lawns', 'Lawn', 'Rajarhat'],
    ['Victoria Grand Banquets', 'Banquet Hall', 'Salt Lake'],
    ['Bengal Tiger Resort', 'Resort', 'EM Bypass'],
  ],
  Jaipur: [
    ['Amber Fort View Palace', 'Heritage Palace', 'Amer Road'],
    ['The Pink Haveli', 'Heritage Palace', 'Old City'],
    ['Rajputana Royal Resort', 'Resort', 'Delhi Road'],
    ['Sheesh Mahal Gardens', 'Lawn', 'Ajmer Road'],
    ['Jaipur Regency Hotel', '5 Star Hotel', 'Tonk Road'],
  ],
  Pune: [
    ['Sahyadri Hills Resort', 'Resort', 'Hinjewadi'],
    ['Koregaon Crown Hotel', '4 Star Hotel', 'Koregaon Park'],
    ['Deccan Lawns', 'Lawn', 'Baner'],
    ['Shaniwar Banquets', 'Banquet Hall', 'Kharadi'],
  ],
  Lucknow: [
    ['Awadh Heritage Kothi', 'Heritage Palace', 'Hazratganj'],
    ['Gomti Riverside Lawns', 'Lawn', 'Gomti Nagar'],
    ['Nawab Grand Banquets', 'Banquet Hall', 'Faizabad Road'],
  ],
  Udaipur: [
    ['Lake Palace Pichola Retreat', 'Heritage Palace', 'Lake Pichola'],
    ['Aravalli Sunset Resort', 'Resort', 'Badi Lake'],
    ['Fateh Sagar Garden Palace', 'Heritage Palace', 'Fateh Sagar'],
    ['Mewar Grand Hotel', '5 Star Hotel', 'Sukhadia Circle'],
  ],
  Goa: [
    ['Candolim Sands Beach Resort', 'Beach Venue', 'Candolim'],
    ['Cliffside Cove Retreat', 'Beach Venue', 'Morjim'],
    ['Palm Grove Villa Estate', 'Resort', 'South Goa'],
    ['The Tidewater Hotel', '5 Star Hotel', 'Calangute'],
  ],
  Kathmandu: [
    ['Himalayan Heritage Durbar', 'Heritage Palace', 'Durbar Marg'],
    ['Nagarkot Cloudline Resort', 'Resort', 'Nagarkot'],
    ['Lazimpat Grand Hotel', '5 Star Hotel', 'Lazimpat'],
  ],
};

const IMAGE_SETS: Record<VenueType, PhotoKey[]> = {
  Resort: ['venueResortSunset', 'venueGardenPavilion', 'venueLawn', 'decorMandapFloral'],
  'Banquet Hall': ['venueLuxuryStage', 'decorMandapNight', 'ideaReceptionToast', 'venueOutdoorMandap'],
  Lawn: ['venueLawn', 'venueGardenEstate', 'decorMandapFloral', 'venueOutdoorMandap'],
  '5 Star Hotel': ['venueLuxuryStage', 'ideaReceptionToast', 'venueResortSunset', 'decorMandapNight'],
  '4 Star Hotel': ['ideaReceptionToast', 'venueLuxuryStage', 'venueGardenPavilion', 'decorMandapNight'],
  'Heritage Palace': ['decorMandapNight', 'venueOutdoorMandap', 'ideaBrideParasol', 'venueLuxuryStage'],
  Farmhouse: ['venueGardenPavilion', 'venueGardenEstate', 'venueLawn', 'decorMandapFloral'],
  'Kalyana Mandapam': ['venueOutdoorMandap', 'ideaCeremonyHands', 'decorMandapNight', 'venueLuxuryStage'],
  'Beach Venue': ['venueDestinationBeach', 'venueCliffside', 'venueResortSunset', 'decorMandapFloral'],
};

const PRICE_BANDS: Record<VenueType, [number, number]> = {
  Resort: [4_00_000, 15_00_000],
  'Banquet Hall': [1_50_000, 5_00_000],
  Lawn: [1_00_000, 4_50_000],
  '5 Star Hotel': [6_00_000, 20_00_000],
  '4 Star Hotel': [3_00_000, 8_00_000],
  'Heritage Palace': [8_00_000, 35_00_000],
  Farmhouse: [2_00_000, 7_00_000],
  'Kalyana Mandapam': [80_000, 3_00_000],
  'Beach Venue': [5_00_000, 18_00_000],
};

const AMENITIES = [
  'Valet parking',
  'In-house decor',
  'In-house catering',
  'Outside caterers allowed',
  'Outside decorators allowed',
  'Alcohol allowed',
  'DJ allowed till 11 PM',
  'Bridal changing room',
  'Guest rooms',
  'Swimming pool',
  'Power backup',
  'Wheelchair accessible',
  'Fire pit & sangeet stage',
  'Mandap setup included',
];

const REVIEWERS = [
  'Ananya & Rohan',
  'Priya & Karthik',
  'Sneha & Arjun',
  'Meera & Vikram',
  'Ishita & Kabir',
  'Divya & Aditya',
  'Kavya & Siddharth',
  'Riya & Nikhil',
  'Pooja & Aman',
  'Neha & Varun',
];

const REVIEW_TEXTS = [
  'The venue looked magical in the evening. The banquet team was extremely co-operative and handled 600 guests without a hitch.',
  'Food was the highlight of our wedding — every guest still talks about the live counters. Great value for money.',
  'Beautiful lawns and a very professional events manager. The mandap setup was done exactly as we had discussed.',
  'Rooms were clean and the staff went out of their way to help our families. Would highly recommend for destination weddings.',
  'Smooth coordination from booking to the reception night. Parking was a little tight, but everything else was perfect.',
  'Stunning property with lots of spaces for each function. Our haldi by the pool was a dream!',
];

const COLLECTION_RULES: Record<CollectionId, (v: Pick<Venue, 'type' | 'rentalCost'>) => boolean> = {
  luxury: (v) => v.rentalCost >= 8_00_000 || v.type === '5 Star Hotel',
  budget: (v) => v.rentalCost <= 3_50_000,
  destination: (v) => v.type === 'Resort' || v.type === 'Beach Venue' || v.type === 'Heritage Palace',
  heritage: (v) => v.type === 'Heritage Palace',
  garden: (v) => v.type === 'Lawn' || v.type === 'Farmhouse',
};

const collectionsFor = (v: Pick<Venue, 'type' | 'rentalCost'>) =>
  (Object.keys(COLLECTION_RULES) as CollectionId[]).filter((c) => COLLECTION_RULES[c](v));

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function buildReviews(seedKey: string, count: number): Review[] {
  const r = seeded(`${seedKey}-reviews`);
  return Array.from({ length: count }, (_, i) => {
    const month = r.int(1, 12).toString().padStart(2, '0');
    const day = r.int(1, 28).toString().padStart(2, '0');
    return {
      id: `${seedKey}-r${i}`,
      author: r.pick(REVIEWERS),
      rating: Math.min(5, Math.round((4 + r.next()) * 10) / 10),
      date: `2026-${month}-${day}`,
      text: r.pick(REVIEW_TEXTS),
    };
  });
}

function buildVenue(city: string, [name, type, locality]: Seed, index: number): Venue {
  const id = slug(`${name}-${city}`);
  const r = seeded(id);
  const [lo, hi] = PRICE_BANDS[type];
  const rentalCost = r.roundTo(lo + r.next() * (hi - lo), 50_000);
  const minCap = r.pick([50, 75, 100, 150, 200]);
  const maxCap = r.pick([300, 500, 750, 1000, 1500, 2000]);
  const veg = r.roundTo(r.int(900, 3200), 50);
  const images = r.pickMany(IMAGE_SETS[type], 4);
  const collections = collectionsFor({ type, rentalCost });
  const reviewCount = r.int(3, 180);

  return {
    id,
    name,
    city,
    locality,
    type,
    rating: r.rating(4.2),
    reviewCount,
    rentalCost,
    vegPerPlate: veg,
    nonVegPerPlate: veg + r.roundTo(r.int(200, 700), 50),
    destinationPackage: r.roundTo(rentalCost * (1.8 + r.next()), 1_00_000),
    capacity: { min: minCap, max: maxCap },
    rooms: type === 'Banquet Hall' || type === 'Lawn' || type === 'Kalyana Mandapam' ? 0 : r.int(20, 180),
    featured: index < 2 || r.next() > 0.7,
    collections,
    images,
    about: `${name} is a ${type.toLowerCase()} in ${locality}, ${city}, loved for its ${r.pick([
      'sprawling manicured lawns',
      'grand pillarless ballroom',
      'lake-facing terraces',
      'heritage architecture',
      'sunset views',
    ])} and ${r.pick([
      'warm hospitality',
      'award-winning cuisine',
      'flexible décor options',
      'dedicated wedding concierge',
    ])}. It hosts ${minCap} to ${maxCap} guests across multiple indoor and outdoor spaces, making it ideal for mehendi, sangeet, pheras and reception on one property.`,
    amenities: r.pickMany(AMENITIES, 7),
    spaces: [
      { name: 'Grand Lawn', type: 'Outdoor', capacity: `${Math.round(maxCap * 0.6)} Seating | ${maxCap} Floating` },
      { name: 'Crystal Ballroom', type: 'Indoor', capacity: `${Math.round(maxCap * 0.3)} Seating | ${Math.round(maxCap * 0.5)} Floating` },
      { name: 'Poolside Deck', type: 'Outdoor', capacity: `${minCap} Seating | ${minCap * 2} Floating` },
    ],
    policies: [
      'Booking amount: 25% of the total at confirmation',
      'Cancellation: non-refundable within 60 days of the event',
      'Music allowed till 11 PM in outdoor spaces',
      'Taxes extra as applicable',
    ],
    reviews: buildReviews(id, Math.min(reviewCount, 6)),
    phone: `+91 9${r.int(100000000, 999999999)}`,
  };
}

export const VENUES: Venue[] = Object.entries(SEEDS).flatMap(([city, seeds]) =>
  seeds.map((seed, i) => buildVenue(city, seed, i)),
);

/** Pin the hero venue to match the reference listing screen. */
const hero = VENUES[0];
Object.assign(hero, {
  rating: 4.8,
  reviewCount: 5,
  rentalCost: 12_00_000,
  capacity: { min: 75, max: 1000 },
  featured: true,
  sponsored: true,
  images: ['venueResortSunset', 'venueLawn', 'venueGardenPavilion', 'decorMandapFloral'] as PhotoKey[],
});
hero.collections = collectionsFor(hero);

export const VENUE_TYPES = Object.keys(PRICE_BANDS) as VenueType[];
