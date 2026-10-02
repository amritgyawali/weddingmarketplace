import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Card, ChoiceChips, EmptyBlock, KButton, KeyValue, KField, Segmented, StackHeader, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { CrewPanel, DeliverablesPanel } from '@/components/work/Bookings';
import { EventsPanel } from '@/components/work/EventsPanel';
import { TaskBoard } from '@/components/work/TaskBoard';
import { findService, serviceName } from '@/data/services';
import { findBooking } from '@/hooks/useWorkspace';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import { formatLongDate, formatMoney, formatPhone, formatShortDate } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

type Tab = 'overview' | 'crew' | 'deliverables' | 'functions' | 'tasks';

/** A provider's view of one booking: request, economics, crew, deliverables, run sheets and tasks. */
export default function VendorBooking() {
  const t = useRoleTheme();
  const account = useAccount();
  const { id } = useLocalSearchParams<{ id: string }>();
  const projects = useDb((s) => s.projects);
  const payables = useDb((s) => s.payables);
  const contracts = useDb((s) => s.contracts);
  const threads = useDb((s) => s.threads);
  const respond = useDb((s) => s.respondToBooking);
  const openThread = useDb((s) => s.openThread);
  const sign = useDb((s) => s.signContract);
  const [tab, setTab] = useState<Tab>('overview');
  const [declineNote, setDeclineNote] = useState('');
  const ref = findBooking(projects, id);

  if (!ref) {
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg }}>
        <StackHeader title="Booking" />
        <EmptyBlock title="Booking not found" />
      </View>
    );
  }
  const { project, booking } = ref;
  const def = findService(booking.serviceId);
  const mine = payables.filter((p) => p.bookingId === booking.id);
  const contract = contracts.find((c) => c.bookingId === booking.id);
  const managed = project.managedBy === 'platform';
  const pending = booking.providerResponse === 'pending' && booking.status !== 'CANCELLED';
  const signed = contract?.signatures.some((s) => s.party === 'provider');

  const chat = () => {
    const existing = threads.find((th) => th.bookingId === booking.id);
    const threadId =
      existing?.id ??
      openThread({
        kind: 'service',
        projectId: project.id,
        bookingId: booking.id,
        title: `${serviceName(booking.serviceId)} · ${booking.providerName}`,
        members: [
          { id: account.id, name: account.businessName ?? account.name, role: 'vendor' },
          ...(managed && project.coordinatorId ? [{ id: project.coordinatorId, name: project.coordinatorName ?? 'Coordinator', role: 'platform' as const }] : []),
          { id: project.customerId, name: project.customerName, role: 'customer' },
        ],
      });
    router.push({ pathname: '/business/inbox/[id]', params: { id: threadId } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title={project.title} subtitle={`${serviceName(booking.serviceId)} · ${project.code}`} right={<StatusPill status={pending ? 'pending' : booking.status} />} />
      <View style={{ paddingVertical: 12 }}>
        <Segmented
          options={[
            { id: 'overview', label: 'Overview' },
            { id: 'crew', label: 'Crew' },
            { id: 'deliverables', label: 'Deliverables' },
            { id: 'functions', label: 'Run sheets' },
            { id: 'tasks', label: 'Tasks' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        {tab === 'overview' && (
          <>
            {pending && (
              <Card style={{ gap: 10, borderColor: t.c.primary, borderWidth: 1 }}>
                <Text size={15} weight="bold" color={t.c.textStrong}>
                  {managed ? 'Vivah picked you for this wedding' : 'New booking'}
                </Text>
                <Text size={13} color={t.c.muted}>
                  Confirm you’re available on {project.events.filter((e) => booking.eventIds.includes(e.id)).map((e) => (e.date ? formatShortDate(e.date) : 'TBC')).join(', ')}. The date stays {booking.status === 'HELD' ? 'held' : 'reserved'} for you until the couple confirms.
                </Text>
                <KField placeholder="Note (optional, e.g. reason for declining)" value={declineNote} onChangeText={setDeclineNote} />
                <View style={styles.row}>
                  <KButton label="Decline" variant="danger" size="sm" style={{ flex: 1 }} onPress={() => { respond(project.id, booking.id, false, declineNote.trim() || 'Not available'); toast('Declined'); router.back(); }} />
                  <KButton label="Accept booking" icon="checkmark" size="sm" style={{ flex: 1.4 }} onPress={() => { respond(project.id, booking.id, true, declineNote.trim() || undefined); toast('Availability confirmed'); }} />
                </View>
              </Card>
            )}
            <Card style={{ gap: 4 }}>
              <Text size={12} weight="medium" color={t.c.muted}>
                {def?.name}
                {booking.packageName ? ` · ${booking.packageName} package` : ''}
              </Text>
              <KeyValue label="Customer" value={project.customerName} />
              {!managed && <KeyValue label="Phone" value={formatPhone(project.customerPhone)} />}
              {managed && <KeyValue label="Coordinator" value={project.coordinatorName ?? 'Vivah team'} />}
              <KeyValue label="Main date" value={formatLongDate(project.weddingDate)} />
              <KeyValue label="City" value={`${project.city}${project.area ? `, ${project.area}` : ''}`} />
              <KeyValue label="Guests" value={String(project.guests)} />
              <KeyValue label="Functions" value={project.events.filter((e) => booking.eventIds.includes(e.id)).map((e) => e.name).join(', ')} />
            </Card>
            <Card style={{ gap: 4 }}>
              <Text size={15} weight="bold" color={t.c.textStrong}>
                Your money
              </Text>
              <KeyValue label="Booking value" value={formatMoney(booking.agreedPrice)} />
              <KeyValue label={`Platform fee (${booking.pricingModel.toLowerCase().replace('_', ' ')})`} value={`− ${formatMoney(booking.platformFee)}`} />
              <KeyValue label="You receive" value={formatMoney(booking.providerPayable)} strong />
              {mine.map((p) => (
                <View key={p.id} style={styles.rowBetween}>
                  <Text size={12} color={t.c.muted} style={{ flex: 1 }}>
                    {p.label.split('— ')[1] ?? p.label} · {formatShortDate(p.due)}
                  </Text>
                  <Text size={12} weight="semibold" color={t.c.textStrong}>
                    {formatMoney(p.amount)}
                  </Text>
                  <StatusPill status={p.status} />
                </View>
              ))}
              {!mine.length && (
                <Text size={12} color={t.c.muted}>
                  Payout schedule appears once the booking is confirmed.
                </Text>
              )}
            </Card>
            {contract && (
              <Card style={{ gap: 8 }}>
                <View style={styles.rowBetween}>
                  <Text size={15} weight="bold" color={t.c.textStrong} style={{ flex: 1 }}>
                    {contract.title}
                  </Text>
                  <StatusPill status={contract.status} />
                </View>
                <Text size={12} color={t.c.muted}>
                  {contract.number} · signed by {contract.signatures.map((s) => s.party).join(', ') || 'no one yet'}
                </Text>
                {!signed && (
                  <KButton
                    label="Sign as provider"
                    icon="create-outline"
                    size="sm"
                    onPress={() => {
                      sign(contract.id, 'provider', account.name);
                      toast('Contract signed');
                    }}
                  />
                )}
              </Card>
            )}
            {!!project.notes && (
              <Card style={{ gap: 4 }}>
                <Text size={13} weight="medium" color={t.c.muted}>
                  Couple’s notes
                </Text>
                <Text size={13} color={t.c.text}>
                  {project.notes}
                </Text>
                {!!project.styles[booking.serviceId]?.length && (
                  <ChoiceChips options={project.styles[booking.serviceId]} selected={project.styles[booking.serviceId]} onToggle={() => {}} />
                )}
              </Card>
            )}
            <View style={styles.row}>
              <KButton label="Message" icon="chatbubbles-outline" variant="secondary" style={{ flex: 1 }} onPress={chat} />
              {!managed && <KButton label="Call" icon="call-outline" variant="secondary" style={{ flex: 1 }} onPress={() => Linking.openURL(`tel:+977${project.customerPhone}`)} />}
            </View>
          </>
        )}
        {tab === 'crew' && <CrewPanel project={project} booking={booking} mode="vendor" />}
        {tab === 'deliverables' && <DeliverablesPanel project={project} booking={booking} mode="vendor" />}
        {tab === 'functions' && <EventsPanel project={{ ...project, events: project.events.filter((e) => booking.eventIds.includes(e.id)) }} mode="vendor" />}
        {tab === 'tasks' && <TaskBoard project={{ ...project, tasks: project.tasks.filter((x) => x.visibility === 'shared' && (x.assigneeKind === 'provider' || x.bookingId === booking.id)) }} mode="vendor" />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
});
