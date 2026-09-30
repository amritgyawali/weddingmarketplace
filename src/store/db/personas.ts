/** Personas: the occasion catalogue a super admin manages, and permission checks for store actions. */
import { PLANNER_MODULES, type PlannerModule } from '@/data/capabilities';
import { categoryForService } from '@/data/categories';
import { EVENT_TYPE_BY_ID } from '@/data/events';
import { occasionIdFor, PROTECTED_OCCASIONS, type OccasionDef } from '@/data/occasions';
import { PERMISSION_LABELS, PERMISSION_SCOPE, type Permission } from '@/data/permissions';
import { CREW_ROLES, SERVICE_BY_ID } from '@/data/services';
import { BUSINESS_FORMS, type BusinessForm } from '@/data/trades';
import { can, experienceFor } from '@/services/experience';
import { useSession } from '@/store/useSession';
import type { Account, EventType, Project } from '@/types/platform';

import { currentActor, type GetDb, now, type SetDb } from './helpers';

/** Everything an admin can set on an occasion (id, built-in flag and timestamps are managed here). */
export type OccasionInput = Omit<OccasionDef, 'id' | 'builtIn' | 'updatedAt' | 'order'> & { order?: number };

/** What a vendor confirms in onboarding or Business → Your services. */
export interface ProviderPersonaInput {
  services: string[];
  primaryService: string;
  businessForm: BusinessForm;
  teamSize?: number;
  tradeProfile?: Account['tradeProfile'];
}

/** What a freelancer confirms in onboarding or Profile → Your craft. */
export interface FreelancerPersonaInput {
  skills: string[];
  primarySkill: string;
  tradeProfile?: Account['tradeProfile'];
}

export interface PersonaActions {
  /** Saves a vendor's services (primary + add-ons), business form and trade essentials. Returns an error to show, or null. */
  setProviderPersona: (accountId: string, input: ProviderPersonaInput) => string | null;
  /** Saves a freelancer's skills (primary first) and craft profile. Returns an error to show, or null. */
  setFreelancerPersona: (accountId: string, input: FreelancerPersonaInput) => string | null;
  /** Adds an occasion (super admin). Returns the new occasion, or an error to show. */
  addOccasion: (input: OccasionInput) => { occasion?: OccasionDef; error?: string };
  /** Edits an occasion (super admin). Returns an error to show, or null. */
  updateOccasion: (id: string, patch: Partial<OccasionInput>) => string | null;
  /** Deletes a custom or built-in occasion that no project uses (super admin). Returns an error to show, or null. */
  removeOccasion: (id: string) => string | null;
}

const MODULES = new Set<string>(PLANNER_MODULES);
const SKILLS = new Set<string>(CREW_ROLES);

/** Does the signed-in staff member hold this permission? */
export function actorCan(perm: Permission, get: GetDb): boolean {
  const s = useSession.getState();
  const account = s.accounts.find((a) => a.id === s.session?.accountId);
  return !!account && account.role === 'platform' && can(experienceFor(account, { occasions: get().occasions }), perm);
}

const signedIn = (): Account | undefined => {
  const s = useSession.getState();
  return s.accounts.find((a) => a.id === s.session?.accountId);
};

const denial = (perm: Permission) => `You don’t have permission to ${PERMISSION_LABELS[perm].charAt(0).toLowerCase()}${PERMISSION_LABELS[perm].slice(1)}. Ask an admin if you need it.`;

/**
 * For platform staff only: an error when they lack the permission, or when a
 * right that is scoped to their own records (a coordinator's projects) is used
 * on someone else's. Other actors get null: couples, vendors and freelancers
 * reach these actions only through their own, separately guarded flows.
 */
export function staffDenied(perms: Permission | Permission[], get: GetDb, project?: Pick<Project, 'coordinatorId' | 'coordinatorName'> | null): string | null {
  const account = signedIn();
  if (!account || account.role !== 'platform') return null;
  const list = Array.isArray(perms) ? perms : [perms];
  const exp = experienceFor(account, { occasions: get().occasions });
  const held = list.find((p) => can(exp, p));
  if (!held) return denial(list[0]);
  const scope = account.staffRole ? PERMISSION_SCOPE[account.staffRole]?.[held] : undefined;
  if (scope === 'own' && project?.coordinatorId && project.coordinatorId !== account.id) return `This project is ${project.coordinatorName ?? 'another coordinator'}’s. Ask them or an admin to make the change.`;
  return null;
}

/** Staff-only actions (payouts, refunds, verification…): an error unless the signed-in user is staff with the permission. */
export function staffOnly(perms: Permission | Permission[], get: GetDb): string | null {
  const account = signedIn();
  const list = Array.isArray(perms) ? perms : [perms];
  if (!account || account.role !== 'platform') return 'Only the Vivah team can do this';
  return staffDenied(list, get);
}

/** Cleans admin input; returns the problem instead of trusting the form. */
function cleanOccasion(input: OccasionInput): { value?: OccasionInput; error?: string } {
  const label = input.label.trim().replace(/\s+/g, ' ');
  if (label.length < 2) return { error: 'Give the occasion a name' };
  if (label.length > 40) return { error: 'Keep the name under 40 characters' };
  const eventTypes = [...new Set(input.eventTypes)].filter((t): t is EventType => !!EVENT_TYPE_BY_ID[t]);
  if (!eventTypes.length) return { error: 'Pick at least one function' };
  const services = [...new Set(input.services)].filter((id) => !!SERVICE_BY_ID[id]);
  if (!services.length) return { error: 'Pick at least one service to show in the marketplace' };
  const defaultServices = [...new Set(input.defaultServices)].filter((id) => services.includes(id));
  const modules = [...new Set(input.modules)].filter((m): m is PlannerModule => MODULES.has(m));
  const text = (v: string, fallback: string) => v.trim().slice(0, 40) || fallback;
  return {
    value: {
      ...input,
      label,
      blurb: input.blurb.trim().slice(0, 80),
      icon: input.icon || 'calendar-outline',
      eventTypes,
      services,
      defaultServices,
      modules,
      vocab: {
        eventDay: text(input.vocab.eventDay, 'Event day'),
        hosts: text(input.vocab.hosts, 'family'),
        planTitle: text(input.vocab.planTitle, 'My celebration'),
        noun: text(input.vocab.noun, 'celebration'),
      },
    },
  };
}

export const personaActions = (set: SetDb, get: GetDb): PersonaActions => ({
  setProviderPersona: (accountId, input) => {
    const session = useSession.getState();
    const account = session.accounts.find((a) => a.id === accountId);
    if (!account || account.role !== 'vendor') return 'This business account no longer exists';
    const actorId = session.session?.accountId;
    if (actorId !== accountId && !actorCan('provider.verify', get)) return 'You can only change your own services';
    const services = [...new Set(input.services)].filter((id) => !!SERVICE_BY_ID[id]);
    if (!services.length) return 'Pick at least one service';
    if (!services.includes(input.primaryService)) return 'Your main service must be one of the services you offer';
    if (!BUSINESS_FORMS.some((f) => f.id === input.businessForm)) return 'Pick how your business is set up';
    const teamSize = input.teamSize === undefined ? undefined : Math.max(0, Math.round(input.teamSize));
    if (teamSize !== undefined && !Number.isFinite(teamSize)) return 'Team size must be a number';
    session.updateAccount(accountId, {
      services: [input.primaryService, ...services.filter((s) => s !== input.primaryService)],
      primaryService: input.primaryService,
      businessForm: input.businessForm,
      teamSize,
      tradeProfile: input.tradeProfile ? { ...account.tradeProfile, ...input.tradeProfile } : account.tradeProfile,
      categoryId: categoryForService(input.primaryService),
      personaConfirmedAt: now(),
    });
    get().log(currentActor(), 'persona.update', 'account', accountId, `${input.primaryService} + ${services.length - 1} more · ${input.businessForm}`);
    return null;
  },

  setFreelancerPersona: (accountId, input) => {
    const session = useSession.getState();
    const account = session.accounts.find((a) => a.id === accountId);
    if (!account || account.role !== 'freelancer') return 'This freelancer account no longer exists';
    const actorId = session.session?.accountId;
    if (actorId !== accountId && !actorCan('provider.verify', get)) return 'You can only change your own skills';
    const skills = [...new Set(input.skills)].filter((k) => SKILLS.has(k));
    if (!skills.length) return 'Pick at least one skill';
    if (!skills.includes(input.primarySkill)) return 'Your main skill must be one of your skills';
    session.updateAccount(accountId, {
      skills: [input.primarySkill, ...skills.filter((k) => k !== input.primarySkill)],
      primarySkill: input.primarySkill,
      tradeProfile: input.tradeProfile ? { ...account.tradeProfile, ...input.tradeProfile } : account.tradeProfile,
      personaConfirmedAt: now(),
    });
    get().log(currentActor(), 'persona.update', 'account', accountId, `${input.primarySkill} + ${skills.length - 1} more`);
    return null;
  },

  addOccasion: (input) => {
    if (!actorCan('occasion.manage', get)) return { error: 'Only a super admin can add occasions' };
    const { value, error } = cleanOccasion(input);
    if (!value) return { error };
    const base = occasionIdFor(value.label) || 'occasion';
    const ids = new Set(get().occasions.map((o) => o.id));
    if (get().occasions.some((o) => o.label.toLowerCase() === value.label.toLowerCase())) return { error: `“${value.label}” already exists` };
    let id = base;
    for (let n = 2; ids.has(id); n++) id = `${base}_${n}`;
    const occasion: OccasionDef = { ...value, id, order: value.order ?? Math.max(0, ...get().occasions.map((o) => o.order)) + 1, builtIn: false, updatedAt: now() };
    set((s) => ({ occasions: [...s.occasions, occasion] }));
    get().log(currentActor(), 'occasion.add', 'occasion', id, occasion.label);
    return { occasion };
  },

  updateOccasion: (id, patch) => {
    if (!actorCan('occasion.manage', get)) return 'Only a super admin can edit occasions';
    const before = get().occasions.find((o) => o.id === id);
    if (!before) return 'This occasion no longer exists';
    const { value, error } = cleanOccasion({ ...before, ...patch, vocab: { ...before.vocab, ...patch.vocab } });
    if (!value) return error ?? 'Check the details';
    if (get().occasions.some((o) => o.id !== id && o.label.toLowerCase() === value.label.toLowerCase())) return `“${value.label}” already exists`;
    if (PROTECTED_OCCASIONS.includes(id) && value.active === false) return `${before.label} is the fallback for older plans and can’t be switched off`;
    set((s) => ({ occasions: s.occasions.map((o) => (o.id === id ? { ...o, ...value, id, builtIn: o.builtIn, updatedAt: now() } : o)) }));
    get().log(currentActor(), 'occasion.update', 'occasion', id, Object.keys(patch).join(', '));
    return null;
  },

  removeOccasion: (id) => {
    if (!actorCan('occasion.manage', get)) return 'Only a super admin can delete occasions';
    const before = get().occasions.find((o) => o.id === id);
    if (!before) return null;
    if (PROTECTED_OCCASIONS.includes(id)) return `${before.label} is the fallback for older plans and can’t be deleted`;
    const inUse = get().projects.filter((p) => p.occasion === id).length;
    if (inUse) return `${inUse} plan${inUse > 1 ? 's use' : ' uses'} this occasion. Switch it off instead, so no new plans pick it.`;
    set((s) => ({ occasions: s.occasions.filter((o) => o.id !== id) }));
    get().log(currentActor(), 'occasion.remove', 'occasion', id, before.label);
    return null;
  },
});
