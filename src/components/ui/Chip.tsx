import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius } from '@/constants/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  onPress?: () => void;
  selected?: boolean;
  /**
   * elevated — white with a hairline border (onboarding choices)
   * outline  — hairline border, ink text (popular searches)
   * filled   — quiet grey fill (filters)
   * All three turn solid burgundy when selected.
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
    { paddingHorizontal: isLg ? 16 : 12, paddingVertical: isLg ? 10 : 6, minHeight: isLg ? 44 : 34 },
  ];

  let bg: string = colors.bgSoft;
  let fg: string = colors.text;
  let borderColor = 'transparent';

  if (variant === 'elevated' || variant === 'outline') {
    bg = selected ? colors.primary : colors.white;
    fg = selected ? colors.white : colors.text;
    borderColor = selected ? colors.primary : colors.border;
  } else {
    bg = selected ? colors.primary : colors.bgSoft;
    fg = selected ? colors.white : colors.text;
    borderColor = selected ? colors.primary : colors.border;
  }

  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[
        base,
        { backgroundColor: bg, borderColor, borderWidth: 1 },
        style,
      ]}>
      {leading}
      <Text weight={bold || selected ? 'semibold' : 'medium'} size={isLg ? 15 : 14} color={fg}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
