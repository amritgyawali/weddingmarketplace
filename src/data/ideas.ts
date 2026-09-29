import type { PhotoKey } from '@/constants/images';
import type { IdeaCategory, IdeaPhoto, RealWedding, Story } from '@/types';
import { seeded } from '@/utils/random';

const PHOTO_SEEDS: [PhotoKey, string, IdeaCategory][] = [
  ['ideaReceptionToast', 'Champagne tower moment at the reception', 'Reception'],
  ['ideaBrideParasol', 'Blush lehenga with a vintage lace parasol', 'Bridal Wear'],
  ['ideaCoupleGardenWalk', 'Pastel coordinated couple outfits for the day wedding', 'Couple Portraits'],
  ['ideaCeremonyHands', 'Jaimala and hand-in-hand pheras', 'Rituals'],
  ['decorMandapNight', 'Floral mandap under fairy lights', 'Decor'],
  ['venueCliffside', 'Sea-view vows at a cliffside venue', 'Venues'],
  ['mehndiHands', 'Intricate bridal mehendi with portrait motifs', 'Mehndi'],
  ['decorMandapFloral', 'Pastel floral mandap for a day ceremony', 'Decor'],
  ['makeupBridePortrait', 'Soft glam bridal makeup with a pearl tiara', 'Bridal Wear'],
  ['venueDestinationBeach', 'Beach aisle with a boho floral arch', 'Venues'],
  ['venueGardenEstate', 'Garden estate open-air ceremony', 'Venues'],
  ['venueLuxuryStage', 'Gold draped reception stage', 'Decor'],
  ['photographerCeremony', 'Candid shooters capturing the ring exchange', 'Couple Portraits'],
  ['venueOutdoorMandap', 'Twilight mandap with marigold canopies', 'Decor'],
  ['venueGardenPavilion', 'Greenhouse pavilion cocktail night', 'Reception'],
  ['venueResortSunset', 'Poolside sundowner sangeet', 'Venues'],
];

const CREDITS = ['Golden Hour Studio', 'Stardust Frames', 'Candid Chronicles', 'Shutter Diaries', 'Saffron Films', 'Moonbeam Pictures'];

export const IDEA_PHOTOS: IdeaPhoto[] = Array.from({ length: 32 }, (_, i) => {
  const [image, title, category] = PHOTO_SEEDS[i % PHOTO_SEEDS.length];
  const r = seeded(`idea-${i}`);
  return {
    id: `idea-${i + 1}`,
    image,
    title,
    category,
    likes: i < 4 ? [8, 18, 4, 24][i] : r.int(2, 480),
    credit: r.pick(CREDITS),
    aspect: 3 / 4,
  };
});

export const IDEA_CATEGORIES: IdeaCategory[] = [
  'Bridal Wear',
  'Decor',
  'Couple Portraits',
  'Mehndi',
  'Reception',
  'Venues',
  'Rituals',
];

export const STORIES: Story[] = [
  {
    id: 'story-1',
    title: '25 Pastel Lehengas We Spotted On Real Brides This Season',
    excerpt: 'From powder blue to mint and lilac — the softest shades are having a moment.',
    category: 'Bridal Wear',
    image: 'ideaBrideParasol',
    readMinutes: 6,
    author: 'Team Vivah',
    body: [
      'Pastels have quietly taken over the bridal aisle. Brides are swapping traditional reds for dreamy hues that photograph beautifully in daylight.',
      'Pair a blush lehenga with polki jewellery for an heirloom feel, or go modern with diamonds and a sheer dupatta draped as a cape.',
      'Tip: book your trial makeup in the same light as your ceremony so the look stays soft yet camera-ready.',
    ],
  },
  {
    id: 'story-2',
    title: 'The Ultimate Wedding Budget Planner: Where Your Money Should Go',
    excerpt: 'A category-by-category split that real couples swear by.',
    category: 'Planning',
    image: 'plannerTeam',
    readMinutes: 8,
    author: 'Aditi Sharma',
    body: [
      'Venue and catering usually take 45–50% of the budget. Lock these first because every other decision depends on the date and guest count.',
      'Keep 10% aside as a buffer. Last-minute additions such as extra rooms, transport or décor upgrades always pop up.',
      'Photography and décor are where you see the result for a lifetime — invest here before splurging on favours.',
    ],
  },
  {
    id: 'story-3',
    title: '12 Mandap Designs That Will Make Your Pheras Unforgettable',
    excerpt: 'Floral canopies, floating mandaps and minimal wooden frames.',
    category: 'Decor',
    image: 'decorMandapFloral',
    readMinutes: 5,
    author: 'Team Vivah',
    body: [
      'A mandap sets the mood of the entire ceremony. Day weddings shine with pastel florals while night pheras call for warm lights and marigolds.',
      'Ask your decorator for a 3D mock-up and check the sight lines for your guests before finalising.',
    ],
  },
  {
    id: 'story-4',
    title: 'Mehendi Trends 2026: Portraits, Minimal Motifs & More',
    excerpt: 'Hidden initials, couple portraits and negative-space designs.',
    category: 'Mehndi',
    image: 'mehndiHands',
    readMinutes: 4,
    author: 'Riya Kapoor',
    body: [
      'Portrait mehendi remains the most requested design this year, with artists sketching the couple’s love story across both hands.',
      'For a modern touch, try negative-space patterns that leave skin exposed for a lighter, airy look.',
    ],
  },
  {
    id: 'story-5',
    title: 'How To Plan A Destination Wedding In 6 Months',
    excerpt: 'A month-by-month timeline for a stress-free celebration.',
    category: 'Planning',
    image: 'venueDestinationBeach',
    readMinutes: 7,
    author: 'Team Vivah',
    body: [
      'Month 1: shortlist destinations and fix the guest list. Month 2: finalise the venue and block rooms.',
      'Months 3–4: book photographers, décor and entertainment. Month 5: send invites and plan logistics. Month 6: confirm every vendor and relax!',
    ],
  },
];

export const REAL_WEDDINGS: RealWedding[] = [
  {
    id: 'rw-1',
    couple: 'Ananya & Rohan',
    city: 'Udaipur',
    venue: 'Lake Palace Pichola Retreat',
    theme: 'Royal Rajasthani',
    cover: 'decorMandapNight',
    gallery: ['ideaCeremonyHands', 'ideaBrideParasol', 'venueOutdoorMandap', 'ideaReceptionToast'],
    story:
      'Ananya and Rohan met at a college fest and knew they wanted a wedding that felt like a royal homecoming. Three days of lakeside celebrations, a marigold-drenched mandap and a sangeet that went on till sunrise!',
    vendors: [
      { role: 'Photographer', name: 'Stardust Frames' },
      { role: 'Decor', name: 'Petals & Kesar' },
      { role: 'Makeup', name: 'Makeup by Tara' },
    ],
  },
  {
    id: 'rw-2',
    couple: 'Priya & Karthik',
    city: 'Goa',
    venue: 'Cliffside Cove Retreat',
    theme: 'Boho Beach',
    cover: 'venueCliffside',
    gallery: ['venueDestinationBeach', 'ideaCoupleGardenWalk', 'decorMandapFloral', 'venueResortSunset'],
    story:
      'A barefoot beach wedding with pastel florals, a sunset ceremony by the sea and a cocktail night under the stars.',
    vendors: [
      { role: 'Planner', name: 'Lotus Weddings & Events' },
      { role: 'Photographer', name: 'Golden Hour Studio' },
    ],
  },
  {
    id: 'rw-3',
    couple: 'Sneha & Arjun',
    city: 'Bangalore',
    venue: 'Windflower Meadows Resort and Spa',
    theme: 'Garden Pastels',
    cover: 'ideaCoupleGardenWalk',
    gallery: ['venueLawn', 'venueGardenPavilion', 'makeupBridePortrait', 'mehndiHands'],
    story:
      'An intimate garden wedding with 200 guests, pastel outfits, a live folk band and a menu featuring dishes from both families’ hometowns.',
    vendors: [
      { role: 'Venue', name: 'Windflower Meadows Resort and Spa' },
      { role: 'Mehendi', name: "Isha's Mehendi Art" },
    ],
  },
];

export const POPULAR_SEARCHES = [
  'DIY decor',
  'Engagement gown',
  'Pre wedding shoot ideas',
  'Bridal entry songs',
  'Photographers in Mumbai',
  'Bridal Makeup in Delhi',
];
