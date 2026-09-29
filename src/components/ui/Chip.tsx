import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, shadows } from '@/constants/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  onPress?: () => void;
  selected?: boolean;
  /**
   * elevated — white pill with soft shadow (onboarding)
   * outline  — pink outline (popular searches)
   * filled   — grey fill, pink when selected (filters)
   */
  variant?: 'elevated' | 'outline' | 'filled';
  size?: 'md' | 'lg';
  bold?: boolean;
  leading?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Chip({
  label,
  onPress,
  selected,
  variant = 'filled',
  size = 'md',
  bold,
  leading,
  style,
}: ChipProps) {
  const isLg = size === 'lg';
  const base: StyleProp<ViewStyle> = [
    styles.base,
    { paddingHorizontal: isLg ? 17 : 14, paddingVertical: isLg ? 11 : 7, minHeight: isLg ? 44 : undefined },
  ];

  let bg: string = colors.bgMuted;
  let fg: string = colors.text;
  let borderColor = 'transparent';

  if (variant === 'elevated') {
    bg = selected ? colors.primary : colors.white;
    fg = selected ? colors.white : colors.text;
  } else if (variant === 'outline') {
    bg = selected ? colors.primary : colors.white;
    fg = selected ? colors.white : colors.primary;
    borderColor = colors.primary;
  } else {
    bg = selected ? colors.primarySoft : colors.bgMuted;
    fg = selected ? colors.primary : colors.text;
    borderColor = selected ? colors.primary : 'transparent';
  }

  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[
        base,
        { backgroundColor: bg, borderColor, borderWidth: variant === 'elevated' ? 0 : 1.2 },
        variant === 'elevated' && (selected ? shadows.pinkGlow : shadows.pill),
        style,
      ]}>
      {leading}
      <Text weight={bold || selected ? 'semibold' : 'medium'} size={isLg ? 16 : 14} color={fg}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
