/**
 * The marketplace catalogue as the app shows it: the bundled lists with a
 * super admin's edits applied (Content studio → Listings). Read the catalogue
 * through these, or through `useLiveList` in a component, never from the
 * bundled arrays, so an edit shows everywhere.
 */
import { patchList, visibleList } from '@/services/content';

import { HOME_CATEGORIES, VENDOR_CATEGORIES, VENUE_COLLECTIONS } from './categories';
import { IDEA_PHOTOS, REAL_WEDDINGS, STORIES } from './ideas';
import { VENDORS } from './vendors';
import { VENUES } from './venues';

/** For lists and search: records a super admin hid are left out. */
export const catalogue = {
  venues: () => visibleList('venue', VENUES),
  vendors: () => visibleList('vendor', VENDORS),
  categories: () => patchList('category', VENDOR_CATEGORIES),
  shortcuts: () => visibleList('shortcut', HOME_CATEGORIES),
  collections: () => visibleList('collection', VENUE_COLLECTIONS),
  ideas: () => visibleList('idea', IDEA_PHOTOS),
  stories: () => visibleList('story', STORIES),
  realWeddings: () => visibleList('realWedding', REAL_WEDDINGS),
};

/** For lookups by id: hidden records stay, so a shortlist or booking that points at one still opens. */
export const catalogueAll = {
  venues: () => patchList('venue', VENUES),
  vendors: () => patchList('vendor', VENDORS),
  collections: () => patchList('collection', VENUE_COLLECTIONS),
  ideas: () => patchList('idea', IDEA_PHOTOS),
  stories: () => patchList('story', STORIES),
  realWeddings: () => patchList('realWedding', REAL_WEDDINGS),
};
