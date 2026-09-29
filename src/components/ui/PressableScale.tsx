import * as Haptics from 'expo-haptics';
import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Scale applied while pressed. */
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

/** Pressable with a spring "squish" — the tactile feel used for every tappable card and pill. */
export function PressableScale({
  activeScale = 0.97,
  haptic = false,
  onPressIn,
  onPressOut,
  onPress,
  style,
  children,
  disabled,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={disabled}
      onPressIn={(e) => {
        scale.set(withTiming(activeScale, { duration: 90 }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, { damping: 14, stiffness: 260 }));
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic) triggerHaptic(haptic === true ? 'light' : haptic);
        onPress?.(e);
      }}
      style={[animatedStyle, disabled && { opacity: 0.5 }, style]}
      {...rest}>
      {children}
    </AnimatedPressable>
  );
}
