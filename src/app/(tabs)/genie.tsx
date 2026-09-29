import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Faqs, GenieHero, PackageCard, Testimonials, WhatsAppFab } from '@/components/genie/GenieSections';
import { Text } from '@/components/ui/Text';
import { BRAND } from '@/constants/brand';
import { colors, GUTTER } from '@/constants/theme';
import { FAQS, GENIE_PACKAGES, TESTIMONIALS } from '@/data/genie';
import { useAppStore } from '@/store/useAppStore';

export default function GenieTab() {
  const insets = useSafeAreaInsets();
  const activePlanId = useAppStore(
    (s) => s.bookings.find((b) => b.kind === 'genie' && b.status !== 'cancelled')?.refId,
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text size={19} weight="semibold" color={colors.heading} align="center">
          {BRAND.genieService}
        </Text>
      </View>

      <ScrollView stickyHeaderIndices={[1]} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        <GenieHero />

        <View style={styles.sticky}>
          <Text size={23} weight="medium" color={colors.black}>
            Select Package
          </Text>
          <Text size={15} color={colors.textSubtle} style={{ marginTop: 2 }}>
            {BRAND.name} Genie can help out!
          </Text>
        </View>

        <View style={{ paddingBottom: 6 }}>
          {GENIE_PACKAGES.map((p) => (
            <PackageCard
              key={p.id}
              pkg={p}
              active={activePlanId === p.id}
              onBuy={() => router.push({ pathname: '/genie-checkout/[id]', params: { id: p.id } })}
            />
          ))}
        </View>

        <Testimonials items={TESTIMONIALS} />
        <Faqs items={FAQS} />
      </ScrollView>

      <WhatsAppFab bottom={24} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  header: {
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    backgroundColor: colors.white,
  },
  sticky: {
    backgroundColor: '#F7F7F8',
    paddingHorizontal: GUTTER,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
});
