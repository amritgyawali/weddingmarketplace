import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/tabs';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { triggerHaptic } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/theme';
import { serviceFeature, tabFeature } from '@/data/features';
import { useExperience } from '@/hooks/useExperience';
import { useFeatures } from '@/hooks/useFeatures';

type IconName = ComponentProps<typeof Ionicons>['name'];

const TABS: Record<string, { label: string; icon: IconName; active: IconName }> = {
  index: { label: 'Home', icon: 'home-outline', active: 'home' },
  venues: { label: 'Venues', icon: 'business-outline', active: 'business' },
  vendors: { label: 'Vendors', icon: 'people-outline', active: 'people' },
  ideas: { label: 'Ideas', icon: 'images-outline', active: 'images' },
  genie: { label: 'Planner', icon: 'clipboard-outline', active: 'clipboard' },
};

/** Tabs that only make sense while planning a wedding (wedding photos, wedding planner packages). */
const WEDDING_TABS = new Set(['ideas', 'genie']);

/**
 * Couple-app bottom bar: outline icons, filled + crimson when active, short
 * sentence-case labels. Follows the celebration (a pasni has no wedding ideas
 * or planner packages) and the super admin's feature switches.
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
        const meta = TABS[route.name];
        if (!meta || !shown(route.name)) return null;
        const active = state.index === i;
        const tint = active ? colors.primary : colors.textMuted;
        return (
          <Pressable
            key={route.key}
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
            <Ionicons name={active ? meta.active : meta.icon} size={23} color={tint} />
            <Text size={11} weight={active ? 'semibold' : 'regular'} color={tint} lineHeight={15} numberOfLines={1}>
              {meta.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 7,
  },
  item: { flex: 1, alignItems: 'center', gap: 2, minHeight: 44, justifyContent: 'center' },
});
