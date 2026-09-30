import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { VenueCardSkeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { colors, GUTTER } from '@/constants/theme';
import { useDebounce } from '@/hooks/useDebounce';
import { useVenues } from '@/hooks/queries';
import { countActiveFilters, DEFAULT_VENUE_FILTERS } from '@/services/api';
import { selectShortlistCount, useAppStore } from '@/store/useAppStore';
import type { CollectionId, VenueFilters, VenueType } from '@/types';

import { FloatingFilterBar } from './FloatingFilterBar';
import { VenueCard } from './VenueCard';
import { VenueFilterSheet } from './VenueFilterSheet';

/** Shared by the VENUES tab and the collection pages. */
export function VenueListScreen({
  title,
  collection,
  initialTypes = [],
  onBack,
}: {
  title: string;
  collection?: CollectionId;
  initialTypes?: VenueType[];
  onBack?: () => void;
}) {
  const city = useAppStore((s) => s.city);
  const shortlistCount = useAppStore(selectShortlistCount);
  const [query, setQuery] = useState('');
  const [destinationPricing, setDestinationPricing] = useState(collection === 'destination');
  const [filters, setFilters] = useState<VenueFilters>({ ...DEFAULT_VENUE_FILTERS, types: initialTypes });
  const [filterOpen, setFilterOpen] = useState(false);
  const debouncedQuery = useDebounce(query);

  const { data, isLoading, isError, refetch, isRefetching } = useVenues({
    city,
    query: debouncedQuery,
    collection,
    filters,
    destinationPricing,
  });
  const activeCount = countActiveFilters(filters) + (destinationPricing ? 1 : 0);

  const header = (
    <View>
      <View style={styles.searchRow}>
        <SearchBar
          placeholder="Search by name or area"
          value={query}
          onChangeText={setQuery}
          style={{ flex: 1 }}
          height={44}
        />
      </View>
      <View style={styles.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text size={15} weight="medium" color={colors.heading}>
            Destination pricing
          </Text>
          <Text size={13} color={colors.textMuted}>
            Show 2-day packages with rooms included
          </Text>
        </View>
        <Toggle value={destinationPricing} onValueChange={setDestinationPricing} accessibilityLabel="Destination pricing" />
      </View>
      {!!data && (
        <Text size={13} color={colors.textMuted} style={styles.count}>
          {data.length} {data.length === 1 ? 'venue' : 'venues'}
        </Text>
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={title}
        onBack={onBack}
        right={
          <IconButton
            icon="bookmark-outline"
            iconSize={21}
            badge={shortlistCount}
            accessibilityLabel="Shortlist"
            onPress={() => router.push('/shortlist')}
          />
        }
      />
      <FlatList
        data={isLoading ? [] : data}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => <VenueCard venue={item} destinationPricing={destinationPricing} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          isLoading ? (
            <View>
              <VenueCardSkeleton />
              <VenueCardSkeleton />
            </View>
          ) : isError ? (
            <ErrorState onRetry={refetch} />
          ) : (
            <EmptyState
              icon="business-outline"
              title="No venues match"
              message="Try removing some filters or switching to another city."
              actionLabel={activeCount || query ? 'Clear filters' : 'Change city'}
              onAction={() => {
                if (activeCount || query) {
                  setFilters(DEFAULT_VENUE_FILTERS);
                  setDestinationPricing(false);
                  setQuery('');
                } else router.push('/select-city');
              }}
            />
          )
        }
        contentContainerStyle={{ paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={3}
        windowSize={7}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />}
      />
      <FloatingFilterBar count={activeCount} onFilter={() => setFilterOpen(true)} onGenie={() => router.navigate('/genie')} />
      <VenueFilterSheet visible={filterOpen} value={filters} onApply={setFilters} onClose={() => setFilterOpen(false)} resultCount={data?.length} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: GUTTER, paddingTop: 12 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: GUTTER,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  count: { paddingHorizontal: GUTTER, paddingTop: 12 },
});
