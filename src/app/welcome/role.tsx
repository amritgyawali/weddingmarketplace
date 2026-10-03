import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/ui/IconButton';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { BRAND } from '@/constants/brand';
import { colors } from '@/constants/theme';
import { useFeatures } from '@/hooks/useFeatures';
import { useSession } from '@/store/useSession';
import { ROLE_THEMES } from '@/theme/roles';
import type { UserRole } from '@/types/platform';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

const ROLES: { role: UserRole; icon: ComponentProps<typeof Ionicons>['name']; who: string }[] = [
  { role: 'customer', icon: 'heart-outline', who: 'We’re getting married, or planning it for family' },
  { role: 'vendor', icon: 'storefront-outline', who: 'I run a venue, studio, caterer or decor business' },
  { role: 'freelancer', icon: 'camera-outline', who: 'I shoot, do makeup or work crew at weddings' },
  { role: 'platform', icon: 'id-card-outline', who: 'I work at Vivah' },
];

export default function RolePicker() {
  const insets = useSafeAreaInsets();
  const selectRole = useSession((s) => s.selectRole);
  const on = useFeatures();
  const roles = ROLES.filter(({ role }) => role === 'customer' || on(`signup.${role}`));

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: insets.bottom + 24 }}>
        <View style={{ paddingHorizontal: 8 }}>
          <BackButton />
        </View>
        <View style={styles.head}>
          <Text serif size={28} weight="bold" color={colors.heading} lineHeight={38}>
            How will you use {BRAND.name}?
          </Text>
          <Text size={15} color={colors.textMuted}>
            Each account type opens its own app. You can switch later.
          </Text>
        </View>

        <View style={styles.list}>
          {roles.map(({ role, icon, who }, i) => {
            const theme = ROLE_THEMES[role];
            return (
              <Pressable
                key={role}
                accessibilityRole="button"
                accessibilityLabel={`Continue as ${theme.label}`}
                onPress={() => {
                  triggerHaptic('light');
                  selectRole(role);
                  router.push('/welcome/login');
                }}
                style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && { backgroundColor: colors.bgSoft }]}>
                <View style={styles.icon}>
                  <Ionicons name={icon} size={22} color={theme.c.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text size={17} weight="semibold" color={colors.heading}>
                    {theme.label}
                  </Text>
                  <Text size={14} color={colors.textMuted}>
                    {who}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
              </Pressable>
            );
          })}
          {/* Vivah staff with full control: login only (super admins are created from the console, never self sign-up). */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue as Super admin"
            onPress={() => {
              triggerHaptic('light');
              selectRole('platform');
              router.push({ pathname: '/welcome/login', params: { as: 'super_admin' } });
            }}
            style={({ pressed }) => [styles.row, styles.rowBorder, pressed && { backgroundColor: colors.bgSoft }]}>
            <View style={styles.icon}>
              <Ionicons name="shield-checkmark-outline" size={22} color={ROLE_THEMES.platform.c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text size={17} weight="semibold" color={colors.heading}>
                Super admin
              </Text>
              <Text size={14} color={colors.textMuted}>
                Full control: edit any account, record, feature or text
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  head: { paddingHorizontal: 20, marginTop: 20, marginBottom: 24, gap: 4 },
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 16 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  icon: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
});
