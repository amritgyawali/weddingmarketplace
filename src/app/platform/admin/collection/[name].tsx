import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { COLLECTION_BY_KEY, recordsOf, recordSubtitle, recordTitle } from '@/components/admin/shared';
import { Card, EmptyBlock, KButton, KField, ListRow } from '@/components/kit';
import { staffScreen } from '@/components/persona/StaffGate';
import { Hint, ToolPage } from '@/components/toolkit/core';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast, toastError } from '@/components/ui/Toast';
import { inputReset } from '@/constants/theme';
import type { DbData } from '@/store/db/types';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import { confirm } from '@/utils/confirm';

const PAGE = 40;

/** A blank record shaped like the first one: same keys, emptied values, no id. */
function templateFrom(sample: unknown): string {
  if (!sample || typeof sample !== 'object' || Array.isArray(sample)) return '{\n  \n}';
  const blank = Object.fromEntries(
    Object.entries(sample as Record<string, unknown>)
      .filter(([k]) => k !== 'id')
      .map(([k, v]) => [k, typeof v === 'number' ? 0 : typeof v === 'boolean' ? false : Array.isArray(v) ? [] : v && typeof v === 'object' ? {} : '']),
  );
  return JSON.stringify(blank, null, 2);
}

/** Every record of one collection: search, open, add, select and delete. */
function CollectionScreen() {
  const t = useRoleTheme();
  const { name } = useLocalSearchParams<{ name: string }>();
  const key = name as keyof DbData;
  const meta = COLLECTION_BY_KEY[key];
  const value = useDb((s) => s[key]);
  const insert = useDb((s) => s.adminInsertRecord);
  const removeMany = useDb((s) => s.adminDeleteRecords);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftKey, setDraftKey] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);

  if (!meta || value === undefined) {
    return (
      <ToolPage title="Collection">
        <EmptyBlock icon="folder-outline" title="Collection not found" action="All data" onAction={() => router.replace('/platform/admin/data')} />
      </ToolPage>
    );
  }

  const isMap = !Array.isArray(value);
  const records = recordsOf(value);
  const q = query.trim().toLowerCase();
  const matches = q ? records.filter(([id, r]) => id.toLowerCase().includes(q) || JSON.stringify(r).toLowerCase().includes(q)) : records;
  const shown = matches.slice(0, limit);
  const toggle = (id: string) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const openAdd = () => {
    setDraft(isMap ? (key === 'featureFlags' ? 'false' : '{\n  \n}') : templateFrom(records[0]?.[1]));
    setDraftKey('');
    setDraftError(null);
    setAdding(true);
  };

  const add = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch (e) {
      return setDraftError(e instanceof Error ? e.message : 'Not valid JSON');
    }
    const res = insert(key, parsed, isMap ? draftKey : undefined);
    if (res.error) return setDraftError(res.error);
    setAdding(false);
    toast('Record added');
    router.push({ pathname: '/platform/admin/record/[name]/[id]', params: { name: key, id: res.id! } });
  };

  const deleteSelected = () =>
    confirm(`Delete ${selected.length} record${selected.length > 1 ? 's' : ''}?`, 'They are removed for everyone. This can’t be undone, except by resetting the demo data.', 'Delete', () => {
      const err = removeMany(key, selected);
      if (err) return toastError(err);
      toast(`${selected.length} deleted`);
      setSelected([]);
      setSelecting(false);
    });

  return (
    <ToolPage
      title={meta.label}
      subtitle={`${records.length} record${records.length === 1 ? '' : 's'}`}
      right={key === 'audit' ? undefined : <KButton label="Add" icon="add" size="sm" onPress={openAdd} />}>
      {!!meta.hint && <Hint>{meta.hint}</Hint>}
      <KField placeholder="Search any field" value={query} onChangeText={(v) => { setQuery(v); setLimit(PAGE); }} autoCorrect={false} autoCapitalize="none" />
      <View style={styles.bar}>
        <Text size={13} color={t.c.muted} style={{ flex: 1 }}>
          {q ? `${matches.length} match${matches.length === 1 ? '' : 'es'}` : `Showing ${shown.length} of ${records.length}`}
        </Text>
        {selecting ? (
          <>
            <KButton label="Cancel" size="sm" variant="ghost" onPress={() => { setSelecting(false); setSelected([]); }} />
            <KButton label={`Delete ${selected.length}`} size="sm" variant="danger" icon="trash-outline" missing={!selected.length && 'Tick the records to delete first'} onPress={deleteSelected} />
          </>
        ) : (
          records.length > 0 && <KButton label="Select" size="sm" variant="secondary" icon="checkbox-outline" onPress={() => setSelecting(true)} />
        )}
      </View>
      {shown.length === 0 ? (
        <EmptyBlock icon="file-tray-outline" title={q ? 'Nothing matches' : 'Empty'} message={q ? 'Try another word.' : 'Add the first record with the Add button.'} />
      ) : (
        <Card padded={false} style={{ overflow: 'hidden' }}>
          {shown.map(([id, r]) => (
            <ListRow
              key={id}
              leading={
                selecting ? (
                  <Pressable onPress={() => toggle(id)} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: selected.includes(id) }}>
                    <Ionicons name={selected.includes(id) ? 'checkbox' : 'square-outline'} size={22} color={selected.includes(id) ? t.c.primary : t.c.muted} />
                  </Pressable>
                ) : undefined
              }
              title={recordTitle(id, r)}
              subtitle={[id !== recordTitle(id, r) ? id : '', recordSubtitle(r)].filter(Boolean).join(' · ')}
              onPress={() => (selecting ? toggle(id) : router.push({ pathname: '/platform/admin/record/[name]/[id]', params: { name: key, id } }))}
            />
          ))}
        </Card>
      )}
      {matches.length > shown.length && <KButton label={`Show ${Math.min(PAGE, matches.length - shown.length)} more`} variant="secondary" onPress={() => setLimit((l) => l + PAGE)} />}

      <Sheet visible={adding} onClose={() => setAdding(false)} title={`Add to ${meta.label.toLowerCase()}`}>
        <View style={{ paddingHorizontal: 20, gap: 12, paddingBottom: 8 }}>
          {isMap && <KField label="Key" required value={draftKey} onChangeText={setDraftKey} autoCapitalize="none" autoCorrect={false} placeholder={key === 'featureFlags' ? 'e.g. home.makeup' : 'Unique key'} />}
          <Text size={13} color={t.c.muted}>
            {isMap ? 'Value as JSON.' : 'Fill in the fields as JSON. Leave out the id and one is made for you.'}
          </Text>
          <TextInput
            value={draft}
            onChangeText={(v) => {
              setDraft(v);
              setDraftError(null);
            }}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.json, inputReset, { color: t.c.textStrong, borderColor: draftError ? t.c.danger : t.c.border }]}
          />
          {!!draftError && (
            <Text size={12} color={t.c.danger} raw>
              {draftError}
            </Text>
          )}
          <KButton label="Add record" icon="add" onPress={add} />
        </View>
      </Sheet>
    </ToolPage>
  );
}

export default staffScreen('/platform/admin/collection', CollectionScreen);

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  json: { minHeight: 180, maxHeight: 340, borderWidth: 1, borderRadius: 6, padding: 10, fontFamily: 'monospace', fontSize: 12, textAlignVertical: 'top' },
});
