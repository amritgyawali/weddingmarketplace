import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { api, type VenueQuery } from '@/services/api';
import type { IdeaCategory } from '@/types';

export const queryKeys = {
  venues: (q: VenueQuery) => ['venues', q] as const,
  venue: (id: string) => ['venue', id] as const,
  similarVenues: (id: string) => ['venue', id, 'similar'] as const,
  collections: (city: string) => ['collections', city] as const,
  vendors: (p: object) => ['vendors', p] as const,
  vendor: (id: string) => ['vendor', id] as const,
  featuredVendors: (city: string, categoryId: string) => ['vendors', 'featured', city, categoryId] as const,
  ideas: (p: object) => ['ideas', p] as const,
  idea: (id: string) => ['idea', id] as const,
  stories: ['stories'] as const,
  story: (id: string) => ['story', id] as const,
  realWeddings: ['realWeddings'] as const,
  realWedding: (id: string) => ['realWedding', id] as const,
  search: (q: string, city: string) => ['search', q, city] as const,
  shortlist: (kind: string, ids: string[]) => ['shortlist', kind, ids] as const,
};

export const useVenues = (q: VenueQuery) =>
  useQuery({ queryKey: queryKeys.venues(q), queryFn: () => api.getVenues(q), placeholderData: keepPreviousData });

export const useVenue = (id: string) =>
  useQuery({ queryKey: queryKeys.venue(id), queryFn: () => api.getVenue(id), enabled: !!id });

export const useSimilarVenues = (id: string) => {
  const venue = useVenue(id);
  return useQuery({
    queryKey: queryKeys.similarVenues(id),
    queryFn: () => api.getSimilarVenues(venue.data!),
    enabled: !!venue.data,
  });
};

export const useCollections = (city: string) =>
  useQuery({ queryKey: queryKeys.collections(city), queryFn: () => api.getCollections(city) });

export const useVendors = (p: Parameters<typeof api.getVendors>[0]) =>
  useQuery({ queryKey: queryKeys.vendors(p), queryFn: () => api.getVendors(p), placeholderData: keepPreviousData });

export const useVendor = (id: string) =>
  useQuery({ queryKey: queryKeys.vendor(id), queryFn: () => api.getVendor(id), enabled: !!id });

export const useFeaturedVendors = (city: string, categoryId: string) =>
  useQuery({
    queryKey: queryKeys.featuredVendors(city, categoryId),
    queryFn: () => api.getFeaturedVendors(city, categoryId),
    enabled: !!city && !!categoryId,
  });

export const useIdeas = (p: { query?: string; category?: IdeaCategory | null }) =>
  useQuery({ queryKey: queryKeys.ideas(p), queryFn: () => api.getIdeas(p), placeholderData: keepPreviousData });

export const useIdea = (id: string) =>
  useQuery({ queryKey: queryKeys.idea(id), queryFn: () => api.getIdea(id), enabled: !!id });

export const useStories = () => useQuery({ queryKey: queryKeys.stories, queryFn: api.getStories });

export const useStory = (id: string) =>
  useQuery({ queryKey: queryKeys.story(id), queryFn: () => api.getStory(id), enabled: !!id });

export const useRealWeddings = () => useQuery({ queryKey: queryKeys.realWeddings, queryFn: api.getRealWeddings });

export const useRealWedding = (id: string) =>
  useQuery({ queryKey: queryKeys.realWedding(id), queryFn: () => api.getRealWedding(id), enabled: !!id });

export const useSearch = (q: string, city: string) =>
  useQuery({
    queryKey: queryKeys.search(q, city),
    queryFn: () => api.search(q, city),
    enabled: q.trim().length > 1,
    placeholderData: keepPreviousData,
  });

export const useShortlistedVenues = (ids: string[]) =>
  useQuery({
    queryKey: queryKeys.shortlist('venues', ids),
    queryFn: () => api.getVenuesByIds(ids),
    placeholderData: keepPreviousData,
  });

export const useShortlistedVendors = (ids: string[]) =>
  useQuery({
    queryKey: queryKeys.shortlist('vendors', ids),
    queryFn: () => api.getVendorsByIds(ids),
    placeholderData: keepPreviousData,
  });
