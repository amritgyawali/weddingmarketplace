import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { VendorCard } from '@/components/listing/VendorCard';
import { Chip } from '@/components/ui/Chip';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { GenieFab } from '@/components/ui/GenieFab';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { Sheet } from '@/components/ui/Sheet';
import { VenueCardSkeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { colors, GUTTER } from '@/constants/theme';
import { ALL_CITIES } from '@/data/cities';
import { categoriesFor, findCategory } from '@/data/categories';
import { SERVICES } from '@/data/services';
import { useExperience } from '@/hooks/useExperience';
import { useDebounce } from '@/hooks/useDebounce';
import { useVendors } from '@/hooks/queries';
import { selectShortlistCount, useAppStore } from '@/store/useAppStore';

type Sort = 'popular' | 'rating' | 'priceLow' | 'priceHigh';
const SORTS: { id: Sort; label: string }[] = [
  { id: 'popular', label: 'Popularity' },
  { id: 'rating', label: 'Rating' },
  { id: 'priceLow', label: 'Price: Low to High' },
  { id: 'priceHigh', label: 'Price: High to Low' },
];

export default function VendorListingScreen() {
  const params = useLocalSearchParams<{ category: string; sub?: string }>();
  const exp = useExperience();
  // Only the services the active occasion lists; a category it doesn't list at all stays browsable from a deep link.
  const category = categoriesFor(exp.occasion?.services ?? SERVICES.map((s) => s.id)).find((c) => c.id === params.category) ?? findCategory(params.category);
  const city = useAppStore((s) => s.city);
  const shortlistCount = useAppStore(selectShortlistCount);
  const [sub, setSub] = useState<string | undefined>(params.sub);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('popular');
  const [sortOpen, setSortOpen] = useState(false);
  const debounced = useDebounce(query);

  const { data, isLoading, isError, refetch, isRefetching } = useVendors({
    categoryId: params.category,
    subcategoryId: sub,
    city,
    query: debounced,
    sort,
  });

  if (!category) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Vendors" />
        <EmptyState icon="alert-circle-outline" title="Category not found" actionLabel="Go back" onAction={() => router.back()} />
      </View>
    );
  }

  const subTitle = category.subcategories.find((s) => s.id === sub)?.title ?? category.title;
  const list = data?.filter((v) => category.id === 'venues' || category.subcategories.some((s) => s.id === v.subcategoryId));

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={`${city === ALL_CITIES ? 'All Cities' : city} • ${subTitle}`}
        right={<IconButton icon="bookmark" iconSize={18} badge={shortlistCount} accessibilityLabel="Shortlist" onPress={() => router.push('/shortlist')} />}
      />
      <FlatList
        data={isLoading ? [] : list}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => <VendorCard vendor={item} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={3}
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />}
        ListHeaderComponent={
          <View style={{ paddingTop: 14, gap: 12 }}>
            {category.subcategories.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                <Chip label="All" selected={!sub} onPress={() => setSub(undefined)} />
                {category.subcategories.map((s) => (
                  <Chip key={s.id} label={s.title} selected={sub === s.id} onPress={() => setSub(s.id)} />
                ))}
              </ScrollView>
            )}
            <View style={styles.searchRow}>
              <SearchBar placeholder={`Search ${subTitle}...`} value={query} onChangeText={setQuery} style={{ flex: 1 }} />
              <IconButton icon="swap-vertical" size={42} accessibilityLabel="Sort" onPress={() => setSortOpen(true)} />
            </View>
            {!!data && (
              <Text size={13} color={colors.textMuted} style={{ paddingHorizontal: GUTTER }}>
                {list?.length ?? 0} {subTitle.toLowerCase()} · sorted by {SORTS.find((s) => s.id === sort)!.label.toLowerCase()}
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <VenueCardSkeleton />
          ) : isError ? (
            <ErrorState onRetry={refetch} />
          ) : (
            <EmptyState
              icon="people-outline"
              title={`No ${subTitle.toLowerCase()} found`}
              message={city === ALL_CITIES ? 'Try a different search.' : `We don't have listings in ${city} yet. Try another city.`}
              actionLabel="Change city"
              onAction={() => router.push('/select-city')}
            />
          )
        }
      />
      <GenieFab bottom={24} />

      <Sheet visible={sortOpen} onClose={() => setSortOpen(false)} title="Sort by">
        <View style={styles.sortList}>
          {SORTS.map((s) => (
            <Chip
              key={s.id}
              label={s.label}
              selected={sort === s.id}
              onPress={() => {
                setSort(s.id);
                setSortOpen(false);
              }}
              style={{ alignSelf: 'flex-start' }}
            />
          ))}
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  chips: { paddingHorizontal: GUTTER, gap: 8 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: GUTTER },
  sortList: { paddingHorizontal: 20, gap: 12, paddingBottom: 8 },
});
