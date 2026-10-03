import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, GUTTER } from '@/constants/theme';

import { Text } from './Text';

export function SectionHeader({
  title,
  badge,
  actionLabel = 'View all',
  onAction,
  right,
  inset = true,
}: {
  title: string;
  badge?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  right?: ReactNode;
  inset?: boolean;
}) {
  return (
    <View style={[styles.row, inset && { paddingHorizontal: GUTTER }]}>
      <View style={styles.titleRow}>
        <Text serif weight="bold" size={18} color={colors.heading} numberOfLines={1} style={{ flexShrink: 1 }} accessibilityRole="header">
          {title}
        </Text>
        {badge}
      </View>
      {right ??
        (onAction && (
          <Pressable onPress={onAction} hitSlop={10} style={styles.action} accessibilityRole="button">
            <Text size={14} weight="medium" color={colors.primary}>
              {actionLabel}
            </Text>
          </Pressable>
        ))}
    </View>
  );
}

export function NewBadge() {
  return (
    <View style={styles.badge}>
      <Text size={11} weight="semibold" color={colors.badgeNew} lineHeight={14}>
        New
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  badge: { borderWidth: 1, borderColor: colors.gold, borderRadius: 3, paddingHorizontal: 5, paddingVertical: 1 },
});
