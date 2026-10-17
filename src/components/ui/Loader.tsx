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

/**
 * Fades its children in after `delay` ms. The fade runs on the UI thread, so it
 * still happens while JavaScript is busy drawing a heavy screen; a screen that
 * draws quickly replaces the loader before it ever shows.
 */
function Reveal({ delay, children }: { delay: number; children: React.ReactNode }) {
  const opacity = useSharedValue(delay > 0 ? 0 : 1);
  useEffect(() => {
    if (delay > 0) opacity.set(withDelay(delay, withTiming(1, { duration: 180 })));
  }, [delay, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View style={[styles.reveal, style]}>{children}</Animated.View>;
}

/** Three bouncing dots in the role's accent: the app's loading indicator. `delay` (ms) keeps it hidden for quick loads. */
export function Loader({ size = 9, color, style, delay = 0 }: { size?: number; color?: string; style?: StyleProp<ViewStyle>; delay?: number }) {
  const t = useRoleTheme();
  const dots = (
    <View style={[styles.row, { gap: size * 0.7, height: size * 2.2 }, style]} accessibilityRole="progressbar" accessibilityLabel="Loading">
      {[0, 1, 2].map((i) => (
        <Dot key={i} index={i} size={size} color={color ?? t.c.primary} />
      ))}
    </View>
  );
  return delay > 0 ? <Reveal delay={delay}>{dots}</Reveal> : dots;
}

/** A centred loader with an optional line of text, for whole screens and panels. `delay` (ms) keeps it hidden for quick loads. */
export function LoadingState({ message = 'Loading…', style, delay = 0 }: { message?: string; style?: StyleProp<ViewStyle>; delay?: number }) {
  const t = useRoleTheme();
  const body = (
    <>
      <Loader size={10} />
      <Text size={14} color={t.c.muted ?? colors.textMuted}>
        {message}
      </Text>
    </>
  );
  return <View style={[styles.state, style]}>{delay > 0 ? <Reveal delay={delay}>{body}</Reveal> : body}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },
  reveal: { alignItems: 'center', gap: 14 },
});
