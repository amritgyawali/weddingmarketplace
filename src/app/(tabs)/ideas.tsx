import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PhotoTile } from '@/components/ideas/PhotoTile';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { GenieFab } from '@/components/ui/GenieFab';
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
  { id: 'real', label: 'Real\nWeddings' },
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
          <Text size={18} weight={t.id === value ? 'semibold' : 'medium'} color={t.id === value ? colors.primary : colors.textStrong} align="center" lineHeight={22}>
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
        contentContainerStyle={{ gap: GAP, paddingBottom: 110 }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => <PhotoTile photo={item} width={tileWidth} />}
        ListHeaderComponent={
          <View style={styles.searchRow}>
            <SearchBar placeholder="Search Photos..." value={query} onChangeText={setQuery} style={{ flex: 1 }} height={44} />
            <PressableScale onPress={() => setFilterOpen(true)} accessibilityLabel="Filter photos" style={styles.filterBtn}>
              <Ionicons name="options-outline" size={20} color={colors.text} />
              <Text size={15} weight="medium" color={colors.text}>
                Filter{filterCount ? ` (${filterCount})` : ''}
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
      contentContainerStyle={{ padding: GUTTER, gap: 22, paddingBottom: 110 }}
      ListEmptyComponent={isLoading ? <Skeleton height={260} borderRadius={radius.lg} /> : null}
      renderItem={({ item }) => (
        <PressableScale onPress={() => router.push({ pathname: '/story/[id]', params: { id: item.id } })} accessibilityLabel={item.title} activeScale={0.98}>
          <Image source={photos[item.image]} style={styles.storyImage} contentFit="cover" transition={200} />
          <Text size={12} weight="bold" color={colors.primary} tracking={0.8} style={{ marginTop: 12 }}>
            {item.category.toUpperCase()}
          </Text>
          <Text size={18} weight="bold" color={colors.heading} lineHeight={24} style={{ marginTop: 4 }}>
            {item.title}
          </Text>
          <Text size={14} color={colors.textMuted} style={{ marginTop: 4 }} numberOfLines={2}>
            {item.excerpt}
          </Text>
          <Text size={12} color={colors.textSubtle} style={{ marginTop: 6 }}>
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
      contentContainerStyle={{ padding: GUTTER, gap: 26, paddingBottom: 110 }}
      ListEmptyComponent={isLoading ? <Skeleton height={300} borderRadius={radius.lg} /> : null}
      renderItem={({ item }) => (
        <PressableScale onPress={() => router.push({ pathname: '/real-wedding/[id]', params: { id: item.id } })} accessibilityLabel={`${item.couple} wedding`} activeScale={0.98}>
          <Image source={photos[item.cover]} style={styles.realCover} contentFit="cover" transition={200} />
          <View style={styles.thumbs}>
            {item.gallery.slice(0, 3).map((g, i) => (
              <Image key={`${g}${i}`} source={photos[g]} style={styles.thumb} contentFit="cover" />
            ))}
          </View>
          <Text size={19} weight="bold" color={colors.heading} style={{ marginTop: 12 }}>
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
        <View style={{ width: 84 }} />
        <Text size={21} weight="semibold" color={colors.heading}>
          Ideas
        </Text>
        <View style={styles.headerRight}>
          <IconButton icon="search" size={38} accessibilityLabel="Search" onPress={() => router.push('/search')} />
          <IconButton icon="heart" size={38} accessibilityLabel="Liked photos" onPress={() => router.push({ pathname: '/shortlist', params: { tab: 'photos' } })} />
        </View>
      </View>
      <TopTabs value={tab} onChange={setTab} />
      <View style={{ flex: 1 }}>
        {tab === 'photos' && <PhotosPane />}
        {tab === 'stories' && <StoriesPane />}
        {tab === 'real' && <RealWeddingsPane />}
      </View>
      <GenieFab bottom={18} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GUTTER - 4,
    paddingBottom: 6,
  },
  headerRight: { flexDirection: 'row', gap: 10, width: 84, justifyContent: 'flex-end' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.hairline },
  tab: { flex: 1, height: 64, alignItems: 'center', justifyContent: 'center' },
  indicator: { position: 'absolute', bottom: -1, left: 0, height: 3, backgroundColor: colors.primary },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 16 },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: colors.bgMuted,
  },
  sheetBody: { paddingHorizontal: 20, gap: 18 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  storyImage: { width: '100%', aspectRatio: 16 / 10, borderRadius: radius.lg, backgroundColor: colors.bgMuted },
  realCover: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg, backgroundColor: colors.bgMuted },
  thumbs: { flexDirection: 'row', gap: 6, marginTop: 6 },
  thumb: { flex: 1, aspectRatio: 1, borderRadius: radius.sm, backgroundColor: colors.bgMuted },
});
