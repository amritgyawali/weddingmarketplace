import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { colors } from '@/constants/theme';
import { useRoleTheme } from '@/theme/RoleTheme';

import { Text } from './Text';

function Dot({ index, color, size }: { index: number; color: string; size: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.set(withDelay(index * 140, withRepeat(withSequence(withTiming(1, { duration: 380, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 380, easing: Easing.in(Easing.quad) })), -1)));
  }, [index, v]);
  const style = useAnimatedStyle(() => ({ opacity: 0.35 + v.get() * 0.65, transform: [{ translateY: -v.get() * size * 0.6 }, { scale: 0.85 + v.get() * 0.25 }] }));
  return <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />;
}

/** Three bouncing dots in the role's accent: the app's loading indicator. */
export function Loader({ size = 9, color, style }: { size?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  const t = useRoleTheme();
  return (
    <View style={[styles.row, { gap: size * 0.7, height: size * 2.2 }, style]} accessibilityRole="progressbar" accessibilityLabel="Loading">
      {[0, 1, 2].map((i) => (
        <Dot key={i} index={i} size={size} color={color ?? t.c.primary} />
      ))}
    </View>
  );
}

/** A centred loader with an optional line of text, for whole screens and panels. */
export function LoadingState({ message = 'Loading…', style }: { message?: string; style?: StyleProp<ViewStyle> }) {
  const t = useRoleTheme();
  return (
    <View style={[styles.state, style]}>
      <Loader size={10} />
      <Text size={14} color={t.c.muted ?? colors.textMuted}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },
});
