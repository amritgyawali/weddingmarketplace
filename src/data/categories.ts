import type { PhotoKey } from '@/constants/images';
import type { VendorCategory, VenueCollection } from '@/types';

import { SERVICE_GROUPS, SERVICES } from './services';

/**
 * Browse categories for the marketplace. Venues are browsed by venue type;
 * every other group lists its services (subcategory id === service id).
 */
export const VENDOR_CATEGORIES: VendorCategory[] = SERVICE_GROUPS.map((g) =>
  g.id === 'venue'
    ? {
        id: 'venues',
        title: g.title,
        subtitle: g.subtitle,
        image: g.image,
        bg: g.bg,
        subcategories: [
          { id: 'all-venues', title: 'View All Venues' },
          { id: 'party-palaces', title: 'Party Palaces' },
          { id: 'banquet-halls', title: 'Banquet Halls' },
          { id: 'hotels', title: 'Hotels' },
          { id: 'resorts', title: 'Resorts' },
          { id: 'gardens', title: 'Gardens & Lawns' },
          { id: 'heritage', title: 'Heritage Courtyards' },
          { id: 'lakeside', title: 'Lakeside Venues' },
        ],
      }
    : {
        id: g.id,
        title: g.title,
        subtitle: g.subtitle,
        image: g.image,
        bg: g.bg,
        subcategories: SERVICES.filter((s) => s.group === g.id).map((s) => ({ id: s.id, title: s.name })),
      },
);

export const HOME_CATEGORIES: {
  id: string;
  title: string;
  image: PhotoKey;
  categoryId: string;
  subcategoryId?: string;
}[] = [
  { id: 'venues', title: 'Party Palaces', image: 'venueGardenEstate', categoryId: 'venues' },
  { id: 'photography', title: 'Photography', image: 'photographerTeam', categoryId: 'photo-video', subcategoryId: 'photography' },
  { id: 'catering', title: 'Catering', image: 'venueGardenPavilion', categoryId: 'food', subcategoryId: 'catering' },
  { id: 'decoration', title: 'Decoration', image: 'decorMandapNight', categoryId: 'decor', subcategoryId: 'decoration' },
  { id: 'makeup', title: 'Makeup', image: 'makeupArtists', categoryId: 'beauty', subcategoryId: 'makeup' },
  { id: 'pre-wedding', title: 'Pre-Wedding', image: 'ideaCoupleGardenWalk', categoryId: 'photo-video', subcategoryId: 'pre-wedding' },
  { id: 'videography', title: 'Videography', image: 'photographerCeremony', categoryId: 'photo-video', subcategoryId: 'videography' },
  { id: 'dj', title: 'DJ & Music', image: 'ideaReceptionToast', categoryId: 'entertainment', subcategoryId: 'dj' },
  { id: 'mehendi', title: 'Mehendi', image: 'mehndiHands', categoryId: 'beauty', subcategoryId: 'mehendi' },
  { id: 'pandit', title: 'Pandit', image: 'ideaCeremonyHands', categoryId: 'rituals', subcategoryId: 'pandit' },
];

export const VENUE_COLLECTIONS: VenueCollection[] = [
  { id: 'luxury', title: 'Luxury Wedding Venues', image: 'venueLuxuryStage' },
  { id: 'budget', title: 'Budget Party Palaces', image: 'venueOutdoorMandap' },
  { id: 'destination', title: 'Destination Weddings', image: 'venueDestinationBeach' },
  { id: 'heritage', title: 'Heritage Courtyards', image: 'decorMandapNight' },
  { id: 'garden', title: 'Garden & Lakeside', image: 'venueGardenEstate' },
];

export const findCategory = (id: string) => VENDOR_CATEGORIES.find((c) => c.id === id);

/**
 * The marketplace for an occasion (owner decision): only the categories and
 * services it lists are shown; the rest are hidden, not ranked lower. Venue
 * types all count as the `venue` service. Every service listed keeps the full
 * catalogue (weddings, "something else").
 */
export function categoriesFor(services: readonly string[]): VendorCategory[] {
  if (services.length >= SERVICES.length) return VENDOR_CATEGORIES;
  const allowed = new Set(services);
  return VENDOR_CATEGORIES.flatMap((c) => {
    if (c.id === 'venues') return allowed.has('venue') ? [c] : [];
    const subcategories = c.subcategories.filter((s) => allowed.has(s.id));
    return subcategories.length ? [{ ...c, subcategories }] : [];
  });
}

/** Home shortcuts for an occasion's services. */
export const homeCategoriesFor = (services: readonly string[]) => (services.length >= SERVICES.length ? HOME_CATEGORIES : HOME_CATEGORIES.filter((c) => services.includes(c.categoryId === 'venues' ? 'venue' : (c.subcategoryId ?? ''))));

export const findSubcategory = (categoryId: string, subId?: string) =>
  findCategory(categoryId)?.subcategories.find((s) => s.id === subId);

/** Browse category that contains a service id. */
export const categoryForService = (serviceId: string) =>
  serviceId === 'venue' ? 'venues' : (SERVICES.find((s) => s.id === serviceId)?.group ?? 'decor');
