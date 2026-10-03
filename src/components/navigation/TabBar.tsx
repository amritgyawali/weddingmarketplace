import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/tabs';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { triggerHaptic } from '@/components/ui/PressableScale';
import { TourTarget } from '@/components/tour/AppTour';
import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/theme';
import { serviceFeature, tabFeature } from '@/data/features';
import { useExperience } from '@/hooks/useExperience';
import { useFeatures } from '@/hooks/useFeatures';

import { TabMark } from './TabMark';

type IconName = ComponentProps<typeof Ionicons>['name'];

const TABS: Record<string, { label: string; icon: IconName; active: IconName }> = {
  index: { label: 'Home', icon: 'home-outline', active: 'home' },
  venues: { label: 'Venues', icon: 'business-outline', active: 'business' },
  vendors: { label: 'Vendors', icon: 'people-outline', active: 'people' },
  ideas: { label: 'Ideas', icon: 'images-outline', active: 'images' },
  wedding: { label: 'My Wedding', icon: 'heart-outline', active: 'heart' },
};

/** Tabs that only make sense while planning a wedding (wedding photos). */
const WEDDING_TABS = new Set(['ideas']);

/**
 * Couple-app bottom bar: a champagne hairline on top, outline icons, filled
 * burgundy with a champagne mark over the active tab, short
 * sentence-case labels. Browse (venues, vendors, ideas) on the left, the
 * couple's own plan on the right. Follows the celebration (a pasni has no
 * wedding ideas and says "My plan") and the super admin's feature switches.
 * Routes without an entry in `TABS` (planner packages) stay reachable by link.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const exp = useExperience();
  const on = useFeatures();
  const occasion = exp.occasion?.id ?? 'wedding';
  const weddingLike = occasion === 'wedding' || occasion === 'engagement';
  const services = exp.occasion?.services;
  const shown = (name: string) => {
    if (name === 'index') return true;
    if (!on(tabFeature('customer', name))) return false;
    if (WEDDING_TABS.has(name) && !weddingLike) return false;
    if (name === 'venues' && ((services && !services.includes('venue')) || !on(serviceFeature('venue')))) return false;
    return true;
  };

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, i) => {
        const base = TABS[route.name];
        if (!base || !shown(route.name)) return null;
        const meta = route.name === 'wedding' && !weddingLike ? { ...base, label: 'My plan' } : base;
        const active = state.index === i;
        const tint = active ? colors.primary : colors.textMuted;
        return (
          <TourTarget key={route.key} id={`tab.${route.name}`} style={styles.slot}>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={meta.label}
              style={({ pressed }) => [styles.item, pressed && { opacity: 0.6 }]}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!active && !event.defaultPrevented) {
                  triggerHaptic('selection');
                  navigation.navigate(route.name, route.params);
                }
              }}>
              <TabMark active={active} />
              <Ionicons name={active ? meta.active : meta.icon} size={23} color={tint} />
              <Text size={11} weight={active ? 'semibold' : 'medium'} color={tint} lineHeight={15} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                {meta.label}
              </Text>
            </Pressable>
          </TourTarget>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.goldLine,
  },
  slot: { flex: 1 },
  item: { flex: 1, alignItems: 'center', gap: 2, minHeight: 52, paddingTop: 8, justifyContent: 'center' },
});
