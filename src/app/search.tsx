import { Ionicons } from '@expo/vector-icons';
import { Photo } from '@/components/ui/Photo';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, SectionList, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Text } from '@/components/ui/Text';
import { photo } from '@/constants/images';
import { colors, fonts, GUTTER, inputReset, radius } from '@/constants/theme';
import { findCategory } from '@/data/categories';
import { POPULAR_SEARCHES } from '@/data/ideas';
import { useDebounce } from '@/hooks/useDebounce';
import { useSearch } from '@/hooks/queries';
import { useAppStore } from '@/store/useAppStore';
import type { SearchResult } from '@/types';
import { formatMoney } from '@/utils/format';
import { tr } from '@/i18n';

const SECTION_TITLES: Record<SearchResult['kind'], string> = {
  category: 'Categories',
  venue: 'Venues',
  vendor: 'Vendors',
  idea: 'Ideas & Photos',
};

function openResult(r: SearchResult) {
  switch (r.kind) {
    case 'venue':
      return router.push({ pathname: '/venue/[id]', params: { id: r.item.id } });
    case 'vendor':
      return router.push({ pathname: '/vendor/[id]', params: { id: r.item.id } });
    case 'idea':
      return router.push({ pathname: '/idea/[id]', params: { id: r.item.id } });
    case 'category':
      return r.item.categoryId === 'venues'
        ? router.push({ pathname: '/collection/[id]', params: { id: r.item.id } })
        : router.push({ pathname: '/vendors/[category]', params: { category: r.item.categoryId, sub: r.item.id } });
  }
}

function ResultRow({ result }: { result: SearchResult }) {
  let image, title: string, subtitle: string;
  switch (result.kind) {
    case 'venue':
      image = photo(result.item.images[0]);
      title = result.item.name;
      subtitle = `${result.item.type} · ${result.item.city} · ${formatMoney(result.item.vegPerPlate)}/plate`;
      break;
    case 'vendor':
      image = photo(result.item.images[0]);
      title = result.item.name;
      subtitle = `${findCategory(result.item.categoryId)?.title} · ${result.item.city} · ★ ${result.item.rating}`;
      break;
    case 'idea':
      image = photo(result.item.image);
      title = result.item.title;
      subtitle = result.item.category;
      break;
    case 'category':
      title = result.item.title;
      subtitle = `Browse all ${result.item.title.toLowerCase()}`;
  }

  return (
    <Pressable
      onPress={() => openResult(result)}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.bgSoft }]}>
      {image ? (
        <Photo source={image} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, styles.catThumb]}>
          <Ionicons name="grid-outline" size={20} color={colors.primary} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text size={16} weight="medium" color={colors.heading} numberOfLines={1}>
          {title}
        </Text>
        <Text size={13} color={colors.textMuted} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Ionicons name="arrow-forward" size={18} color={colors.textSubtle} style={{ transform: [{ rotate: '-45deg' }] }} />
    </Pressable>
  );
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const city = useAppStore((s) => s.city);
  const recent = useAppStore((s) => s.recentSearches);
  const addRecentSearch = useAppStore((s) => s.addRecentSearch);
  const clearRecent = useAppStore((s) => s.clearRecentSearches);
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 220);
  const { data, isFetching } = useSearch(debounced, city);
  const showResults = debounced.trim().length > 1;

  // Keep the API's relevance ordering: section order = first appearance of each kind.
  const kinds = [...new Set((data ?? []).map((r) => r.kind))];
  const sections = kinds.map((kind) => ({ title: SECTION_TITLES[kind], data: (data ?? []).filter((r) => r.kind === kind) }));

  const runSearch = (term: string) => {
    setQuery(term);
    addRecentSearch(term);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 10 }]}>
      <View style={styles.bar}>
        <Ionicons name="search-outline" size={20} color={colors.placeholder} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          autoFocus
          placeholder={tr('Search...')}
          placeholderTextColor={colors.placeholder}
          returnKeyType="search"
          onSubmitEditing={() => addRecentSearch(query)}
          autoCorrect={false}
          style={[styles.input, inputReset]}
          selectionColor={colors.primary}
        />
        {isFetching && showResults && <ActivityIndicator size="small" color={colors.primary} />}
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
          <Text size={17} color={colors.text}>
            Cancel
          </Text>
        </Pressable>
      </View>

      {!showResults ? (
        <Animated.View entering={FadeIn} style={styles.suggestions}>
          {recent.length > 0 && (
            <>
              <View style={styles.headRow}>
                <Text size={20} weight="semibold" color={colors.heading}>
                  Recent Searches
                </Text>
                <Pressable onPress={clearRecent} hitSlop={8}>
                  <Text size={14} weight="semibold" color={colors.primary}>
                    Clear
                  </Text>
                </Pressable>
              </View>
              <View style={styles.chips}>
                {recent.map((r) => (
                  <Chip key={r} label={r} leading={<Ionicons name="time-outline" size={15} color={colors.textMuted} />} onPress={() => runSearch(r)} />
                ))}
              </View>
            </>
          )}
          <Text size={20} weight="semibold" color={colors.heading} style={{ marginTop: recent.length ? 26 : 0, marginBottom: 12 }}>
            Popular Searches
          </Text>
          <View style={styles.chips}>
            {POPULAR_SEARCHES.map((s) => (
              <Chip key={s} label={s} variant="outline" onPress={() => runSearch(s)} />
            ))}
          </View>
        </Animated.View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(r) => `${r.kind}-${r.item.id}`}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}
          renderSectionHeader={({ section }) => (
            <Text size={13} weight="medium" color={colors.textMuted} style={styles.sectionTitle}>
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => <ResultRow result={item} />}
          ListEmptyComponent={
            !isFetching ? (
              <EmptyState icon="search-outline" title={`No results for “${debounced}”`} message="Check the spelling or try a broader term like “photographers” or “venues”." />
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: GUTTER - 10,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    backgroundColor: colors.bgMuted,
  },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 17, color: colors.textStrong, paddingVertical: 0, height: '100%' },
  suggestions: { paddingHorizontal: GUTTER - 10, paddingTop: 26 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sectionTitle: { paddingHorizontal: GUTTER, paddingTop: 22, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: GUTTER, paddingVertical: 10 },
  thumb: { width: 52, height: 52, borderRadius: radius.sm, backgroundColor: colors.bgMuted },
  catThumb: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
});
