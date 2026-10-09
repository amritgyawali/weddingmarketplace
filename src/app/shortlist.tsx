import { Ionicons } from '@expo/vector-icons';
import { Photo } from '@/components/ui/Photo';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { PhotoTile } from '@/components/ideas/PhotoTile';
import { Card, ChoiceChips, KButton, KField, Segmented, StatusPill } from '@/components/kit';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { photos } from '@/constants/images';
import { colors } from '@/constants/theme';
import { IDEA_PHOTOS } from '@/data/ideas';
import { findProvider, type Provider } from '@/data/providers';
import { serviceName } from '@/data/services';
import { useStartChat } from '@/hooks/useChat';
import { useFeatures } from '@/hooks/useFeatures';
import { useAppStore } from '@/store/useAppStore';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import type { ShortlistEntry } from '@/types/platform';
import { formatMoney, timeAgo } from '@/utils/format';

type Tab = 'vendors' | 'photos';
const STAGES: { id: ShortlistEntry['status']; label: string }[] = [
  { id: 'saved', label: 'Saved' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'quote_received', label: 'Quote received' },
  { id: 'negotiating', label: 'Negotiating' },
  { id: 'booked', label: 'Booked' },
  { id: 'rejected', label: 'Not for us' },
];
const TAGS = ['Favourite', 'Backup', 'Within budget', 'Stretch', 'Family pick'];

/** Shortlist as a mini-CRM: stages, notes and tags per vendor, compare, and liked photos. */
export default function ShortlistScreen() {
  const params = useLocalSearchParams<{ tab?: Tab | 'venues' }>();
  const { width } = useWindowDimensions();
  const account = useAccount();
  const entries = useDb((s) => s.shortlists[account.id]);
  const updateShortlist = useDb((s) => s.updateShortlist);
  const toggleShortlist = useDb((s) => s.toggleShortlist);
  const appToggle = useAppStore((s) => s.toggleShortlist);
  const appShortlist = useAppStore((s) => s.shortlist);
  const liked = useAppStore((s) => s.likedPhotos);
  const startChat = useStartChat();
  const [tab, setTab] = useState<Tab>(params.tab === 'photos' ? 'photos' : 'vendors');
  const [stage, setStage] = useState<ShortlistEntry['status'] | 'all'>('all');
  const [compare, setCompare] = useState<string[]>([]);
  const canCompare = useFeatures()('couple.compare');
  const [editing, setEditing] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const list = (entries ?? []).map((e) => ({ e, p: findProvider(e.providerId) })).filter((x): x is { e: ShortlistEntry; p: Provider } => !!x.p);
  const shown = list.filter((x) => stage === 'all' || x.e.status === stage);
  const photosLiked = IDEA_PHOTOS.filter((p) => liked.includes(p.id));
  const current = list.find((x) => x.p.id === editing);

  const remove = (p: Provider) => {
    toggleShortlist(account.id, p.id);
    const kind = p.kind === 'venue' ? 'venues' : 'vendors';
    if (appShortlist[kind].includes(p.id)) appToggle(kind, p.id);
    setCompare((c) => c.filter((x) => x !== p.id));
    toast('Removed from shortlist', 'bookmark-outline');
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="My Shortlist" subtitle={`${list.length} vendors · ${photosLiked.length} photos`} />
      <View style={{ paddingVertical: 10, backgroundColor: colors.white }}>
        <Segmented
          options={[
            { id: 'vendors', label: 'Vendors & venues' },
            { id: 'photos', label: 'Photos' },
          ]}
          value={tab}
          onChange={setTab}
          counts={{ vendors: list.length || undefined, photos: photosLiked.length || undefined }}
        />
      </View>
      {tab === 'vendors' ? (
        <FlatList
          data={shown}
          keyExtractor={(x) => x.p.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: compare.length ? 120 : 40 }}
          ListHeaderComponent={
            list.length ? (
              <View style={{ gap: 10 }}>
                <ChoiceChips options={['All', ...STAGES.map((s) => `${s.label} (${list.filter((x) => x.e.status === s.id).length})`)]} selected={[stage === 'all' ? 'All' : `${STAGES.find((s) => s.id === stage)!.label} (${list.filter((x) => x.e.status === stage).length})`]} onToggle={(v) => setStage(v === 'All' ? 'all' : STAGES.find((s) => v.startsWith(s.label))!.id)} />
                {canCompare && (
                  <Text size={12} color={colors.textMuted}>
                    Tick up to four to compare side by side.
                  </Text>
                )}
              </View>
            ) : null
          }
          ListEmptyComponent={<EmptyState icon="bookmark-outline" art="garland" title="No vendors saved yet" message="Tap the bookmark icon on any venue or vendor to save it here and track your conversations." actionLabel="Browse vendors" onAction={() => router.navigate('/vendors')} />}
          renderItem={({ item: { e, p } }) => {
            const ticked = compare.includes(p.id);
            return (
              <Card padded={false} style={{ overflow: 'hidden' }}>
                <Pressable onPress={() => router.push(p.kind === 'venue' ? { pathname: '/venue/[id]', params: { id: p.id } } : { pathname: '/vendor/[id]', params: { id: p.id } })} style={styles.row}>
                  <Photo source={photos[p.image]} style={styles.image} contentFit="cover" />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text size={12} weight="medium" color={colors.textMuted}>
                      {serviceName(p.serviceId)}
                    </Text>
                    <Text size={15} weight="bold" color={colors.textStrong} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text size={12} color={colors.textMuted} numberOfLines={1}>
                      ★ {p.rating.toFixed(1)} · {p.city} · from {formatMoney(p.startingPrice)}
                    </Text>
                    <Text size={11} color={colors.textMuted}>
                      Saved {timeAgo(e.addedAt)}
                      {e.tags.length ? ` · ${e.tags.join(', ')}` : ''}
                    </Text>
                  </View>
                  {canCompare && (
                    <Pressable onPress={() => setCompare((c) => (ticked ? c.filter((x) => x !== p.id) : [...c, p.id].slice(-4)))} hitSlop={10} accessibilityLabel="Compare">
                      <Ionicons name={ticked ? 'checkbox' : 'square-outline'} size={24} color={ticked ? colors.primary : colors.textSubtle} />
                    </Pressable>
                  )}
                </Pressable>
                {!!e.notes && (
                  <Text size={13} color={colors.text} style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
                    “{e.notes}”
                  </Text>
                )}
                <View style={[styles.actions, { borderTopColor: colors.divider }]}>
                  <Pressable onPress={() => { setEditing(p.id); setNotes(e.notes ?? ''); }} style={styles.action}>
                    <StatusPill status={e.status} label={STAGES.find((s) => s.id === e.status)!.label} />
                    <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
                  </Pressable>
                  <View style={{ flex: 1 }} />
                  <Pressable onPress={() => { startChat({ id: p.id, name: p.name, image: p.image }); if (e.status === 'saved') updateShortlist(account.id, p.id, { status: 'contacted' }); }} style={styles.action} accessibilityLabel={`Chat with ${p.name}`}>
                    <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
                    <Text size={13} weight="semibold" color={colors.primary}>
                      Chat
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => remove(p)} style={styles.action} accessibilityLabel={`Remove ${p.name}`}>
                    <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
              </Card>
            );
          }}
        />
      ) : (
        <FlatList
          data={photosLiked}
          numColumns={2}
          keyExtractor={(p) => p.id}
          columnWrapperStyle={{ gap: 4 }}
          contentContainerStyle={{ gap: 4 }}
          renderItem={({ item }) => <PhotoTile photo={item} width={(width - 4) / 2} />}
          ListEmptyComponent={<EmptyState icon="heart-outline" title="No photos saved yet" message="Like photos in Ideas, then group them into mood boards." actionLabel="Explore ideas" onAction={() => router.navigate('/ideas')} />}
        />
      )}
      {tab === 'vendors' && compare.length > 0 && (
        <View style={styles.footer}>
          <KButton label={compare.length < 2 ? 'Pick one more to compare' : `Compare ${compare.length}`} icon="git-compare-outline" missing={compare.length < 2 && 'Pick at least two vendors to compare'} onPress={() => router.push({ pathname: '/compare', params: { ids: compare.join(',') } })} style={{ flex: 1 }} />
          <KButton label="Clear" variant="ghost" onPress={() => setCompare([])} />
        </View>
      )}
      <Sheet visible={!!current} onClose={() => setEditing(null)} title={current?.p.name}>
        {current && (
          <View style={{ paddingHorizontal: 20, gap: 12 }}>
            <Text size={13} weight="semibold" color={colors.textMuted}>
              Stage
            </Text>
            <ChoiceChips options={STAGES.map((s) => s.label)} selected={[STAGES.find((s) => s.id === current.e.status)!.label]} onToggle={(l) => updateShortlist(account.id, current.p.id, { status: STAGES.find((s) => s.label === l)!.id })} />
            <Text size={13} weight="semibold" color={colors.textMuted}>
              Tags
            </Text>
            <ChoiceChips options={TAGS} selected={current.e.tags} onToggle={(tag) => updateShortlist(account.id, current.p.id, { tags: current.e.tags.includes(tag) ? current.e.tags.filter((x) => x !== tag) : [...current.e.tags, tag] })} />
            <KField label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Price quoted, what you liked, questions to ask…" />
            <KButton
              label="Save"
              onPress={() => {
                updateShortlist(account.id, current.p.id, { notes: notes.trim() || undefined });
                setEditing(null);
              }}
            />
          </View>
        )}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgSoft },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  image: { width: 64, height: 64, borderRadius: 8 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, padding: 14, paddingBottom: 26, backgroundColor: colors.white, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
