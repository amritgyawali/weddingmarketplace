import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { CategoryCircles } from '@/components/home/CategoryCircles';
import { ChecklistCard } from '@/components/home/ChecklistCard';
import { CityHeader } from '@/components/home/CityHeader';
import { GenieBanner } from '@/components/home/GenieBanner';
import { PlanningTools } from '@/components/home/PlanningTools';
import { VenueCollections } from '@/components/home/VenueCollections';
import { VendorMiniCard, VenueMiniCard } from '@/components/listing/MiniCards';
import { EmptyState } from '@/components/ui/EmptyState';
import { GenieFab } from '@/components/ui/GenieFab';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { photos } from '@/constants/images';
import { colors, GUTTER, radius } from '@/constants/theme';
import { ALL_CITIES } from '@/data/cities';
import { useFeaturedVendors, useRealWeddings, useVenues } from '@/hooks/queries';
import { selectUnreadCount, useAppStore } from '@/store/useAppStore';

function Carousel({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
      {children}
    </ScrollView>
  );
}

function CarouselSkeleton({ width = 205, height = 164 }: { width?: number; height?: number }) {
  return (
    <Carousel>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ gap: 8 }}>
          <Skeleton width={width} height={height} borderRadius={radius.lg} />
          <Skeleton width={width * 0.7} height={14} />
          <Skeleton width={width * 0.45} height={12} />
        </View>
      ))}
    </Carousel>
  );
}

export default function ForYouScreen() {
  const city = useAppStore((s) => s.city);
  const unread = useAppStore(selectUnreadCount);
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const venues = useVenues({ city });
  const photographers = useFeaturedVendors(city, 'photographers');
  const makeup = useFeaturedVendors(city, 'makeup');
  const realWeddings = useRealWeddings();
  const cityLabel = city === ALL_CITIES ? 'across India' : `in ${city}`;

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setRefreshing(false);
  };

  return (
    <View style={styles.root}>
      <CityHeader
        right={
          <>
            <IconButton icon="search" accessibilityLabel="Search" onPress={() => router.push('/search')} />
            <IconButton icon="chatbubble" iconSize={18} badge={unread} accessibilityLabel="Messages" onPress={() => router.push('/inbox')} />
            <IconButton icon="person" iconSize={18} accessibilityLabel="Profile & menu" onPress={() => router.push('/profile')} />
          </>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}>
        <CategoryCircles />
        <PlanningTools />

        <View style={styles.section}>
          <SectionHeader title="Venues in your city" onAction={() => router.navigate('/venues')} />
          {venues.isLoading ? (
            <CarouselSkeleton />
          ) : venues.data?.length ? (
            <Carousel>
              {venues.data.slice(0, 8).map((v) => (
                <VenueMiniCard key={v.id} venue={v} />
              ))}
            </Carousel>
          ) : (
            <EmptyState
              icon="business-outline"
              title={`No venues ${cityLabel} yet`}
              message="We're onboarding venues here. Explore all cities meanwhile."
              actionLabel="Change city"
              onAction={() => router.push('/select-city')}
            />
          )}
        </View>

        <VenueCollections city={city} />

        <ChecklistCard />

        {(photographers.isLoading || !!photographers.data?.length) && (
          <View style={styles.section}>
            <SectionHeader
              title={`Top Photographers ${city === ALL_CITIES ? '' : cityLabel}`.trim()}
              onAction={() => router.push({ pathname: '/vendors/[category]', params: { category: 'photographers' } })}
            />
            {photographers.isLoading ? (
              <CarouselSkeleton width={170} height={170} />
            ) : (
              <Carousel>
                {photographers.data!.map((v) => (
                  <VendorMiniCard key={v.id} vendor={v} />
                ))}
              </Carousel>
            )}
          </View>
        )}

        <View style={styles.section}>
          <GenieBanner />
        </View>

        {!!makeup.data?.length && (
          <View style={styles.section}>
            <SectionHeader
              title="Bridal Makeup Artists"
              onAction={() => router.push({ pathname: '/vendors/[category]', params: { category: 'makeup', sub: 'bridal-makeup' } })}
            />
            <Carousel>
              {makeup.data.map((v) => (
                <VendorMiniCard key={v.id} vendor={v} />
              ))}
            </Carousel>
          </View>
        )}

        {!!realWeddings.data?.length && (
          <View style={styles.section}>
            <SectionHeader title="Real Weddings" onAction={() => router.navigate({ pathname: '/ideas', params: { tab: 'real' } })} />
            <Carousel>
              {realWeddings.data.map((w) => (
                <PressableScale
                  key={w.id}
                  accessibilityLabel={`${w.couple} real wedding`}
                  onPress={() => router.push({ pathname: '/real-wedding/[id]', params: { id: w.id } })}
                  style={styles.realCard}>
                  <Image source={photos[w.cover]} style={styles.realImage} contentFit="cover" transition={200} />
                  <Text size={16} weight="semibold" color={colors.heading} numberOfLines={1}>
                    {w.couple}
                  </Text>
                  <Text size={13} color={colors.textMuted} numberOfLines={1}>
                    {w.theme} · {w.city}
                  </Text>
                </PressableScale>
              ))}
            </Carousel>
          </View>
        )}
      </ScrollView>

      <GenieFab bottom={18} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  section: { marginTop: 34 },
  carousel: { paddingHorizontal: GUTTER, gap: 14 },
  realCard: { width: 250, gap: 4 },
  realImage: { width: 250, height: 170, borderRadius: radius.lg, marginBottom: 6, backgroundColor: colors.bgMuted },
});
