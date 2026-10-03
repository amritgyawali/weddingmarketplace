import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius } from '@/constants/theme';

import { Loader } from './Loader';
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

const HEIGHT = { sm: 36, md: 44, lg: 50 } as const;
const FONT = { sm: 14, md: 15, lg: 16 } as const;

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
    outline: { bg: colors.white, fg: colors.heading, border: colors.borderStrong },
    white: { bg: colors.white, fg: colors.heading },
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
          borderWidth: p.border ? 1 : 0,
        },
        style,
      ]}>
      {loading ? (
        <Loader size={7} color={p.fg} />
      ) : (
        <View style={styles.row}>
          {leading}
          {icon && <Ionicons name={icon} size={FONT[size] + 2} color={p.fg} />}
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
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
