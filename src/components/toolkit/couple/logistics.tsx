/** Couple toolkit: guests' stays and travel, vendor meetings and the contact sheet. */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, ChoiceChips, KButton, ListRow, SectionTitle } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { serviceName } from '@/data/services';
import { questionsToAsk } from '@/services/planner';
import { useSession } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import { formatClock, formatMoney, formatPhone, formatShortDate } from '@/utils/format';
import { openWhatsApp, shareMessage } from '@/utils/links';

import { EntryList, Hint, StatRow, ToolPage } from '../core';
import { useWedding } from './shared';

// ─── Guest rooms ────────────────────────────────────────────────────────────

export function GuestRooms() {
  const w = useWedding();
  const needing = w.guests.filter((g) => g.accommodation);
  const people = needing.reduce((s, g) => s + 1 + g.plusOnes + g.children, 0);
  return (
    <ToolPage title="Guest rooms" subtitle="Hotel blocks for out-of-town family">
      <EntryList
        ownerId={w.owner}
        tool="couple.rooms"
        noun="room block"
        defaults={{ date: w.date, fields: { nights: 2 } }}
        fields={[
          { key: 'title', label: 'Hotel or homestay', kind: 'text', required: true },
          { key: 'qty', label: 'Rooms', kind: 'number', required: true },
          { key: 'f.perRoom', label: 'Guests per room', kind: 'number', placeholder: '2' },
          { key: 'date', label: 'Check-in', kind: 'date' },
          { key: 'f.nights', label: 'Nights', kind: 'number' },
          { key: 'amount', label: 'Rate per room per night', kind: 'money' },
          { key: 'note', label: 'Who stays here', kind: 'multiline' },
        ]}
        subtitle={(e) => [`${e.qty ?? 0} rooms`, e.date ? `from ${formatShortDate(e.date)}` : undefined, e.fields?.nights ? `${e.fields.nights} nights` : undefined, e.note].filter(Boolean).join(' · ')}
        trailing={(e) => (e.amount && e.qty ? formatMoney(e.amount * e.qty * Number(e.fields?.nights ?? 1)) : undefined)}
        header={(entries) => {
          const beds = entries.reduce((s, e) => s + (e.qty ?? 0) * Number(e.fields?.perRoom ?? 2), 0);
          return (
            <>
              <StatRow
                items={[
                  { label: 'Guests needing a room', value: String(people) },
                  { label: 'Beds booked', value: String(beds) },
                  { label: 'Short by', value: String(Math.max(0, people - beds)), alert: people > beds },
                ]}
              />
              <Hint>Guests are counted from your guest list (“needs accommodation”), including their plus-ones and children.</Hint>
            </>
          );
        }}
      />
    </ToolPage>
  );
}

// ─── Pickups ────────────────────────────────────────────────────────────────

const PICKUP_STATUS = [
  { id: 'planned', label: 'Planned' },
  { id: 'confirmed', label: 'Driver confirmed' },
  { id: 'done', label: 'Picked up' },
];

export function Pickups() {
  const w = useWedding();
  const needing = w.guests.filter((g) => g.transport).length;
  return (
    <ToolPage title="Pickups and transport" subtitle="Airport, bus park and hotel runs">
      <EntryList
        ownerId={w.owner}
        tool="couple.pickups"
        noun="pickup"
        statusPill
        defaults={{ status: 'planned', fields: { from: 'Tribhuvan airport' } }}
        sort={(a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (a.time ?? '').localeCompare(b.time ?? '')}
        fields={[
          { key: 'title', label: 'Guest or party', kind: 'text', required: true },
          { key: 'date', label: 'Date', kind: 'date', required: true },
          { key: 'time', label: 'Time', kind: 'time' },
          { key: 'f.from', label: 'From', kind: 'select', options: ['Tribhuvan airport', 'Pokhara airport', 'Bus park', 'Hotel', 'Home'] },
          { key: 'f.to', label: 'To', kind: 'text' },
          { key: 'f.driver', label: 'Driver', kind: 'text' },
          { key: 'f.phone', label: 'Driver phone', kind: 'text' },
          { key: 'status', label: 'Status', kind: 'select', options: PICKUP_STATUS },
        ]}
        subtitle={(e) => [e.date ? formatShortDate(e.date) : undefined, e.time ? formatClock(e.time) : undefined, [e.fields?.from, e.fields?.to].filter(Boolean).join(' → '), e.fields?.driver].filter(Boolean).join(' · ')}
        rowActions={(e) => (e.fields?.phone ? [{ label: 'WhatsApp driver', onPress: () => openWhatsApp(`Namaste! Pickup for ${e.title} on ${e.date ? formatShortDate(e.date) : ''} ${e.time ? `at ${formatClock(e.time)}` : ''} from ${e.fields?.from ?? ''}. Dhanyabad!`, String(e.fields?.phone)) }] : [])}
        header={(entries) => (
          <StatRow
            items={[
              { label: 'Guests asking for transport', value: String(needing) },
              { label: 'Pickups planned', value: String(entries.length) },
              { label: 'Unconfirmed', value: String(entries.filter((e) => e.status === 'planned').length), alert: entries.some((e) => e.status === 'planned') },
            ]}
          />
        )}
      />
    </ToolPage>
  );
}

// ─── Vendor meetings ────────────────────────────────────────────────────────

export function VendorMeetings() {
  const t = useRoleTheme();
  const w = useWedding();
  const services = [...new Set([...(w.project?.requirements.map((r) => r.serviceId) ?? []), 'venue', 'catering', 'photography', 'makeup'])];
  const [svc, setSvc] = useState(services[0]);
  return (
    <ToolPage title="Vendor meetings" subtitle="Visits, tastings and what was agreed">
      <Card style={{ gap: 8 }}>
        <SectionTitle title="Questions to ask" />
        <ChoiceChips options={services.map(serviceName)} selected={[serviceName(svc)]} onToggle={(label) => setSvc(services.find((s) => serviceName(s) === label) ?? svc)} />
        {questionsToAsk(svc).map((q) => (
          <Text key={q} size={14} color={t.c.text}>
            • {q}
          </Text>
        ))}
      </Card>
      <EntryList
        ownerId={w.owner}
        tool="couple.meetings"
        noun="meeting"
        statusPill
        defaults={{ status: 'planned' }}
        sort={(a, b) => (b.date ?? '').localeCompare(a.date ?? '')}
        fields={[
          { key: 'title', label: 'Vendor', kind: 'text', required: true },
          { key: 'group', label: 'Service', kind: 'select', options: services.map(serviceName) },
          { key: 'date', label: 'Date', kind: 'date' },
          { key: 'time', label: 'Time', kind: 'time' },
          { key: 'status', label: 'Status', kind: 'select', options: [{ id: 'planned', label: 'Planned' }, { id: 'done', label: 'Done' }, { id: 'follow_up', label: 'Follow up' }] },
          { key: 'note', label: 'What was agreed', kind: 'multiline' },
          { key: 'f.next', label: 'Next step', kind: 'text' },
        ]}
        subtitle={(e) => [e.group, e.date ? formatShortDate(e.date) : undefined, e.time ? formatClock(e.time) : undefined, e.fields?.next ? `Next: ${e.fields.next}` : undefined].filter(Boolean).join(' · ')}
      />
    </ToolPage>
  );
}

// ─── Contact sheet ──────────────────────────────────────────────────────────

const EMERGENCY = [
  ['Police', '100'],
  ['Ambulance', '102'],
  ['Fire brigade', '101'],
  ['Tourist police', '1144'],
];

export function ContactSheet() {
  const t = useRoleTheme();
  const w = useWedding();
  const accounts = useSession((s) => s.accounts);
  const coordinator = w.project?.coordinatorId ? accounts.find((a) => a.id === w.project!.coordinatorId) : undefined;
  const vendors = (w.project?.bookings ?? [])
    .filter((b) => b.status !== 'CANCELLED')
    .map((b) => {
      const owner = accounts.find((a) => a.id === b.providerAccountId || (a.role === 'vendor' && a.listingId === b.providerId));
      return { id: b.id, name: b.providerName, role: serviceName(b.serviceId), phone: owner?.phone };
    });
  const family = (w.project?.collaborators ?? []).filter((c) => c.phone).map((c) => ({ id: c.id, name: c.name, role: c.relation, phone: c.phone }));
  const fixed = [...(coordinator ? [{ id: coordinator.id, name: coordinator.name, role: 'Vivah coordinator', phone: coordinator.phone }] : []), ...vendors, ...family];

  const share = (extra: { title: string; phone?: string; role?: string }[]) =>
    shareMessage(
      `Wedding contacts — ${w.names}\n\n${[...fixed.map((c) => `${c.role}: ${c.name}${c.phone ? ` ${formatPhone(c.phone)}` : ''}`), ...extra.map((c) => `${c.role ?? 'Contact'}: ${c.title}${c.phone ? ` ${c.phone}` : ''}`)].join('\n')}\n\nEmergency: police 100 · ambulance 102 · fire 101`,
    );

  return (
    <ToolPage title="Wedding day contacts" subtitle="Everyone you might need to call">
      <View>
        <SectionTitle title="From your plan" />
        <Card padded={false} style={{ overflow: 'hidden' }}>
          {fixed.length === 0 && <ListRow title="No bookings yet" subtitle="Your coordinator and vendors appear here once they’re booked." icon="people-outline" />}
          {fixed.map((c) => (
            <ListRow key={c.id} icon="call-outline" title={c.name} subtitle={`${c.role}${c.phone ? ` · ${formatPhone(c.phone)}` : ''}`} />
          ))}
        </Card>
      </View>
      <EntryList
        ownerId={w.owner}
        tool="couple.contacts"
        noun="contact"
        fields={[
          { key: 'title', label: 'Name', kind: 'text', required: true },
          { key: 'f.role', label: 'Role', kind: 'text', placeholder: 'e.g. Purohit ji, driver, hotel' },
          { key: 'f.phone', label: 'Phone', kind: 'text' },
        ]}
        subtitle={(e) => [e.fields?.role, e.fields?.phone].filter(Boolean).join(' · ') || undefined}
        header={(entries) => <KButton label="Share contact sheet" icon="share-outline" variant="secondary" onPress={() => share(entries.map((e) => ({ title: e.title, phone: e.fields?.phone ? String(e.fields.phone) : undefined, role: e.fields?.role ? String(e.fields.role) : undefined })))} />}
        emptyTitle="Add your own contacts"
        emptyMessage="Purohit ji, hotel front desk, the family driver — anyone not booked through Vivah."
      />
      <View>
        <SectionTitle title="Emergency numbers" />
        <Card style={{ gap: 4 }}>
          {EMERGENCY.map(([label, num]) => (
            <View key={label} style={styles.between}>
              <Text size={14} color={t.c.text}>
                {label}
              </Text>
              <Text size={14} weight="semibold" color={t.c.textStrong}>
                {num}
              </Text>
            </View>
          ))}
        </Card>
      </View>
    </ToolPage>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
});
