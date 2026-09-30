import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { colors, shadows } from '@/constants/theme';

/** Floating "Filters | Planner" button anchored above the tab bar. */
export function FloatingFilterBar({
  count,
  onFilter,
  onGenie,
  bottom = 16,
}: {
  count: number;
  onFilter: () => void;
  onGenie: () => void;
  bottom?: number;
}) {
  return (
    <Animated.View entering={FadeIn.delay(200)} style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      <View style={styles.bar}>
        <PressableScale haptic onPress={onFilter} accessibilityLabel={`Filters, ${count} active`} style={styles.half}>
          <Ionicons name="options-outline" size={19} color={colors.white} />
          <Text size={15} weight="medium" color={colors.white}>
            Filters{count > 0 ? ` · ${count}` : ''}
          </Text>
        </PressableScale>
        <View style={styles.divider} />
        <PressableScale haptic onPress={onGenie} accessibilityLabel="Get a planner" style={styles.half}>
          <Ionicons name="call-outline" size={18} color={colors.white} />
          <Text size={15} weight="medium" color={colors.white}>
            Get a planner
          </Text>
        </PressableScale>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.heading,
    paddingHorizontal: 4,
    ...shadows.fab,
  },
  half: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: '100%' },
  divider: { width: StyleSheet.hairlineWidth, height: 20, backgroundColor: 'rgba(255,255,255,0.4)' },
});
