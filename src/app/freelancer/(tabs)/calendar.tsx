import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, EmptyBlock, KButton, SectionTitle, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { AvailabilityCalendar } from '@/components/work/AvailabilityCalendar';
import { myApplication, useFreelancerWorkspace } from '@/hooks/useWorkspace';
import { useLayout } from '@/hooks/useLayout';
import { addToGoogleCalendar, exportCalendar, type CalendarItem } from '@/services/exporters';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import { formatClock, formatLongDate, formatMoney } from '@/utils/format';

interface Row {
  id: string;
  date: string;
  time: string;
  title: string;
  subtitle: string;
  status: string;
  pay: number;
  href: () => void;
  item: CalendarItem;
}

/** Availability calendar (manual days + weekly rules) and the freelancer's booked work, exportable to any calendar. */
export default function FreelancerCalendar() {
  const t = useRoleTheme();
  const insets = useSafeAreaInsets();
  const { wide } = useLayout();
  const account = useAccount();
  const { upcoming, standalone } = useFreelancerWorkspace(account);
  const [day, setDay] = useState<string | null>(null);

  const rows: Row[] = [
    ...upcoming.map(({ project, booking, assignment: a }) => {
      const event = project.events.find((e) => e.id === a.eventId);
      const where = event?.venue ? `${event.venue}, ${project.city}` : project.city;
      return {
        id: a.id,
        date: a.date,
        time: a.startTime,
        title: `${a.role} · ${project.title}`,
        subtitle: `${event?.name ?? 'Event'} · ${where} · via ${booking.providerName}`,
        status: a.status,
        pay: a.pay,
        href: () => router.push({ pathname: '/freelancer/assignment/[id]', params: { id: a.id } }),
        item: { title: `${a.role} — ${project.title} (${event?.name ?? 'event'})`, date: a.date, time: a.startTime, durationHours: 8, location: where, description: `Booked by ${booking.providerName}. Pay ${formatMoney(a.pay)}.` },
      };
    }),
    ...standalone
      .filter((g) => myApplication(g, account.id)?.status !== 'completed')
      .map((g) => ({
        id: g.id,
        date: g.date,
        time: g.startTime,
        title: `${g.skill} · ${g.title}`,
        subtitle: `${g.location ? `${g.location}, ` : ''}${g.city} · ${g.postedByName}`,
        status: myApplication(g, account.id)?.status ?? 'hired',
        pay: g.pay,
        href: () => router.push({ pathname: '/freelancer/job/[id]', params: { id: g.id } }),
        item: { title: `${g.skill} — ${g.title}`, date: g.date, time: g.startTime, durationHours: g.hours, location: `${g.location ?? ''} ${g.city}`.trim(), description: `Posted by ${g.postedByName}. Pay ${formatMoney(g.pay)}.` },
      })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  const shown = day ? rows.filter((r) => r.date === day) : rows;

  const exportAll = async () => {
    if (!rows.length) return toast('No booked work to export');
    try {
      await exportCalendar(rows.map((r) => r.item), 'vivah-crew-jobs');
    } catch {
      toast('Couldn’t export the calendar', 'alert-circle');
    }
  };

  const list = (
    <View style={{ gap: 10 }}>
      <SectionTitle title={day ? formatLongDate(day) : 'Booked work'} action={day ? 'Show all' : undefined} onAction={() => setDay(null)} />
      {shown.length === 0 ? (
        <EmptyBlock icon="calendar-clear-outline" title={day ? 'Nothing booked this day' : 'No upcoming work'} message="Keep your calendar up to date — organisers only invite crew who are free." />
      ) : (
        shown.map((r) => (
          <Card key={r.id} style={{ gap: 8 }}>
            <Pressable onPress={r.href} accessibilityRole="button" style={styles.row}>
              <View style={[styles.date, { borderWidth: 1, borderColor: t.c.border }]}>
                <Text size={12} weight="medium" color={t.c.muted}>
                  {new Date(`${r.date}T00:00:00`).toLocaleString('en', { month: 'short' })}
                </Text>
                <Text size={18} weight="bold" color={t.c.textStrong}>
                  {Number(r.date.slice(8, 10))}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text size={15} weight="bold" color={t.c.textStrong} numberOfLines={1}>
                  {r.title}
                </Text>
                <Text size={12} color={t.c.muted} numberOfLines={2}>
                  {formatClock(r.time)} · {r.subtitle}
                </Text>
              </View>
              <StatusPill status={r.status} />
            </Pressable>
            <View style={styles.row}>
              <Text size={15} weight="semibold" color={t.c.textStrong} style={{ flex: 1 }}>
                {formatMoney(r.pay)}
              </Text>
              <KButton label="Google Calendar" icon="logo-google" variant="ghost" size="sm" onPress={() => addToGoogleCalendar(r.item)} />
            </View>
          </Card>
        ))
      )}
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.c.bg }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, gap: 16, paddingBottom: 32 }}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text size={23} weight="bold" color={t.c.textStrong}>
            Calendar
          </Text>
          <Text size={14} color={t.c.muted}>
            {rows.length} booked · block days you can’t work
          </Text>
        </View>
        <KButton label="Export .ics" icon="download-outline" variant="secondary" size="sm" onPress={exportAll} />
      </View>
      <View style={[wide && styles.split]}>
        <Card style={[{ gap: 10 }, wide && { flex: 1.2 }]}>
          <AvailabilityCalendar ownerKind="freelancer" ownerId={account.id} onSelectDay={setDay} />
        </Card>
        <View style={[wide ? { flex: 1 } : { marginTop: 16 }]}>{list}</View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  split: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  date: { width: 50, height: 54, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
