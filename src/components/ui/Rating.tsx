import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';

import { Text } from './Text';

export function Rating({ value, count, size = 15 }: { value: number; count?: number; size?: number }) {
  return (
    <View style={styles.row} accessibilityLabel={`Rated ${value} out of 5${count ? ` from ${count} reviews` : ''}`}>
      <Ionicons name="star" size={size - 1} color={colors.star} />
      <Text size={size} weight="medium" color={colors.text}>
        {value.toFixed(1)}
      </Text>
      {count !== undefined && (
        <Text size={size} color={colors.textMuted}>
          ({count})
        </Text>
      )}
    </View>
  );
}

/** Interactive 5-star input used when writing a review. */
export function StarInput({ value, onChange, size = 34 }: { value: number; onChange: (v: number) => void; size?: number }) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons
          key={n}
          name={n <= value ? 'star' : 'star-outline'}
          size={size}
          color={n <= value ? colors.star : colors.textSubtle}
          onPress={() => onChange(n)}
          accessibilityRole="button"
          accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`}
          style={{ paddingHorizontal: 3 }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
