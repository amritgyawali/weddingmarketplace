import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { CityHeader } from '@/components/home/CityHeader';
import { IconButton } from '@/components/ui/IconButton';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { photos } from '@/constants/images';
import { colors } from '@/constants/theme';
import { categoriesFor, enabledServices } from '@/data/categories';
import { SERVICES } from '@/data/services';
import { useExperience } from '@/hooks/useExperience';
import { useDb } from '@/store/useDb';
import { selectShortlistCount, useAppStore } from '@/store/useAppStore';
import type { VendorCategory } from '@/types';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

const ROW_HEIGHT = 88;

function openSubcategory(category: VendorCategory, subId: string) {
  if (category.id === 'venues') {
    if (subId === 'all-venues') router.navigate('/venues');
    else router.push({ pathname: '/collection/[id]', params: { id: subId } });
    return;
  }
  router.push({ pathname: '/vendors/[category]', params: { category: category.id, sub: subId } });
}

function CategoryRow({ category, expanded, onToggle }: { category: VendorCategory; expanded: boolean; onToggle: () => void }) {
  const chevron = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(expanded ? '180deg' : '0deg', { duration: 200 }) }],
  }));

  return (
    <Animated.View layout={LinearTransition.duration(220)} style={styles.block}>
      <Pressable
        onPress={() => {
          triggerHaptic('selection');
          onToggle();
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${category.title}. ${category.subtitle}`}
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.bgSoft }]}>
        <Image source={photos[category.image]} style={styles.image} contentFit="cover" transition={200} />
        <View style={styles.text}>
          <Text size={17} weight="semibold" color={colors.heading}>
            {category.title}
          </Text>
          <Text size={14} color={colors.textMuted} numberOfLines={1}>
            {category.subtitle}
          </Text>
        </View>
        <Animated.View style={chevron}>
          <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
        </Animated.View>
      </Pressable>

      {expanded && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)} style={styles.subList}>
          {category.subcategories.map((s, i) => (
            <Pressable
              key={s.id}
              onPress={() => openSubcategory(category, s.id)}
              accessibilityRole="link"
              style={({ pressed }) => [
                styles.subItem,
                i < category.subcategories.length - 1 && styles.subBorder,
                pressed && { backgroundColor: colors.primaryTint },
              ]}>
              <Text size={15} color={colors.text}>
                {s.title}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
            </Pressable>
          ))}
        </Animated.View>
      )}
    </Animated.View>
  );
}

export default function VendorsTab() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const shortlistCount = useAppStore(selectShortlistCount);
  const exp = useExperience();
  const flags = useDb((s) => s.featureFlags);
  const all = SERVICES.map((s) => s.id);
  const services = enabledServices(exp.occasion?.services ?? all, flags);
  const categories = categoriesFor(services);
  const filtered = (exp.occasion?.services ?? all).length < all.length;

  return (
    <View style={styles.root}>
      <CityHeader
        border={false}
        right={
          <>
            <IconButton icon="search-outline" accessibilityLabel="Search vendors" onPress={() => router.push('/search')} />
            <IconButton
              icon="bookmark-outline"
              badge={shortlistCount}
              accessibilityLabel="Shortlist"
              onPress={() => router.push('/shortlist')}
            />
          </>
        }
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {filtered && (
          <Text size={13} color={colors.textMuted} style={styles.note}>
            Showing what fits your {exp.occasion?.label.toLowerCase()} plan. Search finds everything else.
          </Text>
        )}
        {categories.map((c) => (
          <CategoryRow
            key={c.id}
            category={c}
            expanded={expanded === c.id}
            onToggle={() => setExpanded((cur) => (cur === c.id ? null : c.id))}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  note: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  block: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  row: { height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16 },
  text: { flex: 1, gap: 1 },
  image: { width: 64, height: 64, borderRadius: 8, backgroundColor: colors.bgMuted },
  subList: { backgroundColor: colors.bgSoft, paddingLeft: 94, paddingRight: 16 },
  subItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13 },
  subBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});
