import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/Text';
import { useInbox } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';

import { Card, type IconName } from './primitives';

export function KpiCard({
  label,
  value,
  icon,
  delta,
  tone,
  style,
  onPress,
}: {
  label: string;
  value: string;
  icon: IconName;
  delta?: string;
  tone?: string;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const t = useRoleTheme();
  const color = tone ?? t.c.primary;
  const negative = delta?.startsWith('-');
  return (
    <Card style={[styles.kpi, style]} onPress={onPress} accessibilityLabel={`${label}: ${value}`}>
      <View style={styles.kpiTop}>
        <View style={[styles.kpiIcon, { backgroundColor: `${color}${t.dark ? '33' : '1A'}` }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        {delta && (
          <Text size={12} weight="bold" color={negative ? t.c.danger : t.c.success}>
            {delta}
          </Text>
        )}
      </View>
      <Text size={22} weight="bold" color={t.c.textStrong} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text size={12} weight="medium" color={t.c.muted} numberOfLines={1}>
        {label}
      </Text>
    </Card>
  );
}

/** Minimal column chart (no chart lib needed). */
export function BarChart({ data, height = 120, format }: { data: { label: string; value: number }[]; height?: number; format?: (v: number) => string }) {
  const t = useRoleTheme();
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View>
      <View style={[styles.bars, { height }]}>
        {data.map((d, i) => {
          const last = i === data.length - 1;
          return (
            <View key={d.label} style={styles.barCol} accessibilityLabel={`${d.label}: ${format ? format(d.value) : d.value}`}>
              {last && (
                <Text size={10} weight="bold" color={t.c.primary} style={{ marginBottom: 4 }}>
                  {format ? format(d.value) : d.value}
                </Text>
              )}
              <View
                style={{
                  width: '62%',
                  height: Math.max(4, (d.value / max) * (height - 20)),
                  borderRadius: 6,
                  backgroundColor: last ? t.c.primary : `${t.c.primary}${t.dark ? '55' : '40'}`,
                }}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.labels}>
        {data.map((d) => (
          <Text key={d.label} size={10} color={t.c.muted} align="center" style={{ flex: 1 }}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function BellButton({ light }: { light: boolean }) {
  const account = useAccount();
  const unread = useInbox(account).filter((n) => !n.read).length;
  const t = useRoleTheme();
  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      hitSlop={10}
      accessibilityLabel={`Notifications, ${unread} unread`}
      style={[styles.iconBtn, { backgroundColor: light ? 'rgba(255,255,255,0.16)' : t.c.surfaceAlt }]}>
      <Ionicons name="notifications-outline" size={20} color={light ? '#FFFFFF' : t.c.textStrong} />
      {unread > 0 && (
        <View style={[styles.badge, { backgroundColor: t.role === 'freelancer' ? t.c.primary : '#EF4444' }]}>
          <Text size={10} weight="bold" color={t.role === 'freelancer' ? t.c.onPrimary : '#FFFFFF'} lineHeight={12}>
            {unread > 9 ? '9+' : unread}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/**
 * Tab-root header. Each role gets its own look:
 * vendor — teal gradient with rounded base; freelancer — dark minimal;
 * platform — compact navy console bar.
 */
export function RoleHeader({
  eyebrow,
  title,
  subtitle,
  right,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children?: ReactNode;
}) {
  const t = useRoleTheme();
  const insets = useSafeAreaInsets();
  const light = t.role === 'vendor' || t.role === 'platform';

  const content = (
    <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 18, paddingBottom: children ? 16 : t.role === 'vendor' ? 22 : 14 }}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          {eyebrow && (
            <Text size={12} weight="semibold" color={light ? 'rgba(255,255,255,0.75)' : t.c.muted} tracking={0.6}>
              {eyebrow}
            </Text>
          )}
          <Text size={t.role === 'platform' ? 20 : 24} weight="bold" color={light ? '#FFFFFF' : t.c.textStrong} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text size={13} color={light ? 'rgba(255,255,255,0.8)' : t.c.muted} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        <View style={styles.headerActions}>
          {right}
          <BellButton light={light} />
        </View>
      </View>
      {children}
    </View>
  );

  if (t.role === 'vendor') {
    return (
      <LinearGradient colors={t.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.vendorHeader}>
        {content}
      </LinearGradient>
    );
  }
  return <View style={{ backgroundColor: t.c.header }}>{content}</View>;
}

/** Stack header for detail screens, styled per role. */
export function StackHeader({ title, subtitle, right, back = true }: { title: string; subtitle?: string; right?: ReactNode; back?: boolean }) {
  const t = useRoleTheme();
  const insets = useSafeAreaInsets();
  const light = t.role === 'vendor' || t.role === 'platform';
  return (
    <View style={[styles.stack, { paddingTop: insets.top + 6, backgroundColor: t.c.header, borderBottomColor: t.dark ? t.c.border : 'transparent' }]}>
      {back && (
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace(`/${t.role === 'vendor' ? 'business' : t.role}` as Href))}
          hitSlop={12}
          accessibilityLabel="Go back"
          style={[styles.iconBtn, { backgroundColor: light ? 'rgba(255,255,255,0.16)' : t.c.surfaceAlt }]}>
          <Ionicons name="chevron-back" size={20} color={light ? '#FFFFFF' : t.c.textStrong} />
        </Pressable>
      )}
      <View style={{ flex: 1 }}>
        <Text size={17} weight="bold" color={light ? '#FFFFFF' : t.c.textStrong} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text size={12} color={light ? 'rgba(255,255,255,0.75)' : t.c.muted} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {right}
    </View>
  );
}

/** Quick action tile (icon + label) used on dashboards. */
export function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const t = useRoleTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.quick, { opacity: pressed ? 0.7 : 1 }]}>
      <View style={[styles.quickIcon, { backgroundColor: t.c.soft, borderRadius: t.role === 'platform' ? 12 : 18 }]}>
        <Ionicons name={icon} size={22} color={t.c.primary} />
      </View>
      <Text size={12} weight="semibold" color={t.c.text} align="center" numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  kpi: { flex: 1, minWidth: '46%', gap: 4, padding: 14 },
  kpiTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  kpiIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  bars: { flexDirection: 'row', alignItems: 'flex-end' },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  labels: { flexDirection: 'row', marginTop: 6 },
  vendorHeader: { borderBottomLeftRadius: 26, borderBottomRightRadius: 26 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  stack: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  quick: { flex: 1, alignItems: 'center', gap: 6 },
  quickIcon: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center' },
});
