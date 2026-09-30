import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Card, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { skillIcon } from '@/data/skills';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Gig } from '@/types/platform';
import { daysUntil, formatClock, formatMoney, formatShortDate } from '@/utils/format';

const HIRED = ['hired', 'confirmed', 'checked_in', 'completed'];

/** Gig summary used by the freelancer feed and the vendor/platform hiring lists. */
export function GigCard({ gig, onPress, showApplicants, badge, distance }: { gig: Gig; onPress?: () => void; showApplicants?: boolean; badge?: string; distance?: number | null }) {
  const t = useRoleTheme();
  const days = daysUntil(gig.date);
  const hired = gig.applications.filter((a) => HIRED.includes(a.status)).length;
  const pending = gig.applications.filter((a) => a.status === 'applied' || a.status === 'shortlisted').length;

  return (
    <Card onPress={onPress} accessibilityLabel={gig.title} style={[{ gap: 12 }, gig.emergency && gig.status === 'open' && { borderColor: t.c.danger, borderWidth: 1 }]}>
      {gig.emergency && gig.status === 'open' && (
        <View style={[styles.emergency, { backgroundColor: `${t.c.danger}22` }]}>
          <Ionicons name="medkit" size={13} color={t.c.danger} />
          <Text size={12} weight="medium" color={t.c.danger}>
            Urgent · {days === 0 ? 'Today' : formatShortDate(gig.date)}
          </Text>
        </View>
      )}
      <View style={styles.row}>
        <View style={[styles.icon, { borderWidth: 1, borderColor: t.c.border }]}>
          <Ionicons name={skillIcon(gig.skill) as never} size={22} color={t.c.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text size={12} weight="medium" color={t.c.muted}>
            {gig.skill}
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
            {formatClock(gig.startTime)} · {gig.hours}h
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="location-outline" size={14} color={t.c.muted} />
          <Text size={12} color={t.c.text}>
            {gig.city}
            {distance !== undefined && distance !== null ? ` · ${distance} km` : ''}
          </Text>
        </View>
      </View>
      {!!gig.equipment?.length && (
        <Text size={12} color={t.c.muted} numberOfLines={1}>
          Needs: {gig.equipment.join(', ')}
        </Text>
      )}
      <View style={styles.row}>
        <Text size={20} weight="bold" color={t.c.textStrong} style={{ flex: 1 }}>
          {formatMoney(gig.pay)}
          <Text size={12} color={t.c.muted}>
            {' '}/ person
          </Text>
        </Text>
        {showApplicants ? (
          <Text size={12} weight="semibold" color={t.c.muted}>
            {hired}/{gig.slots} hired · {pending} pending{gig.invited?.length ? ` · ${gig.invited.length} invited` : ''}
          </Text>
        ) : (
          <Text size={12} weight="semibold" color={t.c.muted}>
            {Math.max(0, gig.slots - hired)} spot{gig.slots - hired === 1 ? '' : 's'} left
          </Text>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  emergency: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
});
