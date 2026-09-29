import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GenieLampIcon } from '@/components/ui/Icons';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { colors, shadows } from '@/constants/theme';

const TABS: Record<string, { label: string; icon: (color: string) => React.ReactNode }> = {
  index: { label: 'FOR YOU', icon: (c) => <Ionicons name="home" size={17} color={c} /> },
  venues: { label: 'VENUES', icon: (c) => <MaterialCommunityIcons name="storefront" size={18} color={c} /> },
  vendors: { label: 'VENDORS', icon: (c) => <MaterialCommunityIcons name="account-tie" size={19} color={c} /> },
  ideas: { label: 'IDEAS', icon: (c) => <Ionicons name="sparkles" size={16} color={c} /> },
  genie: { label: 'GENIE', icon: (c) => <GenieLampIcon size={21} color={c} /> },
};

function TabItem({ active, label, icon, onPress }: { active: boolean; label: string; icon: (c: string) => React.ReactNode; onPress: () => void }) {
  const circle = useAnimatedStyle(() => ({
    backgroundColor: withTiming(active ? colors.primary : colors.bgMuted, { duration: 180 }),
    transform: [{ scale: withTiming(active ? 1.06 : 1, { duration: 180 }) }],
  }));

  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      activeScale={0.92}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={styles.item}>
      <Animated.View style={[styles.circle, circle]}>{icon(active ? colors.white : '#4B4B4E')}</Animated.View>
      <Text size={10.5} weight={active ? 'bold' : 'semibold'} color={active ? colors.primary : '#4B4B4E'} tracking={0.5} lineHeight={14}>
        {label}
      </Text>
    </PressableScale>
  );
}

/** Custom bar reproducing the pink-circle active state of the reference design. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {state.routes.map((route, i) => {
        const meta = TABS[route.name];
        if (!meta) return null;
        const active = state.index === i;
        return (
          <TabItem
            key={route.key}
            active={active}
            label={meta.label}
            icon={meta.icon}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!active && !event.defaultPrevented) navigation.navigate(route.name, route.params);
            }}
          />
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
    borderTopColor: colors.hairline,
    paddingTop: 8,
    ...shadows.tabBar,
  },
  item: { flex: 1, alignItems: 'center', gap: 5 },
  circle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
