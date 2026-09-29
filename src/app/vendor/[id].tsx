import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ExpandableText, HeroControls, InfoTile, ReviewList, Section, StickyCta } from '@/components/detail/DetailParts';
import { ImageCarousel } from '@/components/listing/ImageCarousel';
import { VendorMiniCard } from '@/components/listing/MiniCards';
import { useStartConversation } from '@/components/listing/VenueCard';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Rating } from '@/components/ui/Rating';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { colors, GUTTER, radius } from '@/constants/theme';
import { findCategory, findSubcategory } from '@/data/categories';
import { useFeaturedVendors, useVendor } from '@/hooks/queries';
import { NotFoundError } from '@/services/api';
import { formatMoney } from '@/utils/format';

export default function VendorDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const { data: vendor, isLoading, error, refetch } = useVendor(id);
  const similar = useFeaturedVendors(vendor?.city ?? '', vendor?.categoryId ?? '');
  const startConversation = useStartConversation();
  const [selectedPkg, setSelectedPkg] = useState(1);

  if (isLoading) {
    return (
      <View style={styles.root}>
        <Skeleton height={width * 0.8} borderRadius={0} />
        <View style={{ padding: GUTTER, gap: 12 }}>
          <Skeleton width="40%" />
          <Skeleton width="80%" height={24} />
          <Skeleton height={120} />
        </View>
      </View>
    );
  }

  if (error || !vendor) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Vendor" />
        {error instanceof NotFoundError ? (
          <EmptyState icon="person-outline" title="Vendor not found" actionLabel="Browse vendors" onAction={() => router.navigate('/vendors')} />
        ) : (
          <ErrorState onRetry={refetch} />
        )}
      </View>
    );
  }

  const category = findCategory(vendor.categoryId);
  const sub = findSubcategory(vendor.categoryId, vendor.subcategoryId);
  const pkg = vendor.packages[selectedPkg];

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        <ImageCarousel images={vendor.images} width={width} height={width * 0.8} dotsBottom={16} />
        <HeroControls kind="vendors" id={vendor.id} shareText={`${vendor.name} (${sub?.title ?? category?.title}) in ${vendor.city}`} />

        <View style={styles.head}>
          <View style={styles.rowBetween}>
            <Text size={13} weight="bold" color={colors.primary} tracking={0.6}>
              {(sub?.title ?? category?.title ?? '').toUpperCase()}
            </Text>
            <Rating value={vendor.rating} count={vendor.reviewCount} />
          </View>
          <Text size={24} weight="bold" color={colors.heading} lineHeight={30} style={{ marginTop: 6 }}>
            {vendor.name}
          </Text>
          <View style={styles.location}>
            <Ionicons name="location-outline" size={15} color={colors.textMuted} />
            <Text size={14} color={colors.textMuted}>
              {vendor.city}
            </Text>
          </View>
          <View style={styles.tiles}>
            <InfoTile icon="ribbon-outline" label="Experience" value={`${vendor.experience}+ years`} />
            <InfoTile icon="heart-outline" label="Weddings done" value={`${vendor.eventsDone}+`} />
          </View>
          <View style={styles.actions}>
            <Button label="Message" variant="outline" icon="chatbubble-ellipses-outline" onPress={() => startConversation('vendor', vendor)} style={{ flex: 1 }} />
            <Button
              label="Call"
              variant="outline"
              icon="call-outline"
              color={colors.call}
              onPress={() => Linking.openURL(`tel:${vendor.phone.replace(/\s/g, '')}`)}
              style={{ flex: 1 }}
            />
          </View>
        </View>

        <Section title="Packages">
          <View style={{ gap: 12 }}>
            {vendor.packages.map((p, i) => {
              const active = i === selectedPkg;
              return (
                <Pressable
                  key={p.name}
                  onPress={() => setSelectedPkg(i)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[styles.pkg, active && styles.pkgActive]}>
                  <View style={styles.rowBetween}>
                    <View style={styles.pkgTitle}>
                      <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={20} color={active ? colors.primary : colors.textSubtle} />
                      <Text size={16} weight="semibold" color={colors.heading}>
                        {p.name}
                      </Text>
                    </View>
                    <Text size={16} weight="bold" color={colors.textStrong}>
                      {formatMoney(p.price)}{' '}
                      <Text size={12} color={colors.textMuted}>
                        {p.unit}
                      </Text>
                    </Text>
                  </View>
                  <View style={styles.includes}>
                    {p.includes.map((inc) => (
                      <Text key={inc} size={13} color={colors.textBody}>
                        ✓ {inc}
                      </Text>
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section title="About">
          <ExpandableText text={vendor.about} />
        </Section>

        <Section title="Services">
          <View style={styles.services}>
            {vendor.services.map((s) => (
              <View key={s} style={styles.service}>
                <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
                <Text size={13} color={colors.text}>
                  {s}
                </Text>
              </View>
            ))}
          </View>
        </Section>

        <Section title={`Reviews (${vendor.reviewCount})`}>
          <ReviewList
            reviews={vendor.reviews}
            rating={vendor.rating}
            count={vendor.reviewCount}
            onWrite={() => router.push({ pathname: '/write-review', params: { providerId: vendor.id, name: vendor.name } })}
          />
        </Section>

        {!!similar.data?.filter((v) => v.id !== vendor.id).length && (
          <View style={{ paddingTop: 26 }}>
            <Text size={19} weight="bold" color={colors.heading} style={{ paddingHorizontal: GUTTER, marginBottom: 12 }}>
              More {category?.title.toLowerCase()} in {vendor.city}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: GUTTER, gap: 14 }}>
              {similar.data
                .filter((v) => v.id !== vendor.id)
                .map((v) => (
                  <VendorMiniCard key={v.id} vendor={v} />
                ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      <StickyCta
        priceLabel={`${pkg.name} package`}
        price={formatMoney(pkg.price)}
        unit={pkg.unit}
        cta="Send Enquiry"
        onPress={() => router.push({ pathname: '/enquiry', params: { kind: 'vendor', id: vendor.id, pkg: pkg.name } })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  head: { paddingHorizontal: GUTTER, paddingTop: 16, paddingBottom: 20, borderBottomWidth: 8, borderBottomColor: '#F4F4F5' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  location: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  tiles: { flexDirection: 'row', gap: 10, marginTop: 16 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  pkg: { borderWidth: 1.2, borderColor: colors.border, borderRadius: radius.md, padding: 14 },
  pkgActive: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  pkgTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  includes: { marginTop: 8, marginLeft: 28, gap: 3 },
  services: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  service: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
});
