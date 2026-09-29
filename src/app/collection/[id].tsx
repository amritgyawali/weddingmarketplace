import { useLocalSearchParams } from 'expo-router';

import { VenueListScreen } from '@/components/listing/VenueListScreen';
import { findSubcategory, VENUE_COLLECTIONS } from '@/data/categories';
import type { CollectionId, VenueType } from '@/types';

/** Venue sub-categories from the Vendors tab map onto venue-type filters. */
const SUBCATEGORY_TYPES: Record<string, VenueType[]> = {
  'banquet-halls': ['Banquet Hall'],
  lawns: ['Lawn', 'Farmhouse'],
  resorts: ['Resort'],
  'small-halls': ['Banquet Hall', 'Kalyana Mandapam'],
  'kalyana-mandapams': ['Kalyana Mandapam'],
  '4-star': ['4 Star Hotel', '5 Star Hotel'],
};

export default function CollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const collection = VENUE_COLLECTIONS.find((c) => c.id === id);

  if (collection) {
    return <VenueListScreen key={id} title={collection.title} collection={collection.id as CollectionId} />;
  }

  const sub = findSubcategory('venues', id);
  return <VenueListScreen key={id} title={sub?.title ?? 'Venues'} initialTypes={SUBCATEGORY_TYPES[id] ?? []} />;
}
