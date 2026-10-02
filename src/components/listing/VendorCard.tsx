import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo } from 'react';
import { Linking, StyleSheet, useWindowDimensions, View } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { Rating } from '@/components/ui/Rating';
import { Text } from '@/components/ui/Text';
import { colors, GUTTER, radius } from '@/constants/theme';
import type { Vendor } from '@/types';
import { formatMoney } from '@/utils/format';

import { ImageCarousel } from './ImageCarousel';
import { ShortlistButton } from './ShortlistButton';
import { useStartConversation } from './VenueCard';

export const VendorCard = memo(function VendorCard({ vendor }: { vendor: Vendor }) {
  const { width } = useWindowDimensions();
  const cardWidth = width - GUTTER * 2;
  const startConversation = useStartConversation();
  const open = () => router.push({ pathname: '/vendor/[id]', params: { id: vendor.id } });

  return (
    <View style={styles.card}>
      <View>
        <ImageCarousel images={vendor.images} width={cardWidth} height={cardWidth * 0.6} radius={radius.lg} onPressImage={open} />
        {vendor.featured && (
          <View style={[styles.featured, { pointerEvents: 'none' }]}>
            <Text size={12} weight="semibold" color={colors.gold} lineHeight={16}>
              Featured
            </Text>
          </View>
        )}
        <ShortlistButton kind="vendors" id={vendor.id} size={36} style={styles.save} />
      </View>

      <PressableScale onPress={open} accessibilityLabel={`${vendor.name}, open details`} style={styles.meta}>
        <View style={styles.rowBetween}>
          <Text serif size={18} weight="semibold" color={colors.heading} numberOfLines={1} style={{ flex: 1 }}>
            {vendor.name}
          </Text>
          <Rating value={vendor.rating} count={vendor.reviewCount} />
        </View>
        <Text size={14} color={colors.textMuted} numberOfLines={1}>
          {vendor.city} · {vendor.services.slice(0, 3).join(', ')}
        </Text>
        <View style={styles.priceRow}>
          <Text size={14} color={colors.textMuted}>
            From
          </Text>
          <Text size={17} weight="semibold" color={colors.textStrong}>
            {formatMoney(vendor.startingPrice)}
          </Text>
          <Text size={14} color={colors.textMuted}>
            {vendor.priceUnit}
          </Text>
        </View>
      </PressableScale>

      <View style={styles.actions}>
        <PressableScale haptic onPress={() => startConversation('vendor', vendor)} accessibilityLabel={`Message ${vendor.name}`} style={styles.message}>
          <Ionicons name="chatbubble-outline" size={18} color={colors.heading} />
          <Text size={15} weight="medium" color={colors.heading}>
            Message
          </Text>
        </PressableScale>
        <PressableScale
          haptic
          onPress={() => Linking.openURL(`tel:${vendor.phone.replace(/\s/g, '')}`)}
          accessibilityLabel={`Call ${vendor.name}`}
          style={styles.call}>
          <Ionicons name="call-outline" size={19} color={colors.heading} />
        </PressableScale>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { paddingHorizontal: GUTTER, paddingTop: 16, paddingBottom: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  featured: { position: 'absolute', top: 10, left: 10, backgroundColor: colors.wine, borderWidth: 1, borderColor: colors.goldLine, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  save: { position: 'absolute', top: 10, right: 10 },
  meta: { paddingTop: 10, gap: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 4 },
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
  call: { width: 48, height: 42, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
});
