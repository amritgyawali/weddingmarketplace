/**
 * The persona resolver: identify the user, derive what they can do, and show
 * only that. Pure and deterministic (no React, no store), like the other
 * services, so the same code can later run in an Edge Function.
 *
 *   account + active occasion → PersonaInput → resolveExperience → Experience
 *
 * Old accounts and projects need no migration: services, business form and
 * occasion are inferred from the data they already have.
 */
import { type Capability, planCap } from '@/data/capabilities';
import { BUILT_IN_OCCASIONS, findOccasion, occasionForEventType, type OccasionDef } from '@/data/occasions';
import { permissionsFor, type Permission } from '@/data/permissions';
import { findProvider } from '@/data/providers';
import { SERVICE_BY_ID, SERVICES } from '@/data/services';
import { CORE_CAPABILITIES, FORM_CAPABILITIES, SERVICE_CAPABILITIES, SERVICES_BY_CREW_ROLE, tradeOf, type BusinessForm, type TradeId } from '@/data/trades';
import { type SetupStepDef, toolRole, toolRule, VENDOR_SETUP_STEPS } from '@/data/access';
import type { Account, Equipment, Project } from '@/types/platform';
import type { Experience, PersonaInput, RateModel, Vocabulary, When } from '@/types/persona';

// ─── Inference ──────────────────────────────────────────────────────────────

const known = (ids: string[]) => [...new Set(ids.filter((id) => !!SERVICE_BY_ID[id]))];

/** A vendor's services, primary first: explicit, else from the listing, else from the category. */
export function servicesOf(account: Pick<Account, 'services' | 'primaryService' | 'listingId' | 'listingKind' | 'categoryId'>): { services: string[]; primary?: string; inferred: boolean } {
  const explicit = known(account.services ?? []);
  if (explicit.length) {
    const primary = account.primaryService && explicit.includes(account.primaryService) ? account.primaryService : explicit[0];
    return { services: [primary, ...explicit.filter((s) => s !== primary)], primary, inferred: false };
  }
  let guess: string[] = [];
  if (account.listingKind === 'venue' || account.categoryId === 'venues') guess = ['venue'];
  else if (account.listingId && findProvider(account.listingId)) guess = [findProvider(account.listingId)!.serviceId];
  else if (account.categoryId) {
    const group = SERVICES.filter((s) => s.group === account.categoryId);
    guess = (group.filter((s) => s.core).length ? group.filter((s) => s.core) : group.slice(0, 1)).map((s) => s.id);
  }
  return { services: guess, primary: guess[0], inferred: true };
}

/** The business form: explicit, else a venue for venue services and a team business otherwise (keeps every tool). */
export function businessFormOf(account: Pick<Account, 'businessForm'>, services: string[]): { form: BusinessForm; inferred: boolean } {
  if (account.businessForm) return { form: account.businessForm, inferred: false };
  return { form: services.includes('venue') ? 'venue' : 'studio', inferred: true };
}

/** A freelancer's services, derived from their crew roles (primary skill first). */
export function freelancerServicesOf(account: Pick<Account, 'skills' | 'primarySkill'>): { services: string[]; primarySkill?: string } {
  const skills = account.skills ?? [];
  const primarySkill = account.primarySkill && skills.includes(account.primarySkill) ? account.primarySkill : skills[0];
  const ordered = primarySkill ? [primarySkill, ...skills.filter((s) => s !== primarySkill)] : skills;
  return { services: known(ordered.flatMap((r) => SERVICES_BY_CREW_ROLE[r] ?? [])), primarySkill };
}

/** The occasion of a project: explicit, else from its main function, else a wedding. */
export function occasionOf(project: Pick<Project, 'occasion' | 'eventType'> | null | undefined, occasions: OccasionDef[] = BUILT_IN_OCCASIONS): OccasionDef {
  const explicit = findOccasion(project?.occasion, occasions);
  if (explicit) return explicit;
  return project ? occasionForEventType(project.eventType, occasions) : (findOccasion('wedding', occasions) ?? BUILT_IN_OCCASIONS[0]);
}

/** Builds the resolver input for an account (and, for customers, their active occasion). */
export function personaInputFor(account: Account, occasion?: OccasionDef): { input: PersonaInput; inferred: boolean } {
  switch (account.role) {
    case 'vendor': {
      const s = servicesOf(account);
      const f = businessFormOf(account, s.services);
      return { input: { role: 'vendor', services: s.services, primaryService: s.primary, businessForm: f.form, capsOverride: account.capsOverride }, inferred: s.inferred || f.inferred };
    }
    case 'freelancer': {
      const f = freelancerServicesOf(account);
      return { input: { role: 'freelancer', skills: account.skills ?? [], primarySkill: f.primarySkill, capsOverride: account.capsOverride }, inferred: !account.primarySkill };
    }
    case 'platform':
      return { input: { role: 'platform', staffRole: account.staffRole, team: account.team }, inferred: false };
    default:
      return { input: { role: 'customer', occasion: occasion?.id ?? 'wedding', capsOverride: account.capsOverride }, inferred: !occasion };
  }
}

// ─── Resolution ─────────────────────────────────────────────────────────────

const RATE_BY_UNIT: Record<string, RateModel> = { 'per plate': 'plate', 'per person': 'plate', 'per day': 'day', 'per package': 'package', 'per event': 'event', 'per car': 'day', 'per card': 'package' };

const EQUIPMENT_BY_CAP: [Capability, Equipment['kind'][]][] = [
  ['media.camera', ['camera', 'lens', 'flash', 'drone', 'gimbal', 'light', 'audio']],
  ['music.gear', ['audio', 'light']],
  ['av.gear', ['audio', 'light']],
  ['logistics.fleet', ['vehicle']],
  ['beauty.product_kit', ['kit']],
  ['decor.rental_inventory', ['kit', 'vehicle']],
];

const DEFAULT_VOCAB: Vocabulary = { ...BUILT_IN_OCCASIONS[0].vocab, meetings: 'Site visits' };

/** Deterministic key for an input and the occasion definition it resolved against. */
function keyOf(input: PersonaInput, occasion: OccasionDef | undefined) {
  const norm = {
    r: input.role,
    s: input.services ?? [],
    p: input.primaryService ?? '',
    f: input.businessForm ?? '',
    k: [...(input.skills ?? [])].sort(),
    ps: input.primarySkill ?? '',
    sr: input.staffRole ?? '',
    t: input.team ?? '',
    o: occasion ? [occasion.id, occasion.updatedAt ?? '', occasion.modules.join(','), occasion.services.length, occasion.vocab.planTitle] : '',
    c: [...(input.capsOverride ?? [])].sort(),
  };
  return JSON.stringify(norm);
}

/**
 * Resolves an experience from scratch. Prefer `experience()`, which reuses
 * the same object for the same input so React selectors stay stable.
 */
export function resolveExperience(input: PersonaInput, occasions: OccasionDef[] = BUILT_IN_OCCASIONS): Experience {
  const occasion = input.role === 'customer' ? (findOccasion(input.occasion, occasions) ?? occasionOf(null, occasions)) : undefined;
  const caps = new Set<Capability>(input.capsOverride ?? []);
  let services: string[] = [];
  let primaryService: string | undefined;
  let form: BusinessForm | undefined;
  let perms: Permission[] = [];

  if (input.role === 'vendor' || input.role === 'freelancer') {
    if (input.role === 'vendor') {
      services = known(input.services ?? []);
      primaryService = input.primaryService && services.includes(input.primaryService) ? input.primaryService : services[0];
      form = input.businessForm ?? (services.includes('venue') ? 'venue' : 'studio');
    } else {
      const f = freelancerServicesOf({ skills: input.skills, primarySkill: input.primarySkill });
      services = f.services;
      primaryService = services[0];
      form = 'solo';
    }
    CORE_CAPABILITIES.forEach((c) => caps.add(c));
    services.forEach((s) => (SERVICE_CAPABILITIES[s] ?? []).forEach((c) => caps.add(c)));
    FORM_CAPABILITIES[form].forEach((c) => caps.add(c));
  } else if (input.role === 'customer') {
    occasion?.modules.forEach((m) => caps.add(planCap(m)));
  } else {
    perms = permissionsFor(input.staffRole, input.team);
  }

  const trades = [...new Set(services.map((s) => tradeOf(s)?.id).filter((x): x is TradeId => !!x))];
  const primaryTrade = primaryService ? tradeOf(primaryService)?.id : undefined;
  const unit = primaryService ? SERVICE_BY_ID[primaryService]?.unit : undefined;
  const rateModel: RateModel = input.role === 'freelancer' ? 'day' : unit ? (RATE_BY_UNIT[unit] ?? 'event') : 'event';
  const equipmentKinds = [...new Set(EQUIPMENT_BY_CAP.filter(([c]) => caps.has(c)).flatMap(([, kinds]) => kinds))];

  return {
    key: keyOf(input, occasion),
    role: input.role,
    caps,
    perms: new Set(perms),
    services,
    primaryService,
    trades,
    primaryTrade,
    form: input.role === 'vendor' ? form : undefined,
    occasion,
    vocab: { ...DEFAULT_VOCAB, ...occasion?.vocab, meetings: primaryTrade ? (tradeOf(primaryService!)?.meetings ?? DEFAULT_VOCAB.meetings) : DEFAULT_VOCAB.meetings },
    rateModel,
    equipmentKinds: equipmentKinds.length ? equipmentKinds : ['kit', 'other'],
    inferred: false,
  };
}

const CACHE = new Map<string, Experience>();
const CACHE_LIMIT = 200;

/** The experience for an input, reusing the same object for the same persona. */
export function experience(input: PersonaInput, occasions: OccasionDef[] = BUILT_IN_OCCASIONS, inferred = false): Experience {
  const occasion = input.role === 'customer' ? (findOccasion(input.occasion, occasions) ?? occasionOf(null, occasions)) : undefined;
  const key = `${keyOf(input, occasion)}|${inferred ? 1 : 0}`;
  const hit = CACHE.get(key);
  if (hit) return hit;
  const resolved = { ...resolveExperience(input, occasions), inferred };
  if (CACHE.size >= CACHE_LIMIT) CACHE.delete(CACHE.keys().next().value!);
  CACHE.set(key, resolved);
  return resolved;
}

/** The experience for a signed-in account; customers pass their active project. */
export function experienceFor(account: Account, opts: { project?: Pick<Project, 'occasion' | 'eventType'> | null; occasions?: OccasionDef[] } = {}): Experience {
  const occasions = opts.occasions ?? BUILT_IN_OCCASIONS;
  const occasion = account.role === 'customer' && opts.project ? occasionOf(opts.project, occasions) : undefined;
  const { input, inferred } = personaInputFor(account, occasion);
  return experience(input, occasions, inferred);
}

// ─── Questions screens and actions ask ──────────────────────────────────────

export const has = (exp: Experience, cap: Capability) => exp.caps.has(cap);
export const can = (exp: Experience, perm: Permission) => exp.perms.has(perm);

/** Does a visibility rule pass for this experience? */
export function allows(exp: Experience, when: When | undefined): boolean {
  if (!when) return true;
  if (when.roles && !when.roles.includes(exp.role)) return false;
  if (when.capsAny && !when.capsAny.some((c) => exp.caps.has(c))) return false;
  if (when.capsAll && !when.capsAll.every((c) => exp.caps.has(c))) return false;
  if (when.occasions && !(exp.occasion && when.occasions.includes(exp.occasion.id))) return false;
  if (when.forms && !(exp.form && when.forms.includes(exp.form))) return false;
  if (when.perms && !when.perms.every((p) => exp.perms.has(p))) return false;
  if (when.not && allows(exp, when.not)) return false;
  return true;
}

/** Can this experience open a tool (right role app and the tool's rule passes)? */
export const allowsTool = (exp: Experience, toolId: string) => toolRole(toolId) === exp.role && allows(exp, toolRule(toolId));

/** Tools this persona sees: the ones its rules allow, plus any the owner already has records in. */
export const visibleTools = <T extends { id: string }>(exp: Experience, tools: T[], used: ReadonlySet<string> = new Set()) => tools.filter((t) => allowsTool(exp, t.id) || used.has(t.id));

/** A tool's title in this persona's words (site visits are "Tastings" for caterers, "Fittings" for fashion). */
export const toolTitle = (exp: Experience, tool: { id: string; title: string }) => (tool.id === 'vendor.visits' ? exp.vocab.meetings : tool.title);

/** What the vendor home's setup checklist needs to know. */
export interface SetupFacts {
  confirmed: boolean;
  toolCounts: Record<string, number>;
  portfolio: number;
  packages: number;
  verificationStarted: boolean;
}

/** The setup steps for this persona, with whether each is done. */
export function setupSteps(exp: Experience, facts: SetupFacts): { step: SetupStepDef; done: boolean }[] {
  return VENDOR_SETUP_STEPS.filter((step) => allows(exp, step.when)).map((step) => {
    const target = step.target ?? 1;
    const done =
      step.id === 'services'
        ? facts.confirmed
        : step.id === 'portfolio'
          ? facts.portfolio >= target
          : step.id === 'packages'
            ? facts.packages >= target
            : step.id === 'verify'
              ? facts.verificationStarted
              : (facts.toolCounts[step.tool ?? ''] ?? 0) >= target;
    return { step, done };
  });
}
