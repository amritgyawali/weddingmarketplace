import { Photo } from '@/components/ui/Photo';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { BRAND } from '@/constants/brand';
import { photos } from '@/constants/images';
import { colors, GUTTER } from '@/constants/theme';

/** Promo for the paid planning service: a photo over a wine panel with champagne details. */
export function GenieBanner() {
  return (
    <PressableScale onPress={() => router.navigate('/genie')} accessibilityLabel={`${BRAND.genieService}. Plans from NPR 2,999`} style={styles.card}>
      <View style={styles.photoWrap}>
        <Photo source={photos.virtualPlanningCouple} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient colors={['rgba(61,16,24,0)', 'rgba(61,16,24,0.7)']} style={StyleSheet.absoluteFill} />
        <Text size={13} weight="medium" color={colors.gold} style={styles.caption}>
          {BRAND.genieService}
        </Text>
      </View>
      <View style={styles.body}>
        <Text serif size={18} weight="bold" color={colors.white} lineHeight={26}>
          Hand the phone calls to a planner
        </Text>
        <Text size={14} color="rgba(255,252,248,0.74)">
          They shortlist, negotiate and book for you. From NPR 2,999.
        </Text>
        <Text size={14} weight="semibold" color={colors.gold} style={{ marginTop: 6 }}>
          See planner packages
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: GUTTER, borderWidth: 1, borderColor: colors.goldLine, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.wine },
  photoWrap: { height: 150, backgroundColor: colors.bgMuted, justifyContent: 'flex-end' },
  caption: { padding: 12 },
  body: { padding: 16, gap: 2 },
});
