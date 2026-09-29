import type { PhotoKey } from '@/constants/images';

export type Role = 'bride' | 'groom' | 'other';

export type CityGroup = 'metro' | 'popular' | 'state' | 'international';

export interface City {
  id: string;
  name: string;
  state?: string;
  group: CityGroup;
}

export type VenueType =
  | 'Resort'
  | 'Banquet Hall'
  | 'Lawn'
  | '5 Star Hotel'
  | '4 Star Hotel'
  | 'Heritage Palace'
  | 'Farmhouse'
  | 'Kalyana Mandapam'
  | 'Beach Venue';

export interface Review {
  id: string;
  author: string;
  rating: number;
  date: string;
  text: string;
}

export interface Venue {
  id: string;
  name: string;
  city: string;
  locality: string;
  type: VenueType;
  rating: number;
  reviewCount: number;
  rentalCost: number;
  vegPerPlate: number;
  nonVegPerPlate: number;
  destinationPackage: number;
  capacity: { min: number; max: number };
  rooms: number;
  featured: boolean;
  /** Paid placement — pinned to the top of "popular" sorting. */
  sponsored?: boolean;
  collections: CollectionId[];
  images: PhotoKey[];
  about: string;
  amenities: string[];
  spaces: { name: string; type: string; capacity: string }[];
  policies: string[];
  reviews: Review[];
  phone: string;
}

export type CollectionId = 'luxury' | 'budget' | 'destination' | 'heritage' | 'garden';

export interface VenueCollection {
  id: CollectionId;
  title: string;
  image: PhotoKey;
}

export interface VendorCategory {
  id: string;
  title: string;
  subtitle: string;
  image: PhotoKey;
  bg: string;
  subcategories: { id: string; title: string }[];
}

export interface VendorPackage {
  name: string;
  price: number;
  unit: string;
  includes: string[];
}

export interface Vendor {
  id: string;
  name: string;
  categoryId: string;
  subcategoryId: string;
  city: string;
  rating: number;
  reviewCount: number;
  startingPrice: number;
  priceUnit: string;
  featured: boolean;
  images: PhotoKey[];
  about: string;
  experience: number;
  eventsDone: number;
  services: string[];
  packages: VendorPackage[];
  reviews: Review[];
  phone: string;
}

export type IdeaCategory =
  | 'Bridal Wear'
  | 'Decor'
  | 'Couple Portraits'
  | 'Mehndi'
  | 'Reception'
  | 'Venues'
  | 'Rituals';

export interface IdeaPhoto {
  id: string;
  image: PhotoKey;
  title: string;
  category: IdeaCategory;
  likes: number;
  credit: string;
  aspect: number;
}

export interface Story {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  image: PhotoKey;
  readMinutes: number;
  author: string;
  body: string[];
}

export interface RealWedding {
  id: string;
  couple: string;
  city: string;
  venue: string;
  theme: string;
  cover: PhotoKey;
  gallery: PhotoKey[];
  story: string;
  vendors: { role: string; name: string }[];
}

export interface GeniePackage {
  id: string;
  title: string;
  subtitle: string;
  price: number;
  mrp: number;
  features: string[];
  popular?: boolean;
}

export interface Testimonial {
  id: string;
  couple: string;
  rating: number;
  date: string;
  text: string;
}

export interface Faq {
  id: string;
  q: string;
  a: string;
}

export type ChecklistPhase =
  | '12+ Months'
  | '9-12 Months'
  | '6-9 Months'
  | '3-6 Months'
  | '1-3 Months'
  | '2-4 Weeks'
  | '1 Week'
  | 'Wedding Day';

export interface ChecklistTask {
  id: string;
  title: string;
  phase: ChecklistPhase;
  category: string;
}

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled';

export interface Booking {
  id: string;
  kind: 'venue' | 'vendor' | 'genie';
  refId: string;
  title: string;
  subtitle: string;
  image?: PhotoKey;
  eventDate?: string;
  guests?: number;
  amount?: number;
  status: BookingStatus;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  from: 'me' | 'them';
  text: string;
  at: string;
}

export interface Conversation {
  id: string;
  kind: 'venue' | 'vendor';
  refId: string;
  title: string;
  image: PhotoKey;
  messages: ChatMessage[];
  unread: number;
}

export type SearchResult =
  | { kind: 'venue'; item: Venue }
  | { kind: 'vendor'; item: Vendor }
  | { kind: 'idea'; item: IdeaPhoto }
  | { kind: 'category'; item: { id: string; title: string; categoryId: string } };

export interface VenueFilters {
  sort: 'popular' | 'rating' | 'priceLow' | 'priceHigh';
  types: VenueType[];
  maxBudget: number | null;
  minGuests: number | null;
  minRating: number | null;
}
