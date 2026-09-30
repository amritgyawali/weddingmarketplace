import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { staffScreen } from '@/components/persona/StaffGate';
import { Card, StackHeader, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { MonthGrid } from '@/components/work/MonthGrid';
import { serviceName } from '@/data/services';
import { useLayout } from '@/hooks/useLayout';
import { milestoneStatus } from '@/services/pricing';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import { formatLongDate, formatMoney, today } from '@/utils/format';

/** Operations calendar: every function, meeting and payment due across projects. */
function OpsCalendar() {
  const t = useRoleTheme();
  const { wide } = useLayout();
  const projects = useDb((s) => s.projects);
  const [selected, setSelected] = useState(today());

  const marks: Record<string, string[]> = {};
  const add = (date: string, color: string) => (marks[date] = [...(marks[date] ?? []), color]);
  projects.forEach((p) => {
    p.events.forEach((e) => e.date && e.status !== 'cancelled' && add(e.date, t.c.primary));
    p.timeline.forEach((x) => add(x.date, t.c.info));
    p.milestones.forEach((m) => milestoneStatus(m) !== 'PAID' && add(m.due, milestoneStatus(m) === 'OVERDUE' ? t.c.danger : t.c.warning));
  });

  const events = projects.flatMap((p) => p.events.filter((e) => e.date === selected && e.status !== 'cancelled').map((e) => ({ p, e })));
  const meetings = projects.flatMap((p) => p.timeline.filter((x) => x.date === selected).map((x) => ({ p, x })));
  const dues = projects.flatMap((p) => p.milestones.filter((m) => m.due === selected && milestoneStatus(m) !== 'PAID').map((m) => ({ p, m })));

  const detail = (
    <View style={{ gap: 10, flex: 1 }}>
      <Text size={16} weight="bold" color={t.c.textStrong}>
        {formatLongDate(selected)}
      </Text>
      {events.map(({ p, e }) => (
        <Card key={e.id} onPress={() => router.push({ pathname: '/platform/project/[id]', params: { id: p.id } })} style={{ gap: 6 }}>
          <View style={styles.rowBetween}>
            <Text size={14} weight="bold" color={t.c.textStrong} style={{ flex: 1 }}>
              {p.code} · {p.title} — {e.name}
            </Text>
            <StatusPill status={e.status} />
          </View>
          <Text size={12} color={t.c.muted}>
            {e.startTime} · {e.venue} · {e.guests} guests · {p.coordinatorName ?? 'Unassigned'}
          </Text>
          {p.requirements
            .filter((r) => r.status !== 'CANCELLED' && r.eventIds.includes(e.id))
            .map((r) => {
              const b = p.bookings.find((x) => x.requirementId === r.id && x.status !== 'CANCELLED');
              const ok = b && ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(b.status);
              return (
                <Text key={r.id} size={12} color={ok ? t.c.success : b ? t.c.warning : t.c.danger}>
                  {serviceName(r.serviceId)}: {ok ? `Confirmed · ${b!.providerName}` : b ? `Pending · ${b.providerName}` : 'Missing'}
                </Text>
              );
            })}
        </Card>
      ))}
      {meetings.map(({ p, x }) => (
        <Pressable key={x.id} onPress={() => router.push({ pathname: '/platform/project/[id]', params: { id: p.id, tab: 'timeline' } })}>
          <Card style={{ gap: 2 }}>
            <Text size={13} weight="semibold" color={t.c.textStrong}>
              {x.time ?? ''} {x.title}
            </Text>
            <Text size={12} color={t.c.muted}>
              {p.code} · {x.location ?? x.kind}
            </Text>
          </Card>
        </Pressable>
      ))}
      {dues.map(({ p, m }) => (
        <Card key={m.id} style={{ gap: 2 }}>
          <Text size={13} weight="semibold" color={milestoneStatus(m) === 'OVERDUE' ? t.c.danger : t.c.warning}>
            Payment due · {formatMoney(m.amount - m.paidAmount)}
          </Text>
          <Text size={12} color={t.c.muted}>
            {p.code} · {m.label}
          </Text>
        </Card>
      ))}
      {!events.length && !meetings.length && !dues.length && (
        <Text size={13} color={t.c.muted}>
          Nothing scheduled.
        </Text>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title="Operations calendar" subtitle="Functions · meetings · payment dues" />
      <ScrollView contentContainerStyle={[{ padding: 14, gap: 16, paddingBottom: 40 }, wide && { flexDirection: 'row' }]}>
        <Card style={{ flex: wide ? 1 : undefined }}>
          <MonthGrid marks={marks} selected={selected} onSelect={setSelected} />
          <View style={styles.legend}>
            <Text size={11} color={t.c.primary}>● Function</Text>
            <Text size={11} color={t.c.info}>● Meeting</Text>
            <Text size={11} color={t.c.warning}>● Payment due</Text>
            <Text size={11} color={t.c.danger}>● Overdue</Text>
          </View>
        </Card>
        {detail}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
});

export default staffScreen('/platform/calendar', OpsCalendar);
