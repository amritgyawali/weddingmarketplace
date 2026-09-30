import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo } from 'react';
import { Linking, StyleSheet, useWindowDimensions, View } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { Rating } from '@/components/ui/Rating';
import { Text } from '@/components/ui/Text';
import { colors, GUTTER, radius } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';
import type { Venue } from '@/types';
import { formatMoney } from '@/utils/format';

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

/** Full-width venue card for the venue listing. */
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
        <ImageCarousel images={venue.images} width={cardWidth} height={cardWidth * 0.62} radius={radius.lg} onPressImage={open} />
        {venue.featured && (
          <View style={styles.featured} pointerEvents="none">
            <Text size={12} weight="semibold" color={colors.heading} lineHeight={16}>
              Featured
            </Text>
          </View>
        )}
        <ShortlistButton kind="venues" id={venue.id} size={36} style={styles.save} />
      </View>

      <PressableScale onPress={open} accessibilityLabel={`${venue.name}, open details`} style={styles.meta}>
        <View style={styles.rowBetween}>
          <Text size={18} weight="semibold" color={colors.heading} numberOfLines={1} style={{ flex: 1 }}>
            {venue.name}
          </Text>
          <Rating value={venue.rating} count={venue.reviewCount} />
        </View>
        <Text size={14} color={colors.textMuted} numberOfLines={1}>
          {venue.type} · {venue.city} · {venue.capacity.min}–{venue.capacity.max} guests
        </Text>
        <View style={styles.priceRow}>
          <Text size={17} weight="semibold" color={colors.textStrong}>
            {formatMoney(price.value)}
          </Text>
          <Text size={14} color={colors.textMuted}>
            {price.unit} · {price.label.toLowerCase()}
          </Text>
        </View>
      </PressableScale>

      <View style={styles.actions}>
        <PressableScale
          haptic
          onPress={() => startConversation('venue', venue)}
          accessibilityLabel={`Message ${venue.name}`}
          style={styles.message}>
          <Ionicons name="chatbubble-outline" size={18} color={colors.heading} />
          <Text size={15} weight="medium" color={colors.heading}>
            Message
          </Text>
        </PressableScale>
        <PressableScale
          haptic
          onPress={() => Linking.openURL(`tel:${venue.phone.replace(/\s/g, '')}`)}
          accessibilityLabel={`Call ${venue.name}`}
          style={styles.call}>
          <Ionicons name="call-outline" size={19} color={colors.heading} />
        </PressableScale>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: GUTTER,
    paddingTop: 16,
    paddingBottom: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  featured: { position: 'absolute', top: 10, left: 10, backgroundColor: colors.white, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  save: { position: 'absolute', top: 10, right: 10 },
  meta: { paddingTop: 10, gap: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  message: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  call: {
    width: 48,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
