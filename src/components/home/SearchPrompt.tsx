import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { TourTarget } from '@/components/tour/AppTour';
import { Text } from '@/components/ui/Text';
import { colors, GUTTER } from '@/constants/theme';

/** A search field at the top of home that opens the search screen: easier to find than an icon. */
export function SearchPrompt() {
  return (
    <TourTarget id="search" style={styles.wrap}>
      <Pressable
        onPress={() => router.push('/search')}
        accessibilityRole="search"
        accessibilityLabel="Search venues, vendors and ideas"
        style={({ pressed }) => [styles.field, pressed && { backgroundColor: colors.bgMuted }]}>
        <Ionicons name="search-outline" size={19} color={colors.textMuted} />
        <Text size={15} color={colors.textMuted} numberOfLines={1} style={{ flex: 1 }}>
          Search venues, photographers, makeup…
        </Text>
      </Pressable>
    </TourTarget>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: GUTTER, marginTop: 14 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSoft,
  },
});
