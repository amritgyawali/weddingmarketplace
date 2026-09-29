import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { colors, GUTTER, radius } from '@/constants/theme';

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = radius.sm,
  style,
}: {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useSharedValue(0.55);
  useEffect(() => {
    opacity.set(withRepeat(withTiming(1, { duration: 700 }), -1, true));
  }, [opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return <Animated.View style={[{ width, height, borderRadius, backgroundColor: colors.bgMuted }, animated, style]} />;
}

/** Placeholder matching the large venue card layout. */
export function VenueCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton height={215} borderRadius={radius.md} />
      <View style={styles.row}>
        <Skeleton width={90} height={14} />
        <Skeleton width={60} height={14} />
      </View>
      <Skeleton width="75%" height={20} />
      <Skeleton width="45%" height={18} />
      <View style={styles.row}>
        <Skeleton height={44} borderRadius={22} style={{ flex: 1 }} />
        <Skeleton width={44} height={44} borderRadius={22} />
      </View>
    </View>
  );
}

export function ListRowSkeleton() {
  return (
    <View style={styles.listRow}>
      <Skeleton width={88} height={88} borderRadius={radius.md} />
      <View style={{ flex: 1, gap: 10 }}>
        <Skeleton width="70%" height={16} />
        <Skeleton width="40%" height={14} />
        <Skeleton width="55%" height={14} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: GUTTER, paddingVertical: 14, gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  listRow: { flexDirection: 'row', gap: 14, paddingHorizontal: GUTTER, paddingVertical: 12 },
});
