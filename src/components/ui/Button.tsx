import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius } from '@/constants/theme';

import { Loader } from './Loader';
import { PressableScale, triggerHaptic } from './PressableScale';
import { Text } from './Text';
import { toast } from './Toast';

type Variant = 'primary' | 'outline' | 'white' | 'ghost' | 'soft';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: ComponentProps<typeof Ionicons>['name'];
  leading?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  /**
   * What the person still has to fill in. The button then looks dimmed but
   * stays tappable, and a tap shows this message instead of doing nothing.
   */
  missing?: string | false | null;
  /** Called on a tap while `missing` is set (e.g. `useFormCheck().reveal`). */
  onMissing?: () => void;
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
  missing,
  onMissing,
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
      onPress={
        missing
          ? () => {
              triggerHaptic('medium');
              toast(missing, 'warning-outline');
              onMissing?.();
            }
          : onPress
      }
      disabled={disabled || loading}
      haptic={!missing}
      accessibilityLabel={label}
      accessibilityHint={missing || undefined}
      style={[
        styles.base,
        {
          height: HEIGHT[size],
          backgroundColor: p.bg,
          borderColor: p.border ?? 'transparent',
          borderWidth: p.border ? 1 : 0,
        },
        style,
        !!missing && !disabled && { opacity: 0.45 },
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
