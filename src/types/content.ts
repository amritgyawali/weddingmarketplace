/**
 * App content a super admin edits from the console (Super admin → Content
 * studio): replacement photos, changes to marketplace listings, the order and
 * titles of the couple's home sections, home banners and the brand details.
 * It is one persisted object (`DbData.content`) laid over the bundled
 * catalogue at read time, so removing an edit restores the original.
 * Mirrored by supabase/migrations/0021_app_content.sql.
 */

/** Catalogue lists whose records can be edited. */
export type ContentKind = 'venue' | 'vendor' | 'category' | 'shortcut' | 'collection' | 'idea' | 'story' | 'realWedding';

/** Changes to one catalogue record: only the fields that differ from the original. */
export interface ContentEntry {
  fields: Record<string, unknown>;
  /** Taken out of lists and search; links to it still open. */
  hidden?: boolean;
}

/** A banner a super admin adds to the couple's home. */
export interface ContentBanner {
  id: string;
  title: string;
  body?: string;
  /** A bundled photo key or an image address. */
  image?: string;
  actionLabel?: string;
  /** An app route (`/venues`) or a web address the button opens. */
  href?: string;
  active: boolean;
}

export interface AppContent {
  /** Bundled photo key → the address of the photo shown instead, everywhere it appears. */
  images: Record<string, string>;
  /** Keyed `${kind}:${id}`. */
  entries: Record<string, ContentEntry>;
  home: {
    /** Section ids top to bottom (banners as `banner:<id>`); empty keeps the built-in order. */
    order: string[];
    /** Section id → heading; `{city}` becomes the chosen city. */
    titles: Record<string, string>;
  };
  banners: ContentBanner[];
  /** Brand field (`constants/brand.ts`) → replacement. */
  brand: Record<string, string>;
}
