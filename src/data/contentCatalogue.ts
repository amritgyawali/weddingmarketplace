/**
 * The catalogue lists a super admin can edit from Content studio → Listings,
 * with what the console needs to show and check each one. The lists
 * themselves stay as bundled; edits are laid over them by `services/content`.
 */
import { isPhotoKey, type PhotoRef } from '@/constants/images';
import { imageAddress } from '@/services/content';
import type { ContentKind } from '@/types/content';

import { HOME_CATEGORIES, VENDOR_CATEGORIES, VENUE_COLLECTIONS } from './categories';
import { IDEA_PHOTOS, REAL_WEDDINGS, STORIES } from './ideas';
import { VENDORS } from './vendors';
import { VENUES } from './venues';

export type CatalogueRecord = { id: string } & Record<string, unknown>;

export interface ContentKindDef {
  id: ContentKind;
  label: string;
  /** "venue", for messages. */
  one: string;
  hint: string;
  /** The bundled records, unedited. */
  items: readonly CatalogueRecord[];
  /** Field that names a record. */
  title: string;
  /** Fields shown under the name in lists. */
  detail: string[];
  /** Fields holding one photo or a list of photos. */
  imageFields: string[];
  /** Can a record be taken out of lists and search? */
  hideable: boolean;
}

const records = (list: readonly { id: string }[]) => list as unknown as readonly CatalogueRecord[];

export const CONTENT_CATALOGUE: ContentKindDef[] = [
  { id: 'venue', label: 'Venues', one: 'venue', hint: 'Name, prices, capacity, photos, spaces and policies', items: records(VENUES), title: 'name', detail: ['type', 'locality', 'city'], imageFields: ['images'], hideable: true },
  { id: 'vendor', label: 'Vendors', one: 'vendor', hint: 'Name, starting price, photos, services and packages', items: records(VENDORS), title: 'name', detail: ['subcategoryId', 'city'], imageFields: ['images'], hideable: true },
  { id: 'category', label: 'Categories', one: 'category', hint: 'The tiles on the Vendors tab', items: records(VENDOR_CATEGORIES), title: 'title', detail: ['subtitle'], imageFields: ['image'], hideable: false },
  { id: 'shortcut', label: 'Home shortcuts', one: 'shortcut', hint: 'The small photo tiles at the top of the home', items: records(HOME_CATEGORIES), title: 'title', detail: ['categoryId'], imageFields: ['image'], hideable: true },
  { id: 'collection', label: 'Venue collections', one: 'collection', hint: 'Luxury, budget, destination, heritage, garden', items: records(VENUE_COLLECTIONS), title: 'title', detail: [], imageFields: ['image'], hideable: true },
  { id: 'idea', label: 'Idea photos', one: 'photo', hint: 'The Ideas feed', items: records(IDEA_PHOTOS), title: 'title', detail: ['category', 'credit'], imageFields: ['image'], hideable: true },
  { id: 'story', label: 'Stories', one: 'story', hint: 'Articles on the Ideas tab', items: records(STORIES), title: 'title', detail: ['category', 'author'], imageFields: ['image'], hideable: true },
  { id: 'realWedding', label: 'Real weddings', one: 'wedding', hint: 'Couples’ stories and galleries', items: records(REAL_WEDDINGS), title: 'couple', detail: ['theme', 'city'], imageFields: ['cover', 'gallery'], hideable: true },
];

export const CONTENT_KIND_BY_ID = Object.fromEntries(CONTENT_CATALOGUE.map((k) => [k.id, k])) as Record<ContentKind, ContentKindDef>;

/** A bundled photo key or an address the app can load. */
export const isImageRef = (ref: string) => isPhotoKey(ref) || !!imageAddress(ref);

/** The first photo of a record, for list rows. */
export function recordCover(def: ContentKindDef, record: CatalogueRecord): PhotoRef | undefined {
  for (const field of def.imageFields) {
    const value = record[field];
    if (typeof value === 'string' && value) return value;
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  }
  return undefined;
}

/** `startingPrice` → "Starting price". */
export const fieldLabel = (key: string) => {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};
