/**
 * Super admin console (permission `admin.full`): edit, add and delete any
 * record of any role, switch features on and off, rewrite any text in either
 * language and pin announcements, all from the app with no code change.
 * Every write is audited. Mirrored by supabase/migrations/0016_super_admin.sql.
 */
import type { Lang, TextOverrides } from '@/i18n/runtime';
import { useSession } from '@/store/useSession';
import type { Account, Announcement, UserRole } from '@/types/platform';
import { uid } from '@/utils/format';

import { currentActor, type GetDb, now, type SetDb } from './helpers';
import { staffOnly } from './personas';
import type { DbData } from './types';

export type AdminCollection = keyof DbData;

export interface AdminActions {
  /** Switches one feature for everyone. Returns an error to show, or null. */
  setFeature: (id: string, on: boolean) => string | null;
  /** Switches several features at once (a whole group). */
  setFeatures: (patch: Record<string, boolean>) => string | null;
  /** Turns every feature back on. */
  resetFeatures: () => string | null;
  /** Replaces a piece of app text in one language; empty text removes the override. */
  setTextOverride: (source: string, lang: Lang, text: string) => string | null;
  /** Removes every text override. */
  resetTextOverrides: () => string | null;
  addAnnouncement: (input: Pick<Announcement, 'audience' | 'title' | 'body' | 'tone'>) => string | null;
  updateAnnouncement: (id: string, patch: Partial<Pick<Announcement, 'audience' | 'title' | 'body' | 'tone' | 'active'>>) => string | null;
  removeAnnouncement: (id: string) => string | null;
  /** Replaces one record of any collection (array item by id, map entry by key, or the settings object). */
  adminSaveRecord: (collection: AdminCollection, id: string, record: unknown) => string | null;
  /** Adds a record; arrays get an id when it has none. Returns the id, or an error. */
  adminInsertRecord: (collection: AdminCollection, record: unknown, key?: string) => { id?: string; error?: string };
  /** Deletes records by id (array) or key (map). */
  adminDeleteRecords: (collection: AdminCollection, ids: string[]) => string | null;
  /** Edits any account of any role. */
  adminSaveAccount: (id: string, patch: Partial<Account>) => string | null;
  /** Creates an account of any role (it can sign in with its phone and the demo code). */
  adminCreateAccount: (input: Pick<Account, 'role' | 'name' | 'phone' | 'city'> & Partial<Account>) => { account?: Account; error?: string };
  /** Deletes an account. You can't delete yourself or the last super admin. */
  adminDeleteAccount: (id: string) => string | null;
}

const isRecord = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const GUARD = 'admin.full' as const;
/** Collections the console must not break: their shape is checked before saving. */
const MAP_COLLECTIONS = new Set<AdminCollection>(['shortlists', 'toolState', 'featureFlags', 'textOverrides']);
/** Features that would lock the super admin out; never switched off. */
const LOCKED = new Set(['tab.platform.more', 'tab.platform.index']);

export const adminActions = (set: SetDb, get: GetDb): AdminActions => {
  const guard = () => staffOnly(GUARD, get);
  const audit = (action: string, entity: string, id: string, detail?: string) => get().log(currentActor(), action, entity, id, detail);

  return {
    setFeature: (id, on) => {
      const denied = guard();
      if (denied) return denied;
      if (LOCKED.has(id)) return 'This part of the console stays on so you can always come back';
      set((s) => ({ featureFlags: { ...s.featureFlags, [id]: on } }));
      audit(on ? 'feature.on' : 'feature.off', 'feature', id);
      return null;
    },

    setFeatures: (patch) => {
      const denied = guard();
      if (denied) return denied;
      const clean = Object.fromEntries(Object.entries(patch).filter(([id]) => !LOCKED.has(id)));
      set((s) => ({ featureFlags: { ...s.featureFlags, ...clean } }));
      audit('feature.bulk', 'feature', 'many', `${Object.keys(clean).length} switches`);
      return null;
    },

    resetFeatures: () => {
      const denied = guard();
      if (denied) return denied;
      set({ featureFlags: {} });
      audit('feature.reset', 'feature', 'all');
      return null;
    },

    setTextOverride: (source, lang, text) => {
      const denied = guard();
      if (denied) return denied;
      const key = source.trim();
      if (!key) return 'Pick the text to change';
      const value = text.trim();
      if (value.length > 500) return 'Keep it under 500 characters';
      set((s) => {
        const next: TextOverrides = { ...s.textOverrides };
        const entry = { ...next[key] };
        if (value) entry[lang] = value;
        else delete entry[lang];
        if (entry.en || entry.ne) next[key] = entry;
        else delete next[key];
        return { textOverrides: next };
      });
      audit('text.override', 'text', key.slice(0, 60), `${lang}: ${value || '(removed)'}`);
      return null;
    },

    resetTextOverrides: () => {
      const denied = guard();
      if (denied) return denied;
      set({ textOverrides: {} });
      audit('text.reset', 'text', 'all');
      return null;
    },

    addAnnouncement: (input) => {
      const denied = guard();
      if (denied) return denied;
      const title = input.title.trim();
      if (title.length < 3) return 'Write a title of at least 3 characters';
      const actor = currentActor();
      const a: Announcement = { id: uid('ann'), audience: input.audience, title, body: input.body?.trim() || undefined, tone: input.tone, active: true, createdAt: now(), createdBy: actor.name };
      set((s) => ({ announcements: [a, ...s.announcements] }));
      audit('announcement.add', 'announcement', a.id, title);
      return null;
    },

    updateAnnouncement: (id, patch) => {
      const denied = guard();
      if (denied) return denied;
      if (!get().announcements.some((a) => a.id === id)) return 'Announcement not found';
      if (patch.title !== undefined && patch.title.trim().length < 3) return 'Write a title of at least 3 characters';
      set((s) => ({ announcements: s.announcements.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
      audit('announcement.update', 'announcement', id, Object.keys(patch).join(', '));
      return null;
    },

    removeAnnouncement: (id) => {
      const denied = guard();
      if (denied) return denied;
      set((s) => ({ announcements: s.announcements.filter((a) => a.id !== id) }));
      audit('announcement.remove', 'announcement', id);
      return null;
    },

    adminSaveRecord: (collection, id, record) => {
      const denied = guard();
      if (denied) return denied;
      const current = get()[collection] as unknown;
      if (collection === 'settings') {
        if (!isRecord(record)) return 'Settings must be an object';
        set({ settings: { ...get().settings, ...record } as DbData['settings'] });
      } else if (Array.isArray(current)) {
        if (!isRecord(record)) return 'A record must be an object with fields';
        if (record.id !== undefined && record.id !== id) return 'The id can’t be changed. Duplicate the record instead.';
        if (!current.some((r) => isRecord(r) && r.id === id)) return 'Record not found';
        set({ [collection]: current.map((r) => (isRecord(r) && r.id === id ? { ...record, id } : r)) } as Partial<DbData>);
      } else if (isRecord(current)) {
        if (collection === 'featureFlags' && typeof record !== 'boolean') return 'A feature switch is true or false';
        set({ [collection]: { ...current, [id]: record } } as Partial<DbData>);
      } else return 'This collection can’t be edited';
      audit('record.update', String(collection), id);
      return null;
    },

    adminInsertRecord: (collection, record, key) => {
      const denied = guard();
      if (denied) return { error: denied };
      const current = get()[collection] as unknown;
      if (Array.isArray(current)) {
        if (!isRecord(record)) return { error: 'A record must be an object with fields' };
        const id = typeof record.id === 'string' && record.id.trim() ? record.id.trim() : uid(String(collection).slice(0, 4));
        if (current.some((r) => isRecord(r) && r.id === id)) return { error: `A record with id ${id} already exists` };
        set({ [collection]: [{ ...record, id }, ...current] } as Partial<DbData>);
        audit('record.add', String(collection), id);
        return { id };
      }
      if (isRecord(current) && MAP_COLLECTIONS.has(collection)) {
        const k = key?.trim();
        if (!k) return { error: 'Give the entry a key' };
        if (k in current) return { error: `${k} already exists` };
        set({ [collection]: { ...current, [k]: record } } as Partial<DbData>);
        audit('record.add', String(collection), k);
        return { id: k };
      }
      return { error: 'You can’t add records here' };
    },

    adminDeleteRecords: (collection, ids) => {
      const denied = guard();
      if (denied) return denied;
      if (!ids.length) return 'Select something to delete';
      const current = get()[collection] as unknown;
      const drop = new Set(ids);
      if (Array.isArray(current)) set({ [collection]: current.filter((r) => !(isRecord(r) && drop.has(String(r.id)))) } as Partial<DbData>);
      else if (isRecord(current) && collection !== 'settings') set({ [collection]: Object.fromEntries(Object.entries(current).filter(([k]) => !drop.has(k))) } as Partial<DbData>);
      else return 'This collection can’t be deleted from';
      audit('record.delete', String(collection), ids.length === 1 ? ids[0] : 'many', `${ids.length} deleted`);
      return null;
    },

    adminSaveAccount: (id, patch) => {
      const denied = guard();
      if (denied) return denied;
      const session = useSession.getState();
      const account = session.accounts.find((a) => a.id === id);
      if (!account) return 'Account not found';
      if (patch.name !== undefined && patch.name.trim().length < 2) return 'Enter a name of at least 2 characters';
      if (patch.phone !== undefined && !/^9[678]\d{8}$/.test(patch.phone.replace(/\D/g, '').slice(-10))) return 'Enter a valid Nepali mobile number (98XXXXXXXX)';
      if (patch.email && !/^\S+@\S+\.\S+$/.test(patch.email)) return 'Enter a valid email address';
      if (patch.phone !== undefined) {
        const phone = patch.phone.replace(/\D/g, '').slice(-10);
        const role = patch.role ?? account.role;
        if (session.accounts.some((a) => a.id !== id && a.role === role && a.phone.replace(/\D/g, '').slice(-10) === phone)) return 'Another account of this type already uses that number';
        patch = { ...patch, phone };
      }
      const me = session.session?.accountId;
      if (id === me && (patch.suspended || (patch.role && patch.role !== 'platform') || (patch.staffRole && patch.staffRole !== 'super_admin'))) return 'You can’t suspend or demote yourself';
      if (account.staffRole === 'super_admin' && patch.staffRole && patch.staffRole !== 'super_admin' && session.accounts.filter((a) => a.staffRole === 'super_admin' && !a.suspended).length < 2) return 'Keep at least one super admin';
      session.updateAccount(id, patch);
      audit('account.update', 'account', id, Object.keys(patch).join(', '));
      return null;
    },

    adminCreateAccount: (input) => {
      const denied = guard();
      if (denied) return { error: denied };
      const name = input.name.trim();
      const phone = input.phone.replace(/\D/g, '').slice(-10);
      if (name.length < 2) return { error: 'Enter a name of at least 2 characters' };
      if (!/^9[678]\d{8}$/.test(phone)) return { error: 'Enter a valid Nepali mobile number (98XXXXXXXX)' };
      const session = useSession.getState();
      if (session.findAccount(phone, input.role)) return { error: 'An account of this type already uses that number' };
      const account = session.register({ ...input, name, phone, city: input.city || 'Kathmandu' } as Omit<Account, 'id' | 'createdAt' | 'verified'>);
      session.updateAccount(account.id, { verified: true });
      audit('account.create', 'account', account.id, `${input.role} · ${name}`);
      return { account: { ...account, verified: true } };
    },

    adminDeleteAccount: (id) => {
      const denied = guard();
      if (denied) return denied;
      const session = useSession.getState();
      const account = session.accounts.find((a) => a.id === id);
      if (!account) return 'Account not found';
      if (session.session?.accountId === id) return 'You can’t delete the account you are signed in with';
      if (account.staffRole === 'super_admin' && session.accounts.filter((a) => a.staffRole === 'super_admin').length < 2) return 'Keep at least one super admin';
      useSession.setState((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) }));
      audit('account.delete', 'account', id, `${account.role} · ${account.name}`);
      return null;
    },
  };
};

/** Roles an announcement can target, for pickers. */
export const ANNOUNCEMENT_AUDIENCES: (UserRole | 'all')[] = ['all', 'customer', 'vendor', 'freelancer', 'platform'];
