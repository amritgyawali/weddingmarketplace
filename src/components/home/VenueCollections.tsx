import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { photos } from '@/constants/images';
import { colors, gradients, GUTTER, radius, shadows } from '@/constants/theme';
import { ALL_CITIES } from '@/data/cities';
import { useCollections } from '@/hooks/queries';
import type { CollectionId } from '@/types';

const CARD_GRADIENT: Record<CollectionId, readonly [string, string, string]> = {
  luxury: gradients.collectionLuxury,
  budget: gradients.collectionBudget,
  destination: gradients.collectionDestination,
  heritage: gradients.collectionHeritage,
  garden: gradients.collectionGarden,
};

/** "Venues Collections in {city}" — gradient cards with a framed circular photo. */
export function VenueCollections({ city }: { city: string }) {
  const { data, isLoading } = useCollections(city);
  if (!isLoading && !data?.length) return null;

  return (
    <View style={styles.band}>
      <Text weight="semibold" size={19} color={colors.heading} style={styles.title} numberOfLines={1}>
        Venues Collections {city === ALL_CITIES ? 'across Nepal' : `in ${city}`}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} decelerationRate="fast" snapToInterval={170}>
        {isLoading
          ? [0, 1, 2].map((i) => <Skeleton key={i} width={156} height={188} borderRadius={radius.lg} />)
          : data!.map((c) => (
              <PressableScale
                key={c.id}
                accessibilityLabel={`${c.title}, ${c.count} vendors`}
                onPress={() => router.push({ pathname: '/collection/[id]', params: { id: c.id } })}
                style={[styles.card, shadows.card]}>
                <LinearGradient colors={CARD_GRADIENT[c.id]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
                <View style={styles.curve} />
                <View style={styles.ring}>
                  <Image source={photos[c.image]} style={styles.photo} contentFit="cover" transition={200} />
                </View>
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.fade} />
                <View style={styles.text}>
                  <Text size={17} lineHeight={21} color={colors.white} weight="medium" numberOfLines={2}>
                    {c.title}
                  </Text>
                  <Text size={14} color="rgba(255,255,255,0.92)">
                    {c.count} Vendors
                  </Text>
                </View>
              </PressableScale>
            ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  band: { backgroundColor: colors.collectionBand, paddingBottom: 30, marginTop: 34 },
  title: { paddingHorizontal: GUTTER, paddingTop: 18, paddingBottom: 18, backgroundColor: 'rgba(255,255,255,0.35)' },
  row: { paddingHorizontal: GUTTER, gap: 14 },
  card: { width: 156, height: 188, borderRadius: radius.lg, overflow: 'hidden' },
  curve: {
    position: 'absolute',
    left: -80,
    top: 52,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  ring: {
    position: 'absolute',
    top: 10,
    right: 8,
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.75)',
    padding: 3,
  },
  photo: { flex: 1, borderRadius: 43 },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 90 },
  text: { position: 'absolute', left: 12, right: 10, bottom: 12, gap: 4 },
});
