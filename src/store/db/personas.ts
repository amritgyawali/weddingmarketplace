/** Personas: the occasion catalogue a super admin manages, and permission checks for store actions. */
import { PLANNER_MODULES, type PlannerModule } from '@/data/capabilities';
import { EVENT_TYPE_BY_ID } from '@/data/events';
import { occasionIdFor, PROTECTED_OCCASIONS, type OccasionDef } from '@/data/occasions';
import type { Permission } from '@/data/permissions';
import { SERVICE_BY_ID } from '@/data/services';
import { can, experienceFor } from '@/services/experience';
import { useSession } from '@/store/useSession';
import type { EventType } from '@/types/platform';

import { currentActor, type GetDb, now, type SetDb } from './helpers';

/** Everything an admin can set on an occasion (id, built-in flag and timestamps are managed here). */
export type OccasionInput = Omit<OccasionDef, 'id' | 'builtIn' | 'updatedAt' | 'order'> & { order?: number };

export interface PersonaActions {
  /** Adds an occasion (super admin). Returns the new occasion, or an error to show. */
  addOccasion: (input: OccasionInput) => { occasion?: OccasionDef; error?: string };
  /** Edits an occasion (super admin). Returns an error to show, or null. */
  updateOccasion: (id: string, patch: Partial<OccasionInput>) => string | null;
  /** Deletes a custom or built-in occasion that no project uses (super admin). Returns an error to show, or null. */
  removeOccasion: (id: string) => string | null;
}

const MODULES = new Set<string>(PLANNER_MODULES);

/** Does the signed-in staff member hold this permission? */
export function actorCan(perm: Permission, get: GetDb): boolean {
  const s = useSession.getState();
  const account = s.accounts.find((a) => a.id === s.session?.accountId);
  return !!account && account.role === 'platform' && can(experienceFor(account, { occasions: get().occasions }), perm);
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
