/**
 * Feature switches a super admin flips from the console (Platform → More →
 * Super admin → Features), with no code change. Each switch hides a surface
 * for everyone: a tab, a home section, a marketplace category, a tool, a
 * sign-up path. State lives in `DbData.featureFlags`; a missing id takes its
 * default (`featureDefault`).
 *
 * Out of the box each app shows only its 20 most-used features
 * (`TOP_FEATURES`); everything else is an extra that stays hidden until a
 * super admin switches it on, so new users aren't buried in options.
 *
 * Tools are switched by `tool:<ToolId>` and marketplace services by
 * `service:<serviceId>`, so this list holds only the fixed surfaces.
 */
import type { UserRole } from '@/types/platform';

export interface FeatureDef {
  id: string;
  label: string;
  /** Which app it belongs to; `all` for shared surfaces. */
  role: UserRole | 'all';
  group: string;
  hint?: string;
}

export const FEATURES: FeatureDef[] = [
  // Couple app
  { id: 'tab.customer.venues', label: 'Venues tab', role: 'customer', group: 'Tabs' },
  { id: 'tab.customer.vendors', label: 'Vendors tab', role: 'customer', group: 'Tabs' },
  { id: 'tab.customer.ideas', label: 'Ideas tab', role: 'customer', group: 'Tabs' },
  { id: 'tab.customer.wedding', label: 'My wedding tab', role: 'customer', group: 'Tabs', hint: "The couple's plan, quotes and payments" },
  { id: 'tab.customer.genie', label: 'Planner packages', role: 'customer', group: 'Tabs', hint: 'Paid planner packages: the home banner and the menu entry' },
  { id: 'home.categories', label: 'Category shortcuts', role: 'customer', group: 'Home' },
  { id: 'home.planning', label: 'Your planning grid', role: 'customer', group: 'Home' },
  { id: 'home.venues', label: 'Venues carousel', role: 'customer', group: 'Home' },
  { id: 'home.collections', label: 'Venue collections', role: 'customer', group: 'Home' },
  { id: 'home.checklist', label: 'Checklist card', role: 'customer', group: 'Home' },
  { id: 'home.photographers', label: 'Photographers carousel', role: 'customer', group: 'Home' },
  { id: 'home.planner', label: 'Planner banner', role: 'customer', group: 'Home' },
  { id: 'home.makeup', label: 'Makeup carousel', role: 'customer', group: 'Home' },
  { id: 'home.real_weddings', label: 'Real weddings', role: 'customer', group: 'Home' },
  { id: 'couple.help', label: 'Quick help button', role: 'customer', group: 'Features' },
  { id: 'couple.search', label: 'Search', role: 'customer', group: 'Features' },
  { id: 'couple.messages', label: 'Messages', role: 'customer', group: 'Features' },
  { id: 'couple.tools', label: 'Planning tools hub', role: 'customer', group: 'Features' },
  { id: 'couple.celebrate', label: 'Plan another celebration', role: 'customer', group: 'Features' },
  { id: 'couple.tour', label: 'First-run app tour', role: 'customer', group: 'Features', hint: 'Small cards that explain search, the tabs, messages and the menu on first open' },
  { id: 'couple.bookings', label: 'Enquiries and bookings', role: 'customer', group: 'Screens' },
  { id: 'couple.shortlist', label: 'Shortlist', role: 'customer', group: 'Screens' },
  { id: 'couple.budget', label: 'Budget', role: 'customer', group: 'Screens' },
  { id: 'couple.checklist', label: 'Checklist', role: 'customer', group: 'Screens' },
  { id: 'couple.guests', label: 'Guests and RSVP', role: 'customer', group: 'Screens' },
  { id: 'couple.invitations', label: 'Invitations', role: 'customer', group: 'Screens' },
  { id: 'couple.website', label: 'Wedding website', role: 'customer', group: 'Screens' },
  { id: 'couple.contracts', label: 'Contracts', role: 'customer', group: 'Screens' },
  { id: 'couple.calendar', label: 'Calendar', role: 'customer', group: 'Screens' },
  { id: 'couple.seating', label: 'Seating chart', role: 'customer', group: 'Screens' },
  { id: 'couple.registry', label: 'Gift registry', role: 'customer', group: 'Screens' },
  { id: 'couple.boards', label: 'Mood boards', role: 'customer', group: 'Screens' },
  { id: 'couple.compare', label: 'Compare vendors', role: 'customer', group: 'Screens' },
  { id: 'couple.deals', label: 'Deals and offers', role: 'customer', group: 'Screens' },
  { id: 'couple.shop', label: 'Shop page', role: 'customer', group: 'Screens' },
  { id: 'couple.promotions', label: 'Promotions page', role: 'customer', group: 'Screens' },
  // Everyone
  { id: 'login.demo', label: 'One-tap demo accounts', role: 'all', group: 'Sign-up', hint: 'The "Continue as …" buttons on the login screens' },
  { id: 'app.announcements', label: 'Announcements on home screens', role: 'all', group: 'Content' },
  { id: 'app.notifications', label: 'Pop-up confirmations', role: 'all', group: 'Content', hint: 'The short message after adding, deleting or finishing something' },
  { id: 'app.bug_report', label: 'Shake to report a bug', role: 'all', group: 'Content', hint: 'Everyone, on every screen: a phone screenshot, three fingers held down, the bug button or a shake sends a screenshot and a description to Super admin → Bug reports' },
];

export const FEATURE_BY_ID: Record<string, FeatureDef> = Object.fromEntries(FEATURES.map((f) => [f.id, f]));

export const toolFeature = (toolId: string) => `tool:${toolId}`;
export const serviceFeature = (serviceId: string) => `service:${serviceId}`;
export const tabFeature = (role: UserRole, tab: string) => `tab.${role}.${tab}`;

export interface TopFeature {
  /**
   * The switch behind it: a feature id, `tool:<ToolId>`, or `core.<role>.<name>`
   * for parts that can't be switched off (the plan, account set-up, the staff
   * screens behind permissions).
   */
  id: string;
  label: string;
}

/**
 * The 20 features each app shows out of the box, in the order people meet
 * them. Account basics (home, notifications, settings, profile, language,
 * support, log out) come with every app and aren't counted. Tools listed here
 * are on by default; every other tool is an extra.
 */
export const TOP_FEATURES: Partial<Record<UserRole, TopFeature[]>> = {
  customer: [
    { id: 'tab.customer.venues', label: 'Venues' },
    { id: 'tab.customer.vendors', label: 'Vendors' },
    { id: 'tab.customer.ideas', label: 'Ideas' },
    { id: 'couple.search', label: 'Search' },
    { id: 'couple.messages', label: 'Messages' },
    { id: 'tab.customer.wedding', label: 'My Wedding: plan, quotes and payments' },
    { id: 'couple.bookings', label: 'Enquiries and bookings' },
    { id: 'couple.shortlist', label: 'Shortlist' },
    { id: 'couple.budget', label: 'Budget' },
    { id: 'couple.checklist', label: 'Checklist' },
    { id: 'couple.guests', label: 'Guests and RSVP' },
    { id: 'couple.invitations', label: 'Invitations' },
    { id: 'couple.website', label: 'Wedding website' },
    { id: 'couple.contracts', label: 'Contracts' },
    { id: 'tab.customer.genie', label: 'Planner packages' },
    { id: 'couple.help', label: 'Quick help' },
    { id: 'couple.tools', label: 'Planning tools' },
    { id: 'tool:couple.sait', label: 'Sait finder' },
    { id: 'tool:couple.myday', label: 'My day schedule' },
    { id: 'tool:couple.gifts', label: 'Shagun and gifts' },
  ],
};

/**
 * Switches that come with the app like the account basics: on by default and
 * not counted in the top 20. The first-run tour only explains the app.
 */
export const BASIC_FEATURES = new Set(['couple.tour']);

/** Fixed surfaces that start hidden: extras a super admin can switch on. */
export const EXTRA_FEATURES = new Set([
  'home.collections',
  'home.makeup',
  'home.real_weddings',
  'couple.celebrate',
  'couple.calendar',
  'couple.seating',
  'couple.registry',
  'couple.boards',
  'couple.compare',
  'couple.deals',
  'couple.shop',
  'couple.promotions',
]);

const DEFAULT_TOOLS = new Set([
  ...Object.values(TOP_FEATURES)
    .flat()
    .filter((f) => f.id.startsWith('tool:'))
    .map((f) => f.id.slice(5)),
]);

/** On or off before a super admin touches it: tools only if they are top features, fixed surfaces unless they are extras. */
export const featureDefault = (id: string) => (id.startsWith('tool:') ? DEFAULT_TOOLS.has(id.slice(5)) : !EXTRA_FEATURES.has(id));

/** Is the feature on? A missing id takes its default. */
export const featureOn = (flags: Record<string, boolean> | undefined, id: string) => flags?.[id] ?? featureDefault(id);

/**
 * The screens behind a feature. When a feature is off its links disappear
 * and these screens show a "switched off" page (`FeatureRouteGuard`), so an
 * old link or notification can't open them. `*` matches one path segment.
 */
export const FEATURE_ROUTES: Record<string, string[]> = {
  'couple.bookings': ['/bookings'],
  'couple.shortlist': ['/shortlist'],
  'couple.budget': ['/budget'],
  'couple.checklist': ['/checklist'],
  'couple.guests': ['/guests'],
  'couple.invitations': ['/invitations'],
  'couple.website': ['/website'],
  'couple.contracts': ['/contracts', '/contract/*'],
  'couple.calendar': ['/calendar'],
  'couple.seating': ['/seating'],
  'couple.registry': ['/registry'],
  'couple.boards': ['/boards'],
  'couple.compare': ['/compare'],
  'couple.deals': ['/deals'],
  'couple.shop': ['/info/shop'],
  'couple.promotions': ['/info/promotions'],
  'couple.tools': ['/tools'],
  'couple.help': ['/assistant'],
  'couple.celebrate': ['/celebrate'],
  'couple.search': ['/search'],
  'couple.messages': ['/inbox', '/inbox/*'],
  'tab.customer.genie': ['/genie', '/genie-checkout/*'],
};

const ROUTE_PATTERNS = Object.entries(FEATURE_ROUTES).flatMap(([id, routes]) => routes.map((r) => ({ id, parts: r.split('/').filter(Boolean) })));

/** The feature a path belongs to (`/contract/c1` → `couple.contracts`), if any. */
export function featureForPath(path: string): string | undefined {
  const parts = path.split(/[?#]/)[0].split('/').filter(Boolean);
  return ROUTE_PATTERNS.find((p) => p.parts.length === parts.length && p.parts.every((seg, i) => seg === '*' || seg === parts[i]))?.id;
}

/** A link as expo-router takes it: a path, or a pathname with params. */
export type FeatureLink = string | { pathname: string; params?: Record<string, unknown> };

/** The path a link opens, with `[param]` segments filled in. */
export const linkPath = (href: FeatureLink) =>
  typeof href === 'string' ? href : href.pathname.replace(/\[(\w+)\]/g, (_, k: string) => String(href.params?.[k] ?? k));

/** Can this link open? False when the screen it leads to belongs to a switched-off feature. */
export const linkOn = (flags: Record<string, boolean> | undefined, href: FeatureLink) => {
  const id = featureForPath(linkPath(href));
  return !id || featureOn(flags, id);
};
