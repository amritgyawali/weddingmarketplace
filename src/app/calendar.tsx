import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, KButton, SectionTitle, StatusPill } from '@/components/kit';
import { ToolScreen, toolStyles } from '@/components/planner/ToolScreen';
import { Text } from '@/components/ui/Text';
import { MonthGrid } from '@/components/work/MonthGrid';
import { bsMonthLabel, isPeakSeason } from '@/data/events';
import { useLayout } from '@/hooks/useLayout';
import { addToGoogleCalendar, type CalendarItem, exportCalendar } from '@/services/exporters';
import { milestoneStatus } from '@/services/pricing';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Project } from '@/types/platform';
import { daysUntil, formatClock, formatDateAlt, formatLongDate, formatMoney, relativeDay, today } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

interface Item {
  id: string;
  date: string;
  kind: 'event' | 'meeting' | 'payment' | 'task';
  title: string;
  sub: string;
  time?: string;
  done: boolean;
  cal: CalendarItem;
}

const KIND_ICON: Record<Item['kind'], keyof typeof Ionicons.glyphMap> = { event: 'heart', meeting: 'people', payment: 'wallet', task: 'checkbox' };

function WeddingCalendar({ project }: { project: Project }) {
  const t = useRoleTheme();
  const { wide } = useLayout();
  const [selected, setSelected] = useState<string | null>(null);
  const color: Record<Item['kind'], string> = { event: t.c.primary, meeting: t.c.info, payment: t.c.warning, task: t.c.success };

  const items: Item[] = [
    ...project.events
      .filter((e) => e.date && e.status !== 'cancelled')
      .map((e) => ({ id: e.id, date: e.date!, kind: 'event' as const, title: e.name, sub: `${e.venue}, ${e.city} · ${e.guests} guests`, time: e.startTime, done: e.status === 'done', cal: { title: `${project.title} — ${e.name}`, date: e.date!, time: e.startTime, durationHours: 5, location: `${e.venue}, ${e.city}` } })),
    ...project.timeline
      .filter((x) => !x.internal && x.kind !== 'event')
      .map((x) => ({ id: x.id, date: x.date, kind: 'meeting' as const, title: x.title, sub: x.location ?? x.kind, time: x.time, done: x.done, cal: { title: x.title, date: x.date, time: x.time, location: x.location } })),
    ...project.milestones
      .filter((m) => m.status !== 'WAIVED')
      .map((m) => ({ id: m.id, date: m.due, kind: 'payment' as const, title: `${m.label} — ${formatMoney(m.amount - m.paidAmount)}`, sub: milestoneStatus(m).toLowerCase().replace('_', ' '), done: milestoneStatus(m) === 'PAID', cal: { title: `Vivah payment: ${m.label}`, date: m.due, description: formatMoney(m.amount) } })),
    ...project.tasks
      .filter((x) => x.visibility === 'shared' && x.status !== 'CANCELLED' && ['customer', 'partner', 'family'].includes(x.assigneeKind))
      .map((x) => ({ id: x.id, date: x.due, kind: 'task' as const, title: x.title, sub: x.assigneeName, done: x.status === 'COMPLETED', cal: { title: x.title, date: x.due } })),
  ];
  items.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''));

  const marks: Record<string, string[]> = {};
  items.forEach((i) => (marks[i.date] = [...(marks[i.date] ?? []), color[i.kind]]));
  const upcoming = items.filter((i) => !i.done && i.date >= today());
  const shown = selected ? items.filter((i) => i.date === selected) : upcoming.slice(0, 25);
  const main = project.weddingDate;

  const list = (
    <View style={{ gap: 10, flex: 1 }}>
      <SectionTitle title={selected ? `${formatLongDate(selected)} · ${formatDateAlt(selected)}` : 'Coming up'} action={selected ? 'Show upcoming' : undefined} onAction={() => setSelected(null)} />
      {selected && isPeakSeason(selected) && (
        <Text size={12} color={t.c.warning}>
          Peak saait season — venues and crews book out early around this date.
        </Text>
      )}
      {shown.length === 0 && (
        <Text size={13} color={t.c.muted}>
          Nothing scheduled.
        </Text>
      )}
      {shown.map((i) => (
        <Card key={`${i.kind}-${i.id}`} style={[toolStyles.row, { padding: 12, opacity: i.done ? 0.6 : 1 }]}>
          <Pressable
            disabled={i.kind !== 'task' && i.kind !== 'payment'}
            onPress={() => router.push({ pathname: '/my-wedding', params: { tab: i.kind === 'task' ? 'tasks' : 'payments' } })}
            style={[toolStyles.row, { flex: 1 }]}>
          <View style={[styles.icon, { borderWidth: 1, borderColor: t.c.border }]}>
            <Ionicons name={KIND_ICON[i.kind]} size={17} color={color[i.kind]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text size={14} weight="semibold" color={t.c.textStrong} numberOfLines={2}>
              {i.title}
            </Text>
            <Text size={12} color={t.c.muted} numberOfLines={1}>
              {selected ? '' : `${relativeDay(i.date)} · `}
              {i.time ? `${formatClock(i.time)} · ` : ''}
              {i.sub}
            </Text>
          </View>
          </Pressable>
          {i.done ? <StatusPill status="done" /> : <KButton label="" icon="logo-google" variant="ghost" size="sm" onPress={() => addToGoogleCalendar(i.cal)} />}
        </Card>
      ))}
    </View>
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }}>
      <Card style={[toolStyles.row, { gap: 14 }]}>
        <View style={{ flex: 1 }}>
          <Text size={12} weight="medium" color={t.c.muted}>
            Wedding day
          </Text>
          <Text size={17} weight="bold" color={t.c.textStrong}>
            {formatLongDate(main)}
          </Text>
          <Text size={12} color={t.c.muted}>
            {bsMonthLabel(main)} · {daysUntil(main) >= 0 ? `${daysUntil(main)} days to go` : 'Married'}
          </Text>
        </View>
        <KButton label="Export all" icon="download-outline" size="sm" variant="secondary" onPress={() => exportCalendar(items.filter((i) => !i.done).map((i) => i.cal), `${project.code}-calendar`)} />
      </Card>
      <View style={toolStyles.wrap}>
        {(Object.keys(KIND_ICON) as Item['kind'][]).map((k) => (
          <View key={k} style={toolStyles.row}>
            <View style={[styles.dot, { backgroundColor: color[k] }]} />
            <Text size={12} color={t.c.muted}>
              {k === 'event' ? 'Functions' : k === 'meeting' ? 'Meetings' : k === 'payment' ? 'Payments' : 'Your tasks'}
            </Text>
          </View>
        ))}
      </View>
      <View style={wide ? { flexDirection: 'row', gap: 16, alignItems: 'flex-start' } : { gap: 14 }}>
        <Card style={wide ? { flex: 1 } : undefined}>
          <MonthGrid marks={marks} selected={selected ?? undefined} onSelect={(d) => setSelected(d === selected ? null : d)} initial={upcoming[0]?.date} />
        </Card>
        {list}
      </View>
    </ScrollView>
  );
}

/** Wedding calendar: functions, meetings, payment due dates and tasks, with BS dates and calendar export. */
export default function CalendarScreen() {
  return (
    <ToolScreen title="Wedding calendar" subtitle={(p) => p.title}>
      {(project) => <WeddingCalendar project={project} />}
    </ToolScreen>
  );
}

const styles = StyleSheet.create({
  icon: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
