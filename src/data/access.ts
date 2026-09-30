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

/** Tool ids that are universal for their role on purpose (the registry check lists them). */
export const UNIVERSAL_TOOLS = (Object.keys(TOOL_RULES) as ToolId[]).filter((id) => Object.keys(TOOL_RULES[id]).length === 0);
