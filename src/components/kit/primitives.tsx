import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { statusLabel, statusTone } from '@/theme/roles';
import { useRoleTheme } from '@/theme/RoleTheme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** Themed surface. `pressable` turns it into a card button. */
export function Card({
  children,
  style,
  onPress,
  padded = true,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  padded?: boolean;
  accessibilityLabel?: string;
}) {
  const t = useRoleTheme();
  const base: StyleProp<ViewStyle> = [
    {
      backgroundColor: t.c.surface,
      borderRadius: t.cardRadius,
      borderWidth: 1,
      borderColor: t.c.border,
      padding: padded ? 16 : 0,
    },
    !t.dark && styles.cardShadow,
    style,
  ];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <PressableScale onPress={onPress} activeScale={0.985} accessibilityLabel={accessibilityLabel} style={base}>
      {children}
    </PressableScale>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

export function KButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  size = 'md',
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
}) {
  const t = useRoleTheme();
  const palette: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
    primary: { bg: t.c.primary, fg: t.c.onPrimary, border: t.c.primary },
    secondary: { bg: t.c.surface, fg: t.c.primary, border: t.c.primary },
    ghost: { bg: 'transparent', fg: t.c.primary, border: 'transparent' },
    danger: { bg: t.dark ? '#3A1D1D' : '#FEF2F2', fg: t.c.danger, border: t.c.danger },
    success: { bg: t.c.success, fg: '#FFFFFF', border: t.c.success },
  };
  const p = palette[variant];
  const height = size === 'sm' ? 36 : size === 'lg' ? 52 : 44;
  return (
    <PressableScale
      haptic
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={label}
      style={[
        styles.button,
        { height, backgroundColor: p.bg, borderColor: p.border, borderRadius: t.role === 'platform' ? 10 : height / 2 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={size === 'sm' ? 16 : 18} color={p.fg} />}
          <Text size={size === 'sm' ? 13 : 15} weight="semibold" color={p.fg}>
            {label}
          </Text>
        </>
      )}
    </PressableScale>
  );
}

export function StatusPill({ status, label }: { status: string; label?: string }) {
  const t = useRoleTheme();
  const tone = statusTone(status, t);
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
      <View style={[styles.dot, { backgroundColor: tone.fg }]} />
      <Text size={11} weight="bold" color={tone.fg} lineHeight={14}>
        {label ?? statusLabel(status)}
      </Text>
    </View>
  );
}

const AVATAR_COLORS = ['#0EA5E9', '#8B5CF6', '#F97316', '#10B981', '#E11D48', '#6366F1', '#14B8A6', '#D97706'];

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');
  const color = AVATAR_COLORS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `${color}26`, alignItems: 'center', justifyContent: 'center' }}>
      <Text size={size * 0.38} weight="bold" color={color}>
        {initials}
      </Text>
    </View>
  );
}

export function ProgressBar({ value, color, height = 6 }: { value: number; color?: string; height?: number }) {
  const t = useRoleTheme();
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: t.c.surfaceAlt, overflow: 'hidden' }}>
      <View style={{ height, width: `${Math.min(100, Math.max(0, value * 100))}%`, backgroundColor: color ?? t.c.primary, borderRadius: height / 2 }} />
    </View>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const t = useRoleTheme();
  return (
    <View style={styles.sectionTitle}>
      <Text size={17} weight="bold" color={t.c.textStrong}>
        {title}
      </Text>
      {action && onAction && (
        <Pressable onPress={onAction} hitSlop={10}>
          <Text size={13} weight="semibold" color={t.c.primary}>
            {action}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export function EmptyBlock({ icon = 'file-tray-outline', title, message, action, onAction }: { icon?: IconName; title: string; message?: string; action?: string; onAction?: () => void }) {
  const t = useRoleTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: t.c.soft }]}>
        <Ionicons name={icon} size={28} color={t.c.primary} />
      </View>
      <Text size={17} weight="bold" color={t.c.textStrong} align="center">
        {title}
      </Text>
      {message && (
        <Text size={14} color={t.c.muted} align="center" style={{ maxWidth: 290 }}>
          {message}
        </Text>
      )}
      {action && onAction && <KButton label={action} onPress={onAction} size="sm" style={{ marginTop: 8, paddingHorizontal: 20 }} />}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const t = useRoleTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: t.c.border }, style]} />;
}

/** Label/value line used in summaries. */
export function KeyValue({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const t = useRoleTheme();
  return (
    <View style={styles.kv}>
      <Text size={14} color={t.c.muted}>
        {label}
      </Text>
      <Text size={strong ? 16 : 14} weight={strong ? 'bold' : 'semibold'} color={t.c.textStrong} style={{ flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cardShadow: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18, borderWidth: 1.2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  empty: { alignItems: 'center', padding: 28, gap: 8 },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 4 },
});
