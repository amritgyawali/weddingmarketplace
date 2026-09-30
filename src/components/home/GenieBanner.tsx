import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { BRAND } from '@/constants/brand';
import { photos } from '@/constants/images';
import { colors, GUTTER } from '@/constants/theme';

/** Promo for the paid planning service: a photo with a plain caption underneath. */
export function GenieBanner() {
  return (
    <PressableScale onPress={() => router.navigate('/genie')} accessibilityLabel={`${BRAND.genieService}. Plans from NPR 2,999`} style={styles.card}>
      <View style={styles.photoWrap}>
        <Image source={photos.virtualPlanningCouple} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']} style={StyleSheet.absoluteFill} />
        <Text size={13} weight="medium" color={colors.white} style={styles.caption}>
          {BRAND.genieService}
        </Text>
      </View>
      <View style={styles.body}>
        <Text size={17} weight="bold" color={colors.heading}>
          Hand the phone calls to a planner
        </Text>
        <Text size={14} color={colors.textBody}>
          They shortlist, negotiate and book for you. From NPR 2,999.
        </Text>
        <Text size={14} weight="semibold" color={colors.primary} style={{ marginTop: 4 }}>
          See planner packages
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: GUTTER, borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.white },
  photoWrap: { height: 150, backgroundColor: colors.bgMuted, justifyContent: 'flex-end' },
  caption: { padding: 12 },
  body: { padding: 14, gap: 2 },
});
