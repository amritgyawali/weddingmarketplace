import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/Text';
import { useInbox } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';

import { Card, type IconName } from './primitives';

const ALERT_TONES = ['#DC2626', '#EF4444', '#E11D48', '#B42318'];

/** Text-only stat tile: label on top, figure below. `tone` only matters when it flags a problem. */
export function KpiCard({
  label,
  value,
  icon: _icon,
  delta,
  tone,
  style,
  onPress,
}: {
  label: string;
  value: string;
  /** Kept for call-site compatibility; stat tiles no longer draw icons. */
  icon: IconName;
  delta?: string;
  tone?: string;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const t = useRoleTheme();
  const negative = delta?.startsWith('-');
  const alert = !!tone && (tone === t.c.danger || ALERT_TONES.includes(tone.toUpperCase())) && value !== '0';
  return (
    <Card style={[styles.kpi, style]} onPress={onPress} accessibilityLabel={`${label}: ${value}`}>
      <Text size={13} color={t.c.muted} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.kpiValueRow}>
        <Text size={24} weight="semibold" lineHeight={30} color={alert ? t.c.danger : t.c.textStrong} numberOfLines={1} adjustsFontSizeToFit style={{ flexShrink: 1 }}>
          {value}
        </Text>
        {delta && (
          <Text size={12} weight="medium" color={negative ? t.c.danger : t.c.success}>
            {delta}
          </Text>
        )}
      </View>
    </Card>
  );
}

/** Minimal column chart (no chart lib needed). The latest bar is inked, the rest stay grey. */
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
                <Text size={11} weight="semibold" color={t.c.textStrong} style={{ marginBottom: 4 }}>
                  {format ? format(d.value) : d.value}
                </Text>
              )}
              <View
                style={{
                  width: '56%',
                  height: Math.max(3, (d.value / max) * (height - 20)),
                  borderTopLeftRadius: 2,
                  borderTopRightRadius: 2,
                  backgroundColor: last ? t.c.primary : t.c.border,
                }}
              />
            </View>
          );
        })}
      </View>
      <View style={[styles.labels, { borderTopColor: t.c.border }]}>
        {data.map((d) => (
          <Text key={d.label} size={11} color={t.c.muted} align="center" style={{ flex: 1 }}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function BellButton() {
  const account = useAccount();
  const unread = useInbox(account).filter((n) => !n.read).length;
  const t = useRoleTheme();
  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      hitSlop={10}
      accessibilityLabel={`Notifications, ${unread} unread`}
      style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}>
      <Ionicons name="notifications-outline" size={23} color={t.c.textStrong} />
      {unread > 0 && (
        <View style={[styles.badge, { backgroundColor: t.c.danger, borderColor: t.c.header }]}>
          <Text size={10} weight="bold" color="#FFFFFF" lineHeight={12}>
            {unread > 9 ? '9+' : unread}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/** "VIVAH FOR BUSINESS" → "Vivah for business". Mixed-case strings pass through untouched. */
function sentenceCase(s: string) {
  if (s !== s.toUpperCase()) return s;
  const lower = s.toLowerCase();
  return (lower.charAt(0).toUpperCase() + lower.slice(1)).replace(/\bvivah\b/g, 'Vivah').replace(/\b(wp|qt)-/g, (m) => m.toUpperCase());
}

/** Tab-root header: plain bar, title on the left, bell on the right. Same shape in every role app. */
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
  return (
    <View style={[styles.header, { backgroundColor: t.c.header, borderBottomColor: t.c.border, paddingTop: insets.top + 10 }]}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          {eyebrow && (
            <Text size={13} color={t.c.muted} numberOfLines={1}>
              {sentenceCase(eyebrow)}
            </Text>
          )}
          <Text size={t.role === 'platform' ? 21 : 23} weight="bold" lineHeight={t.role === 'platform' ? 28 : 30} color={t.c.textStrong} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text size={14} color={t.c.muted} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        <View style={styles.headerActions}>
          {right}
          <BellButton />
        </View>
      </View>
      {children}
    </View>
  );
}

/** Stack header for detail screens. */
export function StackHeader({ title, subtitle, right, back = true }: { title: string; subtitle?: string; right?: ReactNode; back?: boolean }) {
  const t = useRoleTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.stack, { paddingTop: insets.top + 6, backgroundColor: t.c.header, borderBottomColor: t.c.border }]}>
      {back && (
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace(`/${t.role === 'vendor' ? 'business' : t.role}` as Href))}
          hitSlop={12}
          accessibilityLabel="Go back"
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}>
          <Ionicons name="chevron-back" size={24} color={t.c.textStrong} />
        </Pressable>
      )}
      <View style={{ flex: 1 }}>
        <Text size={17} weight="semibold" color={t.c.textStrong} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text size={13} color={t.c.muted} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {right}
    </View>
  );
}

/** Shortcut (icon over label) used in dashboard shortcut rows. */
export function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const t = useRoleTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.quick, { opacity: pressed ? 0.6 : 1 }]}>
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={23} color={t.c.textStrong} />
      </View>
      <Text size={13} color={t.c.text} align="center" numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  kpi: { flex: 1, minWidth: '46%', gap: 0, paddingVertical: 12, paddingHorizontal: 14 },
  kpiValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  bars: { flexDirection: 'row', alignItems: 'flex-end' },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  labels: { flexDirection: 'row', paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backBtn: { width: 30, height: 40, alignItems: 'flex-start', justifyContent: 'center', marginLeft: -4 },
  badge: { position: 'absolute', top: 4, right: 3, minWidth: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  stack: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  quick: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 4 },
  quickIcon: { width: 44, height: 34, alignItems: 'center', justifyContent: 'center' },
});
