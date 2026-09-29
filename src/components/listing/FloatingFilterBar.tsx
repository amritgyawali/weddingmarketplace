import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { GenieLampIcon } from '@/components/ui/Icons';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { colors, gradients, shadows } from '@/constants/theme';

/** Floating pink "Filter | Genie" pill anchored above the tab bar. */
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
    <Animated.View entering={FadeInDown.delay(250).springify()} style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      <View style={[styles.pill, shadows.pinkGlow]}>
        <LinearGradient colors={gradients.filterBar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        <PressableScale haptic onPress={onFilter} accessibilityLabel={`Filter, ${count} active`} style={styles.half}>
          <Ionicons name="options-outline" size={22} color={colors.white} />
          <Text size={17} weight="medium" color={colors.white}>
            Filter
          </Text>
          {count > 0 && (
            <View style={styles.count}>
              <Text size={12} weight="bold" color={colors.textStrong} lineHeight={15}>
                {count}
              </Text>
            </View>
          )}
        </PressableScale>
        <View style={styles.divider} />
        <PressableScale haptic onPress={onGenie} accessibilityLabel="Genie" style={styles.half}>
          <GenieLampIcon size={26} color={colors.white} />
          <Text size={17} weight="medium" color={colors.white}>
            Genie
          </Text>
        </PressableScale>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  half: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, height: '100%' },
  divider: { width: 1.5, height: 26, backgroundColor: 'rgba(255,255,255,0.7)' },
  count: { minWidth: 18, height: 20, borderRadius: 3, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
});
