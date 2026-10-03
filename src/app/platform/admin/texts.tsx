import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, EmptyBlock, KButton, KField, Segmented, StatusPill } from '@/components/kit';
import { staffScreen } from '@/components/persona/StaffGate';
import { Hint, ToolPage } from '@/components/toolkit/core';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast, toastError } from '@/components/ui/Toast';
import { dictionaryKeys, translate } from '@/i18n/runtime';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import { confirm } from '@/utils/confirm';

type Show = 'all' | 'changed' | 'missing';
const SHOWS: { id: Show; label: string }[] = [
  { id: 'all', label: 'All text' },
  { id: 'changed', label: 'Changed' },
  { id: 'missing', label: 'No Nepali yet' },
];
const PAGE = 60;
const KEYS = dictionaryKeys().filter((k) => !k.includes('{'));

/**
 * Rewrite any text in the app, in English and in Nepali, without a release.
 * Pick a line (or type the exact English text you see on screen) and give it
 * new wording; it changes everywhere it appears.
 */
function Texts() {
  const t = useRoleTheme();
  const overrides = useDb((s) => s.textOverrides);
  const setText = useDb((s) => s.setTextOverride);
  const resetAll = useDb((s) => s.resetTextOverrides);
  const [show, setShow] = useState<Show>('all');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<string | null>(null);
  const [en, setEn] = useState('');
  const [ne, setNe] = useState('');
  const [source, setSource] = useState('');

  const q = query.trim().toLowerCase();
  const keys = [...new Set([...Object.keys(overrides), ...KEYS])];
  const nepaliOf = (k: string) => translate(k, 'ne', overrides);
  const list = keys.filter((k) => {
    if (show === 'changed' && !overrides[k]) return false;
    if (show === 'missing' && nepaliOf(k) !== k) return false;
    return !q || k.toLowerCase().includes(q) || nepaliOf(k).toLowerCase().includes(q);
  });

  const open = (key: string) => {
    setEditing(key);
    setSource(key);
    setEn(overrides[key]?.en ?? '');
    setNe(overrides[key]?.ne ?? '');
  };

  const save = () => {
    const key = (editing === '' ? source : editing ?? '').trim();
    if (!key) return toastError('Type the English text exactly as it shows in the app');
    const a = setText(key, 'en', en);
    const b = setText(key, 'ne', ne);
    if (a || b) return toastError(a ?? b ?? '');
    setEditing(null);
    toast('Text updated');
  };

  return (
    <ToolPage
      title="Text and translations"
      subtitle={`${Object.keys(overrides).length} changed`}
      right={<KButton label="Add" icon="add" size="sm" onPress={() => open('')} />}>
      <Hint>Tap a line to change what people read. Leave a box empty to keep the original. Changes show at once in both languages.</Hint>
      <Segmented options={SHOWS} value={show} onChange={(v) => { setShow(v); setLimit(PAGE); }} />
      <KField placeholder="Search English or Nepali text" value={query} onChangeText={(v) => { setQuery(v); setLimit(PAGE); }} autoCorrect={false} />
      {list.length === 0 ? (
        <EmptyBlock icon="language-outline" title="Nothing here" message={show === 'changed' ? 'No text has been changed yet.' : 'Try another word.'} />
      ) : (
        <Card padded={false} style={{ overflow: 'hidden' }}>
          {list.slice(0, limit).map((k, i) => {
            const o = overrides[k];
            const nep = nepaliOf(k);
            return (
              <Pressable key={k} onPress={() => open(k)} style={({ pressed }) => [styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.border }, pressed && { backgroundColor: t.c.surfaceAlt }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text size={14} weight="medium" color={t.c.textStrong} raw>
                    {o?.en ?? k}
                  </Text>
                  <Text size={13} color={nep === k ? t.c.muted : t.c.text} raw>
                    {nep === k ? '—' : nep}
                  </Text>
                </View>
                {!!o && <StatusPill status="new" label="Changed" />}
              </Pressable>
            );
          })}
        </Card>
      )}
      {list.length > limit && <KButton label={`Show ${Math.min(PAGE, list.length - limit)} more`} variant="secondary" onPress={() => setLimit((l) => l + PAGE)} />}
      {Object.keys(overrides).length > 0 && (
        <KButton label="Restore all original text" variant="danger" icon="refresh-outline" onPress={() => confirm('Restore all original text?', 'Every change made here is removed in both languages.', 'Restore', () => { const err = resetAll(); if (err) toastError(err); })} />
      )}

      <Sheet visible={editing !== null} onClose={() => setEditing(null)} title="Change text">
        <View style={{ paddingHorizontal: 20, gap: 12, paddingBottom: 8 }}>
          {editing === '' ? (
            <KField label="English text as it shows now" required value={source} onChangeText={setSource} placeholder="e.g. Start a plan" />
          ) : (
            <View style={{ gap: 2 }}>
              <Text size={12} color={t.c.muted}>
                Original
              </Text>
              <Text size={14} color={t.c.textStrong} raw>
                {editing}
              </Text>
            </View>
          )}
          <KField label="New English text" value={en} onChangeText={setEn} placeholder="Leave empty to keep the original" multiline />
          <KField label="Nepali text" value={ne} onChangeText={setNe} placeholder={editing ? translate(editing, 'ne', {}) : 'नेपालीमा लेख्नुहोस्'} multiline />
          <KButton label="Save" icon="checkmark" onPress={save} />
        </View>
      </Sheet>
    </ToolPage>
  );
}

export default staffScreen('/platform/admin/texts', Texts);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
});
