import { Ionicons } from '@expo/vector-icons';
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
        <Text weight="semibold" size={19} color={colors.heading} tracking={-0.2} numberOfLines={1} style={{ flexShrink: 1 }}>
          {title}
        </Text>
        {badge}
      </View>
      {right ??
        (onAction && (
          <Pressable onPress={onAction} hitSlop={10} style={styles.action} accessibilityRole="button">
            <Text size={13} weight="semibold" color={colors.primary}>
              {actionLabel}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </Pressable>
        ))}
    </View>
  );
}

export function NewBadge() {
  return (
    <View style={styles.badge}>
      <Text size={11} weight="bold" color={colors.white} lineHeight={14} tracking={0.4}>
        NEW
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  badge: { backgroundColor: colors.badgeNew, borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3 },
});
