import { useLocalSearchParams } from 'expo-router';

import { VenueListScreen } from '@/components/listing/VenueListScreen';
import { findSubcategory, VENUE_COLLECTIONS } from '@/data/categories';
import { useLiveList } from '@/hooks/useContent';
import type { CollectionId, VenueType } from '@/types';

/** Venue sub-categories from the Vendors tab map onto venue-type filters. */
const SUBCATEGORY_TYPES: Record<string, VenueType[]> = {
  'party-palaces': ['Party Palace'],
  'banquet-halls': ['Banquet Hall'],
  hotels: ['Hotel'],
  resorts: ['Resort'],
  gardens: ['Garden', 'Farmhouse'],
  heritage: ['Heritage Courtyard'],
  lakeside: ['Lakeside Venue'],
};

export default function CollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const collection = useLiveList('collection', VENUE_COLLECTIONS, true).find((c) => c.id === id);

  if (collection) {
    return <VenueListScreen key={id} title={collection.title} collection={collection.id as CollectionId} />;
  }

  const sub = findSubcategory('venues', id);
  return <VenueListScreen key={id} title={sub?.title ?? 'Venues'} initialTypes={SUBCATEGORY_TYPES[id] ?? []} />;
}
