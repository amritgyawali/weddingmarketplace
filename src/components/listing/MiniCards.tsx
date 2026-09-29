import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { photos, type PhotoKey } from '@/constants/images';
import { colors, radius } from '@/constants/theme';
import type { Vendor, Venue } from '@/types';
import { formatMoney } from '@/utils/format';

import { ShortlistButton } from './ShortlistButton';

/**
 * Card shell: the bookmark sits beside (not inside) the pressable so the
 * two touch targets never nest — nested buttons are invalid on web.
 */
function MiniCard({
  width,
  imageHeight,
  image,
  label,
  onPress,
  save,
  children,
}: {
  width: number;
  imageHeight: number;
  image: PhotoKey;
  label: string;
  onPress: () => void;
  save: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={{ width }}>
      <PressableScale accessibilityLabel={label} onPress={onPress}>
        <View style={[styles.imageWrap, { height: imageHeight }]}>
          <Image source={photos[image]} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        </View>
        <View style={styles.meta}>{children}</View>
      </PressableScale>
      <View style={styles.save}>{save}</View>
    </View>
  );
}

/** Compact venue card for horizontal carousels (home, similar venues, chat replies). */
export function VenueMiniCard({ venue, width = 205 }: { venue: Venue; width?: number }) {
  return (
    <MiniCard
      width={width}
      imageHeight={width * 0.8}
      image={venue.images[0]}
      label={venue.name}
      onPress={() => router.push({ pathname: '/venue/[id]', params: { id: venue.id } })}
      save={<ShortlistButton kind="venues" id={venue.id} size={32} />}>
      <Text size={15} weight="semibold" color={colors.heading} numberOfLines={1}>
        {venue.name}
      </Text>
      <View style={styles.row}>
        <Text size={13} color={colors.textMuted} numberOfLines={1} style={{ flex: 1 }}>
          {venue.locality}, {venue.city}
        </Text>
        <Ionicons name="star" size={13} color={colors.star} />
        <Text size={13} weight="semibold" color={colors.text}>
          {venue.rating.toFixed(1)}
        </Text>
      </View>
      <Text size={13} color={colors.textBody}>
        <Text size={14} weight="bold" color={colors.textStrong}>
          {formatMoney(venue.vegPerPlate)}
        </Text>{' '}
        per plate
      </Text>
    </MiniCard>
  );
}

export function VendorMiniCard({ vendor, width = 170 }: { vendor: Vendor; width?: number }) {
  return (
    <MiniCard
      width={width}
      imageHeight={width}
      image={vendor.images[0]}
      label={vendor.name}
      onPress={() => router.push({ pathname: '/vendor/[id]', params: { id: vendor.id } })}
      save={<ShortlistButton kind="vendors" id={vendor.id} size={30} />}>
      <Text size={15} weight="semibold" color={colors.heading} numberOfLines={1}>
        {vendor.name}
      </Text>
      <View style={styles.row}>
        <Ionicons name="star" size={13} color={colors.star} />
        <Text size={13} weight="semibold" color={colors.text}>
          {vendor.rating.toFixed(1)}
        </Text>
        <Text size={13} color={colors.textMuted} numberOfLines={1} style={{ flex: 1 }}>
          ({vendor.reviewCount}) · {vendor.city}
        </Text>
      </View>
      <Text size={13} color={colors.textBody} numberOfLines={1}>
        From{' '}
        <Text size={14} weight="bold" color={colors.textStrong}>
          {formatMoney(vendor.startingPrice)}
        </Text>
      </Text>
    </MiniCard>
  );
}

const styles = StyleSheet.create({
  imageWrap: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.bgMuted },
  save: { position: 'absolute', top: 8, right: 8 },
  meta: { paddingTop: 8, gap: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
