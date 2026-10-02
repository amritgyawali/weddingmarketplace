import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Loader } from '@/components/ui/Loader';
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
    style,
  ];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <PressableScale onPress={onPress} accessibilityLabel={accessibilityLabel} style={base}>
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
    secondary: { bg: t.c.surface, fg: t.c.textStrong, border: t.c.border },
    ghost: { bg: 'transparent', fg: t.c.primary, border: 'transparent' },
    danger: { bg: t.c.surface, fg: t.c.danger, border: t.c.border },
    success: { bg: t.c.success, fg: '#FFFFFF', border: t.c.success },
  };
  const p = palette[variant];
  const height = size === 'sm' ? 34 : size === 'lg' ? 50 : 42;
  return (
    <PressableScale
      haptic
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={label}
      style={[
        styles.button,
        { height, backgroundColor: p.bg, borderColor: p.border, borderRadius: t.role === 'platform' ? 6 : 8 },
        style,
      ]}>
      {loading ? (
        <Loader size={7} color={p.fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon === 'sparkles-outline' || icon === 'sparkles' ? 'add' : icon} size={size === 'sm' ? 16 : 18} color={p.fg} />}
          <Text size={size === 'sm' ? 14 : 15} weight="semibold" color={p.fg} numberOfLines={1} style={{ flexShrink: 1 }}>
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
      <Text size={12} weight="semibold" color={tone.fg} lineHeight={16}>
        {label ?? statusLabel(status)}
      </Text>
    </View>
  );
}

/** Muted, earthy initials colours (brass, pine, clay, slate, plum, moss). */
const AVATAR_COLORS = ['#8A6A2F', '#2E5E50', '#9A4A34', '#44566E', '#6C3F5E', '#566B3A'];

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');
  const color = AVATAR_COLORS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `${color}1F`, alignItems: 'center', justifyContent: 'center' }}>
      <Text size={size * 0.38} weight="semibold" color={color}>
        {initials}
      </Text>
    </View>
  );
}

export function ProgressBar({ value, color, height = 4 }: { value: number; color?: string; height?: number }) {
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
      <Text size={16} weight="bold" color={t.c.textStrong} style={{ flex: 1 }}>
        {title}
      </Text>
      {action && onAction && (
        <Pressable onPress={onAction} hitSlop={12} style={({ pressed }) => pressed && { opacity: 0.6 }}>
          <Text size={14} weight="medium" color={t.c.primary}>
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
      <Ionicons name={icon} size={30} color={t.c.subtle} style={{ marginBottom: 2 }} />
      <Text size={16} weight="semibold" color={t.c.textStrong} align="center">
        {title}
      </Text>
      {message && (
        <Text size={14} color={t.c.muted} align="center" style={{ maxWidth: 290 }}>
          {message}
        </Text>
      )}
      {action && onAction && <KButton label={action} onPress={onAction} size="sm" variant="secondary" style={{ marginTop: 8, paddingHorizontal: 16 }} />}
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
      <Text size={14} color={t.c.muted} style={{ flexShrink: 1 }}>
        {label}
      </Text>
      <Text size={strong ? 16 : 14} weight={strong ? 'bold' : 'semibold'} color={t.c.textStrong} style={{ flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 16, borderWidth: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  sectionTitle: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  empty: { alignItems: 'center', padding: 28, gap: 6 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 4 },
});
