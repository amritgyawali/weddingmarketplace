/**
 * The sections of the couple's home, top to bottom. A super admin reorders
 * them, renames the headings and switches them off from Content studio →
 * Home; banners they add sit in the same list as `banner:<id>`.
 */
export interface HomeSectionDef {
  id: string;
  label: string;
  hint: string;
  /** The feature switch that hides it (`data/features.ts`); sections without one always show. */
  feature?: string;
  /** Built-in heading a super admin may replace; `{city}` becomes the chosen city. */
  title?: string;
  /** Shown for weddings and engagements only. */
  weddingOnly?: boolean;
}

export const HOME_SECTIONS: HomeSectionDef[] = [
  { id: 'strip', label: 'Your celebration', hint: 'The countdown band, or the invitation to start a plan' },
  { id: 'categories', label: 'Category shortcuts', hint: 'The row of small photo tiles', feature: 'home.categories' },
  { id: 'planning', label: 'Planning grid', hint: 'Shortcuts to the planning tools', feature: 'home.planning' },
  { id: 'venues', label: 'Venues', hint: 'Venues in the chosen city', feature: 'home.venues', title: 'Venues in {city}' },
  { id: 'collections', label: 'Venue collections', hint: 'Luxury, budget, heritage and more', feature: 'home.collections', title: 'Collections in {city}', weddingOnly: true },
  { id: 'checklist', label: 'Checklist card', hint: 'What to do next', feature: 'home.checklist' },
  { id: 'photographers', label: 'Photographers', hint: 'Top-rated photographers', feature: 'home.photographers', title: 'Photographers in {city}' },
  { id: 'picks', label: 'Services for this celebration', hint: 'Up to three carousels picked by the occasion' },
  { id: 'planner', label: 'Planner banner', hint: 'The Vivah Planners promotion', feature: 'home.planner', weddingOnly: true },
  { id: 'makeup', label: 'Makeup artists', hint: 'Top-rated makeup artists', feature: 'home.makeup', title: 'Bridal makeup' },
  { id: 'real_weddings', label: 'Real weddings', hint: 'Stories from couples', feature: 'home.real_weddings', title: 'Real weddings', weddingOnly: true },
];

export const HOME_SECTION_IDS = HOME_SECTIONS.map((s) => s.id);
export const HOME_SECTION_BY_ID: Record<string, HomeSectionDef> = Object.fromEntries(HOME_SECTIONS.map((s) => [s.id, s]));

/** Places a home banner's button can open, offered as shortcuts in the editor. */
export const BANNER_LINKS: { label: string; href: string }[] = [
  { label: 'Venues', href: '/venues' },
  { label: 'Vendors', href: '/vendors' },
  { label: 'Ideas', href: '/ideas' },
  { label: 'My wedding', href: '/my-wedding' },
  { label: 'Start a plan', href: '/plan' },
  { label: 'Search', href: '/search' },
];
