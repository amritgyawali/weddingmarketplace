import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, GUTTER } from '@/constants/theme';

import { BackButton } from './IconButton';
import { Text } from './Text';

/**
 * Top bar used by stack screens: back chevron, centred title and an optional
 * right slot. Includes the status-bar inset.
 */
export function ScreenHeader({
  title,
  subtitle,
  right,
  left,
  back = true,
  border = true,
  onBack,
  background = colors.white,
  style,
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  left?: ReactNode;
  back?: boolean;
  border?: boolean;
  onBack?: () => void;
  background?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.wrap,
        { paddingTop: insets.top + 4, backgroundColor: background },
        border && styles.border,
        style,
      ]}>
      <View style={styles.side}>{left ?? (back ? <BackButton onPress={onBack} /> : null)}</View>
      <View style={styles.center}>
        {title && (
          <Text serif weight="semibold" size={17} color={colors.heading} numberOfLines={1} align="center" accessibilityRole="header">
            {title}
          </Text>
        )}
        {subtitle && (
          <Text size={12} color={colors.textMuted} numberOfLines={1} align="center">
            {subtitle}
          </Text>
        )}
      </View>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: GUTTER - 8,
    paddingBottom: 6,
    minHeight: 52,
    zIndex: 10,
  },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  side: { minWidth: 76, flexDirection: 'row', alignItems: 'center', gap: 4 },
  right: { justifyContent: 'flex-end' },
  center: { flex: 1, alignItems: 'center' },
});
