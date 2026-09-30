/** Role toolkits: generic tool records, per-owner tool settings and ops broadcasts. */
import { useSession } from '@/store/useSession';
import type { Broadcast, ToolEntry, ToolEntryInput, ToolState, ToolValue, UserRole } from '@/types/platform';
import { uid } from '@/utils/format';

import { currentActor, type GetDb, now, type SetDb } from './helpers';
import { staffOnly } from './personas';

export interface ToolkitActions {
  addToolEntry: (input: ToolEntryInput) => ToolEntry | null;
  updateToolEntry: (id: string, patch: Partial<ToolEntryInput>) => void;
  removeToolEntry: (id: string) => void;
  toggleToolEntry: (id: string) => void;
  /** Adds a tool's starter items once per owner (never again after the owner edits the list). */
  ensureToolPreset: (ownerId: string, tool: string, items: Omit<ToolEntryInput, 'ownerId' | 'tool'>[]) => void;
  setToolState: (ownerId: string, tool: string, patch: ToolState) => void;
  sendBroadcast: (audience: Broadcast['audience'], title: string, body: string) => Broadcast | null;
}

export const toolStateKey = (ownerId: string, tool: string) => `${ownerId}:${tool}`;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

/** Drops invalid values instead of trusting the form: money and quantities are non-negative integers. */
function clean<T extends Partial<ToolEntryInput>>(input: T): T {
  const out = { ...input };
  if (out.title !== undefined) out.title = out.title.trim();
  if (out.amount !== undefined) out.amount = Number.isFinite(out.amount) ? Math.max(0, Math.round(out.amount)) : undefined;
  if (out.qty !== undefined) out.qty = Number.isFinite(out.qty) ? Math.max(0, Math.round(out.qty)) : undefined;
  if (out.date !== undefined && out.date && !DATE.test(out.date)) out.date = undefined;
  if (out.time !== undefined && out.time && !TIME.test(out.time)) out.time = undefined;
  return out;
}

/** Money-, status- or permission-relevant tools are audited when the ops team changes them. */
const AUDITED = /^(platform\.|vendor\.(expenses|vouchers|referrals|goals)|freelancer\.invoices)/;

export const toolkitActions = (set: SetDb, get: GetDb): ToolkitActions => ({
  addToolEntry: (input) => {
    const data = clean(input);
    if (!data.title || !data.ownerId || !data.tool) return null;
    const entry: ToolEntry = { ...data, id: uid('te'), createdBy: data.createdBy ?? currentActor().id, createdAt: now(), updatedAt: now() };
    set((s) => ({ toolEntries: [entry, ...s.toolEntries] }));
    if (AUDITED.test(entry.tool)) get().log(currentActor(), 'tool.add', entry.tool, entry.id, entry.title);
    return entry;
  },

  updateToolEntry: (id, patch) => {
    const data = clean(patch);
    if (data.title !== undefined && !data.title) return;
    const before = get().toolEntries.find((e) => e.id === id);
    if (!before) return;
    set((s) => ({ toolEntries: s.toolEntries.map((e) => (e.id === id ? { ...e, ...data, id: e.id, ownerId: e.ownerId, tool: e.tool, updatedAt: now() } : e)) }));
    if (AUDITED.test(before.tool) && (data.status !== undefined || data.amount !== undefined)) get().log(currentActor(), 'tool.update', before.tool, id, data.status ?? `amount ${data.amount}`);
  },

  removeToolEntry: (id) => {
    const before = get().toolEntries.find((e) => e.id === id);
    if (!before) return;
    set((s) => ({ toolEntries: s.toolEntries.filter((e) => e.id !== id) }));
    if (AUDITED.test(before.tool)) get().log(currentActor(), 'tool.remove', before.tool, id, before.title);
  },

  toggleToolEntry: (id) => set((s) => ({ toolEntries: s.toolEntries.map((e) => (e.id === id ? { ...e, done: !e.done, updatedAt: now() } : e)) })),

  ensureToolPreset: (ownerId, tool, items) => {
    const key = toolStateKey(ownerId, tool);
    const s = get();
    if (s.toolState[key]?._seeded || s.toolEntries.some((e) => e.ownerId === ownerId && e.tool === tool)) return;
    const stamp = now();
    const entries: ToolEntry[] = items.map((item, i) => ({ ...clean(item), ownerId, tool, id: uid('te'), createdAt: stamp, updatedAt: stamp, fields: { ...item.fields, order: i } }));
    set((st) => ({ toolEntries: [...entries, ...st.toolEntries], toolState: { ...st.toolState, [key]: { ...st.toolState[key], _seeded: true } } }));
  },

  setToolState: (ownerId, tool, patch) => {
    const key = toolStateKey(ownerId, tool);
    const safe: ToolState = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined && !(typeof v === 'number' && !Number.isFinite(v)))) as Record<string, ToolValue | string[]>;
    set((s) => ({ toolState: { ...s.toolState, [key]: { ...s.toolState[key], ...safe } } }));
    if (AUDITED.test(tool)) get().log(currentActor(), 'tool.settings', tool, ownerId, Object.keys(safe).join(', '));
  },

  sendBroadcast: (audience, title, body) => {
    if (staffOnly('broadcast.send', get)) return null;
    const t = title.trim();
    const b = body.trim();
    if (!t || !b) return null;
    const actor = currentActor();
    const roles: UserRole[] = audience === 'all' ? ['customer', 'vendor', 'freelancer'] : [audience];
    const recipients = useSession.getState().accounts.filter((a) => roles.includes(a.role) && !a.suspended).length;
    const hrefFor: Record<UserRole, string> = { customer: '/notifications', vendor: '/business', freelancer: '/freelancer', platform: '/platform' };
    const broadcast: Broadcast = { id: uid('bc'), audience, title: t, body: b, sentById: actor.id, sentByName: actor.name, at: now(), recipients };
    set((s) => ({ broadcasts: [broadcast, ...s.broadcasts].slice(0, 100) }));
    roles.forEach((r) => get().notify(r, t, b, hrefFor[r], 'system'));
    get().log(actor, 'broadcast.send', 'broadcast', broadcast.id, `${audience}: ${t}`);
    return broadcast;
  },
});
