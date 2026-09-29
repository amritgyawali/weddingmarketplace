import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/tabs';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { triggerHaptic } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useRoleTheme } from '@/theme/RoleTheme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export interface RoleTab {
  name: string;
  label: string;
  icon: IconName;
  activeIcon: IconName;
  badge?: number;
}

/**
 * One tab bar, three personalities:
 * vendor — white bar, active tab expands into a teal pill;
 * freelancer — floating dark capsule with amber active circle;
 * platform — navy console rail with a top indicator.
 */
export function RoleTabBar({ state, navigation, tabs }: BottomTabBarProps & { tabs: RoleTab[] }) {
  const t = useRoleTheme();
  const insets = useSafeAreaInsets();

  const press = (routeName: string, key: string, focused: boolean) => {
    const event = navigation.emit({ type: 'tabPress', target: key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) {
      triggerHaptic('selection');
      navigation.navigate(routeName);
    }
  };

  const items = state.routes
    .map((route, index) => ({ route, index, tab: tabs.find((x) => x.name === route.name) }))
    .filter((x): x is typeof x & { tab: RoleTab } => !!x.tab);

  if (t.role === 'freelancer') {
    return (
      <View style={[styles.floatWrap, { paddingBottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
        <View style={[styles.float, { backgroundColor: t.c.surface, borderColor: t.c.border }]}>
          {items.map(({ route, index, tab }) => {
            const focused = state.index === index;
            return (
              <Pressable
                key={route.key}
                onPress={() => press(route.name, route.key, focused)}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={tab.label}
                style={styles.floatItem}>
                <View style={[styles.floatIcon, focused && { backgroundColor: t.c.primary }]}>
                  <Ionicons name={focused ? tab.activeIcon : tab.icon} size={21} color={focused ? t.c.onPrimary : t.c.muted} />
                  {!!tab.badge && !focused && <View style={[styles.dotBadge, { backgroundColor: t.c.primary }]} />}
                </View>
                <Text size={10} weight="semibold" color={focused ? t.c.primary : t.c.muted}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  if (t.role === 'platform') {
    return (
      <View style={[styles.rail, { backgroundColor: t.c.header, paddingBottom: Math.max(insets.bottom, 8) }]}>
        {items.map(({ route, index, tab }) => {
          const focused = state.index === index;
          return (
            <Pressable
              key={route.key}
              onPress={() => press(route.name, route.key, focused)}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.label}
              style={styles.railItem}>
              <View style={[styles.railIndicator, { backgroundColor: focused ? '#A5B4FC' : 'transparent' }]} />
              <View>
                <Ionicons name={focused ? tab.activeIcon : tab.icon} size={21} color={focused ? '#FFFFFF' : '#8F8CC0'} />
                {!!tab.badge && (
                  <View style={styles.railBadge}>
                    <Text size={9} weight="bold" color="#FFFFFF" lineHeight={11}>
                      {tab.badge > 9 ? '9+' : tab.badge}
                    </Text>
                  </View>
                )}
              </View>
              <Text size={10} weight={focused ? 'bold' : 'medium'} color={focused ? '#FFFFFF' : '#8F8CC0'}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  // vendor
  return (
    <View style={[styles.pillBar, { backgroundColor: t.c.surface, borderTopColor: t.c.border, paddingBottom: Math.max(insets.bottom, 10) }]}>
      {items.map(({ route, index, tab }) => {
        const focused = state.index === index;
        return (
          <Pressable
            key={route.key}
            onPress={() => press(route.name, route.key, focused)}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
            style={[styles.pillItem, { flex: focused ? 1.9 : 1 }]}>
            <Animated.View layout={LinearTransition.duration(180)} style={[styles.pill, focused && { backgroundColor: t.c.soft, paddingHorizontal: 14 }]}>
              <View>
                <Ionicons name={focused ? tab.activeIcon : tab.icon} size={21} color={focused ? t.c.primary : t.c.muted} />
                {!!tab.badge && (
                  <View style={[styles.pillBadge, { borderColor: t.c.surface }]}>
                    <Text size={9} weight="bold" color="#FFFFFF" lineHeight={11}>
                      {tab.badge > 9 ? '9+' : tab.badge}
                    </Text>
                  </View>
                )}
              </View>
              {focused && (
                <Text size={12} weight="bold" color={t.c.primary} numberOfLines={1}>
                  {tab.label}
                </Text>
              )}
            </Animated.View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  floatWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14 },
  float: { flexDirection: 'row', borderRadius: 28, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 6 },
  floatItem: { flex: 1, alignItems: 'center', gap: 3 },
  floatIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dotBadge: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4 },
  rail: { flexDirection: 'row' },
  railItem: { flex: 1, alignItems: 'center', gap: 4, paddingBottom: 6 },
  railIndicator: { width: 28, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, marginBottom: 6 },
  railBadge: { position: 'absolute', top: -5, right: -9, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  pillBar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, paddingHorizontal: 8 },
  pillItem: { flex: 1, alignItems: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, borderRadius: 19, paddingHorizontal: 8 },
  pillBadge: { position: 'absolute', top: -4, right: -8, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5 },
});
