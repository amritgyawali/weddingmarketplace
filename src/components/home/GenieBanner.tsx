import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { BRAND } from '@/constants/brand';
import { photos } from '@/constants/images';
import { colors, GUTTER, radius, shadows } from '@/constants/theme';

/** Promo for the paid virtual-planning service. */
export function GenieBanner() {
  return (
    <PressableScale
      onPress={() => router.navigate('/genie')}
      accessibilityLabel={`${BRAND.genieService}. Plans from ₹249`}
      style={[styles.card, shadows.card]}>
      <Image source={photos.virtualPlanningCouple} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="left" />
      <LinearGradient
        colors={['rgba(255,255,255,0.98)', 'rgba(255,255,255,0.85)', 'rgba(255,255,255,0)']}
        locations={[0, 0.5, 0.85]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        <Text size={12} weight="bold" color={colors.primary} tracking={1}>
          {BRAND.genieTagline.toUpperCase()}
        </Text>
        <Text size={19} weight="bold" color={colors.textStrong} lineHeight={24}>
          Let an expert plan{'\n'}your wedding
        </Text>
        <Text size={13} color={colors.textBody}>
          Plans from just ₹249
        </Text>
        <View style={styles.cta}>
          <Text size={13} weight="bold" color={colors.white}>
            Explore Genie
          </Text>
          <Ionicons name="arrow-forward" size={14} color={colors.white} />
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: GUTTER,
    height: 170,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.bgMuted,
  },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 18, gap: 6, maxWidth: '68%' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    marginTop: 4,
  },
});
