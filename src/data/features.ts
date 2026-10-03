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
  { id: 'tab.customer.genie', label: 'Planner tab', role: 'customer', group: 'Tabs', hint: 'Paid planner packages' },
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
  // Business app
  { id: 'tab.vendor.leads', label: 'Leads tab', role: 'vendor', group: 'Tabs' },
  { id: 'tab.vendor.bookings', label: 'Bookings tab', role: 'vendor', group: 'Tabs' },
  { id: 'tab.vendor.calendar', label: 'Calendar tab', role: 'vendor', group: 'Tabs' },
  { id: 'tab.vendor.account', label: 'Business tab', role: 'vendor', group: 'Tabs' },
  { id: 'vendor.social', label: 'Social media hub', role: 'vendor', group: 'Features', hint: 'Facebook, Instagram, WhatsApp and TikTok inbox and publishing' },
  { id: 'vendor.messages', label: 'Messages', role: 'vendor', group: 'Screens' },
  { id: 'vendor.quotes', label: 'Quotations', role: 'vendor', group: 'Screens' },
  { id: 'vendor.packages', label: 'Packages and services', role: 'vendor', group: 'Screens' },
  { id: 'vendor.portfolio', label: 'Portfolio', role: 'vendor', group: 'Screens' },
  { id: 'vendor.gigs', label: 'Hire freelancers', role: 'vendor', group: 'Screens' },
  { id: 'vendor.finance', label: 'Finance', role: 'vendor', group: 'Screens' },
  { id: 'vendor.reviews', label: 'Reviews', role: 'vendor', group: 'Screens' },
  { id: 'vendor.tools', label: 'Business tools hub', role: 'vendor', group: 'Screens' },
  { id: 'vendor.team', label: 'Team and staff', role: 'vendor', group: 'Screens' },
  { id: 'vendor.customers', label: 'Customers', role: 'vendor', group: 'Screens' },
  { id: 'vendor.analytics', label: 'Analytics', role: 'vendor', group: 'Screens' },
  { id: 'vendor.promotions', label: 'Promotions', role: 'vendor', group: 'Screens' },
  // Freelancer app
  { id: 'tab.freelancer.jobs', label: 'My jobs tab', role: 'freelancer', group: 'Tabs' },
  { id: 'tab.freelancer.calendar', label: 'Calendar tab', role: 'freelancer', group: 'Tabs' },
  { id: 'tab.freelancer.earnings', label: 'Earnings tab', role: 'freelancer', group: 'Tabs' },
  { id: 'tab.freelancer.profile', label: 'Profile tab', role: 'freelancer', group: 'Tabs' },
  // Staff console (More and the super admin console can't be switched off)
  { id: 'tab.platform.leads', label: 'Leads tab', role: 'platform', group: 'Tabs' },
  { id: 'tab.platform.weddings', label: 'Weddings tab', role: 'platform', group: 'Tabs' },
  { id: 'tab.platform.execution', label: 'Control tab', role: 'platform', group: 'Tabs' },
  // Everyone
  { id: 'signup.vendor', label: 'Business sign-up', role: 'all', group: 'Sign-up', hint: 'Hides the business card on "Who are you?"' },
  { id: 'signup.freelancer', label: 'Freelancer sign-up', role: 'all', group: 'Sign-up' },
  { id: 'signup.platform', label: 'Staff sign-up', role: 'all', group: 'Sign-up' },
  { id: 'login.demo', label: 'One-tap demo accounts', role: 'all', group: 'Sign-up', hint: 'The "Continue as …" buttons on the login screens' },
  { id: 'app.announcements', label: 'Announcements on home screens', role: 'all', group: 'Content' },
  { id: 'app.notifications', label: 'Pop-up confirmations', role: 'all', group: 'Content', hint: 'The short message after adding, deleting or finishing something' },
  { id: 'app.bug_report', label: 'Shake to report a bug', role: 'all', group: 'Content', hint: 'Everyone, on every screen: shaking the phone sends a screenshot and a description to Super admin → Bug reports' },
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
export const TOP_FEATURES: Record<UserRole, TopFeature[]> = {
  customer: [
    { id: 'tab.customer.venues', label: 'Venues' },
    { id: 'tab.customer.vendors', label: 'Vendors' },
    { id: 'tab.customer.ideas', label: 'Ideas' },
    { id: 'couple.search', label: 'Search' },
    { id: 'couple.messages', label: 'Messages' },
    { id: 'core.customer.wedding', label: 'My Wedding: plan, quotes and payments' },
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
  vendor: [
    { id: 'tab.vendor.leads', label: 'Leads' },
    { id: 'tab.vendor.bookings', label: 'Bookings' },
    { id: 'tab.vendor.calendar', label: 'Calendar' },
    { id: 'tab.vendor.account', label: 'Business' },
    { id: 'vendor.messages', label: 'Messages' },
    { id: 'vendor.quotes', label: 'Quotations' },
    { id: 'vendor.packages', label: 'Packages and services' },
    { id: 'vendor.portfolio', label: 'Portfolio' },
    { id: 'core.vendor.services', label: 'Your services' },
    { id: 'vendor.gigs', label: 'Hire freelancers' },
    { id: 'vendor.finance', label: 'Finance' },
    { id: 'vendor.reviews', label: 'Reviews' },
    { id: 'core.vendor.verification', label: 'Verification' },
    { id: 'vendor.tools', label: 'Business tools' },
    { id: 'tool:vendor.replies', label: 'Saved replies' },
    { id: 'tool:vendor.followups', label: 'Follow-ups' },
    { id: 'tool:vendor.pricing', label: 'Price calculator' },
    { id: 'tool:vendor.prep', label: 'Event prep checklists' },
    { id: 'tool:vendor.expenses', label: 'Expenses' },
    { id: 'core.vendor.trade', label: 'The main tool for their trade (menu, themes, fleet…)' },
  ],
  freelancer: [
    { id: 'core.freelancer.gigs', label: 'Gigs near you' },
    { id: 'tab.freelancer.jobs', label: 'My jobs' },
    { id: 'tab.freelancer.calendar', label: 'Calendar' },
    { id: 'tab.freelancer.earnings', label: 'Earnings' },
    { id: 'tab.freelancer.profile', label: 'Profile' },
    { id: 'core.freelancer.craft', label: 'Your craft' },
    { id: 'core.freelancer.portfolio', label: 'Portfolio' },
    { id: 'core.freelancer.messages', label: 'Messages' },
    { id: 'core.freelancer.verification', label: 'Verification' },
    { id: 'core.freelancer.tools', label: 'Freelancer tools' },
    { id: 'tool:freelancer.week', label: 'This week' },
    { id: 'tool:freelancer.open', label: 'Open dates' },
    { id: 'tool:freelancer.gear', label: 'Gear checklist' },
    { id: 'tool:freelancer.deliveries', label: 'Edits and deliveries' },
    { id: 'tool:freelancer.rates', label: 'Rate calculator' },
    { id: 'tool:freelancer.invoices', label: 'Private invoices' },
    { id: 'tool:freelancer.expenses', label: 'Expenses and mileage' },
    { id: 'tool:freelancer.goals', label: 'Earnings goal' },
    { id: 'tool:freelancer.reliability', label: 'Reliability coach' },
    { id: 'core.freelancer.craftkit', label: 'The kit tool for their craft (card backup, product kit, setlist, vehicle log)' },
  ],
  platform: [
    { id: 'tab.platform.leads', label: 'Leads' },
    { id: 'tab.platform.weddings', label: 'Weddings' },
    { id: 'tab.platform.execution', label: 'Control' },
    { id: 'core.platform.messages', label: 'Messages' },
    { id: 'core.platform.calendar', label: 'Operations calendar' },
    { id: 'core.platform.gigs', label: 'Crew gigs' },
    { id: 'core.platform.quotes', label: 'Quotations' },
    { id: 'core.platform.finance', label: 'Finance' },
    { id: 'core.platform.disputes', label: 'Disputes and refunds' },
    { id: 'core.platform.approvals', label: 'Verification and moderation' },
    { id: 'core.platform.providers', label: 'Providers' },
    { id: 'core.platform.freelancers', label: 'Freelancers' },
    { id: 'core.platform.users', label: 'Users' },
    { id: 'core.platform.marketplace', label: 'Marketplace settings' },
    { id: 'core.platform.occasions', label: 'Occasions' },
    { id: 'core.platform.analytics', label: 'Analytics' },
    { id: 'core.platform.audit', label: 'Audit log' },
    { id: 'core.platform.tools', label: 'Operations tools' },
    { id: 'tool:platform.tickets', label: 'Helpdesk' },
    { id: 'tool:platform.sla', label: 'SLA monitor' },
  ],
};

/** The one trade tool each business gets by default ("core.vendor.trade"); a business sees only its own trade's. */
export const TRADE_TOOLS = ['vendor.menu', 'vendor.themes', 'vendor.gallery', 'vendor.trials', 'vendor.requests', 'vendor.power', 'vendor.fleet', 'vendor.fittings', 'vendor.muhurta'];
/** The kit tool each craft gets by default ("core.freelancer.craftkit"); crew see only their craft's. */
export const CRAFT_TOOLS = ['freelancer.backup', 'freelancer.kit', 'freelancer.setlist', 'freelancer.vehicle'];

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
  'vendor.social',
  'vendor.team',
  'vendor.customers',
  'vendor.analytics',
  'vendor.promotions',
]);

const DEFAULT_TOOLS = new Set([
  ...Object.values(TOP_FEATURES)
    .flat()
    .filter((f) => f.id.startsWith('tool:'))
    .map((f) => f.id.slice(5)),
  ...TRADE_TOOLS,
  ...CRAFT_TOOLS,
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
  'vendor.messages': ['/business/inbox', '/business/inbox/*'],
  'vendor.quotes': ['/business/quotes', '/business/quote/*'],
  'vendor.packages': ['/business/packages'],
  'vendor.portfolio': ['/business/portfolio'],
  'vendor.gigs': ['/business/gigs', '/business/gig/*'],
  'vendor.finance': ['/business/finance'],
  'vendor.reviews': ['/business/reviews'],
  'vendor.tools': ['/business/tools'],
  'vendor.team': ['/business/team'],
  'vendor.customers': ['/business/customers'],
  'vendor.analytics': ['/business/analytics'],
  'vendor.promotions': ['/business/promotions'],
  'vendor.social': ['/business/social', '/business/social/*', '/business/social/thread/*'],
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
