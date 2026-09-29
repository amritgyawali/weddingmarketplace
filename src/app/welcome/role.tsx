import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/ui/IconButton';
import { RingsMark } from '@/components/ui/Icons';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { BRAND } from '@/constants/brand';
import { colors } from '@/constants/theme';
import { useSession } from '@/store/useSession';
import { useRoleFonts } from '@/theme/fonts';
import { ROLE_THEMES } from '@/theme/roles';
import type { UserRole } from '@/types/platform';

const ROLES: { role: UserRole; icon: ComponentProps<typeof Ionicons>['name']; features: string[] }[] = [
  { role: 'customer', icon: 'heart', features: ['Venues & vendors', 'Quotes & bookings', 'My Wedding tracker'] },
  { role: 'vendor', icon: 'storefront', features: ['Leads & quotations', 'Projects & payments', 'Hire freelancers'] },
  { role: 'freelancer', icon: 'flash', features: ['Find gigs nearby', 'Check-in on site', 'Weekly payouts'] },
  { role: 'platform', icon: 'shield-checkmark', features: ['Wedding control room', 'Approvals', 'Genie planning'] },
];

export default function RolePicker() {
  const insets = useSafeAreaInsets();
  const selectRole = useSession((s) => s.selectRole);
  const fontsReady = useRoleFonts('all');
  if (!fontsReady) return <View style={styles.root} />;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 24, paddingHorizontal: 20 }}>
        <BackButton />
        <View style={styles.brand}>
          <View style={styles.mark}>
            <RingsMark size={26} />
          </View>
          <Text size={13} weight="bold" color={colors.primary} tracking={1.2}>
            {BRAND.name.toUpperCase()} · ONE WEDDING PLATFORM
          </Text>
        </View>
        <Text size={32} weight="bold" color={colors.heading} lineHeight={38} tracking={-0.6}>
          Who are you?
        </Text>
        <Text size={15} color={colors.textMuted} style={{ marginTop: 6, marginBottom: 22 }}>
          Every account type gets its own app experience.
        </Text>

        <View style={{ gap: 14 }}>
          {ROLES.map(({ role, icon, features }, i) => {
            const theme = ROLE_THEMES[role];
            return (
              <Animated.View key={role} entering={FadeInDown.delay(i * 70).duration(380)}>
                <PressableScale
                  haptic
                  accessibilityLabel={`Continue as ${theme.label}`}
                  onPress={() => {
                    selectRole(role);
                    router.push('/welcome/login');
                  }}
                  style={styles.card}>
                  <LinearGradient colors={theme.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                  <View style={styles.cardTop}>
                    <View style={styles.icon}>
                      <Ionicons name={icon} size={24} color={role === 'freelancer' ? '#111418' : '#FFFFFF'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text size={20} weight="bold" color={role === 'freelancer' ? '#111418' : '#FFFFFF'} style={{ fontFamily: theme.fonts.bold }}>
                        {theme.label}
                      </Text>
                      <Text size={13} color={role === 'freelancer' ? 'rgba(17,20,24,0.8)' : 'rgba(255,255,255,0.85)'} style={{ fontFamily: theme.fonts.regular }}>
                        {theme.tagline}
                      </Text>
                    </View>
                    <Ionicons name="arrow-forward" size={20} color={role === 'freelancer' ? '#111418' : '#FFFFFF'} />
                  </View>
                  <View style={styles.features}>
                    {features.map((f) => (
                      <View key={f} style={[styles.feature, { backgroundColor: role === 'freelancer' ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.18)' }]}>
                        <Text size={11} weight="semibold" color={role === 'freelancer' ? '#111418' : '#FFFFFF'} style={{ fontFamily: theme.fonts.semibold }}>
                          {f}
                        </Text>
                      </View>
                    ))}
                  </View>
                </PressableScale>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgSoft },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24, marginBottom: 14 },
  mark: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 20, overflow: 'hidden', padding: 16, gap: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  icon: { width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  features: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  feature: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
});
