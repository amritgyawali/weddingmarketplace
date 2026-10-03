import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Card, EmptyBlock, KButton, ListRow, RoleHeader, SectionTitle, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { AvailabilityCalendar } from '@/components/work/AvailabilityCalendar';
import { serviceName } from '@/data/services';
import { useLinkOn } from '@/hooks/useFeatures';
import { useLayout } from '@/hooks/useLayout';
import { useVendorWorkspace } from '@/hooks/useWorkspace';
import { exportCalendar } from '@/services/exporters';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import { daysUntil, formatLongDate } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

/** Availability calendar that feeds the matching engine, plus bookings by day. */
export default function VendorCalendar() {
  const t = useRoleTheme();
  const { wide } = useLayout();
  const linkOn = useLinkOn();
  const account = useAccount();
  const { bookings, staff } = useVendorWorkspace(account);
  const [day, setDay] = useState<string | null>(null);
  const ownerId = account.listingId ?? account.id;
  const onDay = day ? bookings.filter(({ project, booking }) => booking.status !== 'CANCELLED' && project.events.some((e) => booking.eventIds.includes(e.id) && e.date === day)) : [];
  const upcoming = bookings
    .filter(({ booking }) => booking.status !== 'CANCELLED')
    .flatMap(({ project, booking }) => project.events.filter((e) => booking.eventIds.includes(e.id) && e.date && daysUntil(e.date) >= 0).map((e) => ({ project, booking, e })));

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <RoleHeader title="Calendar" subtitle="Booked, held and blocked days feed Vivah matching" />
      <ScrollView contentContainerStyle={[{ padding: 16, gap: 16, paddingBottom: 40 }, wide && { flexDirection: 'row', alignItems: 'flex-start' }]}>
        <Card style={{ flex: wide ? 1.2 : undefined }}>
          <AvailabilityCalendar ownerKind="provider" ownerId={ownerId} onSelectDay={setDay} />
        </Card>
        <View style={{ flex: 1, gap: 14 }}>
          {day && (
            <View>
              <SectionTitle title={formatLongDate(day)} />
              {onDay.length ? (
                <Card padded={false} style={{ overflow: 'hidden' }}>
                  {onDay.map(({ project, booking }) => (
                    <ListRow key={booking.id} icon="briefcase-outline" title={project.title} subtitle={`${serviceName(booking.serviceId)} · ${project.guests} guests`} trailing={<StatusPill status={booking.status} />} onPress={() => router.push({ pathname: '/business/booking/[id]', params: { id: booking.id } })} />
                  ))}
                </Card>
              ) : (
                <Text size={13} color={t.c.muted}>
                  No bookings on this day.
                </Text>
              )}
            </View>
          )}
          <View>
            <SectionTitle title="Team on duty" />
            {staff.length ? (
              <Card style={{ gap: 4 }}>
                {staff.map((m) => (
                  <Text key={m.id} size={13} color={t.c.text}>
                    • {m.name} — {m.role} {m.active ? '' : '(inactive)'}
                  </Text>
                ))}
              </Card>
            ) : (
              <EmptyBlock icon="people-outline" title="No team yet" action={linkOn('/business/team') ? 'Add team' : undefined} onAction={() => router.push('/business/team')} />
            )}
          </View>
          <KButton
            label="Export bookings to Google / Apple Calendar"
            icon="calendar-outline"
            variant="secondary"
            onPress={() => exportCalendar(upcoming.map(({ project, booking, e }) => ({ title: `${e.name} · ${project.title} (${serviceName(booking.serviceId)})`, date: e.date!, time: e.startTime, location: e.venue, durationHours: 8 })), 'vivah-bookings')}
          />
        </View>
      </ScrollView>
    </View>
  );
}

