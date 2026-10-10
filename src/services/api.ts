/**
 * Data-access layer. Every screen reads through these async functions (via
 * React Query), so replacing the mock data with a real backend only means
 * swapping the bodies below for `fetch` calls.
 */
import { ALL_CITIES } from '@/data/cities';
import { findCategory } from '@/data/categories';
import { catalogue, catalogueAll } from '@/data/live';
import type {
  CollectionId,
  IdeaCategory,
  SearchResult,
  Vendor,
  Venue,
  VenueFilters,
} from '@/types';

const LATENCY = { min: 180, max: 450 };

const delay = <T>(value: T): Promise<T> =>
  new Promise((resolve) =>
    setTimeout(() => resolve(value), LATENCY.min + Math.random() * (LATENCY.max - LATENCY.min)),
  );

export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} "${id}" was not found`);
    this.name = 'NotFoundError';
  }
}

const normalize = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g, ' ');

const STOPWORDS = new Set([
  'a', 'an', 'the', 'in', 'at', 'for', 'of', 'and', 'near', 'best', 'top', 'me', 'my', 'show', 'to', 'with', 'on', 'idea', 'ideas',
]);

/** Lower-cases, drops filler words and naive plurals ("photographers" → "photographer"). */
const tokenize = (query: string) =>
  normalize(query)
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t))
    .map((t) => (t.length > 4 ? t.replace(/(es|s)$/, '') : t));

/** Fraction of query tokens found in the given fields (1 = every token matched). */
const relevance = (query: string, ...fields: (string | undefined)[]) => {
  const tokens = tokenize(query);
  if (!tokens.length) return 1;
  const haystack = normalize(fields.filter(Boolean).join(' '));
  return tokens.filter((t) => haystack.includes(t)).length / tokens.length;
};

/** Strict match used by in-list search boxes. */
const matches = (query: string, ...fields: (string | undefined)[]) => relevance(query, ...fields) === 1;

/** Looser threshold for global search so multi-word queries still surface results. */
const SEARCH_THRESHOLD = 0.5;

const inCity = (city: string, itemCity: string) => city === ALL_CITIES || city === itemCity;

export const DEFAULT_VENUE_FILTERS: VenueFilters = {
  sort: 'popular',
  types: [],
  maxBudget: null,
  minGuests: null,
  minRating: null,
};

export const countActiveFilters = (f: VenueFilters) =>
  (f.sort !== 'popular' ? 1 : 0) +
  (f.types.length ? 1 : 0) +
  (f.maxBudget ? 1 : 0) +
  (f.minGuests ? 1 : 0) +
  (f.minRating ? 1 : 0);

export interface VenueQuery {
  city: string;
  query?: string;
  collection?: CollectionId;
  filters?: VenueFilters;
  destinationPricing?: boolean;
}

export function filterVenues({ city, query = '', collection, filters = DEFAULT_VENUE_FILTERS, destinationPricing }: VenueQuery) {
  const priceOf = (v: Venue) => (destinationPricing ? v.destinationPackage : v.rentalCost);
  const list = catalogue.venues().filter(
    (v) =>
      inCity(city, v.city) &&
      (!collection || v.collections.includes(collection)) &&
      (!destinationPricing || v.collections.includes('destination')) &&
      (!filters.types.length || filters.types.includes(v.type)) &&
      (!filters.maxBudget || priceOf(v) <= filters.maxBudget) &&
      (!filters.minGuests || v.capacity.max >= filters.minGuests) &&
      (!filters.minRating || v.rating >= filters.minRating) &&
      matches(query, v.name, v.locality, v.city, v.type),
  );

  const sorters: Record<VenueFilters['sort'], (a: Venue, b: Venue) => number> = {
    popular: (a, b) =>
      Number(!!b.sponsored) - Number(!!a.sponsored) ||
      Number(b.featured) - Number(a.featured) ||
      b.reviewCount - a.reviewCount,
    rating: (a, b) => b.rating - a.rating,
    priceLow: (a, b) => priceOf(a) - priceOf(b),
    priceHigh: (a, b) => priceOf(b) - priceOf(a),
  };
  return list.sort(sorters[filters.sort]);
}

export const api = {
  getVenues: (q: VenueQuery) => delay(filterVenues(q)),

  getVenue: async (id: string) => {
    const venue = catalogueAll.venues().find((v) => v.id === id);
    if (!venue) throw new NotFoundError('Venue', id);
    return delay(venue);
  },

  getSimilarVenues: (venue: Venue) =>
    delay(catalogue.venues().filter((v) => v.id !== venue.id && (v.city === venue.city || v.type === venue.type)).slice(0, 6)),

  getCollections: (city: string) =>
    delay(
      catalogue.collections().map((c) => ({
        ...c,
        count: catalogue.venues().filter((v) => inCity(city, v.city) && v.collections.includes(c.id)).length,
      })).filter((c) => c.count > 0),
    ),

  getVendors: ({
    categoryId,
    subcategoryId,
    city,
    query = '',
    sort = 'popular',
  }: {
    categoryId: string;
    subcategoryId?: string;
    city: string;
    query?: string;
    sort?: 'popular' | 'rating' | 'priceLow' | 'priceHigh';
  }) => {
    const list = catalogue.vendors().filter(
      (v) =>
        v.categoryId === categoryId &&
        (!subcategoryId || v.subcategoryId === subcategoryId) &&
        inCity(city, v.city) &&
        matches(query, v.name, v.city),
    );
    const sorters = {
      popular: (a: Vendor, b: Vendor) => Number(b.featured) - Number(a.featured) || b.reviewCount - a.reviewCount,
      rating: (a: Vendor, b: Vendor) => b.rating - a.rating,
      priceLow: (a: Vendor, b: Vendor) => a.startingPrice - b.startingPrice,
      priceHigh: (a: Vendor, b: Vendor) => b.startingPrice - a.startingPrice,
    };
    return delay(list.sort(sorters[sort]));
  },

  getVendor: async (id: string) => {
    const vendor = catalogueAll.vendors().find((v) => v.id === id);
    if (!vendor) throw new NotFoundError('Vendor', id);
    return delay(vendor);
  },

  getFeaturedVendors: (city: string, categoryId: string, limit = 8) =>
    delay(
      catalogue.vendors().filter((v) => v.categoryId === categoryId && inCity(city, v.city))
        .sort((a, b) => b.rating - a.rating)
        .slice(0, limit),
    ),

  getVenuesByIds: (ids: string[]) => delay(catalogueAll.venues().filter((v) => ids.includes(v.id))),
  getVendorsByIds: (ids: string[]) => delay(catalogueAll.vendors().filter((v) => ids.includes(v.id))),

  getIdeas: ({ query = '', category }: { query?: string; category?: IdeaCategory | null }) =>
    delay(catalogue.ideas().filter((p) => (!category || p.category === category) && matches(query, p.title, p.category))),

  getIdea: async (id: string) => {
    const idea = catalogueAll.ideas().find((p) => p.id === id);
    if (!idea) throw new NotFoundError('Photo', id);
    return delay(idea);
  },

  getStories: () => delay(catalogue.stories()),
  getStory: async (id: string) => {
    const story = catalogueAll.stories().find((s) => s.id === id);
    if (!story) throw new NotFoundError('Story', id);
    return delay(story);
  },

  getRealWeddings: () => delay(catalogue.realWeddings()),
  getRealWedding: async (id: string) => {
    const wedding = catalogueAll.realWeddings().find((w) => w.id === id);
    if (!wedding) throw new NotFoundError('Real wedding', id);
    return delay(wedding);
  },

  search: (query: string, city: string): Promise<SearchResult[]> => {
    const q = query.trim();
    if (!q) return delay([]);

    const topScores = new Map<SearchResult['kind'], number>();

    /** Scores, filters and ranks a collection; local results win ties. */
    const rank = <T>(
      kind: SearchResult['kind'],
      items: T[],
      fields: (item: T) => (string | undefined)[],
      cityOf?: (item: T) => string,
      tie?: (a: T, b: T) => number,
    ) => {
      const scored = items
        .map((item) => ({ item, score: relevance(q, ...fields(item)) }))
        .filter((x) => x.score >= SEARCH_THRESHOLD)
        .sort(
          (a, b) =>
            b.score - a.score ||
            (cityOf ? Number(inCity(city, cityOf(b.item))) - Number(inCity(city, cityOf(a.item))) : 0) ||
            (tie ? tie(a.item, b.item) : 0),
        );
      topScores.set(kind, scored[0]?.score ?? 0);
      return scored.map((x) => x.item);
    };

    const categories: SearchResult[] = rank(
      'category',
      catalogue.categories().flatMap((c) => c.subcategories.map((s) => ({ id: s.id, title: s.title, categoryId: c.id, parent: c.title }))),
      (s) => [s.title, s.parent],
    )
      .slice(0, 4)
      .map(({ id, title, categoryId }) => ({ kind: 'category', item: { id, title, categoryId } }));

    const venues: SearchResult[] = rank(
      'venue',
      catalogue.venues(),
      (v) => [v.name, v.city, v.locality, v.type, 'venue wedding venues'],
      (v) => v.city,
      (a, b) => b.rating - a.rating,
    )
      .slice(0, 6)
      .map((item) => ({ kind: 'venue', item }));

    const vendors: SearchResult[] = rank(
      'vendor',
      catalogue.vendors(),
      (v) => [v.name, v.city, findCategory(v.categoryId)?.title, v.subcategoryId.replace(/-/g, ' '), v.services.join(' ')],
      (v) => v.city,
      (a, b) => b.rating - a.rating,
    )
      .slice(0, 8)
      .map((item) => ({ kind: 'vendor', item }));

    const ideas: SearchResult[] = rank('idea', catalogue.ideas(), (p) => [p.title, p.category])
      .slice(0, 6)
      .map((item) => ({ kind: 'idea', item }));

    // Groups are ordered by their best match; categories stay on top as shortcuts.
    const groups = [venues, vendors, ideas].sort(
      (a, b) => (b[0] ? topScores.get(b[0].kind)! : 0) - (a[0] ? topScores.get(a[0].kind)! : 0),
    );
    return delay([...categories, ...groups.flat()]);
  },
};
