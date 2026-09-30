/**
 * Building blocks shared by every role toolkit: owner/entry/state hooks, the
 * page shell, and `EntryList`, a config-driven list + form for tools whose
 * data is a list of records (gifts, expenses, tickets…).
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Card, ChoiceChips, EmptyBlock, KButton, KField, ProgressBar, SectionTitle, StackHeader, StatusPill } from '@/components/kit';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { toast } from '@/components/ui/Toast';
import { useLayout } from '@/hooks/useLayout';
import { useCustomerWorkspace } from '@/hooks/useWorkspace';
import { toolStateKey } from '@/store/db/toolkit';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { ToolEntry, ToolEntryInput, ToolState, ToolValue } from '@/types/platform';
import { confirm } from '@/utils/confirm';
import { addDays, formatMoney, formatShortDate, parseMoney, today } from '@/utils/format';

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Whose records a tool reads and writes: the couple's project (shared with
 * collaborators), the vendor or freelancer account, or the whole ops team.
 */
export function useToolOwner() {
  const account = useAccount();
  const { project } = useCustomerWorkspace(account.id);
  if (account.role === 'customer') return project?.id ?? account.id;
  if (account.role === 'platform') return 'platform';
  return account.id;
}

/** Entries of one tool for one owner. Selects the stable array and filters in render. */
export function useToolEntries(ownerId: string, tool: string) {
  const all = useDb((s) => s.toolEntries);
  return all.filter((e) => e.ownerId === ownerId && e.tool === tool);
}

/** A tool's saved settings, with defaults for missing keys. */
export function useToolState<T extends ToolState>(ownerId: string, tool: string, defaults: T): [T, (patch: Partial<T>) => void] {
  const saved = useDb((s) => s.toolState[toolStateKey(ownerId, tool)]);
  const setToolState = useDb((s) => s.setToolState);
  const value = { ...defaults, ...saved } as T;
  return [value, (patch) => setToolState(ownerId, tool, patch as ToolState)];
}

/** Adds a tool's starter items the first time its owner opens it. */
export function usePreset(ownerId: string, tool: string, items: Omit<ToolEntryInput, 'ownerId' | 'tool'>[] | undefined) {
  const ensure = useDb((s) => s.ensureToolPreset);
  useEffect(() => {
    // Idempotent: the action returns early once the owner has been seeded.
    if (items?.length) ensure(ownerId, tool, items);
  }, [ensure, ownerId, tool, items]);
}

// ─── Page shell ─────────────────────────────────────────────────────────────

/** Stack header + scrolling column, centred at desktop width. */
export function ToolPage({ title, subtitle, right, children }: { title: string; subtitle?: string; right?: ReactNode; children: ReactNode }) {
  const t = useRoleTheme();
  const { wide, contentWidth } = useLayout();
  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title={title} subtitle={subtitle} right={right} />
      <ScrollView contentContainerStyle={[styles.page, wide && { width: Math.min(contentWidth, 880), alignSelf: 'center' }]} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </View>
  );
}

/** A row of text-only stats (label above, figure below). */
export function StatRow({ items }: { items: { label: string; value: string; alert?: boolean }[] }) {
  const t = useRoleTheme();
  return (
    <View style={styles.stats}>
      {items.map((s) => (
        <Card key={s.label} style={styles.stat}>
          <Text size={13} color={t.c.muted} numberOfLines={1}>
            {s.label}
          </Text>
          <Text size={21} weight="semibold" lineHeight={28} color={s.alert ? t.c.danger : t.c.textStrong} numberOfLines={1} adjustsFontSizeToFit>
            {s.value}
          </Text>
        </Card>
      ))}
    </View>
  );
}

/** Label/value line with an optional muted note underneath. */
export function Line({ label, value, note, strong, tone }: { label: string; value: string; note?: string; strong?: boolean; tone?: 'danger' | 'success' }) {
  const t = useRoleTheme();
  return (
    <View style={styles.line}>
      <View style={{ flex: 1 }}>
        <Text size={14} color={strong ? t.c.textStrong : t.c.text} weight={strong ? 'semibold' : 'regular'}>
          {label}
        </Text>
        {note && (
          <Text size={12} color={t.c.muted}>
            {note}
          </Text>
        )}
      </View>
      <Text size={strong ? 16 : 14} weight={strong ? 'bold' : 'semibold'} color={tone === 'danger' ? t.c.danger : tone === 'success' ? t.c.success : t.c.textStrong}>
        {value}
      </Text>
    </View>
  );
}

/** Muted explanatory paragraph. */
export function Hint({ children }: { children: ReactNode }) {
  const t = useRoleTheme();
  return (
    <Text size={13} color={t.c.muted} lineHeight={19}>
      {children}
    </Text>
  );
}

/** Numeric input that keeps digits only and reports a number. */
export function NumberField({ label, value, onChange, money, placeholder }: { label: string; value: number; onChange: (n: number) => void; money?: boolean; placeholder?: string }) {
  return (
    <KField
      label={label || undefined}
      accessibilityLabel={label || placeholder || 'Amount'}
      prefix={money ? 'NPR' : undefined}
      value={value ? String(value) : ''}
      placeholder={placeholder ?? '0'}
      keyboardType="number-pad"
      onChangeText={(v) => onChange(Number(v.replace(/\D/g, '')) || 0)}
    />
  );
}

/** Two or three controls side by side on wide screens, stacked on phones. */
export function Cols({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { medium } = useLayout();
  return <View style={[{ flexDirection: medium ? 'row' : 'column', gap: 10 }, style]}>{children}</View>;
}

export function Col({ children }: { children: ReactNode }) {
  return <View style={{ flex: 1 }}>{children}</View>;
}

// ─── EntryList ──────────────────────────────────────────────────────────────

type BaseKey = 'title' | 'note' | 'amount' | 'qty' | 'date' | 'time' | 'status' | 'group' | 'refId' | 'done';
export type FieldKey = BaseKey | `f.${string}`;
export type FieldKind = 'text' | 'multiline' | 'money' | 'number' | 'date' | 'time' | 'select' | 'toggle';

export interface FieldDef {
  key: FieldKey;
  label: string;
  kind: FieldKind;
  options?: string[] | { id: string; label: string }[];
  placeholder?: string;
  required?: boolean;
}

type Draft = Record<string, ToolValue | undefined>;

const optionList = (f: FieldDef) => (f.options ?? []).map((o) => (typeof o === 'string' ? { id: o, label: o } : o));

function readField(e: Partial<ToolEntry>, key: FieldKey): ToolValue | undefined {
  if (key.startsWith('f.')) return e.fields?.[key.slice(2)];
  return e[key as BaseKey];
}

/** Numeric fields hold the typed text while editing; this turns it into a whole number (NaN when invalid). */
function numeric(f: FieldDef, v: ToolValue | undefined): number | undefined {
  if (v === undefined || v === '') return undefined;
  if (typeof v === 'number') return v;
  return f.kind === 'money' ? parseMoney(String(v)) : /^\d+$/.test(String(v).trim()) ? Number(String(v).trim()) : NaN;
}

function toInput(draft: Draft, fields: FieldDef[]): Partial<ToolEntryInput> {
  const out: Partial<ToolEntryInput> & { fields: Record<string, ToolValue> } = { fields: {} };
  for (const f of fields) {
    const v = f.kind === 'money' || f.kind === 'number' ? numeric(f, draft[f.key]) : draft[f.key];
    if (f.key.startsWith('f.')) {
      if (v !== undefined && v !== '') out.fields[f.key.slice(2)] = v;
    } else {
      (out as Record<string, unknown>)[f.key] = v === '' ? undefined : v;
    }
  }
  return out;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

function validate(draft: Draft, fields: FieldDef[]): string | null {
  for (const f of fields) {
    const v = draft[f.key];
    if (f.required && (v === undefined || v === '')) return `${f.label} is required`;
    if (f.kind === 'money' || f.kind === 'number') {
      const n = numeric(f, v);
      if (n !== undefined && !(Number.isFinite(n) && n >= 0)) return f.kind === 'money' ? `${f.label}: enter an amount like 150000, 150k or 1.5 lakh` : `${f.label}: enter a whole number`;
      if (f.required && f.kind === 'money' && !n) return `${f.label} is required`;
    }
    if (f.kind === 'date' && v && !DATE.test(String(v))) return `${f.label}: use yyyy-mm-dd`;
    if (f.kind === 'time' && v && !TIME.test(String(v))) return `${f.label}: use HH:mm, e.g. 16:30`;
  }
  return null;
}

/** Form fields for an entry, shared by add and edit. */
function EntryForm({ fields, draft, setDraft }: { fields: FieldDef[]; draft: Draft; setDraft: (d: Draft) => void }) {
  const t = useRoleTheme();
  const put = (k: FieldKey, v: ToolValue | undefined) => setDraft({ ...draft, [k]: v });
  return (
    <View style={{ gap: 12 }}>
      {fields.map((f) => {
        const v = draft[f.key];
        switch (f.kind) {
          case 'money':
          case 'number':
            return (
              <KField
                key={f.key}
                label={f.label}
                prefix={f.kind === 'money' ? 'NPR' : undefined}
                value={v === undefined || v === '' ? '' : String(v)}
                placeholder={f.placeholder ?? '0'}
                keyboardType={f.kind === 'money' ? 'default' : 'number-pad'}
                onChangeText={(x) => put(f.key, x.trim() === '' ? undefined : x)}
              />
            );
          case 'select': {
            const opts = optionList(f);
            return (
              <View key={f.key} style={{ gap: 6 }}>
                <Text size={13} weight="medium" color={t.c.text}>
                  {f.label}
                </Text>
                <ChoiceChips options={opts.map((o) => o.label)} selected={opts.filter((o) => o.id === v).map((o) => o.label)} onToggle={(label) => put(f.key, opts.find((o) => o.label === label)?.id)} />
              </View>
            );
          }
          case 'toggle':
            return (
              <View key={f.key} style={styles.toggleRow}>
                <Text size={15} color={t.c.textStrong} style={{ flex: 1 }}>
                  {f.label}
                </Text>
                <Toggle value={!!v} onValueChange={(x) => put(f.key, x)} accessibilityLabel={f.label} />
              </View>
            );
          case 'date':
            return (
              <View key={f.key} style={{ gap: 6 }}>
                <KField label={f.label} value={v ? String(v) : ''} placeholder={f.placeholder ?? 'yyyy-mm-dd'} onChangeText={(x) => put(f.key, x.trim() || undefined)} autoCapitalize="none" />
                <View style={styles.quick}>
                  {[
                    ['Today', 0],
                    ['+1 week', 7],
                    ['+1 month', 30],
                  ].map(([label, d]) => (
                    <Pressable key={label} onPress={() => put(f.key, addDaysIso(Number(d)))} hitSlop={6}>
                      <Text size={13} color={t.c.primary}>
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            );
          default:
            return (
              <KField
                key={f.key}
                label={f.label}
                value={v === undefined ? '' : String(v)}
                placeholder={f.placeholder ?? (f.kind === 'time' ? 'HH:mm' : undefined)}
                multiline={f.kind === 'multiline'}
                onChangeText={(x) => put(f.key, x)}
                autoCapitalize={f.kind === 'time' ? 'none' : 'sentences'}
              />
            );
        }
      })}
    </View>
  );
}

const addDaysIso = (n: number) => addDays(today(), n);

export interface EntryListProps {
  ownerId: string;
  tool: string;
  fields: FieldDef[];
  /** Singular noun for buttons: "gift", "expense". */
  noun: string;
  presets?: Omit<ToolEntryInput, 'ownerId' | 'tool'>[];
  /** Show a tick box per row and overall progress. */
  checklist?: boolean;
  /** Section the list by `group` or `status`. */
  groupBy?: 'group' | 'status';
  groupOrder?: string[];
  /** Values new entries start with. */
  defaults?: Partial<ToolEntryInput> & { fields?: Record<string, ToolValue> };
  subtitle?: (e: ToolEntry) => string | undefined;
  trailing?: (e: ToolEntry) => string | undefined;
  /** Show the status as a pill on each row. */
  statusPill?: boolean;
  sort?: (a: ToolEntry, b: ToolEntry) => number;
  filter?: (e: ToolEntry) => boolean;
  /** Content above the list (summaries, calculators); receives the tool's entries. */
  header?: (entries: ToolEntry[]) => ReactNode;
  /** Extra buttons on a row. */
  rowActions?: (e: ToolEntry) => { label: string; onPress: () => void }[];
  emptyTitle?: string;
  emptyMessage?: string;
  /** Called after an entry is added (e.g. to toast a follow-up). */
  onAdded?: (e: ToolEntry) => void;
}

const defaultSubtitle = (e: ToolEntry) =>
  [e.date ? formatShortDate(e.date) : undefined, e.time, e.qty ? `× ${e.qty}` : undefined, e.note].filter(Boolean).join(' · ') || undefined;

/** List + add/edit sheet for any record-shaped tool. */
export function EntryList(props: EntryListProps) {
  const { ownerId, tool, fields, noun, checklist, groupBy, groupOrder, defaults, statusPill } = props;
  const t = useRoleTheme();
  usePreset(ownerId, tool, props.presets);
  const all = useToolEntries(ownerId, tool);
  const add = useDb((s) => s.addToolEntry);
  const update = useDb((s) => s.updateToolEntry);
  const remove = useDb((s) => s.removeToolEntry);
  const toggle = useDb((s) => s.toggleToolEntry);
  const [editing, setEditing] = useState<ToolEntry | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [error, setError] = useState<string | null>(null);

  const entries = all.filter((e) => !props.filter || props.filter(e)).sort(props.sort ?? ((a, b) => Number(a.fields?.order ?? 0) - Number(b.fields?.order ?? 0) || (a.date ?? '').localeCompare(b.date ?? '') || a.createdAt.localeCompare(b.createdAt)));
  const done = entries.filter((e) => e.done).length;

  const open = (e: ToolEntry | 'new') => {
    const src: Partial<ToolEntry> = e === 'new' ? { ...defaults } : e;
    setDraft(Object.fromEntries(fields.map((f) => [f.key, readField(src, f.key)])));
    setError(null);
    setEditing(e);
  };

  const save = () => {
    const problem = validate(draft, fields);
    if (problem) return setError(problem);
    const input = toInput(draft, fields);
    if (editing === 'new') {
      const created = add({ ...defaults, ...input, fields: { ...defaults?.fields, ...input.fields }, ownerId, tool, title: String(input.title ?? '') } as ToolEntryInput);
      if (!created) return setError('Please add a title');
      toast(`${cap(noun)} added`);
      props.onAdded?.(created);
    } else if (editing) {
      update(editing.id, { ...input, fields: { ...editing.fields, ...input.fields } });
      toast('Saved');
    }
    setEditing(null);
  };

  const sections: { title: string | null; items: ToolEntry[] }[] = groupBy
    ? [...new Set([...(groupOrder ?? []), ...entries.map((e) => (groupBy === 'group' ? e.group : e.status) ?? 'Other')])]
        .map((g) => ({ title: g, items: entries.filter((e) => ((groupBy === 'group' ? e.group : e.status) ?? 'Other') === g) }))
        .filter((s) => s.items.length)
    : [{ title: null, items: entries }];

  const statusField = fields.find((f) => f.key === 'status');
  const statusLabelOf = (id?: string) => (id && statusField ? (optionList(statusField).find((o) => o.id === id)?.label ?? id) : id);

  return (
    <View style={{ gap: 14 }}>
      {props.header?.(entries)}
      {checklist && entries.length > 0 && (
        <Card style={{ gap: 8 }}>
          <View style={styles.between}>
            <Text size={15} weight="semibold" color={t.c.textStrong}>
              {done} of {entries.length} done
            </Text>
            <Text size={13} color={t.c.muted}>
              {Math.round((done / entries.length) * 100)}%
            </Text>
          </View>
          <ProgressBar value={done / entries.length} />
        </Card>
      )}
      <KButton label={`Add ${noun}`} icon="add" variant="secondary" onPress={() => open('new')} />
      {entries.length === 0 && <EmptyBlock icon="list-outline" title={props.emptyTitle ?? `No ${noun}s yet`} message={props.emptyMessage} />}
      {sections.map((sec) => (
        <View key={sec.title ?? 'all'}>
          {sec.title && <SectionTitle title={`${groupBy === 'status' ? statusLabelOf(sec.title) : sec.title} (${sec.items.length})`} />}
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {sec.items.map((e, i) => {
              const sub = (props.subtitle ?? defaultSubtitle)(e);
              const trail = props.trailing?.(e) ?? (e.amount ? formatMoney(e.amount) : undefined);
              const extra = props.rowActions?.(e) ?? [];
              return (
                <View key={e.id} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.border }]}>
                  {checklist && (
                    <Pressable onPress={() => toggle(e.id)} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: !!e.done }} accessibilityLabel={e.title}>
                      <Ionicons name={e.done ? 'checkbox' : 'square-outline'} size={22} color={e.done ? t.c.success : t.c.subtle} />
                    </Pressable>
                  )}
                  <Pressable style={{ flex: 1, gap: 2 }} onPress={() => open(e)} accessibilityRole="button" accessibilityLabel={`Edit ${e.title}`}>
                    <Text size={15} weight="semibold" color={e.done ? t.c.muted : t.c.textStrong} style={e.done ? { textDecorationLine: 'line-through' } : undefined} numberOfLines={2}>
                      {e.title}
                    </Text>
                    {sub && (
                      <Text size={13} color={t.c.muted} numberOfLines={2}>
                        {sub}
                      </Text>
                    )}
                    {extra.length > 0 && (
                      <View style={[styles.quick, { marginTop: 4 }]}>
                        {extra.map((a) => (
                          <Pressable key={a.label} onPress={a.onPress} hitSlop={6}>
                            <Text size={13} weight="medium" color={t.c.primary}>
                              {a.label}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </Pressable>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    {trail && (
                      <Text size={14} weight="semibold" color={t.c.textStrong}>
                        {trail}
                      </Text>
                    )}
                    {statusPill && e.status && <StatusPill status={e.status} label={statusLabelOf(e.status)} />}
                  </View>
                </View>
              );
            })}
          </Card>
        </View>
      ))}

      <Sheet
        visible={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? `Add ${noun}` : `Edit ${noun}`}
        footer={
          <View style={styles.sheetFooter}>
            {editing && editing !== 'new' && (
              <KButton
                label="Delete"
                variant="danger"
                style={{ flex: 1 }}
                onPress={() =>
                  confirm(`Delete this ${noun}?`, editing.title, 'Delete', () => {
                    remove(editing.id);
                    setEditing(null);
                  })
                }
              />
            )}
            <KButton label="Save" style={{ flex: 2 }} onPress={save} />
          </View>
        }>
        <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12, gap: 10 }} keyboardShouldPersistTaps="handled">
          <EntryForm fields={fields} draft={draft} setDraft={setDraft} />
          {error && (
            <Text size={13} color={t.c.danger}>
              {error}
            </Text>
          )}
        </ScrollView>
      </Sheet>
    </View>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Sum of entry amounts. */
export const sumAmount = (entries: ToolEntry[], pick: (e: ToolEntry) => boolean = () => true) => entries.filter(pick).reduce((s, e) => s + (e.amount ?? 0), 0);

export { today };

const styles = StyleSheet.create({
  page: { padding: 16, gap: 14, paddingBottom: 48 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flex: 1, minWidth: 140, paddingVertical: 12, paddingHorizontal: 14 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  quick: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  sheetFooter: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 8 },
});
