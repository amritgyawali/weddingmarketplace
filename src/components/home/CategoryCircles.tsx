import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { HOME_CATEGORIES } from '@/data/categories';
import { photos } from '@/constants/images';
import { colors, GUTTER } from '@/constants/theme';

/** Horizontally scrolling round category shortcuts on a soft grey band. */
export function CategoryCircles() {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.band}
      contentContainerStyle={styles.content}>
      {HOME_CATEGORIES.map((c) => (
        <PressableScale
          key={c.id}
          accessibilityLabel={c.title}
          onPress={() =>
            c.categoryId === 'venues'
              ? router.navigate('/venues')
              : router.push({
                  pathname: '/vendors/[category]',
                  params: { category: c.categoryId, ...(c.subcategoryId ? { sub: c.subcategoryId } : {}) },
                })
          }
          style={styles.item}>
          <Image source={photos[c.image]} style={styles.circle} contentFit="cover" transition={200} />
          <Text size={14} weight="medium" color={colors.text} align="center" numberOfLines={2} lineHeight={18}>
            {c.title}
          </Text>
        </PressableScale>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  band: { backgroundColor: '#F7F7F8', flexGrow: 0 },
  content: { paddingHorizontal: GUTTER - 4, paddingTop: 14, paddingBottom: 18, gap: 10 },
  item: { width: 104, alignItems: 'center', gap: 10 },
  circle: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.bgMuted },
});
