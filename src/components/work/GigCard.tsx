import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Card, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { SKILL_ICONS } from '@/data/skills';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Gig } from '@/types/platform';
import { daysUntil, formatINR, formatShortDate } from '@/utils/format';

/** Gig summary used by the freelancer feed and the vendor/platform hiring lists. */
export function GigCard({ gig, onPress, showApplicants, badge }: { gig: Gig; onPress?: () => void; showApplicants?: boolean; badge?: string }) {
  const t = useRoleTheme();
  const days = daysUntil(gig.date);
  const hired = gig.applications.filter((a) => a.status === 'hired' || a.status === 'completed').length;
  const pending = gig.applications.filter((a) => a.status === 'applied' || a.status === 'shortlisted').length;
  const icon = (SKILL_ICONS[gig.skill] ?? 'briefcase-outline') as React.ComponentProps<typeof Ionicons>['name'];

  return (
    <Card onPress={onPress} accessibilityLabel={gig.title} style={{ gap: 12 }}>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: t.c.soft }]}>
          <Ionicons name={icon} size={22} color={t.c.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text size={12} weight="bold" color={t.c.primary} tracking={0.4}>
            {gig.skill.toUpperCase()}
          </Text>
          <Text size={16} weight="bold" color={t.c.textStrong} numberOfLines={2}>
            {gig.title}
          </Text>
          <Text size={12} color={t.c.muted} numberOfLines={1}>
            by {gig.postedByName}
          </Text>
        </View>
        {badge ? <StatusPill status={badge} /> : gig.status !== 'open' && <StatusPill status={gig.status} />}
      </View>
      <View style={styles.meta}>
        <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={14} color={t.c.muted} />
          <Text size={12} color={t.c.text}>
            {formatShortDate(gig.date)}
            {days >= 0 && days <= 7 ? ` · ${days === 0 ? 'today' : `in ${days}d`}` : ''}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={14} color={t.c.muted} />
          <Text size={12} color={t.c.text}>
            {gig.startTime} · {gig.hours}h
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="location-outline" size={14} color={t.c.muted} />
          <Text size={12} color={t.c.text}>
            {gig.city}
          </Text>
        </View>
      </View>
      <View style={styles.row}>
        <Text size={20} weight="bold" color={t.c.textStrong} style={{ flex: 1 }}>
          {formatINR(gig.pay)}
          <Text size={12} color={t.c.muted}>
            {' '}/ person
          </Text>
        </Text>
        {showApplicants ? (
          <Text size={12} weight="semibold" color={t.c.muted}>
            {hired}/{gig.slots} hired · {pending} pending
          </Text>
        ) : (
          <Text size={12} weight="semibold" color={t.c.muted}>
            {gig.slots - hired} spot{gig.slots - hired === 1 ? '' : 's'} left
          </Text>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
