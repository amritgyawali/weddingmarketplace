import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { colors, GUTTER, themed } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';

/** City switcher plus icon actions: the top bar of the Home and Vendors tabs. */
export function CityHeader({ right, border = true }: { right: ReactNode; border?: boolean }) {
  const insets = useSafeAreaInsets();
  const city = useAppStore((s) => s.city);

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 6 }, border && styles.border]}>
      <PressableScale
        onPress={() => router.push('/select-city')}
        accessibilityLabel={`Current city ${city}. Change city`}
        style={styles.city}>
        <Ionicons name="location-outline" size={18} color={colors.primary} />
        <Text weight="bold" size={19} color={colors.heading} numberOfLines={1} style={{ flexShrink: 1 }}>
          {city}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} style={{ marginTop: 2 }} />
      </PressableScale>
      <View style={styles.actions}>{right}</View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GUTTER,
    paddingBottom: 8,
    backgroundColor: colors.white,
    zIndex: 10,
  },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  city: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1, marginRight: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 2, marginRight: -8 },
}));
