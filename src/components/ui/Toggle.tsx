import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors, shadow, themed } from '@/constants/theme';
import { useRoleTheme } from '@/theme/RoleTheme';

import { triggerHaptic } from './PressableScale';

const TRACK_W = 52;
const TRACK_H = 31;
const KNOB = 27;

/** On/off switch. */
export function Toggle({
  value,
  onValueChange,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  accessibilityLabel: string;
}) {
  const t = useRoleTheme();
  const on = t.c.primary;
  const off = t.c.borderStrong;
  const progress = useSharedValue(value ? 1 : 0);

  const reduced = useReducedMotion();
  useEffect(() => {
    progress.set(withTiming(value ? 1 : 0, { duration: reduced ? 0 : 180 }));
  }, [value, progress, reduced]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.get(), [0, 1], [off, on]),
  }));
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.get() * (TRACK_W - KNOB - 4) }],
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      onPress={() => {
        triggerHaptic('selection');
        onValueChange(!value);
      }}>
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.knob, knobStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  track: { width: TRACK_W, height: TRACK_H, borderRadius: TRACK_H / 2, padding: 2, justifyContent: 'center' },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: colors.onDark,
    ...shadow(2, 0.15, 3, 2, colors.black),
  },
}));
