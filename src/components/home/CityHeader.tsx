import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { colors, GUTTER } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';

/** Pink city switcher + round actions — top bar of the For You and Vendors tabs. */
export function CityHeader({ right, border = true }: { right: ReactNode; border?: boolean }) {
  const insets = useSafeAreaInsets();
  const city = useAppStore((s) => s.city);

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }, border && styles.border]}>
      <PressableScale
        onPress={() => router.push('/select-city')}
        accessibilityLabel={`Current city ${city}. Change city`}
        activeScale={0.96}
        style={styles.city}>
        <Text weight="bold" size={24} color={colors.primary} tracking={-0.4} numberOfLines={1} style={{ flexShrink: 1 }}>
          {city}
        </Text>
        <Ionicons name="chevron-down" size={22} color={colors.primary} style={{ marginTop: 2 }} />
      </PressableScale>
      <View style={styles.actions}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GUTTER,
    paddingBottom: 12,
    backgroundColor: colors.white,
    zIndex: 10,
  },
  border: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
  city: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 1, marginRight: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
});
