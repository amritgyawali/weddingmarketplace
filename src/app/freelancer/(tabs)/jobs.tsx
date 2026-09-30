import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, EmptyBlock, Segmented, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { GigCard } from '@/components/work/GigCard';
import { myApplication, useFreelancerWorkspace } from '@/hooks/useWorkspace';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import { daysUntil, formatClock, formatMoney, formatShortDate } from '@/utils/format';

type Filter = 'upcoming' | 'applied' | 'completed';

/** Everything the freelancer is booked on (wedding assignments + standalone gigs) and applications. */
export default function MyJobs() {
  const t = useRoleTheme();
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const { assignments, applied, standalone } = useFreelancerWorkspace(account);
  const [filter, setFilter] = useState<Filter>('upcoming');

  const activeAssignments = assignments.filter((x) => !['CANCELLED', 'EMERGENCY_REPLACEMENT', 'NO_SHOW'].includes(x.assignment.status));
  const upcomingAssign = activeAssignments.filter((x) => x.assignment.status !== 'COMPLETED' && daysUntil(x.assignment.date) >= 0);
  const doneAssign = activeAssignments.filter((x) => x.assignment.status === 'COMPLETED' || daysUntil(x.assignment.date) < 0);
  const upcomingGigs = standalone.filter((g) => myApplication(g, account.id)!.status !== 'completed' && daysUntil(g.date) >= 0);
  const doneGigs = standalone.filter((g) => myApplication(g, account.id)!.status === 'completed' || daysUntil(g.date) < 0);
  const pending = applied.filter((g) => ['applied', 'shortlisted', 'invited', 'rejected', 'withdrawn'].includes(myApplication(g, account.id)!.status));

  const assignmentCard = (x: (typeof assignments)[number]) => {
    const event = x.project.events.find((e) => e.id === x.assignment.eventId);
    const days = daysUntil(x.assignment.date);
    return (
      <Card key={x.assignment.id} onPress={() => router.push({ pathname: '/freelancer/assignment/[id]', params: { id: x.assignment.id } })} style={{ gap: 10 }}>
        <View style={styles.row}>
          <View style={[styles.icon, { borderWidth: 1, borderColor: t.c.border }]}>
            <Ionicons name="heart" size={20} color={t.c.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text size={12} weight="medium" color={t.c.muted}>
              {x.assignment.role} · {x.booking.providerName}
            </Text>
            <Text size={16} weight="bold" color={t.c.textStrong} numberOfLines={1}>
              {x.project.title} — {event?.name ?? 'Event'}
            </Text>
            <Text size={12} color={t.c.muted}>
              {formatShortDate(x.assignment.date)} · {formatClock(x.assignment.startTime)} · {event?.venue ?? x.project.city}
            </Text>
          </View>
          <StatusPill status={x.assignment.status} />
        </View>
        <View style={styles.row}>
          <Text size={18} weight="bold" color={t.c.textStrong} style={{ flex: 1 }}>
            {formatMoney(x.assignment.pay)}
          </Text>
          <Text size={12} weight="semibold" color={days === 0 ? t.c.primary : t.c.muted}>
            {days === 0 ? 'TODAY' : days > 0 ? `in ${days} days` : 'done'}
          </Text>
        </View>
      </Card>
    );
  };

  const groups = {
    upcoming: [...upcomingAssign.map((x) => ({ date: x.assignment.date, node: assignmentCard(x), id: x.assignment.id })), ...upcomingGigs.map((g) => ({ date: g.date, id: g.id, node: <GigCard key={g.id} gig={g} badge={myApplication(g, account.id)!.status} onPress={() => router.push({ pathname: '/freelancer/job/[id]', params: { id: g.id } })} /> }))].sort((a, b) => a.date.localeCompare(b.date)),
    applied: pending.map((g) => ({ date: g.date, id: g.id, node: <GigCard key={g.id} gig={g} badge={myApplication(g, account.id)!.status} onPress={() => router.push({ pathname: '/freelancer/gig/[id]', params: { id: g.id } })} /> })),
    completed: [...doneAssign.map((x) => ({ date: x.assignment.date, node: assignmentCard(x), id: x.assignment.id })), ...doneGigs.map((g) => ({ date: g.date, id: g.id, node: <GigCard key={g.id} gig={g} badge={myApplication(g, account.id)!.status} onPress={() => router.push({ pathname: '/freelancer/job/[id]', params: { id: g.id } })} /> }))].sort((a, b) => b.date.localeCompare(a.date)),
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg, paddingTop: insets.top + 12 }}>
      <View style={{ paddingHorizontal: 16, marginBottom: 14 }}>
        <Text size={23} weight="bold" color={t.c.textStrong}>
          My jobs
        </Text>
        <Text size={14} color={t.c.muted}>
          {groups.upcoming.length} upcoming · {groups.applied.length} applications
        </Text>
      </View>
      <Segmented
        options={[
          { id: 'upcoming', label: 'Upcoming' },
          { id: 'applied', label: 'Applied' },
          { id: 'completed', label: 'Completed' },
        ]}
        value={filter}
        onChange={setFilter}
        counts={{ upcoming: groups.upcoming.length, applied: groups.applied.length, completed: groups.completed.length }}
      />
      <FlatList
        data={groups[filter]}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
        ListEmptyComponent={<EmptyBlock icon="briefcase-outline" title={filter === 'upcoming' ? 'No confirmed jobs yet' : filter === 'applied' ? 'No applications pending' : 'No completed jobs'} message="Apply to gigs — you’ll be notified the moment you’re hired." action="Discover gigs" onAction={() => router.navigate('/freelancer')} />}
        renderItem={({ item }) => <View>{item.node}</View>}
      />
    </View>
  );
}


const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
