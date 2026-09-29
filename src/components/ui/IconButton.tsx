import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, hitSlop } from '@/constants/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface IconButtonProps {
  icon?: IoniconName;
  children?: ReactNode;
  onPress?: () => void;
  size?: number;
  iconSize?: number;
  color?: string;
  background?: string;
  badge?: number;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

/** Round grey action button used across every top bar in the reference UI. */
export function IconButton({
  icon,
  children,
  onPress,
  size = 36,
  iconSize = 19,
  color = colors.text,
  background = colors.bgMuted,
  badge,
  accessibilityLabel,
  style,
}: IconButtonProps) {
  return (
    <PressableScale
      onPress={onPress}
      hitSlop={hitSlop}
      activeScale={0.9}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: background },
        style,
      ]}>
      {children ?? (icon && <Ionicons name={icon} size={iconSize} color={color} />)}
      {!!badge && badge > 0 && (
        <View style={styles.badge}>
          <Text size={10} weight="bold" color={colors.white} lineHeight={13}>
            {badge > 9 ? '9+' : badge}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

/** Circular back chevron — falls back to home when there is no history (deep links). */
export function BackButton({ onPress, style }: { onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <IconButton
      icon="chevron-back"
      iconSize={20}
      size={34}
      accessibilityLabel="Go back"
      onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.white,
  },
});
