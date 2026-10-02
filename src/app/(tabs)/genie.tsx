import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Faqs, GenieHero, PackageCard, Testimonials, WhatsAppFab } from '@/components/genie/GenieSections';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { BRAND } from '@/constants/brand';
import { colors, GUTTER } from '@/constants/theme';
import { FAQS, GENIE_PACKAGES, TESTIMONIALS } from '@/data/genie';
import { useAppStore } from '@/store/useAppStore';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

export default function GenieTab() {
  const activePlanId = useAppStore(
    (s) => s.bookings.find((b) => b.kind === 'genie' && b.status !== 'cancelled')?.refId,
  );

  return (
    <View style={styles.root}>
      <ScreenHeader title={BRAND.genieService} back={false} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
        <GenieHero />

        <View style={styles.packagesHead}>
          <Text size={18} weight="bold" color={colors.heading}>
            Packages
          </Text>
          <Text size={14} color={colors.textMuted}>
            Pay once. Your planner stays with you for the period shown.
          </Text>
        </View>

        {GENIE_PACKAGES.map((p) => (
          <PackageCard
            key={p.id}
            pkg={p}
            active={activePlanId === p.id}
            onBuy={() => router.push({ pathname: '/genie-checkout/[id]', params: { id: p.id } })}
          />
        ))}

        <Testimonials items={TESTIMONIALS} />
        <Faqs items={FAQS} />
      </ScrollView>

      <WhatsAppFab bottom={16} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  packagesHead: { paddingHorizontal: GUTTER, paddingTop: 28 },
});
