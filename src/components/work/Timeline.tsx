import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ChoiceChips, KButton, KField } from '@/components/kit';
import { Calendar } from '@/components/ui/Calendar';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { bsMonthLabel } from '@/data/events';
import { addToGoogleCalendar, exportCalendar } from '@/services/exporters';
import { buildTimeline } from '@/services/planner';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Project, TimelineEntry } from '@/types/platform';
import { addDays, daysUntil, formatClock, formatMonthDay, today } from '@/utils/format';

const KIND_ICON: Record<TimelineEntry['kind'], string> = {
  milestone: 'flag',
  booking: 'checkmark-circle',
  payment: 'card',
  meeting: 'people',
  event: 'heart',
  delivery: 'cloud-download',
  task: 'checkbox',
};

/** Project timeline: bookings, payments, meetings, events and deliveries in date order. */
export function TimelineView({ project, mode }: { project: Project; mode: 'customer' | 'platform' | 'vendor' }) {
  const t = useRoleTheme();
  const addEntry = useDb((s) => s.addTimelineEntry);
  const toggle = useDb((s) => s.toggleTimelineEntry);
  const entries = buildTimeline(project, { internal: mode === 'platform' });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(addDays(today(), 7));
  const [time, setTime] = useState('11:00');
  const [location, setLocation] = useState('');
  const [kind, setKind] = useState<TimelineEntry['kind']>('meeting');
  const [internal, setInternal] = useState(false);
  const firstUpcoming = entries.findIndex((e) => daysUntil(e.date) >= 0);

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.actions}>
        <KButton label="Add meeting / milestone" icon="add" size="sm" variant="secondary" onPress={() => setOpen(true)} style={{ flex: 1 }} />
        <KButton
          label="Export .ics"
          icon="calendar-outline"
          size="sm"
          variant="ghost"
          onPress={() =>
            exportCalendar(
              entries.filter((e) => daysUntil(e.date) >= 0).map((e) => ({ title: `${e.title} · ${project.title}`, date: e.date, time: e.time, location: e.location })),
              project.code,
            )
          }
        />
      </View>
      <View>
        {entries.map((e, i) => {
          const past = daysUntil(e.date) < 0;
          const isNext = i === firstUpcoming;
          const color = e.done ? t.c.success : isNext ? t.c.primary : past ? t.c.warning : t.c.subtle;
          const manual = project.timeline.some((x) => x.id === e.id);
          return (
            <View key={e.id} style={styles.item}>
              <View style={{ width: 54 }}>
                <Text size={12} weight="bold" color={isNext ? t.c.primary : t.c.textStrong}>
                  {formatMonthDay(e.date)}
                </Text>
                <Text size={10} color={t.c.subtle}>
                  {bsMonthLabel(e.date).split(' ')[0]}
                </Text>
              </View>
              <View style={styles.rail}>
                <View style={[styles.node, { backgroundColor: e.done || isNext ? color : t.c.surface, borderColor: color }]}>
                  <Ionicons name={(KIND_ICON[e.kind] + (e.done || isNext ? '' : '-outline')) as never} size={11} color={e.done || isNext ? '#fff' : color} />
                </View>
                {i < entries.length - 1 && <View style={[styles.line, { backgroundColor: t.c.border }]} />}
              </View>
              <Pressable disabled={!manual} onPress={() => toggle(project.id, e.id)} onLongPress={() => addToGoogleCalendar({ title: e.title, date: e.date, time: e.time, location: e.location })} style={{ flex: 1, paddingBottom: 16 }}>
                <Text size={14} weight={isNext ? 'bold' : 'semibold'} color={t.c.textStrong} style={e.done ? { opacity: 0.7 } : undefined}>
                  {e.title}
                  {e.internal ? '  🔒' : ''}
                </Text>
                {(e.time || e.location) && (
                  <Text size={12} color={t.c.muted}>
                    {[e.time && formatClock(e.time), e.location].filter(Boolean).join(' · ')}
                  </Text>
                )}
                {isNext && (
                  <Text size={11} weight="bold" color={t.c.primary}>
                    NEXT · {daysUntil(e.date) === 0 ? 'today' : `in ${daysUntil(e.date)} days`}
                  </Text>
                )}
              </Pressable>
            </View>
          );
        })}
      </View>
      <Text size={11} color={t.c.subtle} align="center">
        Long-press any item to add it to Google Calendar.
      </Text>

      <Sheet visible={open} onClose={() => setOpen(false)} title="Add to timeline">
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
          <ChoiceChips options={['meeting', 'milestone', 'delivery', 'task']} selected={[kind]} onToggle={(v) => setKind(v as TimelineEntry['kind'])} />
          <KField placeholder="Title (e.g. Menu tasting)" value={title} onChangeText={setTitle} />
          <Calendar value={date} onChange={setDate} />
          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <KField label="Time" value={time} onChangeText={setTime} placeholder="11:00" />
            </View>
            <View style={{ flex: 2 }}>
              <KField label="Location" value={location} onChangeText={setLocation} placeholder="Venue / office / video call" />
            </View>
          </View>
          {mode === 'platform' && <ChoiceChips options={['Visible to customer', 'Internal only']} selected={[internal ? 'Internal only' : 'Visible to customer']} onToggle={(v) => setInternal(v === 'Internal only')} />}
          <KButton
            label="Add"
            disabled={!title.trim()}
            onPress={() => {
              addEntry(project.id, { title: title.trim(), date, time: kind === 'meeting' ? time : undefined, location: location.trim() || undefined, kind, internal });
              setOpen(false);
              setTitle('');
              toast('Added to timeline');
            }}
          />
        </ScrollView>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  item: { flexDirection: 'row', gap: 8 },
  rail: { alignItems: 'center', width: 22 },
  node: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  line: { width: 2, flex: 1, marginVertical: 2 },
});
