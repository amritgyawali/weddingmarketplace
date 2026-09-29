import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ExpandableText, HeroControls, InfoTile, ReviewList, Section, StickyCta } from '@/components/detail/DetailParts';
import { ImageCarousel } from '@/components/listing/ImageCarousel';
import { VenueMiniCard } from '@/components/listing/MiniCards';
import { useStartConversation } from '@/components/listing/VenueCard';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { CrownRibbon } from '@/components/ui/Icons';
import { Rating } from '@/components/ui/Rating';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { colors, GUTTER, radius } from '@/constants/theme';
import { useSimilarVenues, useVenue } from '@/hooks/queries';
import { NotFoundError } from '@/services/api';
import { formatMoney } from '@/utils/format';

export default function VenueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const { data: venue, isLoading, error, refetch } = useVenue(id);
  const similar = useSimilarVenues(id);
  const startConversation = useStartConversation();

  if (isLoading) {
    return (
      <View style={styles.root}>
        <Skeleton height={width * 0.8} borderRadius={0} />
        <View style={{ padding: GUTTER, gap: 12 }}>
          <Skeleton width="40%" />
          <Skeleton width="80%" height={24} />
          <Skeleton height={80} />
          <Skeleton height={140} />
        </View>
      </View>
    );
  }

  if (error || !venue) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Venue" />
        {error instanceof NotFoundError ? (
          <EmptyState icon="business-outline" title="Venue not found" message="It may have been removed." actionLabel="Browse venues" onAction={() => router.navigate('/venues')} />
        ) : (
          <ErrorState onRetry={refetch} />
        )}
      </View>
    );
  }

  const enquire = () => router.push({ pathname: '/enquiry', params: { kind: 'venue', id: venue.id } });

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        <View>
          <ImageCarousel images={venue.images} width={width} height={width * 0.8} dotsBottom={16} />
          {venue.featured && (
            <View style={styles.crown}>
              <CrownRibbon size={30} />
            </View>
          )}
          <View style={styles.photoCount}>
            <Ionicons name="images-outline" size={14} color={colors.white} />
            <Text size={12} weight="semibold" color={colors.white}>
              {venue.images.length} photos
            </Text>
          </View>
        </View>
        <HeroControls kind="venues" id={venue.id} shareText={`${venue.name}, ${venue.locality}, ${venue.city} — found on the wedding app!`} />

        <View style={styles.head}>
          <View style={styles.rowBetween}>
            <Text size={15} color={colors.textBody}>
              {venue.locality}, {venue.city}
            </Text>
            <Rating value={venue.rating} count={venue.reviewCount} />
          </View>
          <Text size={24} weight="bold" color={colors.heading} lineHeight={30} style={{ marginTop: 6 }}>
            {venue.name}
          </Text>
          <View style={styles.tags}>
            <View style={styles.tag}>
              <Ionicons name="business-outline" size={14} color={colors.textBody} />
              <Text size={13} color={colors.textBody}>
                {venue.type}
              </Text>
            </View>
            <View style={styles.tag}>
              <Ionicons name="people-outline" size={14} color={colors.textBody} />
              <Text size={13} color={colors.textBody}>
                {venue.capacity.min}-{venue.capacity.max} pax
              </Text>
            </View>
            {venue.rooms > 0 && (
              <View style={styles.tag}>
                <Ionicons name="bed-outline" size={14} color={colors.textBody} />
                <Text size={13} color={colors.textBody}>
                  {venue.rooms} rooms
                </Text>
              </View>
            )}
          </View>

          <View style={styles.actions}>
            <Button label="Message" variant="outline" icon="chatbubble-ellipses-outline" onPress={() => startConversation('venue', venue)} style={{ flex: 1 }} />
            <Button
              label="Call"
              variant="outline"
              icon="call-outline"
              color={colors.call}
              onPress={() => Linking.openURL(`tel:${venue.phone.replace(/\s/g, '')}`)}
              style={{ flex: 1 }}
            />
          </View>
        </View>

        <Section title="Pricing">
          <View style={styles.tiles}>
            <InfoTile icon="leaf-outline" label="Veg per plate" value={formatMoney(venue.vegPerPlate)} />
            <InfoTile icon="restaurant-outline" label="Non-veg per plate" value={formatMoney(venue.nonVegPerPlate)} />
            <InfoTile icon="key-outline" label="Rental cost / function" value={formatMoney(venue.rentalCost)} />
            <InfoTile icon="airplane-outline" label="Destination (2 days)" value={formatMoney(venue.destinationPackage)} />
          </View>
        </Section>

        <Section title="About">
          <ExpandableText text={venue.about} />
        </Section>

        <Section title="Areas available">
          {venue.spaces.map((s) => (
            <View key={s.name} style={styles.space}>
              <View style={styles.spaceIcon}>
                <Ionicons name={s.type === 'Indoor' ? 'home-outline' : 'sunny-outline'} size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text size={15} weight="semibold" color={colors.heading}>
                  {s.name}{' '}
                  <Text size={13} color={colors.textMuted}>
                    ({s.type})
                  </Text>
                </Text>
                <Text size={13} color={colors.textBody}>
                  {s.capacity}
                </Text>
              </View>
            </View>
          ))}
        </Section>

        <Section title="Amenities & Policies">
          <View style={styles.amenities}>
            {venue.amenities.map((a) => (
              <View key={a} style={styles.amenity}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text size={14} color={colors.text} style={{ flex: 1 }}>
                  {a}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.policies}>
            {venue.policies.map((p) => (
              <Text key={p} size={13} color={colors.textBody} lineHeight={20}>
                • {p}
              </Text>
            ))}
          </View>
        </Section>

        <Section title={`Reviews (${venue.reviewCount})`}>
          <ReviewList
            reviews={venue.reviews}
            rating={venue.rating}
            count={venue.reviewCount}
            onWrite={() => router.push({ pathname: '/write-review', params: { providerId: venue.id, name: venue.name } })}
          />
        </Section>

        {!!similar.data?.length && (
          <View style={{ paddingTop: 26 }}>
            <Text size={19} weight="bold" color={colors.heading} style={{ paddingHorizontal: GUTTER, marginBottom: 12 }}>
              Similar venues
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: GUTTER, gap: 14 }}>
              {similar.data.map((v) => (
                <VenueMiniCard key={v.id} venue={v} width={190} />
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      <StickyCta priceLabel="Starting at" price={formatMoney(venue.vegPerPlate)} unit="per plate" cta="Check Availability" onPress={enquire} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  crown: { position: 'absolute', top: 0, left: GUTTER + 50 },
  photoCount: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  head: { paddingHorizontal: GUTTER, paddingTop: 16, paddingBottom: 20, borderBottomWidth: 8, borderBottomColor: '#F4F4F5' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.bgMuted,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  actions: { flexDirection: 'row', gap: 12, marginTop: 18 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  space: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  spaceIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amenities: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  amenity: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 8 },
  policies: { marginTop: 16, padding: 14, borderRadius: radius.md, backgroundColor: colors.bgSoft, gap: 4 },
});
