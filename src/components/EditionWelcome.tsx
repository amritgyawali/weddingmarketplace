import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';
import { LanguageSwitch } from '@/components/ui/LanguageSwitch';
import { Ornament } from '@/components/ui/Ornament';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { toastError } from '@/components/ui/Toast';
import { BRAND } from '@/constants/brand';
import { EDITION, EDITION_ROLE, editionInfo } from '@/constants/edition';
import { usesDirectRoleEntry } from '@/constants/env';
import { colors, themed } from '@/constants/theme';
import { enterDemoRole } from '@/services/auth';
import { useSession } from '@/store/useSession';
import { ROLE_THEMES } from '@/theme/roles';

const ICONS: Record<Exclude<typeof EDITION, 'all'>, ComponentProps<typeof Ionicons>['name']> = {
  vendor: 'storefront-outline',
  freelancer: 'camera-outline',
  staff: 'id-card-outline',
  admin: 'shield-checkmark-outline',
};

/**
 * The signed-out screen of a single-role app (constants/edition.ts): what the
 * app is for and one button in. The local demo opens the edition's seeded
 * account; live builds go to the usual login for that one role.
 */
export function EditionWelcome() {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const selectRole = useSession((s) => s.selectRole);
  const direct = usesDirectRoleEntry();
  if (EDITION === 'all' || !EDITION_ROLE || !editionInfo) return null;
  const role = EDITION_ROLE;
  const info = editionInfo;
  const theme = ROLE_THEMES[role];
  const superAdmin = EDITION === 'admin';

  const enter = () => {
    if (direct) {
      const error = enterDemoRole(superAdmin ? 'super_admin' : role);
      if (error) return toastError(error);
      if (superAdmin) setTimeout(() => router.replace('/platform/admin'), 0);
      return;
    }
    selectRole(role);
    router.push({ pathname: '/welcome/login', params: superAdmin ? { as: 'super_admin' } : {} });
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView bounces={false} contentContainerStyle={{ flexGrow: 1 }}>
        <View style={[styles.hero, { backgroundColor: theme.gradient[0], paddingTop: insets.top + 16 }]}>
          <View style={styles.heroTop}>
            <View>
              <Text serif size={24} weight="bold" color={colors.onDark} lineHeight={32}>
                {BRAND.name}
              </Text>
              <Text serif size={13} color={colors.gold} lineHeight={18} raw>
                विवाह
              </Text>
            </View>
            <LanguageSwitch compact />
          </View>
          <Animated.View entering={reduced ? undefined : FadeInDown.duration(450)} style={styles.badgeWrap}>
            <View style={styles.badge}>
              <Ionicons name={ICONS[EDITION]} size={34} color={colors.gold} />
            </View>
            <Ornament width={72} />
            <Text serif size={28} weight="bold" color={colors.onDark} lineHeight={38} align="center">
              {info.appName}
            </Text>
          </Animated.View>
        </View>

        <Animated.View entering={reduced ? undefined : FadeInUp.duration(450).delay(120)} style={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
          <View style={{ gap: 6 }}>
            <Text serif size={22} weight="bold" color={colors.heading} lineHeight={30}>
              {info.title}
            </Text>
            <Text size={15} color={colors.textMuted} lineHeight={22}>
              {info.who}
            </Text>
          </View>

          <View style={styles.points}>
            {info.points.map((point) => (
              <View key={point} style={styles.point}>
                <Ionicons name="checkmark-circle" size={20} color={theme.c.primary} />
                <Text size={15} color={colors.text} style={{ flex: 1 }}>
                  {point}
                </Text>
              </View>
            ))}
          </View>

          <View style={{ flex: 1 }} />

          <PressableScale
            haptic
            onPress={enter}
            style={[styles.primary, { backgroundColor: theme.c.primary }]}
            accessibilityRole="button"
            accessibilityLabel={direct ? `Open ${info.appName}` : 'Log in'}>
            <Text size={16} weight="semibold" color={theme.c.onPrimary}>
              {direct ? 'Get started' : 'Log in'}
            </Text>
          </PressableScale>
          {direct && (
            <Text size={12} color={colors.textSubtle} align="center" lineHeight={18}>
              Opens a demo account stored on this device.
            </Text>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  hero: { paddingHorizontal: 20, paddingBottom: 32, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badgeWrap: { alignItems: 'center', gap: 14, marginTop: 28 },
  badge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 28, gap: 22 },
  points: { gap: 14 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  primary: { height: 52, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
}));
