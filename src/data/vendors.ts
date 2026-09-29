import type { PhotoKey } from '@/constants/images';
import type { Review, Vendor, VendorPackage } from '@/types';
import { seeded } from '@/utils/random';

import { VENDOR_CATEGORIES } from './categories';

const VENDOR_CITIES = [
  'Bangalore',
  'Delhi NCR',
  'Mumbai',
  'Hyderabad',
  'Chennai',
  'Kolkata',
  'Jaipur',
  'Pune',
  'Lucknow',
  'Udaipur',
  'Goa',
  'Kathmandu',
];

const FIRST = ['Aarav', 'Riya', 'Kabir', 'Isha', 'Vihaan', 'Meera', 'Arjun', 'Tara', 'Neel', 'Anaya', 'Dev', 'Saanvi', 'Rohan', 'Kiara', 'Yash', 'Nisha'];
const LAST = ['Mehra', 'Kapoor', 'Iyer', 'Reddy', 'Sharma', 'Bose', 'Rathore', 'Kulkarni', 'Khanna', 'Nair', 'Shrestha', 'Malhotra'];
const WORDS = ['Candid', 'Golden Hour', 'Saffron', 'Ivory', 'Rosewood', 'Moonbeam', 'Stardust', 'Lotus', 'Peacock', 'Velvet', 'Marigold', 'Silverline', 'Kesar', 'Chandni', 'Sitara', 'Mogra'];

type NameFn = (r: ReturnType<typeof seeded>) => string;

const person: NameFn = (r) => `${r.pick(FIRST)} ${r.pick(LAST)}`;

const SUB_META: Record<
  string,
  { name: NameFn; price: [number, number]; unit: string; images: PhotoKey[]; services: string[] }
> = {
  photographers: {
    name: (r) => r.pick([`${person(r)} Photography`, `The ${r.pick(WORDS)} Studio`, `${r.pick(WORDS)} Frames`]),
    price: [40_000, 3_50_000],
    unit: 'per day',
    images: ['photographerCeremony', 'photographerTeam', 'ideaCoupleGardenWalk', 'ideaBrideParasol'],
    services: ['Candid photography', 'Traditional photography', 'Pre-wedding shoot', 'Drone coverage', 'Premium albums'],
  },
  cinematographers: {
    name: (r) => r.pick([`${r.pick(WORDS)} Films`, `${person(r)} Cinematics`, `Reel ${r.pick(WORDS)} Weddings`]),
    price: [60_000, 4_00_000],
    unit: 'per day',
    images: ['photographerTeam', 'photographerCeremony', 'ideaReceptionToast', 'venueCliffside'],
    services: ['Wedding film', 'Teaser & trailer', 'Same-day edit', 'Drone cinematography', '4K raw footage'],
  },
  'bridal-makeup': {
    name: (r) => r.pick([`Makeup by ${r.pick(FIRST)}`, `${person(r)} Makeovers`, `${r.pick(WORDS)} Glam Studio`]),
    price: [15_000, 1_20_000],
    unit: 'per function',
    images: ['makeupBridePortrait', 'makeupArtists', 'ideaBrideParasol', 'ideaCeremonyHands'],
    services: ['HD bridal makeup', 'Airbrush makeup', 'Hairstyling & draping', 'Trial session', 'Destination on-call'],
  },
  'family-makeup': {
    name: (r) => r.pick([`${r.pick(WORDS)} Family Glam`, `${person(r)} Beauty`, `Glow by ${r.pick(FIRST)}`]),
    price: [3_000, 15_000],
    unit: 'per person',
    images: ['makeupArtists', 'makeupBridePortrait', 'ideaReceptionToast'],
    services: ['Party makeup', 'Hairstyling', 'Saree draping', 'Group bookings'],
  },
  planners: {
    name: (r) => r.pick([`${r.pick(WORDS)} Weddings & Events`, `${person(r)} Wedding Co.`, `Shubh ${r.pick(WORDS)} Planners`]),
    price: [1_50_000, 12_00_000],
    unit: 'per event',
    images: ['plannerTeam', 'decorMandapFloral', 'venueGardenPavilion', 'decorMandapNight'],
    services: ['End-to-end planning', 'Vendor management', 'Guest hospitality', 'Destination logistics', 'Day-of coordination'],
  },
  decorators: {
    name: (r) => r.pick([`${r.pick(WORDS)} Decor`, `${person(r)} Designs`, `Petals & ${r.pick(WORDS)}`]),
    price: [75_000, 10_00_000],
    unit: 'per event',
    images: ['decorMandapFloral', 'decorMandapNight', 'venueOutdoorMandap', 'venueLuxuryStage'],
    services: ['Mandap design', 'Floral installations', 'Stage & backdrop', 'Lighting', 'Theme decor'],
  },
  'virtual-planning': {
    name: (r) => r.pick([`${r.pick(WORDS)} Virtual Planners`, `Plan with ${r.pick(FIRST)}`]),
    price: [5_000, 50_000],
    unit: 'per package',
    images: ['virtualPlanningCouple', 'expertDesk', 'plannerTeam'],
    services: ['Video consultations', 'Budget planning', 'Vendor shortlisting', 'Checklists & trackers'],
  },
  djs: {
    name: (r) => r.pick([`DJ ${r.pick(FIRST)}`, `${r.pick(WORDS)} Beats`, `DJ ${person(r)}`]),
    price: [25_000, 2_00_000],
    unit: 'per event',
    images: ['ideaReceptionToast', 'venueGardenPavilion', 'venueResortSunset'],
    services: ['Sangeet & cocktail sets', 'Bridal entry songs', 'Baraat dhol & DJ', 'LED dance floor', 'Custom playlists'],
  },
  'mehendi-artists': {
    name: (r) => r.pick([`${r.pick(FIRST)}'s Mehendi Art`, `${r.pick(WORDS)} Henna`, `Mehendi by ${person(r)}`]),
    price: [5_000, 60_000],
    unit: 'per function',
    images: ['mehndiHands', 'ideaCeremonyHands', 'ideaBrideParasol'],
    services: ['Bridal mehendi', 'Arabic designs', 'Guest mehendi', 'Organic henna'],
  },
};

const GENERIC_META = (subTitle: string, images: PhotoKey[]) => ({
  name: ((r) => r.pick([`${r.pick(WORDS)} ${subTitle}`, `${person(r)} ${subTitle}`, `${subTitle} by ${r.pick(FIRST)}`])) as NameFn,
  price: [20_000, 3_00_000] as [number, number],
  unit: 'per event',
  images,
  services: ['Customised packages', 'Experienced team', 'Travel for destination weddings', 'Advance booking discount'],
});

const REVIEWERS = ['Ananya', 'Priya', 'Sneha', 'Meera', 'Ishita', 'Divya', 'Kavya', 'Riya', 'Pooja', 'Neha', 'Aditi', 'Shreya'];
const REVIEW_TEXTS = [
  'Absolutely loved working with the team. Super professional, punctual and the results were beyond our expectations!',
  'They understood exactly what we wanted and delivered on time. Highly recommended for anyone planning a wedding.',
  'Great experience overall. Communication was quick and they were flexible with last-minute changes.',
  'Worth every rupee — our families could not stop praising them. Would book again in a heartbeat.',
  'Very polite and talented team. A couple of small delays but the final outcome was gorgeous.',
];

function buildReviews(seedKey: string, count: number): Review[] {
  const r = seeded(`${seedKey}-reviews`);
  return Array.from({ length: count }, (_, i) => ({
    id: `${seedKey}-r${i}`,
    author: r.pick(REVIEWERS),
    rating: Math.min(5, Math.round((4 + r.next()) * 10) / 10),
    date: `2026-${r.int(1, 12).toString().padStart(2, '0')}-${r.int(1, 28).toString().padStart(2, '0')}`,
    text: r.pick(REVIEW_TEXTS),
  }));
}

function buildPackages(r: ReturnType<typeof seeded>, base: number, unit: string, services: string[]): VendorPackage[] {
  return [
    { name: 'Essential', price: base, unit, includes: services.slice(0, 2) },
    { name: 'Signature', price: r.roundTo(base * 1.8, 1_000), unit, includes: services.slice(0, 4) },
    { name: 'Luxury', price: r.roundTo(base * 3, 1_000), unit, includes: services },
  ];
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function buildVendors(): Vendor[] {
  const out: Vendor[] = [];
  const usedIds = new Set<string>();

  for (const category of VENDOR_CATEGORIES) {
    if (category.id === 'venues') continue;
    for (const sub of category.subcategories) {
      const meta =
        SUB_META[sub.id] ??
        GENERIC_META(sub.title.replace(/s$/, ''), [category.image, 'ideaReceptionToast', 'venueGardenPavilion']);
      for (const city of VENDOR_CITIES) {
        const perCity = city === 'Bangalore' || city === 'Delhi NCR' || city === 'Mumbai' ? 3 : 2;
        for (let i = 0; i < perCity; i++) {
          const r = seeded(`${sub.id}-${city}-${i}`);
          const name = meta.name(r);
          let id = slug(`${name}-${city}`);
          while (usedIds.has(id)) id = `${id}-${r.int(2, 99)}`;
          usedIds.add(id);
          const startingPrice = r.roundTo(meta.price[0] + r.next() * (meta.price[1] - meta.price[0]), 1_000);
          const reviewCount = r.int(4, 240);
          const experience = r.int(2, 15);
          out.push({
            id,
            name,
            categoryId: category.id,
            subcategoryId: sub.id,
            city,
            rating: r.rating(4.3),
            reviewCount,
            startingPrice,
            priceUnit: meta.unit,
            featured: i === 0 && r.next() > 0.4,
            images: r.pickMany(meta.images, Math.min(4, meta.images.length)),
            about: `${name} is a ${city}-based ${sub.title.toLowerCase().replace(/s$/, '')} team with ${experience}+ years of experience crafting celebrations across India. Known for a warm, detail-obsessed approach, they work closely with couples to bring every ritual and moment to life.`,
            experience,
            eventsDone: experience * r.int(20, 60),
            services: meta.services,
            packages: buildPackages(r, startingPrice, meta.unit, meta.services),
            reviews: buildReviews(id, Math.min(reviewCount, 5)),
            phone: `+91 9${r.int(100000000, 999999999)}`,
          });
        }
      }
    }
  }
  return out;
}

export const VENDORS: Vendor[] = buildVendors();
