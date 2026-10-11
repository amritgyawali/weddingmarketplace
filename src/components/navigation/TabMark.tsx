import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, withTiming } from 'react-native-reanimated';

import { colors, motion, themed } from '@/constants/theme';
import { easeOut } from '@/hooks/useMotion';

/**
 * The champagne mark over the active tab: grows in from the centre when a
 * tab is chosen. Shape and position carry the state, not colour alone.
 * `vertical` draws it down the left edge of a sidebar item instead.
 */
export function TabMark({ active, vertical }: { active: boolean; vertical?: boolean }) {
  const reduced = useReducedMotion();
  const timing = { duration: reduced ? 0 : motion.base, easing: easeOut };
  const style = useAnimatedStyle(() =>
    vertical
      ? { height: withTiming(active ? 18 : 0, timing), opacity: withTiming(active ? 1 : 0, timing) }
      : { width: withTiming(active ? 28 : 0, timing), opacity: withTiming(active ? 1 : 0, timing) },
  );
  return <Animated.View style={[vertical ? styles.side : styles.top, { pointerEvents: 'none' }, style]} />;
}

const styles = themed(() => StyleSheet.create({
  top: { position: 'absolute', top: 0, alignSelf: 'center', height: 3, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, backgroundColor: colors.gold },
  side: { position: 'absolute', left: 0, top: '50%', marginTop: -9, width: 3, borderTopRightRadius: 2, borderBottomRightRadius: 2, backgroundColor: colors.gold },
}));
