import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Card, EmptyBlock, FilterChip, KButton, KField, ListRow, Segmented, StatusPill } from '@/components/kit';
import { Hint } from '@/components/toolkit/core';
import { Photo } from '@/components/ui/Photo';
import { photo } from '@/constants/images';
import { CONTENT_CATALOGUE, CONTENT_KIND_BY_ID, recordCover } from '@/data/contentCatalogue';
import { useContent } from '@/hooks/useContent';
import { entryKey, patchList } from '@/services/content';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { ContentKind } from '@/types/content';

type Show = 'all' | 'changed' | 'hidden';
const SHOWS: { id: Show; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'changed', label: 'Changed' },
  { id: 'hidden', label: 'Hidden' },
];
const PAGE = 40;

/** Every venue, vendor, category, collection, idea photo, story and real wedding, to open and edit. */
export function ListingsTab() {
  const t = useRoleTheme();
  const content = useContent();
  const [kind, setKind] = useState<ContentKind>('venue');
  const [show, setShow] = useState<Show>('all');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const def = CONTENT_KIND_BY_ID[kind];
  const q = query.trim().toLowerCase();
  const records = patchList(kind, def.items, content).filter((r) => {
    const entry = content.entries[entryKey(kind, r.id)];
    if (show === 'changed' && !entry) return false;
    if (show === 'hidden' && !entry?.hidden) return false;
    return !q || [def.title, ...def.detail].some((f) => String(r[f] ?? '').toLowerCase().includes(q));
  });
  const pick = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setLimit(PAGE);
  };

  return (
    <>
      <Hint>Open a record to change its name, photos, prices and every other detail, or to hide it from lists and search.</Hint>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
        {CONTENT_CATALOGUE.map((k) => (
          <FilterChip key={k.id} label={`${k.label} (${k.items.length})`} selected={k.id === kind} onPress={() => pick(setKind)(k.id)} />
        ))}
      </ScrollView>
      <Segmented options={SHOWS} value={show} onChange={pick(setShow)} />
      <KField placeholder={`Search ${def.label.toLowerCase()}`} value={query} onChangeText={pick(setQuery)} autoCorrect={false} />
      {records.length === 0 ? (
        <EmptyBlock icon="search-outline" title="Nothing here" message={show === 'all' ? 'Try another word.' : 'Nothing of this kind has been changed yet.'} />
      ) : (
        <Card padded={false} style={{ overflow: 'hidden' }}>
          {records.slice(0, limit).map((r, i) => {
            const entry = content.entries[entryKey(kind, r.id)];
            const cover = recordCover(def, r);
            return (
              <View key={r.id} style={i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.border }}>
                <ListRow
                  title={String(r[def.title] ?? r.id)}
                  subtitle={
                    def.detail
                      .map((f) => String(r[f] ?? '').replace(/-/g, ' '))
                      .filter(Boolean)
                      .join(' · ') || def.hint
                  }
                  leading={<Photo source={photo(cover)} style={styles.thumb} contentFit="cover" />}
                  meta={entry ? <View style={styles.pills}>{entry.hidden ? <StatusPill status="CANCELLED" label="Hidden" /> : <StatusPill status="new" label="Changed" />}</View> : undefined}
                  onPress={() => router.push({ pathname: '/platform/admin/content/[kind]/[id]', params: { kind, id: r.id } })}
                />
              </View>
            );
          })}
        </Card>
      )}
      {records.length > limit && <KButton label={`Show ${Math.min(PAGE, records.length - limit)} more`} variant="secondary" onPress={() => setLimit((l) => l + PAGE)} />}
    </>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 46, height: 46, borderRadius: 6 },
  pills: { flexDirection: 'row', marginTop: 2 },
});
