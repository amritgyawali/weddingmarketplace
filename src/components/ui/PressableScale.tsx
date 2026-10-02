import * as Haptics from 'expo-haptics';
import { useRef } from 'react';
import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

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

/** Extra touch area around small targets, so a slightly-off tap still lands. */
const SLOP = { top: 6, bottom: 6, left: 6, right: 6 };

/**
 * Pressable that dims while held: the press feedback for every tappable
 * surface. It is a plain `Pressable` (no animated wrapper): an animated
 * style changing on press-in made Android drop some taps, so buttons needed
 * several presses. `onPress` fires on release as usual; a second tap within
 * 350 ms is ignored so a double tap can't submit twice.
 */
export function PressableScale({
  activeScale: _activeScale,
  haptic = false,
  onPress,
  style,
  children,
  disabled,
  hitSlop,
  ...rest
}: PressableScaleProps) {
  const last = useRef(0);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={hitSlop ?? SLOP}
      onPress={(e) => {
        const now = Date.now();
        if (now - last.current < 350) return;
        last.current = now;
        if (haptic) triggerHaptic(haptic === true ? 'light' : haptic);
        onPress?.(e);
      }}
      style={({ pressed }) => [style, pressed && !disabled && { opacity: 0.7 }, disabled && { opacity: 0.45 }]}
      {...rest}>
      {children}
    </Pressable>
  );
}
