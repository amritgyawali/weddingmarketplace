import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { enabledServices, homeCategoriesFor } from '@/data/categories';
import { SERVICES } from '@/data/services';
import { useExperience } from '@/hooks/useExperience';
import { useDb } from '@/store/useDb';
import { photos } from '@/constants/images';
import { colors, GUTTER } from '@/constants/theme';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

/** Horizontally scrolling category shortcuts: small photo tiles with a label underneath. */
export function CategoryCircles() {
  const exp = useExperience();
  const flags = useDb((s) => s.featureFlags);
  const services = exp.occasion?.services ?? SERVICES.map((s) => s.id);
  const categories = homeCategoriesFor(enabledServices(services, flags));
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.band}
      contentContainerStyle={styles.content}>
      {categories.map((c) => (
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
          <Text size={13} color={colors.text} align="center" numberOfLines={2} lineHeight={16}>
            {c.title}
          </Text>
        </PressableScale>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  band: { flexGrow: 0, marginTop: 22 },
  content: { paddingHorizontal: GUTTER, gap: 12 },
  item: { width: 76, alignItems: 'center', gap: 6 },
  circle: { width: 76, height: 76, borderRadius: 8, backgroundColor: colors.bgMuted },
});
