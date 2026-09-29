import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, shadows } from '@/constants/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

type Variant = 'primary' | 'outline' | 'white' | 'ghost' | 'soft';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: ComponentProps<typeof Ionicons>['name'];
  leading?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  size?: 'md' | 'lg' | 'sm';
  style?: StyleProp<ViewStyle>;
  color?: string;
}

const HEIGHT = { sm: 38, md: 46, lg: 54 } as const;
const FONT = { sm: 14, md: 16, lg: 17 } as const;

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  leading,
  loading,
  disabled,
  size = 'md',
  style,
  color,
}: ButtonProps) {
  const tint = color ?? colors.primary;
  const palette: Record<Variant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: tint, fg: colors.white },
    outline: { bg: colors.white, fg: tint, border: tint },
    white: { bg: colors.white, fg: tint },
    ghost: { bg: 'transparent', fg: tint },
    soft: { bg: colors.primarySoft, fg: tint },
  };
  const p = palette[variant];

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      haptic
      accessibilityLabel={label}
      style={[
        styles.base,
        {
          height: HEIGHT[size],
          backgroundColor: p.bg,
          borderColor: p.border ?? 'transparent',
          borderWidth: p.border ? 1.2 : 0,
        },
        variant === 'white' && shadows.card,
        variant === 'primary' && shadows.pinkGlow,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.row}>
          {leading}
          {icon && <Ionicons name={icon} size={FONT[size] + 3} color={p.fg} />}
          <Text weight="semibold" size={FONT[size]} color={p.fg}>
            {label}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
