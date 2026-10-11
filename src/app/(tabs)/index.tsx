import { Photo } from '@/components/ui/Photo';
import { router } from 'expo-router';
import { Fragment, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { CategoryCircles } from '@/components/home/CategoryCircles';
import { ContentBanner } from '@/components/home/ContentBanner';
import { ChecklistCard } from '@/components/home/ChecklistCard';
import { CityHeader } from '@/components/home/CityHeader';
import { GenieBanner } from '@/components/home/GenieBanner';
import { PlanningTools } from '@/components/home/PlanningTools';
import { SearchPrompt } from '@/components/home/SearchPrompt';
import { TourTarget, useCoupleTourOnFirstVisit } from '@/components/tour/AppTour';
import { VenueCollections } from '@/components/home/VenueCollections';
import { WeddingStrip } from '@/components/home/WeddingStrip';
import { VendorMiniCard, VenueMiniCard } from '@/components/listing/MiniCards';
import { AnnouncementBanner } from '@/components/ui/AppBanners';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';
import { PressableScale } from '@/components/ui/PressableScale';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { photo } from '@/constants/images';
import { colors, GUTTER, radius, themed } from '@/constants/theme';
import { ALL_CITIES } from '@/data/cities';
import { serviceFeature } from '@/data/features';
import { HOME_SECTION_IDS } from '@/data/homeSections';
import { SERVICE_BY_ID, SERVICES } from '@/data/services';
import { useContent } from '@/hooks/useContent';
import { useExperience } from '@/hooks/useExperience';
import { useFeatures } from '@/hooks/useFeatures';
import { useFeaturedVendors, useRealWeddings, useVendors, useVenues } from '@/hooks/queries';
import { bannerSectionId, orderSections, sectionTitle } from '@/services/content';
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

/** Top-rated vendors for one service, e.g. pandits for a pasni. Hidden when the city has none. */
function ServiceCarousel({ serviceId, city, title }: { serviceId: string; city: string; title?: string }) {
  const def = SERVICE_BY_ID[serviceId];
  const { data, isLoading } = useVendors({ categoryId: def?.group ?? '', subcategoryId: serviceId, city, sort: 'rating' });
  if (!def || (!isLoading && !data?.length)) return null;
  return (
    <View style={styles.section}>
      <SectionHeader title={title ?? def.name} onAction={() => router.push({ pathname: '/vendors/[category]', params: { category: def.group, sub: serviceId } })} />
      {isLoading ? (
        <CarouselSkeleton width={170} height={170} />
      ) : (
        <Carousel>
          {data!.slice(0, 8).map((v) => (
            <VendorMiniCard key={v.id} vendor={v} />
          ))}
        </Carousel>
      )}
    </View>
  );
}

/**
 * The couple's home. It follows the active celebration: a pasni or a
 * birthday shows its own services and checklist, and the wedding-only
 * sections (collections, bridal makeup, real weddings, planner packages)
 * stay with weddings. A super admin can switch any section off, reorder
 * them, rename their headings and add banners (Content studio → Home).
 */
export default function ForYouScreen() {
  const city = useAppStore((s) => s.city);
  const unread = useAppStore(selectUnreadCount);
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const exp = useExperience();
  const on = useFeatures();
  const content = useContent();
  useCoupleTourOnFirstVisit();

  const occasionId = exp.occasion?.id ?? 'wedding';
  const weddingLike = occasionId === 'wedding' || occasionId === 'engagement';
  const services = exp.occasion?.services ?? SERVICES.map((s) => s.id);
  const offers = (id: string) => services.includes(id) && on(serviceFeature(id));
  /** Services this celebration needs most that the sections above don't already cover. */
  const picks = (exp.occasion?.defaultServices ?? []).filter((s) => !['venue', 'photography', 'makeup'].includes(s) && offers(s)).slice(0, 3);

  const venues = useVenues({ city });
  const photographers = useFeaturedVendors(city, 'photo-video');
  const makeup = useFeaturedVendors(city, 'beauty');
  const realWeddings = useRealWeddings();
  const cityLabel = city === ALL_CITIES ? 'across Nepal' : `in ${city}`;
  const cityName = city === ALL_CITIES ? 'Nepal' : city;
  /** A section heading: the super admin's wording, else the built-in one. */
  const heading = (id: string, fallback: string) => sectionTitle(id, fallback, cityName, content);
  const photoList = photographers.data?.filter((v) => v.subcategoryId === 'photography');
  const makeupList = makeup.data?.filter((v) => v.subcategoryId === 'makeup');

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setRefreshing(false);
  };

  const sections: Record<string, React.ReactNode> = {
    strip: <WeddingStrip />,
    categories: on('home.categories') && <CategoryCircles />,
    planning: on('home.planning') && <PlanningTools />,
    venues: on('home.venues') && offers('venue') && (
      <View style={styles.section}>
        <SectionHeader title={heading('venues', city === ALL_CITIES ? 'Venues' : `Venues in ${city}`)} onAction={() => router.navigate('/venues')} />
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
    ),
    collections: weddingLike && on('home.collections') && <VenueCollections city={city} title={heading('collections', '') || undefined} />,
    checklist: on('home.checklist') && <ChecklistCard />,
    photographers: on('home.photographers') && offers('photography') && (photographers.isLoading || !!photoList?.length) && (
      <View style={styles.section}>
        <SectionHeader
          title={heading('photographers', `Photographers ${city === ALL_CITIES ? '' : cityLabel}`.trim())}
          onAction={() => router.push({ pathname: '/vendors/[category]', params: { category: 'photo-video', sub: 'photography' } })}
        />
        {photographers.isLoading ? (
          <CarouselSkeleton width={170} height={170} />
        ) : (
          <Carousel>
            {photoList!.map((v) => (
              <VendorMiniCard key={v.id} vendor={v} />
            ))}
          </Carousel>
        )}
      </View>
    ),
    picks: picks.map((s) => (
      <ServiceCarousel key={s} serviceId={s} city={city} />
    )),
    planner: weddingLike && on('home.planner') && on('tab.customer.genie') && (
      <View style={styles.section}>
        <GenieBanner />
      </View>
    ),
    makeup: on('home.makeup') && offers('makeup') && !!makeupList?.length && (
      <View style={styles.section}>
        <SectionHeader
          title={heading('makeup', weddingLike ? 'Bridal makeup' : 'Makeup artists')}
          onAction={() => router.push({ pathname: '/vendors/[category]', params: { category: 'beauty', sub: 'makeup' } })}
        />
        <Carousel>
          {makeupList.map((v) => (
            <VendorMiniCard key={v.id} vendor={v} />
          ))}
        </Carousel>
      </View>
    ),
    real_weddings: weddingLike && on('home.real_weddings') && !!realWeddings.data?.length && (
      <View style={styles.section}>
        <SectionHeader title={heading('real_weddings', 'Real weddings')} onAction={() => router.navigate({ pathname: '/ideas', params: { tab: 'real' } })} />
        <Carousel>
          {realWeddings.data.map((w) => (
            <PressableScale
              key={w.id}
              accessibilityLabel={`${w.couple} real wedding`}
              onPress={() => router.push({ pathname: '/real-wedding/[id]', params: { id: w.id } })}
              style={styles.realCard}>
              <Photo source={photo(w.cover)} style={styles.realImage} contentFit="cover" transition={200} />
              <Text size={15} weight="semibold" color={colors.heading} numberOfLines={1} raw>
                {w.couple}
              </Text>
              <Text size={13} color={colors.textMuted} numberOfLines={1}>
                {w.theme} · {w.city}
              </Text>
            </PressableScale>
          ))}
        </Carousel>
      </View>
    ),
  };
  for (const banner of content.banners) sections[bannerSectionId(banner.id)] = banner.active && <ContentBanner banner={banner} />;
  const order = orderSections(HOME_SECTION_IDS, content.home.order, content.banners);

  return (
    <View style={styles.root}>
      <CityHeader
        right={
          <>
            {on('couple.messages') && (
              <TourTarget id="messages">
                <IconButton icon="chatbubble-outline" badge={unread} accessibilityLabel="Messages" onPress={() => router.push('/inbox')} />
              </TourTarget>
            )}
            <TourTarget id="menu">
              <IconButton icon="person-circle-outline" iconSize={25} accessibilityLabel="Profile & menu" onPress={() => router.push('/profile')} />
            </TourTarget>
          </>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}>
        {on('couple.search') && <SearchPrompt />}
        <AnnouncementBanner style={{ marginHorizontal: GUTTER, marginTop: 14 }} />
        {order.map((id) => (
          <Fragment key={id}>{sections[id]}</Fragment>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  section: { marginTop: 30 },
  carousel: { paddingHorizontal: GUTTER, gap: 12 },
  realCard: { width: 240, gap: 0 },
  realImage: { width: 240, height: 160, borderRadius: radius.lg, marginBottom: 8, backgroundColor: colors.bgMuted },
}));
