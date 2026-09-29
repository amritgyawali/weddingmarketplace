import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo } from 'react';
import { Linking, StyleSheet, useWindowDimensions, View } from 'react-native';

import { CrownRibbon } from '@/components/ui/Icons';
import { PressableScale } from '@/components/ui/PressableScale';
import { Rating } from '@/components/ui/Rating';
import { Text } from '@/components/ui/Text';
import { colors, GUTTER, radius } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';
import type { Venue } from '@/types';
import { formatINR } from '@/utils/format';

import { ImageCarousel } from './ImageCarousel';
import { ShortlistButton } from './ShortlistButton';

const PER_PLATE_TYPES = new Set(['Banquet Hall', 'Kalyana Mandapam', '4 Star Hotel']);

export function venuePrice(venue: Venue, destinationPricing = false) {
  if (destinationPricing) {
    return { label: 'Destination package', value: venue.destinationPackage, unit: 'for 2 days' };
  }
  if (PER_PLATE_TYPES.has(venue.type)) {
    return { label: 'Veg price', value: venue.vegPerPlate, unit: 'per plate' };
  }
  return { label: 'Rental cost', value: venue.rentalCost, unit: 'per function' };
}

export function useStartConversation() {
  const openConversation = useAppStore((s) => s.openConversation);
  return (kind: 'venue' | 'vendor', item: { id: string; name: string; images: Venue['images'] }) => {
    const id = openConversation({ kind, refId: item.id, title: item.name, image: item.images[0] });
    router.push({ pathname: '/inbox/[id]', params: { id } });
  };
}

/** Full-width venue card from the "Bangalore • Venues" listing. */
export const VenueCard = memo(function VenueCard({
  venue,
  destinationPricing,
}: {
  venue: Venue;
  destinationPricing?: boolean;
}) {
  const { width } = useWindowDimensions();
  const cardWidth = width - GUTTER * 2;
  const price = venuePrice(venue, destinationPricing);
  const startConversation = useStartConversation();
  const open = () => router.push({ pathname: '/venue/[id]', params: { id: venue.id } });

  return (
    <View style={styles.card}>
      <View>
        <ImageCarousel images={venue.images} width={cardWidth} height={cardWidth * 0.63} radius={radius.md} onPressImage={open} />
        {venue.featured && (
          <View style={styles.crown} pointerEvents="none">
            <CrownRibbon size={26} />
          </View>
        )}
        <ShortlistButton kind="venues" id={venue.id} size={38} style={styles.save} />
      </View>

      <PressableScale onPress={open} activeScale={0.99} accessibilityLabel={`${venue.name}, open details`} style={styles.meta}>
        <View style={styles.rowBetween}>
          <Text size={15} color={colors.textBody}>
            {venue.city}
          </Text>
          <Rating value={venue.rating} count={venue.reviewCount} />
        </View>
        <Text size={19} weight="semibold" color={colors.heading} numberOfLines={2} style={{ marginTop: 6 }}>
          {venue.name}
        </Text>
        <Text size={13} color={colors.textMuted} style={{ marginTop: 8 }}>
          {price.label}
        </Text>
        <View style={styles.priceRow}>
          <Text size={20} weight="bold" color={colors.textStrong}>
            {formatINR(price.value)}
          </Text>
          <Text size={13} color={colors.textBody}>
            {price.unit}
          </Text>
        </View>
        <View style={[styles.rowBetween, { marginTop: 10 }]}>
          <View style={styles.spec}>
            <MaterialCommunityIcons name="account-group" size={22} color={colors.textMuted} />
            <Text size={15} color={colors.textMuted}>
              {venue.capacity.min}-{venue.capacity.max} pax
            </Text>
          </View>
          <View style={styles.spec}>
            <MaterialCommunityIcons name="bank-outline" size={19} color={colors.textMuted} />
            <Text size={15} color={colors.textMuted}>
              {venue.type}
            </Text>
          </View>
        </View>
      </PressableScale>

      <View style={styles.actions}>
        <PressableScale
          haptic
          onPress={() => startConversation('venue', venue)}
          accessibilityLabel={`Message ${venue.name}`}
          style={styles.message}>
          <Ionicons name="chatbubble-ellipses" size={22} color={colors.primary} />
          <Text size={17} weight="medium" color={colors.primary}>
            Message
          </Text>
        </PressableScale>
        <PressableScale
          haptic
          onPress={() => Linking.openURL(`tel:${venue.phone.replace(/\s/g, '')}`)}
          accessibilityLabel={`Call ${venue.name}`}
          style={styles.call}>
          <Ionicons name="call" size={22} color={colors.call} />
        </PressableScale>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: GUTTER,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 8,
    borderBottomColor: '#F4F4F5',
  },
  crown: { position: 'absolute', top: 0, left: 0 },
  save: { position: 'absolute', top: 10, right: 10 },
  meta: { paddingTop: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 },
  spec: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  message: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.3,
    borderColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  call: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.3,
    borderColor: colors.call,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
