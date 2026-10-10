import type { PhotoKey } from '@/constants/images';
import { patchList } from '@/services/content';
import type { CollectionId, Review, Venue, VenueType } from '@/types';
import { seeded } from '@/utils/random';

type Seed = [name: string, type: VenueType, locality: string];

/** Fictional venues grouped by city; attributes are generated deterministically. */
const SEEDS: Record<string, Seed[]> = {
  Kathmandu: [
    ['Everest Grand Party Palace', 'Party Palace', 'Tinkune'],
    ['Himalayan Heritage Durbar', 'Heritage Courtyard', 'Durbar Marg'],
    ['Rhododendron Banquet', 'Banquet Hall', 'New Baneshwor'],
    ['Kathmandu Crown Hotel', 'Hotel', 'Lazimpat'],
    ['Bhrikuti Party Palace', 'Party Palace', 'Kalanki'],
    ['Sagarmatha Convention Hall', 'Banquet Hall', 'Sinamangal'],
    ['Sundarijal Green Garden', 'Garden', 'Sundarijal'],
    ['Budhanilkantha Heights Resort', 'Resort', 'Budhanilkantha'],
    ['Maharajgunj Royal Banquet', 'Banquet Hall', 'Maharajgunj'],
  ],
  Lalitpur: [
    ['Patan Courtyard Heritage', 'Heritage Courtyard', 'Mangal Bazar'],
    ['Jhamsikhel Garden Palace', 'Party Palace', 'Jhamsikhel'],
    ['Godawari Pine Resort', 'Resort', 'Godawari'],
    ['Kumaripati Banquet', 'Banquet Hall', 'Kumaripati'],
    ['Bhaisepati Farmhouse', 'Farmhouse', 'Bhaisepati'],
  ],
  Bhaktapur: [
    ['Nyatapola Heritage Venue', 'Heritage Courtyard', 'Taumadhi'],
    ['Suryabinayak Party Palace', 'Party Palace', 'Suryabinayak'],
    ['Changunarayan Hill Garden', 'Garden', 'Changu'],
  ],
  Pokhara: [
    ['Phewa Lakeside Pavilion', 'Lakeside Venue', 'Lakeside'],
    ['Sarangkot Sunrise Resort', 'Resort', 'Sarangkot'],
    ['Begnas Lake Retreat', 'Lakeside Venue', 'Begnas'],
    ['Machhapuchhre View Party Palace', 'Party Palace', 'Chipledhunga'],
    ['Pokhara Grand Hotel', 'Hotel', 'Damside'],
  ],
  Chitwan: [
    ['Rapti Riverside Resort', 'Resort', 'Sauraha'],
    ['Narayani Banquet', 'Banquet Hall', 'Bharatpur'],
    ['Chitwan Green Party Palace', 'Party Palace', 'Narayangarh'],
  ],
  Butwal: [
    ['Tinau Party Palace', 'Party Palace', 'Traffic Chowk'],
    ['Siddhartha Garden Banquet', 'Garden', 'Devinagar'],
  ],
  Biratnagar: [
    ['Koshi Grand Banquet', 'Banquet Hall', 'Main Road'],
    ['Morang Party Palace', 'Party Palace', 'Tinpaini'],
  ],
  Dharan: [['Bijayapur Hills Resort', 'Resort', 'Bijayapur']],
  Birgunj: [['Gahawa Party Palace', 'Party Palace', 'Gahawa']],
  Nepalgunj: [['Bheri Banquet', 'Banquet Hall', 'Surkhet Road']],
  Janakpur: [['Mithila Heritage Hall', 'Heritage Courtyard', 'Janaki Mandir']],
  Dhangadhi: [['Seti Party Palace', 'Party Palace', 'Chauraha']],
  Nagarkot: [['Nagarkot Cloudline Resort', 'Resort', 'Nagarkot']],
  Dhulikhel: [['Dhulikhel Horizon Resort', 'Resort', 'Dhulikhel']],
};

const IMAGE_SETS: Record<VenueType, PhotoKey[]> = {
  'Party Palace': ['venueLuxuryStage', 'decorMandapNight', 'ideaReceptionToast', 'venueOutdoorMandap'],
  'Banquet Hall': ['venueLuxuryStage', 'ideaReceptionToast', 'decorMandapNight', 'venueGardenPavilion'],
  Hotel: ['venueLuxuryStage', 'ideaReceptionToast', 'venueResortSunset', 'decorMandapNight'],
  Resort: ['venueResortSunset', 'venueGardenPavilion', 'venueLawn', 'decorMandapFloral'],
  Garden: ['venueLawn', 'venueGardenEstate', 'decorMandapFloral', 'venueOutdoorMandap'],
  'Heritage Courtyard': ['decorMandapNight', 'venueOutdoorMandap', 'ideaBrideParasol', 'ideaCeremonyHands'],
  'Lakeside Venue': ['venueDestinationBeach', 'venueCliffside', 'venueResortSunset', 'decorMandapFloral'],
  Farmhouse: ['venueGardenPavilion', 'venueGardenEstate', 'venueLawn', 'decorMandapFloral'],
};

/** Venue rental per function in NPR. */
const PRICE_BANDS: Record<VenueType, [number, number]> = {
  'Party Palace': [50_000, 300_000],
  'Banquet Hall': [80_000, 400_000],
  Hotel: [250_000, 1_200_000],
  Resort: [200_000, 900_000],
  Garden: [60_000, 350_000],
  'Heritage Courtyard': [250_000, 1_000_000],
  'Lakeside Venue': [150_000, 700_000],
  Farmhouse: [80_000, 350_000],
};

const AMENITIES = [
  'Parking for 200+ cars',
  'In-house decor',
  'In-house catering',
  'Outside caterers allowed',
  'Outside decorators allowed',
  'Bar license',
  'Music allowed till 10 PM',
  'Bridal changing room',
  'Guest rooms',
  'Generator backup',
  'Wheelchair accessible',
  'Jagge / mandap setup included',
  'Panche Baja welcome area',
  'Separate dining hall',
  'Mountain view',
];

const REVIEWERS = [
  'Aakriti & Sujan',
  'Pratiksha & Bibek',
  'Srijana & Nabin',
  'Anisha & Rojan',
  'Sarina & Prabin',
  'Rashmi & Kiran',
  'Shristi & Aayush',
  'Nikita & Suman',
  'Bipana & Roshan',
  'Samjhana & Dipesh',
];

const REVIEW_TEXTS = [
  'The hall looked magical in the evening and the team handled 600 guests without a hitch. Janti welcome was beautifully organised.',
  'Food was the highlight of our wedding — every guest still talks about the Newari bhoj counter. Great value for money.',
  'Beautiful garden and a very professional events manager. The jagge was set up exactly as we had discussed with our pandit.',
  'Rooms were clean and the staff went out of their way to help our families from outside the valley. Highly recommended.',
  'Smooth coordination from booking to the reception night. Parking was a little tight during the janti, everything else was perfect.',
  'Stunning mountain view and lots of spaces for each function. Our mehendi on the lawn was a dream!',
];

const COLLECTION_RULES: Record<CollectionId, (v: Pick<Venue, 'type' | 'rentalCost'>) => boolean> = {
  luxury: (v) => v.rentalCost >= 500_000 || v.type === 'Hotel',
  budget: (v) => v.rentalCost <= 150_000,
  destination: (v) => v.type === 'Resort' || v.type === 'Lakeside Venue',
  heritage: (v) => v.type === 'Heritage Courtyard',
  garden: (v) => v.type === 'Garden' || v.type === 'Farmhouse' || v.type === 'Lakeside Venue',
};

export const collectionsFor = (v: Pick<Venue, 'type' | 'rentalCost'>) =>
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

const HAS_ROOMS: VenueType[] = ['Hotel', 'Resort', 'Lakeside Venue', 'Heritage Courtyard'];

function buildVenue(city: string, [name, type, locality]: Seed, index: number): Venue {
  const id = slug(`${name}-${city}`);
  const r = seeded(id);
  const [lo, hi] = PRICE_BANDS[type];
  const rentalCost = r.roundTo(lo + r.next() * (hi - lo), 10_000);
  const minCap = r.pick([50, 100, 150, 200, 300]);
  const maxCap = r.pick([300, 500, 800, 1000, 1500, 2500]);
  const veg = r.roundTo(r.int(850, 2200), 50);
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
    nonVegPerPlate: veg + r.roundTo(r.int(200, 600), 50),
    destinationPackage: r.roundTo(rentalCost * (1.8 + r.next()), 50_000),
    capacity: { min: minCap, max: Math.max(maxCap, minCap * 2) },
    rooms: HAS_ROOMS.includes(type) ? r.int(20, 150) : 0,
    featured: index < 2 || r.next() > 0.7,
    collections,
    images,
    about: `${name} is a ${type.toLowerCase()} in ${locality}, ${city}, loved for its ${r.pick([
      'grand pillarless hall',
      'manicured gardens',
      'lake-facing terraces',
      'Newari woodwork and courtyards',
      'Himalayan views',
    ])} and ${r.pick(['warm hospitality', 'famous wedding bhoj', 'flexible décor options', 'dedicated wedding manager'])}. It hosts ${minCap} to ${maxCap} guests across indoor and outdoor spaces — ideal for mehendi, janti welcome, swayambar, the wedding rituals and reception on one property.`,
    amenities: r.pickMany(AMENITIES, 7),
    spaces: [
      { name: 'Main Hall', type: 'Indoor', capacity: `${Math.round(maxCap * 0.6)} Seating | ${maxCap} Floating` },
      { name: 'Garden', type: 'Outdoor', capacity: `${Math.round(maxCap * 0.4)} Seating | ${Math.round(maxCap * 0.7)} Floating` },
      { name: 'Mandap Courtyard', type: 'Outdoor', capacity: `${minCap} Seating | ${minCap * 2} Floating` },
    ],
    policies: [
      'Booking advance: 30% of the total at confirmation',
      'Cancellation: non-refundable within 45 days of the event',
      'Music allowed till 10 PM in outdoor spaces',
      '13% VAT and 10% service charge extra where applicable',
    ],
    reviews: buildReviews(id, Math.min(reviewCount, 6)),
    phone: `+977 98${r.int(10_000_000, 99_999_999)}`,
  };
}

export const VENUES: Venue[] = Object.entries(SEEDS).flatMap(([city, seeds]) =>
  seeds.map((seed, i) => buildVenue(city, seed, i)),
);

/** Pin the hero venue so the demo always opens on a strong listing. */
const hero = VENUES[0];
Object.assign(hero, {
  rating: 4.8,
  reviewCount: 126,
  rentalCost: 180_000,
  capacity: { min: 200, max: 1500 },
  featured: true,
  sponsored: true,
  images: ['venueLuxuryStage', 'decorMandapNight', 'venueGardenPavilion', 'decorMandapFloral'] as PhotoKey[],
});
hero.collections = collectionsFor(hero);

export const VENUE_TYPES = Object.keys(PRICE_BANDS) as VenueType[];

/** A venue by id, with a super admin's edits (Content studio) applied. */
export const findVenue = (id: string) => patchList('venue', VENUES).find((v) => v.id === id);
