import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { CityHeader } from '@/components/home/CityHeader';
import { IconButton } from '@/components/ui/IconButton';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { photos } from '@/constants/images';
import { colors } from '@/constants/theme';
import { VENDOR_CATEGORIES } from '@/data/categories';
import { selectShortlistCount, useAppStore } from '@/store/useAppStore';
import type { VendorCategory } from '@/types';

const ROW_HEIGHT = 126;

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
        style={({ pressed }) => [styles.row, { backgroundColor: category.bg, opacity: pressed ? 0.92 : 1 }]}>
        <View style={styles.text}>
          <View style={styles.titleRow}>
            <Text size={21} weight="semibold" color={colors.heading} tracking={-0.3}>
              {category.title}
            </Text>
            <Animated.View style={chevron}>
              <Ionicons name="chevron-down" size={20} color={colors.heading} />
            </Animated.View>
          </View>
          <Text size={16} color={colors.textBody} numberOfLines={1} style={{ marginTop: 10 }}>
            {category.subtitle}
          </Text>
        </View>
        <Image source={photos[category.image]} style={styles.image} contentFit="cover" transition={200} />
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
              <Text size={16} color={colors.text}>
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

  return (
    <View style={styles.root}>
      <CityHeader
        border={false}
        right={
          <>
            <IconButton icon="search" size={40} iconSize={21} accessibilityLabel="Search vendors" onPress={() => router.push('/search')} />
            <IconButton
              icon="bookmark"
              size={40}
              iconSize={20}
              badge={shortlistCount}
              accessibilityLabel="Shortlist"
              onPress={() => router.push('/shortlist')}
            />
          </>
        }
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {VENDOR_CATEGORIES.map((c) => (
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
  block: { marginBottom: 4 },
  row: { height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  text: { flex: 1, paddingLeft: 21, paddingRight: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  image: {
    width: 158,
    height: ROW_HEIGHT,
    borderTopLeftRadius: ROW_HEIGHT,
    borderBottomLeftRadius: ROW_HEIGHT,
  },
  subList: { backgroundColor: colors.white, paddingHorizontal: 21 },
  subItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15 },
  subBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
});
