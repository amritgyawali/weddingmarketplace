import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { GenieAvatar } from '@/components/ui/GenieFab';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
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
          placeholder="Search Venues..."
          value={query}
          onChangeText={setQuery}
          style={{ flex: 1 }}
          height={44}
        />
        <PressableScale onPress={() => router.push('/assistant')} accessibilityLabel="Ask Wedika AI" activeScale={0.9}>
          <GenieAvatar size={44} ring={2} />
        </PressableScale>
      </View>
      <View style={styles.toggleRow}>
        <Text size={17} weight="medium" color={colors.heading}>
          Destination Wedding Pricing
        </Text>
        <Toggle value={destinationPricing} onValueChange={setDestinationPricing} accessibilityLabel="Destination Wedding Pricing" />
      </View>
      {!!data && (
        <Text size={13} color={colors.textMuted} style={styles.count}>
          {data.length} {data.length === 1 ? 'venue' : 'venues'} found
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
            icon="bookmark"
            iconSize={18}
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
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: GUTTER, paddingTop: 16 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GUTTER,
    paddingTop: 18,
    paddingBottom: 2,
  },
  count: { paddingHorizontal: GUTTER, paddingTop: 8 },
});
