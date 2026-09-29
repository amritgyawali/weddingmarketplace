import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo } from 'react';
import { Linking, StyleSheet, useWindowDimensions, View } from 'react-native';

import { CrownRibbon } from '@/components/ui/Icons';
import { PressableScale } from '@/components/ui/PressableScale';
import { Rating } from '@/components/ui/Rating';
import { Text } from '@/components/ui/Text';
import { colors, GUTTER, radius } from '@/constants/theme';
import type { Vendor } from '@/types';
import { formatINR } from '@/utils/format';

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
        <ImageCarousel images={vendor.images} width={cardWidth} height={cardWidth * 0.6} radius={radius.md} onPressImage={open} />
        {vendor.featured && (
          <View style={styles.crown} pointerEvents="none">
            <CrownRibbon size={26} />
          </View>
        )}
        <ShortlistButton kind="vendors" id={vendor.id} size={38} style={styles.save} />
      </View>

      <PressableScale onPress={open} activeScale={0.99} accessibilityLabel={`${vendor.name}, open details`} style={styles.meta}>
        <View style={styles.rowBetween}>
          <Text size={15} color={colors.textBody}>
            {vendor.city}
          </Text>
          <Rating value={vendor.rating} count={vendor.reviewCount} />
        </View>
        <Text size={19} weight="semibold" color={colors.heading} numberOfLines={1} style={{ marginTop: 6 }}>
          {vendor.name}
        </Text>
        <Text size={13} color={colors.textMuted} style={{ marginTop: 8 }}>
          Starting price
        </Text>
        <View style={styles.priceRow}>
          <Text size={20} weight="bold" color={colors.textStrong}>
            {formatINR(vendor.startingPrice)}
          </Text>
          <Text size={13} color={colors.textBody}>
            {vendor.priceUnit}
          </Text>
        </View>
        <View style={styles.tags}>
          {vendor.services.slice(0, 3).map((s) => (
            <View key={s} style={styles.tag}>
              <Text size={12} color={colors.textBody}>
                {s}
              </Text>
            </View>
          ))}
        </View>
      </PressableScale>

      <View style={styles.actions}>
        <PressableScale haptic onPress={() => startConversation('vendor', vendor)} accessibilityLabel={`Message ${vendor.name}`} style={styles.message}>
          <Ionicons name="chatbubble-ellipses" size={22} color={colors.primary} />
          <Text size={17} weight="medium" color={colors.primary}>
            Message
          </Text>
        </PressableScale>
        <PressableScale
          haptic
          onPress={() => Linking.openURL(`tel:${vendor.phone.replace(/\s/g, '')}`)}
          accessibilityLabel={`Call ${vendor.name}`}
          style={styles.call}>
          <Ionicons name="call" size={22} color={colors.call} />
        </PressableScale>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { paddingHorizontal: GUTTER, paddingTop: 16, paddingBottom: 20, borderBottomWidth: 8, borderBottomColor: '#F4F4F5' },
  crown: { position: 'absolute', top: 0, left: 0 },
  save: { position: 'absolute', top: 10, right: 10 },
  meta: { paddingTop: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: { backgroundColor: colors.bgMuted, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
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
  call: { width: 50, height: 50, borderRadius: 25, borderWidth: 1.3, borderColor: colors.call, alignItems: 'center', justifyContent: 'center' },
});
