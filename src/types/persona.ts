/**
 * Persona model: who a user is (taxonomy), what they can do (capabilities and
 * permissions) and what they see (surfaces). See docs/MASTER_PLAN.md §2–§3.
 *
 *   taxonomy → capabilities → surfaces
 */
import type { Capability } from '@/data/capabilities';
import type { CraftId } from '@/data/crafts';
import type { OccasionDef, OccasionId, OccasionVocab } from '@/data/occasions';
import type { Permission } from '@/data/permissions';
import type { BusinessForm, TradeId } from '@/data/trades';

import type { Equipment, PlatformTeam, StaffRole, UserRole } from './platform';

export type { Capability, PlannerModule, PlanCapability, ProviderCapability } from '@/data/capabilities';
export type { CraftId } from '@/data/crafts';
export type { HonoureeKind, OccasionDef, OccasionId, OccasionVocab } from '@/data/occasions';
export type { Permission } from '@/data/permissions';
export type { BusinessForm, TradeId } from '@/data/trades';

/**
 * A visibility rule for anything the UI renders. Every key that is set must
 * pass; an empty rule is universal.
 */
export interface When {
  /** Roles the item belongs to. */
  roles?: UserRole[];
  /** At least one of these capabilities. */
  capsAny?: Capability[];
  /** All of these capabilities. */
  capsAll?: Capability[];
  /** Customer only: the active occasion is one of these. */
  occasions?: OccasionId[];
  /** Vendor only: the business form is one of these. */
  forms?: BusinessForm[];
  /** Platform only: all of these permissions. */
  perms?: Permission[];
  /** Platform only: at least one of these permissions. */
  permsAny?: Permission[];
  /** Platform only: the staff member's team is one of these. */
  teams?: PlatformTeam[];
  /** Hidden when this nested rule passes. */
  not?: When;
}

/** Everything the resolver needs to know about a user. */
export interface PersonaInput {
  role: UserRole;
  /** vendor */
  services?: string[];
  primaryService?: string;
  businessForm?: BusinessForm;
  /** freelancer */
  skills?: string[];
  primarySkill?: string;
  /** platform */
  staffRole?: StaffRole;
  team?: PlatformTeam;
  /** customer, from the active project */
  occasion?: OccasionId;
  capsOverride?: Capability[];
}

export type RateModel = 'day' | 'event' | 'hour' | 'plate' | 'package';

/** Words that change with the persona. */
export interface Vocabulary extends OccasionVocab {
  /** What the provider's site visits are called ("Tastings", "Fittings"). */
  meetings: string;
}

/** The resolved persona: one object per distinct input, reused across renders. */
export interface Experience {
  /** Stable key for the input; equal keys mean an identical experience. */
  key: string;
  role: UserRole;
  caps: ReadonlySet<Capability>;
  perms: ReadonlySet<Permission>;
  /** Providers: the services offered, primary first. */
  services: string[];
  primaryService?: string;
  trades: TradeId[];
  primaryTrade?: TradeId;
  form?: BusinessForm;
  /** Platform staff: role and team (their permissions are in `perms`). */
  staffRole?: StaffRole;
  team?: PlatformTeam;
  /** Freelancers: the craft of the primary skill, and every craft their skills cover. */
  craft?: CraftId;
  crafts: CraftId[];
  /** Customers: the active occasion. */
  occasion?: OccasionDef;
  vocab: Vocabulary;
  rateModel: RateModel;
  equipmentKinds: Equipment['kind'][];
  /** True when services or form were guessed from older account data. */
  inferred: boolean;
}
