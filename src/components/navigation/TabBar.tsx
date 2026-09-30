import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/tabs';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { triggerHaptic } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const TABS: Record<string, { label: string; icon: IconName; active: IconName }> = {
  index: { label: 'Home', icon: 'home-outline', active: 'home' },
  venues: { label: 'Venues', icon: 'business-outline', active: 'business' },
  vendors: { label: 'Vendors', icon: 'people-outline', active: 'people' },
  ideas: { label: 'Ideas', icon: 'images-outline', active: 'images' },
  genie: { label: 'Planner', icon: 'clipboard-outline', active: 'clipboard' },
};

/** Couple-app bottom bar: outline icons, filled + crimson when active, short sentence-case labels. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, i) => {
        const meta = TABS[route.name];
        if (!meta) return null;
        const active = state.index === i;
        const tint = active ? colors.primary : colors.textMuted;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={meta.label}
            style={styles.item}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!active && !event.defaultPrevented) {
                triggerHaptic('selection');
                navigation.navigate(route.name, route.params);
              }
            }}>
            <Ionicons name={active ? meta.active : meta.icon} size={23} color={tint} />
            <Text size={11} weight={active ? 'semibold' : 'regular'} color={tint} lineHeight={14}>
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
  item: { flex: 1, alignItems: 'center', gap: 2 },
});
