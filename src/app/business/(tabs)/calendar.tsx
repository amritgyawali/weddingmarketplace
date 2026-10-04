import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Card, EmptyBlock, KButton, KField, ListRow, RoleHeader, SectionTitle, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { AvailabilityCalendar } from '@/components/work/AvailabilityCalendar';
import { serviceName } from '@/data/services';
import { useLinkOn } from '@/hooks/useFeatures';
import { useLayout } from '@/hooks/useLayout';
import { useVendorWorkspace } from '@/hooks/useWorkspace';
import { exportCalendar } from '@/services/exporters';
import { dailyCapacity } from '@/services/customerPlanning';
import { useExperience } from '@/hooks/useExperience';
import { useDb } from '@/store/useDb';
import { toast } from '@/components/ui/Toast';
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
  const exp = useExperience();
  const savePersona = useDb((s) => s.setProviderPersona);
  const [capacity, setCapacity] = useState(String(dailyCapacity(account)));
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
          <KField label="Events per day" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" />
          <Text size={13} color={t.c.muted}>Publish how many functions your team can handle each day. Customers see the remaining slots.</Text>
          <KButton label="Save daily capacity" size="sm" onPress={() => {
            const error = savePersona(account.id, { services: exp.services, primaryService: exp.primaryService!, businessForm: exp.form!, teamSize: account.teamSize, tradeProfile: { ...account.tradeProfile, eventsPerDay: Number(capacity) } });
            toast(error ?? 'Daily capacity saved', error ? 'alert-circle' : 'checkmark-circle');
          }} />
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

