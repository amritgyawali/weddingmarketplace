import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';

import { PhotoTile } from '@/components/ideas/PhotoTile';
import { VendorCard } from '@/components/listing/VendorCard';
import { VenueCard } from '@/components/listing/VenueCard';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { VenueCardSkeleton } from '@/components/ui/Skeleton';
import { colors, GUTTER } from '@/constants/theme';
import { IDEA_PHOTOS } from '@/data/ideas';
import { useShortlistedVendors, useShortlistedVenues } from '@/hooks/queries';
import { useAppStore } from '@/store/useAppStore';

type Tab = 'venues' | 'vendors' | 'photos';

export default function ShortlistScreen() {
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const [tab, setTab] = useState<Tab>(params.tab ?? 'venues');
  const { width } = useWindowDimensions();
  const shortlist = useAppStore((s) => s.shortlist);
  const liked = useAppStore((s) => s.likedPhotos);
  const venues = useShortlistedVenues(shortlist.venues);
  const vendors = useShortlistedVendors(shortlist.vendors);
  const photos = IDEA_PHOTOS.filter((p) => liked.includes(p.id));

  const counts = { venues: shortlist.venues.length, vendors: shortlist.vendors.length, photos: photos.length };

  const tabs = (
    <View style={styles.tabs}>
      {(['venues', 'vendors', 'photos'] as Tab[]).map((t) => (
        <Chip key={t} label={`${t[0].toUpperCase()}${t.slice(1)} (${counts[t]})`} selected={tab === t} onPress={() => setTab(t)} />
      ))}
    </View>
  );

  const empty = (label: string, action: () => void, actionLabel: string) => (
    <EmptyState icon="bookmark-outline" title={`No ${label} saved yet`} message="Tap the bookmark icon to save favourites and compare them later." actionLabel={actionLabel} onAction={action} />
  );

  return (
    <View style={styles.root}>
      <ScreenHeader title="My Shortlist" />
      {tabs}
      {tab === 'venues' && (
        <FlatList
          data={venues.data?.filter((v) => shortlist.venues.includes(v.id))}
          keyExtractor={(v) => v.id}
          renderItem={({ item }) => <VenueCard venue={item} />}
          ListEmptyComponent={venues.isLoading && counts.venues ? <VenueCardSkeleton /> : empty('venues', () => router.navigate('/venues'), 'Browse venues')}
        />
      )}
      {tab === 'vendors' && (
        <FlatList
          data={vendors.data?.filter((v) => shortlist.vendors.includes(v.id))}
          keyExtractor={(v) => v.id}
          renderItem={({ item }) => <VendorCard vendor={item} />}
          ListEmptyComponent={vendors.isLoading && counts.vendors ? <VenueCardSkeleton /> : empty('vendors', () => router.navigate('/vendors'), 'Browse vendors')}
        />
      )}
      {tab === 'photos' && (
        <FlatList
          data={photos}
          numColumns={2}
          keyExtractor={(p) => p.id}
          columnWrapperStyle={{ gap: 4 }}
          contentContainerStyle={{ gap: 4 }}
          renderItem={({ item }) => <PhotoTile photo={item} width={(width - 4) / 2} />}
          ListEmptyComponent={empty('photos', () => router.navigate('/ideas'), 'Explore ideas')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: GUTTER, paddingVertical: 12, flexWrap: 'wrap' },
});
