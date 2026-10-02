/** Building blocks of the super admin console: role names, collection metadata and a generic record editor. */
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Card, KField } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { inputReset } from '@/constants/theme';
import type { DbData } from '@/store/db/types';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { UserRole } from '@/types/platform';

export const ROLE_NAMES: Record<UserRole, string> = { customer: 'Couple', vendor: 'Business', freelancer: 'Freelancer', platform: 'Staff' };

/** How each collection is described in the console, grouped like the app. */
export const COLLECTIONS: { key: keyof DbData; label: string; group: string; hint: string }[] = [
  { key: 'projects', label: 'Projects (weddings and celebrations)', group: 'Planning', hint: 'Events, requirements, bookings, tasks, milestones' },
  { key: 'quotes', label: 'Quotations', group: 'Planning', hint: 'Every version sent to families' },
  { key: 'leads', label: 'Leads', group: 'Planning', hint: 'Marketplace enquiries to businesses' },
  { key: 'gigs', label: 'Gigs', group: 'Crew', hint: 'Freelancer postings and applications' },
  { key: 'payments', label: 'Payments', group: 'Money', hint: 'Customer payments against milestones' },
  { key: 'payables', label: 'Payables', group: 'Money', hint: 'What the platform owes providers and crew' },
  { key: 'revenue', label: 'Revenue', group: 'Money', hint: 'What the platform earns' },
  { key: 'refunds', label: 'Refunds', group: 'Money', hint: '' },
  { key: 'disputes', label: 'Disputes', group: 'Money', hint: '' },
  { key: 'invoices', label: 'Invoices', group: 'Money', hint: '' },
  { key: 'availability', label: 'Calendar days', group: 'Calendars', hint: 'Booked, held and blocked days' },
  { key: 'availabilityRules', label: 'Weekly rules', group: 'Calendars', hint: '' },
  { key: 'threads', label: 'Message threads', group: 'Messages', hint: '' },
  { key: 'messages', label: 'Messages', group: 'Messages', hint: '' },
  { key: 'notifications', label: 'Notifications', group: 'Messages', hint: '' },
  { key: 'broadcasts', label: 'Broadcasts', group: 'Messages', hint: '' },
  { key: 'notes', label: 'Internal notes', group: 'Messages', hint: '' },
  { key: 'files', label: 'Files', group: 'Messages', hint: '' },
  { key: 'reviews', label: 'Reviews', group: 'Trust', hint: '' },
  { key: 'verifications', label: 'Verification cases', group: 'Trust', hint: 'KYC documents and checks' },
  { key: 'audit', label: 'Audit log', group: 'Trust', hint: 'Read with care: this is the record of changes' },
  { key: 'guests', label: 'Guests', group: 'Couple tools', hint: '' },
  { key: 'seating', label: 'Seating plans', group: 'Couple tools', hint: '' },
  { key: 'budget', label: 'Budget lines', group: 'Couple tools', hint: '' },
  { key: 'websites', label: 'Wedding websites', group: 'Couple tools', hint: '' },
  { key: 'registry', label: 'Registry gifts', group: 'Couple tools', hint: '' },
  { key: 'boards', label: 'Inspiration boards', group: 'Couple tools', hint: '' },
  { key: 'contracts', label: 'Contracts', group: 'Couple tools', hint: '' },
  { key: 'shortlists', label: 'Shortlists', group: 'Couple tools', hint: 'One list per couple' },
  { key: 'deals', label: 'Deals', group: 'Business', hint: '' },
  { key: 'staff', label: 'Business staff', group: 'Business', hint: '' },
  { key: 'packages', label: 'Packages', group: 'Business', hint: '' },
  { key: 'portfolio', label: 'Portfolio items', group: 'Business', hint: '' },
  { key: 'toolEntries', label: 'Tool records', group: 'Tools', hint: 'Everything saved in the 80 role tools' },
  { key: 'toolState', label: 'Tool settings', group: 'Tools', hint: '' },
  { key: 'occasions', label: 'Occasions', group: 'Catalogue', hint: 'Also editable from Occasions' },
  { key: 'settings', label: 'Platform settings', group: 'Catalogue', hint: 'Rates, fees, cities, banners' },
  { key: 'announcements', label: 'Announcements', group: 'Console', hint: '' },
  { key: 'featureFlags', label: 'Feature switches', group: 'Console', hint: 'false hides a feature' },
  { key: 'textOverrides', label: 'Text changes', group: 'Console', hint: '' },
];

export const COLLECTION_BY_KEY = Object.fromEntries(COLLECTIONS.map((c) => [c.key, c])) as Record<keyof DbData, (typeof COLLECTIONS)[number]>;

/** Records of a collection as [id, value] pairs, whatever its shape. */
export function recordsOf(value: unknown): [string, unknown][] {
  if (Array.isArray(value)) return value.map((r, i) => [String((r as { id?: unknown })?.id ?? i), r]);
  if (value && typeof value === 'object') return Object.entries(value as Record<string, unknown>);
  return [];
}

/** A one-line, human label for any record: its name, title, label… or its id. */
export function recordTitle(id: string, value: unknown): string {
  if (!value || typeof value !== 'object') return `${id}: ${JSON.stringify(value)}`;
  const r = value as Record<string, unknown>;
  for (const k of ['title', 'name', 'label', 'code', 'number', 'businessName', 'customerName', 'text', 'message', 'action']) {
    if (typeof r[k] === 'string' && r[k]) return String(r[k]);
  }
  return id;
}

/** Second line under a record: a few short fields that help tell records apart. */
export function recordSubtitle(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const r = value as Record<string, unknown>;
  return ['status', 'kind', 'role', 'city', 'date', 'due', 'at', 'createdAt', 'amount', 'serviceId']
    .filter((k) => r[k] !== undefined && r[k] !== null && typeof r[k] !== 'object')
    .slice(0, 4)
    .map((k) => `${k}: ${String(r[k]).slice(0, 24)}`)
    .join(' · ');
}

type Value = string | number | boolean | null | object;

/**
 * Edits one field of a record by its type: text, number, on/off, or JSON for
 * lists and nested objects. Calls `onChange` with the parsed value, or
 * reports the JSON error under the field.
 */
export function FieldEditor({ name, value, onChange, locked }: { name: string; value: Value; onChange: (v: Value) => void; locked?: boolean }) {
  const t = useRoleTheme();
  const [json, setJson] = useState(() => (value !== null && typeof value === 'object' ? JSON.stringify(value, null, 2) : ''));
  const [error, setError] = useState<string | null>(null);

  if (typeof value === 'boolean') {
    return (
      <View style={styles.boolRow}>
        <Text size={14} weight="medium" color={t.c.textStrong} style={{ flex: 1 }} raw>
          {name}
        </Text>
        <Toggle value={value} onValueChange={(v) => !locked && onChange(v)} accessibilityLabel={name} />
      </View>
    );
  }
  if (typeof value === 'number') {
    return <KField label={name} value={String(value)} editable={!locked} keyboardType="numeric" onChangeText={(v) => onChange(v.trim() === '' || Number.isNaN(Number(v)) ? value : Number(v))} />;
  }
  if (value === null || typeof value === 'string') {
    const long = typeof value === 'string' && value.length > 60;
    return <KField label={name} value={value ?? ''} editable={!locked} multiline={long} onChangeText={(v) => onChange(v)} autoCapitalize="none" autoCorrect={false} hint={locked ? 'This field can’t be changed' : undefined} />;
  }
  return (
    <View style={{ gap: 6 }}>
      <Text size={13} weight="medium" color={t.c.text} raw>
        {name} {Array.isArray(value) ? `(${value.length})` : ''}
      </Text>
      <TextInput
        value={json}
        multiline
        editable={!locked}
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={(v) => {
          setJson(v);
          try {
            onChange(JSON.parse(v) as Value);
            setError(null);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Not valid JSON');
          }
        }}
        style={[styles.json, inputReset, { color: t.c.textStrong, borderColor: error ? t.c.danger : t.c.border, backgroundColor: t.c.surface }]}
      />
      {!!error && (
        <Text size={12} color={t.c.danger} raw>
          {error}
        </Text>
      )}
    </View>
  );
}

/** Groups a record's fields: simple ones first, then lists and nested objects. */
export function RecordFields({ record, onChange, lockedKeys = [] }: { record: Record<string, Value>; onChange: (next: Record<string, Value>) => void; lockedKeys?: string[] }) {
  const keys = Object.keys(record);
  const simple = keys.filter((k) => record[k] === null || typeof record[k] !== 'object');
  const nested = keys.filter((k) => record[k] !== null && typeof record[k] === 'object');
  const set = (k: string, v: Value) => onChange({ ...record, [k]: v });
  return (
    <>
      {simple.length > 0 && (
        <Card style={{ gap: 12 }}>
          {simple.map((k) => (
            <FieldEditor key={k} name={k} value={record[k]} locked={lockedKeys.includes(k)} onChange={(v) => set(k, v)} />
          ))}
        </Card>
      )}
      {nested.length > 0 && (
        <Card style={{ gap: 14 }}>
          {nested.map((k) => (
            <FieldEditor key={k} name={k} value={record[k]} locked={lockedKeys.includes(k)} onChange={(v) => set(k, v)} />
          ))}
        </Card>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  boolRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 40 },
  json: { minHeight: 110, maxHeight: 320, borderWidth: 1, borderRadius: 6, padding: 10, fontFamily: 'monospace', fontSize: 12, textAlignVertical: 'top' },
});
