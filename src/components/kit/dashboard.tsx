import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ornament } from '@/components/ui/Ornament';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/theme';
import { useInbox } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';

import { Card, type IconName } from './primitives';


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
  const alert = !!tone && (tone === t.c.danger || tone === colors.danger) && value !== '0';
  return (
    <Card style={[styles.kpi, style]} onPress={onPress} accessibilityLabel={`${label}: ${value}`}>
      <Text size={13} color={t.c.muted} numberOfLines={1} maxFontSizeMultiplier={1.3}>
        {label}
      </Text>
      <View style={styles.kpiValueRow}>
        <Text serif size={22} weight="semibold" lineHeight={30} color={alert ? t.c.danger : t.c.textStrong} numberOfLines={1} adjustsFontSizeToFit numeric maxFontSizeMultiplier={1.3} style={{ flexShrink: 1 }}>
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

/**
 * The one thing that needs the user now, at the top of a dashboard: a wine
 * band with the gilt ornament, a serif title and at most two actions (the
 * first in champagne). Everything else on the screen sits below it, quieter.
 */
export function FocusBand({
  eyebrow,
  title,
  body,
  figure,
  figureLabel,
  primary,
  secondary,
  onPress,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  /** A headline number on the right (an amount, a count). */
  figure?: string;
  figureLabel?: string;
  primary?: { label: string; onPress: () => void; icon?: IconName };
  secondary?: { label: string; onPress: () => void };
  onPress?: () => void;
}) {
  return (
    <View style={styles.focus}>
      <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={`${eyebrow}. ${title}`} style={({ pressed }) => [styles.focusTop, pressed && { opacity: 0.85 }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Ornament width={56} style={{ marginBottom: 8 }} />
          <Text size={13} weight="medium" color={colors.gold}>
            {eyebrow}
          </Text>
          <Text serif size={19} weight="bold" color={colors.white} lineHeight={26} numberOfLines={2}>
            {title}
          </Text>
          {body && (
            <Text size={13} color={colors.onWineMuted} numberOfLines={2}>
              {body}
            </Text>
          )}
        </View>
        {figure && (
          <View style={{ alignItems: 'flex-end' }}>
            {figureLabel && (
              <Text size={12} color={colors.onWineMuted}>
                {figureLabel}
              </Text>
            )}
            <Text serif size={20} weight="bold" color={colors.gold} lineHeight={28} numeric>
              {figure}
            </Text>
          </View>
        )}
      </Pressable>
      {(primary || secondary) && (
        <View style={styles.focusActions}>
          {secondary && (
            <Pressable onPress={secondary.onPress} accessibilityRole="button" style={({ pressed }) => [styles.focusBtn, styles.focusBtnGhost, pressed && { opacity: 0.75 }]}>
              <Text size={14} weight="semibold" color={colors.white} numberOfLines={1}>
                {secondary.label}
              </Text>
            </Pressable>
          )}
          {primary && (
            <Pressable
              onPress={() => {
                triggerHaptic('light');
                primary.onPress();
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.focusBtn, { backgroundColor: colors.gold, flex: 1.3 }, pressed && { opacity: 0.85 }]}>
              {primary.icon && <Ionicons name={primary.icon} size={16} color={colors.wine} />}
              <Text size={14} weight="semibold" color={colors.wine} numberOfLines={1}>
                {primary.label}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

/**
 * Compact stat for rows of three or four (guests, seating, registry):
 * label above on one line, the Martel figure below, an optional note.
 * `alert` colours the figure only when it flags a problem.
 */
export function StatTile({ label, value, sub, alert, style }: { label: string; value: string; sub?: string; alert?: boolean; style?: StyleProp<ViewStyle> }) {
  const t = useRoleTheme();
  return (
    // A plain surface, not Card: on the web Card's `padding` shorthand would override the tighter padding a four-across row needs.
    <View style={[styles.tile, { backgroundColor: t.c.surface, borderColor: t.c.border, borderRadius: t.cardRadius }, style]} accessible accessibilityLabel={`${label}: ${value}${sub ? `, ${sub}` : ''}`}>
      <Text size={12} weight="medium" color={t.c.muted} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.3}>
        {label}
      </Text>
      <Text serif size={20} weight="semibold" lineHeight={28} color={alert ? t.c.warning : t.c.textStrong} numberOfLines={1} adjustsFontSizeToFit numeric maxFontSizeMultiplier={1.3}>
        {value}
      </Text>
      {sub && (
        <Text size={11} color={t.c.muted} lineHeight={14} numberOfLines={2} maxFontSizeMultiplier={1.3}>
          {sub}
        </Text>
      )}
    </View>
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
                <Text size={12} weight="semibold" color={t.c.textStrong} numeric style={{ marginBottom: 4 }}>
                  {format ? format(d.value) : d.value}
                </Text>
              )}
              <View
                style={{
                  width: '56%',
                  maxWidth: 40,
                  height: Math.max(3, (d.value / max) * (height - 20)),
                  borderTopLeftRadius: 3,
                  borderTopRightRadius: 3,
                  backgroundColor: last ? t.c.primary : t.c.soft,
                }}
              />
            </View>
          );
        })}
      </View>
      <View style={[styles.labels, { borderTopColor: t.c.border }]}>
        {data.map((d) => (
          <Text key={d.label} size={12} color={t.c.muted} align="center" style={{ flex: 1 }} maxFontSizeMultiplier={1.2}>
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
          <Text size={10} weight="bold" color={t.c.onPrimary} lineHeight={12} maxFontSizeMultiplier={1}>
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
          <Text serif size={t.role === 'platform' ? 20 : 22} weight="bold" lineHeight={t.role === 'platform' ? 28 : 30} color={t.c.textStrong} numberOfLines={1} accessibilityRole="header">
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
        <Text serif size={17} weight="semibold" color={t.c.textStrong} numberOfLines={1} accessibilityRole="header">
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
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.quick, { opacity: pressed ? 0.6 : 1 }]}>
      <View style={[styles.quickIcon, { backgroundColor: t.c.soft }]}>
        <Ionicons name={icon} size={22} color={t.c.primary} />
      </View>
      <Text size={13} weight="medium" color={t.c.text} align="center" numberOfLines={2} maxFontSizeMultiplier={1.3}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  kpi: { flex: 1, minWidth: '46%', gap: 0, paddingTop: 12, paddingBottom: 12, paddingLeft: 14, paddingRight: 14 },
  kpiValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  tile: { flex: 1, minWidth: 0, gap: 0, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 8 },
  focus: { backgroundColor: colors.wine, borderRadius: 12, borderWidth: 1, borderColor: colors.goldLine, padding: 16, gap: 14 },
  focusTop: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  focusActions: { flexDirection: 'row', gap: 10, width: '100%', maxWidth: 440 },
  focusBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: 8, paddingHorizontal: 12 },
  focusBtnGhost: { borderWidth: 1, borderColor: colors.goldLine },
  bars: { flexDirection: 'row', alignItems: 'flex-end' },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  labels: { flexDirection: 'row', paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backBtn: { width: 40, height: 44, alignItems: 'flex-start', justifyContent: 'center', marginLeft: -4, marginRight: -6 },
  badge: { position: 'absolute', top: 4, right: 3, minWidth: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  stack: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  quick: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 2 },
  quickIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});
