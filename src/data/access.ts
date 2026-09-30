/**
 * Who sees what: the visibility rule of every tool and persona-aware surface.
 * Rules are data so the registry check (`npm run check:personas`) can walk
 * them, and so adding a trade or an occasion never touches screen code.
 *
 * An empty rule (`{}`) is universal on purpose. Every tool must have a rule:
 * `ToolDef.id` is typed as `ToolId`, so a tool without one is a compile error.
 */
import type { UserRole } from '@/types/platform';
import type { When } from '@/types/persona';

const ALL: When = {};

export const TOOL_RULES = {
  // ─── Couple (P3 switches the filtering on) ────────────────────────────────
  'couple.sait': { capsAny: ['plan.sait'] },
  'couple.samagri': { capsAny: ['plan.samagri'] },
  'couple.weather': ALL,
  'couple.duties': { capsAny: ['plan.duties'] },
  'couple.janti': { capsAny: ['plan.janti'] },
  'couple.rooms': ALL,
  'couple.pickups': ALL,
  'couple.contacts': ALL,
  'couple.myday': ALL,
  'couple.outfits': { capsAny: ['plan.outfits'] },
  'couple.kit': ALL,
  'couple.shots': ALL,
  'couple.music': ALL,
  'couple.menu': ALL,
  'couple.meetings': ALL,
  'couple.tips': { capsAny: ['plan.tips'] },
  'couple.gifts': ALL,
  'couple.whatif': ALL,
  'couple.savings': ALL,
  'couple.honeymoon': { capsAny: ['plan.honeymoon'] },

  // ─── Vendor ───────────────────────────────────────────────────────────────
  'vendor.replies': ALL,
  'vendor.followups': ALL,
  'vendor.visits': { capsAny: ['space.site_visits', 'food.tastings', 'decor.themes', 'fashion.fittings'] },
  'vendor.response': ALL,
  'vendor.policy': ALL,
  'vendor.hours': ALL,
  'vendor.pricing': ALL,
  'vendor.benchmark': ALL,
  'vendor.vouchers': { capsAny: ['space.halls', 'beauty.looks', 'media.gallery'] },
  'vendor.referrals': ALL,
  'vendor.goals': ALL,
  'vendor.expenses': ALL,
  'vendor.pnl': ALL,
  'vendor.tax': ALL,
  'vendor.roster': { capsAny: ['team.roster'] },
  'vendor.prep': ALL,
  'vendor.tasks': ALL,
  'vendor.inventory': { capsAny: ['decor.rental_inventory', 'av.gear', 'media.camera', 'music.gear', 'space.halls'] },
  'vendor.suppliers': { capsAny: ['decor.suppliers', 'food.menu', 'space.halls'] },
  'vendor.halls': { capsAny: ['space.halls'] },
  // Trade tools (P1)
  'vendor.menu': { capsAny: ['food.menu', 'space.in_house_catering'] },
  'vendor.tastings': { capsAny: ['food.tastings'] },
  'vendor.themes': { capsAny: ['decor.themes'] },
  'vendor.rentals': { capsAny: ['decor.rental_inventory'] },
  'vendor.setup': { capsAny: ['decor.setup_teardown', 'av.gear'] },
  'vendor.gallery': { capsAny: ['media.gallery', 'media.deliverables'] },
  'vendor.shotlists': { capsAny: ['media.shot_list'] },
  'vendor.trials': { capsAny: ['beauty.trials', 'beauty.looks'] },
  'vendor.requests': { capsAny: ['music.requests'] },
  'vendor.power': { capsAny: ['av.power_load'] },
  'vendor.fleet': { capsAny: ['logistics.fleet'] },
  'vendor.fittings': { capsAny: ['fashion.fittings'] },
  'vendor.muhurta': { capsAny: ['rituals.muhurta', 'rituals.samagri'] },

  // ─── Freelancer (P2 switches the filtering on) ────────────────────────────
  'freelancer.week': ALL,
  'freelancer.open': ALL,
  'freelancer.travel': ALL,
  'freelancer.gear': { capsAny: ['media.camera', 'music.gear', 'av.gear', 'logistics.fleet'] },
  'freelancer.safety': ALL,
  'freelancer.backup': { capsAny: ['media.card_backup'] },
  'freelancer.deliveries': { capsAny: ['media.deliverables', 'media.editing_queue', 'stationery.proofs'] },
  'freelancer.diary': ALL,
  'freelancer.rates': ALL,
  'freelancer.invoices': ALL,
  'freelancer.expenses': ALL,
  'freelancer.tax': ALL,
  'freelancer.goals': ALL,
  'freelancer.pots': ALL,
  'freelancer.pitch': ALL,
  'freelancer.reliability': ALL,
  'freelancer.clients': ALL,
  'freelancer.network': ALL,
  'freelancer.certs': ALL,
  'freelancer.gearcare': { capsAny: ['media.camera', 'music.gear', 'av.gear', 'logistics.fleet'] },

  // ─── Platform (P4 switches the filtering on) ──────────────────────────────
  'platform.sla': { perms: ['project.view_all'] },
  'platform.workload': { perms: ['project.view_all'] },
  'platform.oncall': { perms: ['incident.manage'] },
  'platform.holidays': { perms: ['project.view_all'] },
  'platform.qa': { perms: ['project.view_all'] },
  'platform.tickets': { perms: ['incident.manage'] },
  'platform.macros': { perms: ['incident.manage'] },
  'platform.broadcasts': { perms: ['broadcast.send'] },
  'platform.winback': { perms: ['project.view_all'] },
  'platform.promos': { perms: ['settings.edit'] },
  'platform.recruit': { perms: ['provider.verify'] },
  'platform.cities': { perms: ['provider.verify'] },
  'platform.demand': { perms: ['project.view_all'] },
  'platform.funnel': { perms: ['project.view_all'] },
  'platform.scorecards': { perms: ['project.view_all'] },
  'platform.targets': { perms: ['project.view_all'] },
  'platform.cashflow': { perms: ['refund.approve'] },
  'platform.batches': { perms: ['payout.batch'] },
  'platform.risk': { perms: ['audit.view'] },
  'platform.exports': { perms: ['audit.view'] },
} satisfies Record<string, When>;

export type ToolId = keyof typeof TOOL_RULES;

const TOOL_ROLE_PREFIX: Record<string, UserRole> = { couple: 'customer', vendor: 'vendor', freelancer: 'freelancer', platform: 'platform' };

/** The role app a tool belongs to, from its id prefix. */
export const toolRole = (id: string): UserRole | undefined => TOOL_ROLE_PREFIX[id.split('.')[0]];

/** A tool's rule; unknown ids get a rule nobody passes. */
export const toolRule = (id: string): When => (id in TOOL_RULES ? TOOL_RULES[id as ToolId] : { roles: [] });

/** Vendor sidebar links and business-hub rows that not every business gets, keyed by route. */
export const VENDOR_LINK_RULES: Record<string, When> = {
  '/business/gigs': { capsAny: ['team.hire_crew'] },
  '/business/team': { forms: ['venue', 'studio'] },
};

/** A step on the vendor home's setup checklist, shown until it is done. */
export interface SetupStepDef {
  id: string;
  title: string;
  subtitle: string;
  when: When;
  /** A tool whose entries complete the step, or a route to open. */
  tool?: ToolId;
  href?: string;
  /** How many entries (or portfolio items / packages) complete it. */
  target?: number;
}

export const VENDOR_SETUP_STEPS: SetupStepDef[] = [
  { id: 'services', title: 'Confirm your services', subtitle: 'So we show you the right tools and send the right leads', when: {}, href: '/business/services' },
  { id: 'halls', title: 'Add your halls', subtitle: 'Seated and floating capacity for each space', when: { capsAny: ['space.halls'] }, tool: 'vendor.halls', target: 1 },
  { id: 'menu', title: 'Publish your menu', subtitle: 'Dishes and per-plate prices couples can compare', when: { capsAny: ['food.menu'] }, tool: 'vendor.menu', target: 5 },
  { id: 'themes', title: 'Add your decor themes', subtitle: 'Price bands and what each theme includes', when: { capsAny: ['decor.themes'] }, tool: 'vendor.themes', target: 2 },
  { id: 'looks', title: 'Build your looks book', subtitle: 'The bridal and party looks you offer', when: { capsAny: ['beauty.looks'] }, tool: 'vendor.trials', target: 2 },
  { id: 'fleet', title: 'List your vehicles', subtitle: 'Seats, drivers and papers for each vehicle', when: { capsAny: ['logistics.fleet'] }, tool: 'vendor.fleet', target: 1 },
  { id: 'gear', title: 'List your gear', subtitle: 'Sound, lights and power you bring', when: { capsAny: ['music.gear', 'av.gear'], not: { capsAny: ['decor.rental_inventory', 'media.camera', 'space.halls'] } }, tool: 'vendor.inventory', target: 3 },
  { id: 'fittings', title: 'Set up fittings', subtitle: 'Measurements and alteration dates per client', when: { capsAny: ['fashion.fittings'] }, tool: 'vendor.fittings', target: 1 },
  { id: 'muhurta', title: 'Add your ceremonies', subtitle: 'Muhurta slots and samagri lists', when: { capsAny: ['rituals.muhurta'] }, tool: 'vendor.muhurta', target: 1 },
  { id: 'portfolio', title: 'Upload three portfolio albums', subtitle: 'Couples book what they can see', when: { capsAny: ['core.portfolio'] }, href: '/business/portfolio', target: 3 },
  { id: 'packages', title: 'Create a package', subtitle: 'Basic, premium and luxury tiers compare best', when: {}, href: '/business/packages', target: 1 },
  { id: 'verify', title: 'Get verified', subtitle: 'Submit PAN/VAT and ID for the Verified badge', when: {}, href: '/business/verification' },
];

/** Tool ids that are universal for their role on purpose (the registry check lists them). */
export const UNIVERSAL_TOOLS = (Object.keys(TOOL_RULES) as ToolId[]).filter((id) => Object.keys(TOOL_RULES[id]).length === 0);
