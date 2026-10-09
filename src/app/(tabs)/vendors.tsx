import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { CityHeader } from '@/components/home/CityHeader';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Ornament } from '@/components/ui/Ornament';
import { Photo } from '@/components/ui/Photo';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { photos } from '@/constants/images';
import { colors, GUTTER, gradients } from '@/constants/theme';
import { categoriesFor, enabledServices } from '@/data/categories';
import { SERVICES } from '@/data/services';
import { useExperience } from '@/hooks/useExperience';
import { useLayout } from '@/hooks/useLayout';
import { useMotion } from '@/hooks/useMotion';
import { useDb } from '@/store/useDb';
import { selectShortlistCount, useAppStore } from '@/store/useAppStore';
import type { VendorCategory } from '@/types';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

const GAP = 12;

function openSubcategory(category: VendorCategory, subId: string) {
  if (category.id === 'venues') {
    if (subId === 'all-venues') router.navigate('/venues');
    else router.push({ pathname: '/collection/[id]', params: { id: subId } });
    return;
  }
  router.push({ pathname: '/vendors/[category]', params: { category: category.id, sub: subId } });
}

function openAll(category: VendorCategory) {
  if (category.id === 'venues') router.navigate('/venues');
  else router.push({ pathname: '/vendors/[category]', params: { category: category.id } });
}

/** A photo card with the category's name set in Martel over a wine scrim. */
function CategoryCard({ category, width, height, featured, onPress }: { category: VendorCategory; width: number; height: number; featured?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        triggerHaptic('selection');
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${category.title}. ${category.subtitle}`}
      accessibilityHint="Shows the services in this category"
      style={({ pressed }) => [styles.card, { width, height }, pressed && { opacity: 0.9 }]}>
      <Photo source={photos[category.image]} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={gradients.photoCaption} locations={[0.35, 0.6, 1]} style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]} />
      <View style={[styles.caption, featured && styles.captionFeatured]}>
        {featured && <Ornament width={56} style={{ marginBottom: 8 }} />}
        <Text serif size={featured ? 24 : 17} weight="bold" color={colors.white} lineHeight={featured ? 32 : 23} numberOfLines={2}>
          {category.title}
        </Text>
        <Text size={featured ? 14 : 12} color={colors.onWineMuted} numberOfLines={featured ? 2 : 1}>
          {featured ? category.subtitle : `${category.subcategories.length} services`}
        </Text>
      </View>
      {featured && (
        <View style={styles.explore}>
          <Text size={13} weight="semibold" color={colors.wine}>
            Explore
          </Text>
          <Ionicons name="arrow-forward" size={14} color={colors.wine} />
        </View>
      )}
    </Pressable>
  );
}

/**
 * Vendors tab: an editorial index of every service. The first category is
 * a full-width feature, the rest a grid of tall photo cards with serif
 * captions; a card opens a sheet with its services and a "View all" link.
 * Only the services the active celebration uses are shown; search finds
 * the rest.
 */
export default function VendorsTab() {
  const [open, setOpen] = useState<VendorCategory | null>(null);
  const shortlistCount = useAppStore(selectShortlistCount);
  const exp = useExperience();
  const flags = useDb((s) => s.featureFlags);
  const { width, contentWidth, medium, wide } = useLayout();
  const motion = useMotion();
  const all = SERVICES.map((s) => s.id);
  const services = enabledServices(exp.occasion?.services ?? all, flags);
  const categories = categoriesFor(services);
  const filtered = (exp.occasion?.services ?? all).length < all.length;

  const inner = Math.min(width, contentWidth) - GUTTER * 2;
  const columns = wide ? 4 : medium ? 3 : 2;
  const cardWidth = Math.floor((inner - GAP * (columns - 1)) / columns);
  const [featured, ...rest] = categories;
  /** Close the sheet first, then navigate, so the next screen never opens under the closing modal. */
  const leaveSheet = (go: () => void) => {
    setOpen(null);
    setTimeout(go, 80);
  };

  return (
    <View style={styles.root}>
      <CityHeader
        border={false}
        right={
          <>
            <IconButton icon="search-outline" accessibilityLabel="Search vendors" onPress={() => router.push('/search')} />
            <IconButton icon="bookmark-outline" badge={shortlistCount} accessibilityLabel="Shortlist" onPress={() => router.push('/shortlist')} />
          </>
        }
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { width: inner + GUTTER * 2 }]}>
        <View style={styles.intro}>
          <Text serif size={26} weight="bold" color={colors.heading} lineHeight={36} accessibilityRole="header">
            Find your vendors
          </Text>
          <Text size={15} color={colors.textMuted}>
            {filtered ? `Showing what fits your ${exp.occasion?.label.toLowerCase()} plan. Search finds everything else.` : 'Every service for the day, from party palaces to pandits.'}
          </Text>
        </View>

        {/* One entrance for the whole index: per-card animations replayed whenever the list re-rendered after the store loaded. */}
        <Animated.View entering={motion.enter(0)} style={{ gap: GAP }}>
          {featured && <CategoryCard category={featured} featured width={inner} height={medium ? 260 : 200} onPress={() => setOpen(featured)} />}
          <View style={styles.grid}>
            {rest.map((c) => (
              <CategoryCard key={c.id} category={c} width={cardWidth} height={Math.round(cardWidth * 1.22)} onPress={() => setOpen(c)} />
            ))}
          </View>
        </Animated.View>
      </ScrollView>

      <Sheet
        visible={!!open}
        onClose={() => setOpen(null)}
        title={open?.title}
        footer={
          open ? (
            <View style={styles.sheetFooter}>
              <Button
                label={open.id === 'venues' ? 'View all venues' : `View all ${open.title.toLowerCase()}`}
                onPress={() => leaveSheet(() => openAll(open))}
              />
            </View>
          ) : null
        }>
        {open && (
          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={styles.sheetList}>
            <Text size={14} color={colors.textMuted} style={{ marginBottom: 6 }}>
              {open.subtitle}
            </Text>
            {open.subcategories.map((s, i) => (
              <Pressable
                key={s.id}
                onPress={() => leaveSheet(() => openSubcategory(open, s.id))}
                accessibilityRole="link"
                style={({ pressed }) => [styles.subItem, i > 0 && styles.subBorder, pressed && { backgroundColor: colors.primaryTint }]}>
                <Text size={16} color={colors.heading} style={{ flex: 1 }}>
                  {s.title}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
              </Pressable>
            ))}
          </ScrollView>
        )}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { alignSelf: 'center', paddingHorizontal: GUTTER, paddingBottom: 32, gap: GAP },
  intro: { paddingTop: 6, paddingBottom: 4, gap: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  card: { borderRadius: 10, overflow: 'hidden', backgroundColor: colors.bgMuted, justifyContent: 'flex-end' },
  caption: { padding: 12, gap: 1 },
  captionFeatured: { padding: 18, paddingRight: 120 },
  explore: {
    position: 'absolute',
    right: 16,
    bottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.gold,
    borderRadius: 6,
    paddingHorizontal: 12,
    height: 34,
  },
  sheetList: { paddingHorizontal: GUTTER, paddingBottom: 8 },
  subItem: { flexDirection: 'row', alignItems: 'center', minHeight: 50 },
  subBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  sheetFooter: { paddingHorizontal: GUTTER, paddingTop: 8 },
});
