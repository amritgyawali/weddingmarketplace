import { Photo } from '@/components/ui/Photo';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { photos } from '@/constants/images';
import { colors, GUTTER, radius } from '@/constants/theme';
import { ALL_CITIES } from '@/data/cities';
import { useCollections } from '@/hooks/queries';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

/** Curated venue collections: full-bleed photos with the title set on a dark scrim. */
export function VenueCollections({ city }: { city: string }) {
  const { data, isLoading } = useCollections(city);
  if (!isLoading && !data?.length) return null;

  return (
    <View style={styles.section}>
      <SectionHeader title={`Collections ${city === ALL_CITIES ? 'across Nepal' : `in ${city}`}`} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} decelerationRate="fast" snapToInterval={162}>
        {isLoading
          ? [0, 1, 2].map((i) => <Skeleton key={i} width={150} height={196} borderRadius={radius.lg} />)
          : data!.map((c) => (
              <PressableScale
                key={c.id}
                accessibilityLabel={`${c.title}, ${c.count} venues`}
                onPress={() => router.push({ pathname: '/collection/[id]', params: { id: c.id } })}
                style={styles.card}>
                <Photo source={photos[c.image]} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                <LinearGradient colors={['rgba(37,27,24,0)', 'rgba(37,27,24,0.82)']} style={styles.fade} />
                <View style={styles.text}>
                  <Text serif size={15} lineHeight={21} color={colors.white} weight="semibold" numberOfLines={2}>
                    {c.title}
                  </Text>
                  <Text size={13} color={colors.gold}>
                    {c.count} venues
                  </Text>
                </View>
              </PressableScale>
            ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 30 },
  row: { paddingHorizontal: GUTTER, gap: 12 },
  card: { width: 150, height: 196, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.bgMuted },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 110 },
  text: { position: 'absolute', left: 10, right: 10, bottom: 10, gap: 2 },
});
