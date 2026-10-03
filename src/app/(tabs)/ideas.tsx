import { Ionicons } from '@expo/vector-icons';
import { Photo } from '@/components/ui/Photo';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PhotoTile } from '@/components/ideas/PhotoTile';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { SearchBar } from '@/components/ui/SearchBar';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { photos } from '@/constants/images';
import { colors, GUTTER, radius } from '@/constants/theme';
import { IDEA_CATEGORIES } from '@/data/ideas';
import { useDebounce } from '@/hooks/useDebounce';
import { useIdeas, useRealWeddings, useStories } from '@/hooks/queries';
import { useAppStore } from '@/store/useAppStore';
import type { IdeaCategory } from '@/types';

type Tab = 'photos' | 'stories' | 'real';
const TABS: { id: Tab; label: string }[] = [
  { id: 'photos', label: 'Photos' },
  { id: 'stories', label: 'Stories' },
  { id: 'real', label: 'Real weddings' },
];
const GAP = 4;

function TopTabs({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
  const { width } = useWindowDimensions();
  const tabWidth = width / TABS.length;
  const index = TABS.findIndex((t) => t.id === value);
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: withTiming(index * tabWidth, { duration: 220 }) }] }));

  return (
    <View style={styles.tabs}>
      {TABS.map((t) => (
        <Pressable
          key={t.id}
          onPress={() => onChange(t.id)}
          accessibilityRole="tab"
          accessibilityState={{ selected: t.id === value }}
          style={styles.tab}>
          <Text size={15} weight={t.id === value ? 'semibold' : 'regular'} color={t.id === value ? colors.heading : colors.textMuted} align="center" lineHeight={20}>
            {t.label}
          </Text>
        </Pressable>
      ))}
      <Animated.View style={[styles.indicator, { width: tabWidth }, indicator]} />
    </View>
  );
}

function PhotosPane() {
  const { width } = useWindowDimensions();
  const tileWidth = (width - GAP) / 2;
  const likedPhotos = useAppStore((s) => s.likedPhotos);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<IdeaCategory | null>(null);
  const [onlyLiked, setOnlyLiked] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const debounced = useDebounce(query);
  const { data, isLoading } = useIdeas({ query: debounced, category });
  const list = onlyLiked ? data?.filter((p) => likedPhotos.includes(p.id)) : data;
  const filterCount = (category ? 1 : 0) + (onlyLiked ? 1 : 0);

  return (
    <>
      <FlatList
        data={list}
        numColumns={2}
        keyExtractor={(p) => p.id}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={{ gap: GAP, paddingBottom: 30 }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => <PhotoTile photo={item} width={tileWidth} />}
        ListHeaderComponent={
          <View style={styles.searchRow}>
            <SearchBar placeholder="Mehendi, mandap, lehenga…" value={query} onChangeText={setQuery} style={{ flex: 1 }} height={42} />
            <PressableScale onPress={() => setFilterOpen(true)} accessibilityLabel="Filter photos" style={styles.filterBtn}>
              <Ionicons name="options-outline" size={18} color={colors.heading} />
              <Text size={14} weight="medium" color={colors.heading}>
                Filter{filterCount ? ` · ${filterCount}` : ''}
              </Text>
            </PressableScale>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={{ flexDirection: 'row', gap: GAP }}>
              <Skeleton width={tileWidth} height={tileWidth * 1.33} borderRadius={0} />
              <Skeleton width={tileWidth} height={tileWidth * 1.33} borderRadius={0} />
            </View>
          ) : (
            <EmptyState
              icon={onlyLiked ? 'heart-outline' : 'images-outline'}
              title={onlyLiked ? 'No liked photos yet' : 'No photos found'}
              message={onlyLiked ? 'Tap the heart on any photo to save it here.' : 'Try a different keyword or filter.'}
            />
          )
        }
      />
      <Sheet visible={filterOpen} onClose={() => setFilterOpen(false)} title="Filter photos">
        <View style={styles.sheetBody}>
          <View style={styles.chipWrap}>
            <Chip label="All" selected={!category} onPress={() => setCategory(null)} />
            {IDEA_CATEGORIES.map((c) => (
              <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />
            ))}
          </View>
          <Chip
            label="Only my liked photos"
            leading={<Ionicons name={onlyLiked ? 'heart' : 'heart-outline'} size={16} color={colors.primary} />}
            selected={onlyLiked}
            onPress={() => setOnlyLiked((v) => !v)}
            style={{ alignSelf: 'flex-start' }}
          />
          <Button label="Show photos" onPress={() => setFilterOpen(false)} />
        </View>
      </Sheet>
    </>
  );
}

function StoriesPane() {
  const { data, isLoading } = useStories();
  return (
    <FlatList
      data={data}
      keyExtractor={(s) => s.id}
      contentContainerStyle={{ padding: GUTTER, gap: 24, paddingBottom: 30 }}
      ListEmptyComponent={isLoading ? <Skeleton height={260} borderRadius={radius.lg} /> : null}
      renderItem={({ item }) => (
        <PressableScale onPress={() => router.push({ pathname: '/story/[id]', params: { id: item.id } })} accessibilityLabel={item.title}>
          <Photo source={photos[item.image]} style={styles.storyImage} contentFit="cover" transition={200} />
          <Text size={13} weight="medium" color={colors.primary} style={{ marginTop: 10 }}>
            {item.category}
          </Text>
          <Text serif size={19} weight="bold" color={colors.heading} lineHeight={27} style={{ marginTop: 2 }}>
            {item.title}
          </Text>
          <Text size={14} color={colors.textMuted} style={{ marginTop: 4 }} numberOfLines={2}>
            {item.excerpt}
          </Text>
          <Text size={12} color={colors.textMuted} style={{ marginTop: 6 }}>
            {item.author} · {item.readMinutes} min read
          </Text>
        </PressableScale>
      )}
    />
  );
}

function RealWeddingsPane() {
  const { data, isLoading } = useRealWeddings();
  return (
    <FlatList
      data={data}
      keyExtractor={(w) => w.id}
      contentContainerStyle={{ padding: GUTTER, gap: 28, paddingBottom: 30 }}
      ListEmptyComponent={isLoading ? <Skeleton height={300} borderRadius={radius.lg} /> : null}
      renderItem={({ item }) => (
        <PressableScale onPress={() => router.push({ pathname: '/real-wedding/[id]', params: { id: item.id } })} accessibilityLabel={`${item.couple} wedding`}>
          <Photo source={photos[item.cover]} style={styles.realCover} contentFit="cover" transition={200} />
          <View style={styles.thumbs}>
            {item.gallery.slice(0, 3).map((g, i) => (
              <Photo key={`${g}${i}`} source={photos[g]} style={styles.thumb} contentFit="cover" />
            ))}
          </View>
          <Text serif size={19} weight="bold" color={colors.heading} lineHeight={27} style={{ marginTop: 10 }}>
            {item.couple}
          </Text>
          <Text size={14} color={colors.textMuted}>
            {item.city} · {item.theme} · {item.venue}
          </Text>
        </PressableScale>
      )}
    />
  );
}

export default function IdeasTab() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const [tab, setTab] = useState<Tab>(params.tab ?? 'photos');
  const [lastParam, setLastParam] = useState(params.tab);
  // Deep links such as "Real Weddings → View all" switch the active pane.
  if (params.tab !== lastParam) {
    setLastParam(params.tab);
    if (params.tab) setTab(params.tab);
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text size={23} weight="bold" color={colors.heading}>
          Ideas
        </Text>
        <View style={styles.headerRight}>
          <IconButton icon="search-outline" accessibilityLabel="Search" onPress={() => router.push('/search')} />
          <IconButton icon="heart-outline" accessibilityLabel="Liked photos" onPress={() => router.push({ pathname: '/shortlist', params: { tab: 'photos' } })} />
        </View>
      </View>
      <TopTabs value={tab} onChange={setTab} />
      <View style={{ flex: 1 }}>
        {tab === 'photos' && <PhotosPane />}
        {tab === 'stories' && <StoriesPane />}
        {tab === 'real' && <RealWeddingsPane />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: GUTTER,
    paddingRight: GUTTER - 8,
    paddingBottom: 4,
  },
  headerRight: { flexDirection: 'row', gap: 2 },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  tab: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' },
  indicator: { position: 'absolute', bottom: -1, left: 0, height: 2, backgroundColor: colors.heading },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: GUTTER, paddingVertical: 12 },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sheetBody: { paddingHorizontal: 20, gap: 18 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  storyImage: { width: '100%', aspectRatio: 16 / 10, borderRadius: radius.lg, backgroundColor: colors.bgMuted },
  realCover: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg, backgroundColor: colors.bgMuted },
  thumbs: { flexDirection: 'row', gap: 6, marginTop: 6 },
  thumb: { flex: 1, aspectRatio: 1, borderRadius: radius.sm, backgroundColor: colors.bgMuted },
});
