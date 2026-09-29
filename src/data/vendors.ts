import type { PhotoKey } from '@/constants/images';
import type { Review, Vendor, VendorPackage } from '@/types';
import { seeded } from '@/utils/random';

import { SERVICES, type ServiceDef } from './services';

/** Cities with a vendor market; bigger markets get more vendors per service. */
const VENDOR_CITIES: [city: string, perService: number][] = [
  ['Kathmandu', 3],
  ['Lalitpur', 2],
  ['Bhaktapur', 1],
  ['Pokhara', 2],
  ['Chitwan', 1],
  ['Butwal', 1],
  ['Biratnagar', 1],
  ['Dharan', 1],
];

const FIRST = ['Aayush', 'Srijana', 'Bibek', 'Pratiksha', 'Sujan', 'Anisha', 'Rojan', 'Kabita', 'Nabin', 'Sarina', 'Prabin', 'Rashmi', 'Suman', 'Nikita', 'Dipesh', 'Samjhana'];
const LAST = ['Shrestha', 'Maharjan', 'Gurung', 'Thapa', 'Karki', 'Adhikari', 'Tamang', 'Rai', 'Magar', 'Bajracharya', 'Pradhan', 'Joshi', 'KC', 'Bhattarai', 'Limbu', 'Sherpa'];
const WORDS = ['Himalayan', 'Kasthamandap', 'Laligurans', 'Sunaulo', 'Chandani', 'Mayur', 'Dhaka', 'Sindoor', 'Mangal', 'Shubha', 'Sagarmatha', 'Annapurna', 'Rato Gulaf', 'Makalu', 'Phewa', 'Kanchan'];

type R = ReturnType<typeof seeded>;
const person = (r: R) => `${r.pick(FIRST)} ${r.pick(LAST)}`;

/** Name patterns per service; unknown services fall back to a generic pattern. */
const NAMES: Record<string, (r: R) => string> = {
  photography: (r) => r.pick([`${person(r)} Photography`, `${r.pick(WORDS)} Studio`, `${r.pick(WORDS)} Frames`, `Wedding Story ${r.pick(['Nepal', 'Studio', 'Co.'])}`]),
  videography: (r) => r.pick([`${r.pick(WORDS)} Films`, `${person(r)} Cinematics`, `Reel ${r.pick(WORDS)} Weddings`]),
  drone: (r) => r.pick([`${r.pick(WORDS)} Aerials`, `SkyShot ${r.pick(WORDS)}`]),
  'pre-wedding': (r) => r.pick([`${r.pick(WORDS)} Pre-wedding Co.`, `Love Story by ${r.pick(FIRST)}`]),
  makeup: (r) => r.pick([`Makeup by ${r.pick(FIRST)}`, `${person(r)} Makeovers`, `${r.pick(WORDS)} Glam Studio`]),
  mehendi: (r) => r.pick([`${r.pick(FIRST)}'s Mehendi Art`, `${r.pick(WORDS)} Henna`, `Mehendi by ${person(r)}`]),
  decoration: (r) => r.pick([`${r.pick(WORDS)} Decor`, `${person(r)} Designs`, `Sayapatri ${r.pick(WORDS)} Events`]),
  planner: (r) => r.pick([`${r.pick(WORDS)} Weddings & Events`, `${person(r)} Wedding Co.`, `Shubha Bibaha Planners`]),
  catering: (r) => r.pick([`${r.pick(WORDS)} Caterers`, `${person(r)} Bhoj Ghar`, `${r.pick(WORDS)} Kitchen & Catering`]),
  dj: (r) => r.pick([`DJ ${r.pick(FIRST)}`, `${r.pick(WORDS)} Beats`, `DJ ${person(r)}`]),
  'panche-baja': (r) => r.pick([`${r.pick(WORDS)} Panche Baja`, `Shree ${r.pick(LAST)} Baja Samuha`]),
  pandit: (r) => r.pick([`Pandit ${r.pick(['Hari', 'Krishna', 'Ram', 'Shiva', 'Narayan'])} ${r.pick(['Bhattarai', 'Adhikari', 'Sharma', 'Pokharel', 'Dahal'])}`, `${r.pick(WORDS)} Purohit Sewa`]),
  transport: (r) => r.pick([`${r.pick(WORDS)} Wedding Cars`, `${person(r)} Travels`]),
  'bridal-wear': (r) => r.pick([`${r.pick(WORDS)} Bridal House`, `${r.pick(FIRST)}'s Saree Palace`]),
  'groom-wear': (r) => r.pick([`${r.pick(WORDS)} Daura Suruwal`, `${r.pick(LAST)} Tailors & Suits`]),
  jewellery: (r) => r.pick([`${r.pick(WORDS)} Jewellers`, `${r.pick(LAST)} Gahana Pasal`]),
  invitation: (r) => r.pick([`${r.pick(WORDS)} Cards`, `${r.pick(WORDS)} Printers & Invites`]),
};

const genericName = (def: ServiceDef) => (r: R) =>
  r.pick([`${r.pick(WORDS)} ${def.name.split(' ')[0]}`, `${person(r)} ${def.name.split(' /')[0]}`, `${def.name.split(' ')[0]} by ${r.pick(FIRST)}`]);

const IMAGES: Record<string, PhotoKey[]> = {
  photography: ['photographerCeremony', 'photographerTeam', 'ideaCoupleGardenWalk', 'ideaBrideParasol'],
  videography: ['photographerTeam', 'photographerCeremony', 'ideaReceptionToast', 'venueCliffside'],
  'pre-wedding': ['ideaCoupleGardenWalk', 'venueCliffside', 'ideaBrideParasol', 'venueResortSunset'],
  makeup: ['makeupBridePortrait', 'makeupArtists', 'ideaBrideParasol', 'ideaCeremonyHands'],
  decoration: ['decorMandapFloral', 'decorMandapNight', 'venueOutdoorMandap', 'venueLuxuryStage'],
  planner: ['plannerTeam', 'decorMandapFloral', 'venueGardenPavilion', 'decorMandapNight'],
  catering: ['venueGardenPavilion', 'ideaReceptionToast', 'venueLuxuryStage'],
};

const SERVICE_BLURBS: Record<string, string[]> = {
  photography: ['Candid & traditional coverage', 'Pre-wedding shoot', 'Drone coverage', 'Premium albums', 'Same-day sneak peeks'],
  videography: ['Cinematic wedding film', 'Teaser & highlights', 'Same-day edit', 'Drone cinematography', '4K raw footage'],
  makeup: ['HD bridal makeup', 'Airbrush makeup', 'Hairstyling & saree draping', 'Trial session', 'Destination on-call'],
  decoration: ['Jagge / mandap design', 'Floral installations', 'Stage & backdrop', 'Lighting', 'Theme decor'],
  catering: ['Nepali & Newari menus', 'Live counters', 'Buffet & plated service', 'Welcome drinks', 'Trained service staff'],
  planner: ['End-to-end planning', 'Vendor management', 'Guest hospitality', 'Destination logistics', 'Day-of coordination'],
};

const REVIEWERS = ['Aakriti', 'Pratiksha', 'Srijana', 'Anisha', 'Sarina', 'Rashmi', 'Shristi', 'Nikita', 'Bipana', 'Samjhana', 'Sujata', 'Barsha'];
const REVIEW_TEXTS = [
  'Absolutely loved working with the team. Super professional, punctual and the results were beyond our expectations!',
  'They understood exactly what we wanted and delivered on time. Highly recommended for anyone planning a wedding in Nepal.',
  'Great experience overall. Communication was quick and they were flexible with last-minute changes on the wedding day.',
  'Worth every rupee — our families could not stop praising them. Would book again in a heartbeat.',
  'Very polite and talented team. A couple of small delays because of traffic but the final outcome was gorgeous.',
];

const LANGS = [['Nepali', 'English'], ['Nepali', 'English', 'Hindi'], ['Nepali', 'Newari', 'English'], ['Nepali', 'Maithili', 'Hindi']];

function buildReviews(seedKey: string, count: number): Review[] {
  const r = seeded(`${seedKey}-reviews`);
  return Array.from({ length: count }, (_, i) => ({
    id: `${seedKey}-r${i}`,
    author: r.pick(REVIEWERS),
    rating: Math.min(5, Math.round((4 + r.next()) * 10) / 10),
    date: `2026-${r.int(1, 9).toString().padStart(2, '0')}-${r.int(1, 28).toString().padStart(2, '0')}`,
    text: r.pick(REVIEW_TEXTS),
  }));
}

function buildPackages(r: R, base: number, unit: string, services: string[], def: ServiceDef): VendorPackage[] {
  const crew = (mult: number) =>
    Object.fromEntries(def.crew.filter((c) => c.pay > 0).map((c) => [c.role, Math.max(1, Math.round(c.default * mult))]));
  return [
    { name: 'Basic', price: base, unit, includes: services.slice(0, 2), crew: crew(0.5), hours: 8 },
    { name: 'Premium', price: r.roundTo(base * 1.9, 1_000), unit, includes: services.slice(0, 4), crew: crew(1), hours: 12 },
    { name: 'Luxury', price: r.roundTo(base * 3, 1_000), unit, includes: services, crew: crew(1.5), hours: 16 },
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

  for (const def of SERVICES) {
    if (def.id === 'venue') continue;
    const nameFn = NAMES[def.id] ?? genericName(def);
    const images = IMAGES[def.id] ?? [def.image, 'ideaReceptionToast', 'venueGardenPavilion'];
    const services = SERVICE_BLURBS[def.id] ?? [...def.styles.slice(0, 3).map((s) => `${s} ${def.name.toLowerCase()}`), 'Customised packages', 'Travel outside the valley'];
    for (const [city, perCity] of VENDOR_CITIES) {
      // Niche services only exist in the bigger markets.
      const count = def.core || def.budgetShare >= 0.02 ? perCity : city === 'Kathmandu' || city === 'Pokhara' ? 1 : 0;
      for (let i = 0; i < count; i++) {
        const r = seeded(`${def.id}-${city}-${i}`);
        const name = nameFn(r);
        let id = slug(`${name}-${city}`);
        while (usedIds.has(id)) id = `${id}-${r.int(2, 99)}`;
        usedIds.add(id);
        const [lo, hi] = def.priceRange;
        const step = hi > 10_000 ? 1_000 : hi > 1_000 ? 50 : 10;
        const startingPrice = r.roundTo(lo + r.next() * (hi - lo) * 0.6, step);
        const reviewCount = r.int(4, 240);
        const experience = r.int(2, 15);
        out.push({
          id,
          name,
          categoryId: def.group,
          subcategoryId: def.id,
          city,
          rating: r.rating(4.2),
          reviewCount,
          startingPrice,
          priceUnit: def.unit,
          featured: i === 0 && r.next() > 0.4,
          images: r.pickMany(images, Math.min(4, images.length)),
          about: `${name} is a ${city}-based ${def.name.toLowerCase()} team with ${experience}+ years of experience across Nepal. Known for a warm, detail-obsessed approach, they work closely with families to bring every ritual — from tilak to bidai — to life.`,
          experience,
          eventsDone: experience * r.int(15, 50),
          services,
          packages: buildPackages(r, startingPrice, def.unit, services, def),
          reviews: buildReviews(id, Math.min(reviewCount, 5)),
          phone: `+977 98${r.int(10_000_000, 99_999_999)}`,
          languages: r.pick(LANGS),
          teamSize: Math.max(1, def.crew.reduce((n, c) => n + c.default, 0) + r.int(0, 6)),
          serviceAreas: city === 'Kathmandu' || city === 'Lalitpur' || city === 'Bhaktapur' ? ['Kathmandu', 'Lalitpur', 'Bhaktapur'] : [city],
          travels: r.next() > 0.35,
          instantBook: r.next() > 0.75,
          styles: r.pickMany(def.styles, Math.min(3, def.styles.length)),
        });
      }
    }
  }
  return out;
}

export const VENDORS: Vendor[] = buildVendors();

/** Pin the flagship studio used by the demo vendor account and seed projects. */
const studio = VENDORS.find((v) => v.subcategoryId === 'photography' && v.city === 'Kathmandu')!;
Object.assign(studio, {
  id: 'wedding-story-nepal-kathmandu',
  name: 'Wedding Story Nepal',
  rating: 4.9,
  reviewCount: 214,
  startingPrice: 60_000,
  featured: true,
  experience: 9,
  eventsDone: 420,
  teamSize: 14,
  instantBook: false,
  styles: ['Candid', 'Cinematic', 'Traditional'],
  images: ['photographerCeremony', 'photographerTeam', 'ideaCoupleGardenWalk', 'ideaBrideParasol'],
  about:
    'Wedding Story Nepal is a Kathmandu studio of 14 photographers, cinematographers and editors. We cover every ritual from tilak to bidai, run pre-wedding shoots from Nagarkot to Pokhara, and deliver sneak peeks within 72 hours.',
});

export const findVendor = (id: string) => VENDORS.find((v) => v.id === id);
