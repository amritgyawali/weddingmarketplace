import type { PhotoKey } from '@/constants/images';
import type { VendorCategory, VenueCollection } from '@/types';

/** Vendors tab — order, colours and copy follow the reference screen. */
export const VENDOR_CATEGORIES: VendorCategory[] = [
  {
    id: 'venues',
    title: 'Venues',
    subtitle: 'Banquet Halls, Marriage Garden / Lawns, Wedding Resorts',
    image: 'venueLawn',
    bg: '#D8DFFA',
    subcategories: [
      { id: 'all-venues', title: 'View All Venues' },
      { id: 'banquet-halls', title: 'Banquet Halls' },
      { id: 'lawns', title: 'Marriage Garden / Lawns' },
      { id: 'resorts', title: 'Wedding Resorts' },
      { id: 'small-halls', title: 'Small Function / Party Halls' },
      { id: 'destination', title: 'Destination Wedding Venues' },
      { id: 'kalyana-mandapams', title: 'Kalyana Mandapams' },
      { id: '4-star', title: '4 Star & Above Wedding Hotels' },
    ],
  },
  {
    id: 'photographers',
    title: 'Photographers',
    subtitle: 'Photographers',
    image: 'photographerCeremony',
    bg: '#F6D8C6',
    subcategories: [
      { id: 'photographers', title: 'Photographers' },
      { id: 'cinematographers', title: 'Cinematographers' },
    ],
  },
  {
    id: 'makeup',
    title: 'Makeup',
    subtitle: 'Bridal Makeup Artists, Family Makeup',
    image: 'makeupBridePortrait',
    bg: '#E0B0AB',
    subcategories: [
      { id: 'bridal-makeup', title: 'Bridal Makeup Artists' },
      { id: 'family-makeup', title: 'Family Makeup' },
    ],
  },
  {
    id: 'planning-decor',
    title: 'Planning & Decor',
    subtitle: 'Wedding Planners, Decorators',
    image: 'decorMandapFloral',
    bg: '#F6B796',
    subcategories: [
      { id: 'planners', title: 'Wedding Planners' },
      { id: 'decorators', title: 'Decorators' },
    ],
  },
  {
    id: 'virtual-planning',
    title: 'Virtual Planning',
    subtitle: 'Virtual planning',
    image: 'virtualPlanningCouple',
    bg: '#F3D6C4',
    subcategories: [{ id: 'virtual-planning', title: 'Virtual planning' }],
  },
  {
    id: 'mehndi',
    title: 'Mehndi',
    subtitle: 'Mehendi Artists',
    image: 'mehndiHands',
    bg: '#E7D6C1',
    subcategories: [{ id: 'mehendi-artists', title: 'Mehendi Artists' }],
  },
  {
    id: 'music-dance',
    title: 'Music & Dance',
    subtitle: 'DJs, Sangeet Choreographer, Wedding Entertainment',
    image: 'ideaReceptionToast',
    bg: '#D9E7F2',
    subcategories: [
      { id: 'djs', title: 'DJs' },
      { id: 'choreographers', title: 'Sangeet Choreographer' },
      { id: 'entertainment', title: 'Wedding Entertainment' },
    ],
  },
  {
    id: 'food',
    title: 'Food',
    subtitle: 'Catering Services, Cake, Chaat & Food Stalls',
    image: 'venueGardenPavilion',
    bg: '#F4E3B8',
    subcategories: [
      { id: 'catering', title: 'Catering Services' },
      { id: 'cake', title: 'Cake' },
      { id: 'food-stalls', title: 'Chaat & Food Stalls' },
      { id: 'bartenders', title: 'Bartenders' },
    ],
  },
  {
    id: 'bridal-wear',
    title: 'Bridal Wear',
    subtitle: 'Bridal Lehengas, Kanjeevaram / Silk Sarees',
    image: 'ideaBrideParasol',
    bg: '#F3CCD8',
    subcategories: [
      { id: 'lehengas', title: 'Bridal Lehengas' },
      { id: 'sarees', title: 'Kanjeevaram / Silk Sarees' },
      { id: 'gowns', title: 'Cocktail Gowns' },
    ],
  },
  {
    id: 'groom-wear',
    title: 'Groom Wear',
    subtitle: 'Sherwani, Wedding Suits / Tuxes',
    image: 'ideaCoupleGardenWalk',
    bg: '#D6E4D4',
    subcategories: [
      { id: 'sherwani', title: 'Sherwani' },
      { id: 'suits', title: 'Wedding Suits / Tuxes' },
    ],
  },
  {
    id: 'pandits',
    title: 'Pandits',
    subtitle: 'Wedding Pandits',
    image: 'ideaCeremonyHands',
    bg: '#F2D2BD',
    subcategories: [{ id: 'pandits', title: 'Wedding Pandits' }],
  },
];

export const HOME_CATEGORIES: {
  id: string;
  title: string;
  image: PhotoKey;
  categoryId: string;
  subcategoryId?: string;
}[] = [
  { id: 'venues', title: 'Wedding Venues', image: 'venueGardenEstate', categoryId: 'venues' },
  {
    id: 'photographers',
    title: 'Wedding Photographers',
    image: 'photographerTeam',
    categoryId: 'photographers',
    subcategoryId: 'photographers',
  },
  {
    id: 'planners',
    title: 'Wedding Planners',
    image: 'plannerTeam',
    categoryId: 'planning-decor',
    subcategoryId: 'planners',
  },
  {
    id: 'makeup',
    title: 'Bridal Makeup Artists',
    image: 'makeupArtists',
    categoryId: 'makeup',
    subcategoryId: 'bridal-makeup',
  },
  {
    id: 'decor',
    title: 'Decorators',
    image: 'decorMandapNight',
    categoryId: 'planning-decor',
    subcategoryId: 'decorators',
  },
  {
    id: 'mehndi',
    title: 'Mehendi Artists',
    image: 'mehndiHands',
    categoryId: 'mehndi',
    subcategoryId: 'mehendi-artists',
  },
];

export const VENUE_COLLECTIONS: VenueCollection[] = [
  { id: 'luxury', title: 'Luxury Wedding Venues', image: 'venueLuxuryStage' },
  { id: 'budget', title: 'Budget Wedding Venues', image: 'venueOutdoorMandap' },
  { id: 'destination', title: 'Destination Wedding Venues', image: 'venueDestinationBeach' },
  { id: 'heritage', title: 'Heritage Wedding Venues', image: 'decorMandapNight' },
  { id: 'garden', title: 'Garden Wedding Venues', image: 'venueGardenEstate' },
];

export const findCategory = (id: string) => VENDOR_CATEGORIES.find((c) => c.id === id);

export const findSubcategory = (categoryId: string, subId?: string) =>
  findCategory(categoryId)?.subcategories.find((s) => s.id === subId);
