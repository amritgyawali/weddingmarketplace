import * as Haptics from 'expo-haptics';
import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Kept for older call sites; presses now dim instead of shrinking. */
  activeScale?: number;
  haptic?: boolean | 'light' | 'medium' | 'selection';
}

export const triggerHaptic = (kind: 'light' | 'medium' | 'selection' | 'success' = 'light') => {
  if (Platform.OS === 'web') return;
  if (kind === 'selection') Haptics.selectionAsync().catch(() => {});
  else if (kind === 'success')
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  else
    Haptics.impactAsync(
      kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
    ).catch(() => {});
};

/** Pressable that dims briefly while held: the press feedback for every tappable surface. */
export function PressableScale({
  activeScale: _activeScale,
  haptic = false,
  onPressIn,
  onPressOut,
  onPress,
  style,
  children,
  disabled,
  ...rest
}: PressableScaleProps) {
  const dim = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: dim.get() }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={disabled}
      onPressIn={(e) => {
        dim.set(withTiming(0.72, { duration: 60 }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        dim.set(withTiming(1, { duration: 160 }));
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic) triggerHaptic(haptic === true ? 'light' : haptic);
        onPress?.(e);
      }}
      style={[animatedStyle, style, disabled && { opacity: 0.45 }]}
      {...rest}>
      {children}
    </AnimatedPressable>
  );
}
