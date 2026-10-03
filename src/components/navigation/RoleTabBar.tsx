import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { triggerHaptic } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { BRAND } from '@/constants/brand';
import { tabFeature } from '@/data/features';
import { useFeatures, useLinkOn } from '@/hooks/useFeatures';
import { useLayout } from '@/hooks/useLayout';
import { useRoleTheme } from '@/theme/RoleTheme';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

type IconName = ComponentProps<typeof Ionicons>['name'];

export interface RoleTab {
  name: string;
  label: string;
  icon: IconName;
  activeIcon: IconName;
  badge?: number;
}

export interface SidebarLink {
  label: string;
  icon: IconName;
  href: Href;
  badge?: number;
  /** Links with a section are listed under that heading, after the others. */
  section?: string;
}

/**
 * Shared tab bar for the vendor, freelancer and staff apps. On phones it is a
 * plain bottom bar; at desktop widths it becomes a sidebar that also lists
 * the deep links. The same component in every role, only the accent differs.
 */
export function RoleTabBar({ state, navigation, tabs, links: allLinks = [] }: BottomTabBarProps & { tabs: RoleTab[]; links?: SidebarLink[] }) {
  const t = useRoleTheme();
  const insets = useSafeAreaInsets();
  const { wide } = useLayout();
  const on = useFeatures();
  const linkOn = useLinkOn();
  // Sidebar links to switched-off features (and extras not switched on) disappear.
  const links = allLinks.filter((l) => linkOn(l.href));

  const press = (routeName: string, key: string, focused: boolean) => {
    const event = navigation.emit({ type: 'tabPress', target: key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) {
      triggerHaptic('selection');
      navigation.navigate(routeName);
    }
  };

  const items = state.routes
    .map((route, index) => ({ route, index, tab: tabs.find((x) => x.name === route.name) }))
    .filter((x): x is typeof x & { tab: RoleTab } => !!x.tab)
    // The first tab and the staff "More" tab (home of the super admin console) can't be switched off.
    .filter((x) => x.index === 0 || x.route.name === 'index' || x.route.name === 'more' || on(tabFeature(t.role, x.route.name)));

  if (wide) {
    return (
      <View style={[styles.sidebar, { backgroundColor: t.c.surface, borderRightColor: t.c.border, paddingTop: insets.top + 20 }]}>
        <View style={styles.sideBrand}>
          <Text size={20} weight="bold" serif color={t.c.textStrong} lineHeight={26}>
            {BRAND.name}
          </Text>
          <Text size={13} color={t.c.muted}>
            {t.label}
          </Text>
        </View>
        {items.map(({ route, index, tab }) => {
          const focused = state.index === index;
          return (
            <Pressable
              key={route.key}
              onPress={() => press(route.name, route.key, focused)}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              style={({ pressed }) => [styles.sideItem, focused && { backgroundColor: t.c.surfaceAlt }, pressed && !focused && { opacity: 0.7 }]}>
              <Ionicons name={focused ? tab.activeIcon : tab.icon} size={19} color={focused ? t.c.primary : t.c.muted} />
              <Text size={14} weight={focused ? 'semibold' : 'regular'} color={focused ? t.c.textStrong : t.c.text} style={{ flex: 1 }}>
                {tab.label}
              </Text>
              {!!tab.badge && (
                <Text size={12} weight="semibold" color={t.c.danger}>
                  {tab.badge > 99 ? '99+' : tab.badge}
                </Text>
              )}
            </Pressable>
          );
        })}
        {links.length > 0 && <View style={[styles.sideDivider, { backgroundColor: t.c.border }]} />}
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {[...links.filter((l) => !l.section), ...links.filter((l) => l.section)].map((l, i, all) => (
            <View key={`${l.section ?? ''}${l.label}`}>
              {!!l.section && all[i - 1]?.section !== l.section && (
                <Text size={12} weight="semibold" color={t.c.muted} style={styles.sideSection}>
                  {l.section}
                </Text>
              )}
              <Pressable onPress={() => router.push(l.href)} style={({ pressed }) => [styles.sideItem, pressed && { opacity: 0.7 }]}>
                <Ionicons name={l.icon} size={18} color={t.c.muted} />
                <Text size={14} color={t.c.text} style={{ flex: 1 }}>
                  {l.label}
                </Text>
                {!!l.badge && (
                  <Text size={12} weight="semibold" color={t.c.danger}>
                    {l.badge}
                  </Text>
                )}
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.bar, { backgroundColor: t.c.surface, borderTopColor: t.c.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
      {items.map(({ route, index, tab }) => {
        const focused = state.index === index;
        const tint = focused ? t.c.primary : t.c.muted;
        return (
          <Pressable
            key={route.key}
            onPress={() => press(route.name, route.key, focused)}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.badge ? `${tab.label}, ${tab.badge} new` : tab.label}
            style={({ pressed }) => [styles.item, pressed && { opacity: 0.6 }]}>
            <View>
              <Ionicons name={focused ? tab.activeIcon : tab.icon} size={23} color={tint} />
              {!!tab.badge && (
                <View style={[styles.badge, { backgroundColor: t.c.danger, borderColor: t.c.surface }]}>
                  <Text size={9} weight="bold" color="#FFFFFF" lineHeight={11}>
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </Text>
                </View>
              )}
            </View>
            <Text size={11} weight={focused ? 'semibold' : 'regular'} color={tint} lineHeight={14} numberOfLines={1}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: { width: 228, borderRightWidth: StyleSheet.hairlineWidth, paddingBottom: 18, gap: 1 },
  sideBrand: { paddingHorizontal: 20, marginBottom: 16 },
  sideItem: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  sideDivider: { height: StyleSheet.hairlineWidth, marginVertical: 10, marginHorizontal: 20 },
  sideSection: { paddingHorizontal: 20, marginTop: 14, marginBottom: 4 },
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 7 },
  item: { flex: 1, alignItems: 'center', gap: 2, minHeight: 44, justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -10, minWidth: 17, height: 17, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
});
