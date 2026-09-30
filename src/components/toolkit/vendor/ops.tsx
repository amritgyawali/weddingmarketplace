/** Vendor toolkit: inventory, suppliers, staff roster, halls, event prep checklists and team tasks. */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, ChoiceChips, EmptyBlock, KButton, SectionTitle, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { serviceName } from '@/data/services';
import { useVendorWorkspace } from '@/hooks/useWorkspace';
import { bookingDates } from '@/store/db/helpers';
import { hallCapacity, LAYOUTS } from '@/services/toolkit';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import { daysUntil, formatLongDate, formatMoney, formatShortDate, today } from '@/utils/format';
import { openWhatsApp } from '@/utils/links';

import { EntryList, Hint, NumberField, StatRow, ToolPage, useToolEntries } from '../core';

// ─── Inventory ──────────────────────────────────────────────────────────────

const INVENTORY_GROUPS = ['Furniture', 'Tents and stage', 'Lighting', 'Sound', 'Crockery', 'Cameras and gear', 'Vehicles', 'Other'];

export function Inventory() {
  const account = useAccount();
  return (
    <ToolPage title="Inventory and equipment" subtitle="Stock, condition and servicing">
      <EntryList
        ownerId={account.id}
        tool="vendor.inventory"
        noun="item"
        groupBy="group"
        groupOrder={INVENTORY_GROUPS}
        defaults={{ group: 'Furniture', fields: { condition: 'Good' } }}
        fields={[
          { key: 'title', label: 'Item', kind: 'text', required: true, placeholder: 'e.g. Chiavari chairs, LED par lights' },
          { key: 'group', label: 'Category', kind: 'select', options: INVENTORY_GROUPS },
          { key: 'qty', label: 'Quantity owned', kind: 'number', required: true },
          { key: 'f.condition', label: 'Condition', kind: 'select', options: ['Good', 'Needs repair', 'Out of service'] },
          { key: 'amount', label: 'Value per unit', kind: 'money' },
          { key: 'date', label: 'Next service or check', kind: 'date' },
          { key: 'note', label: 'Storage and notes', kind: 'text' },
        ]}
        subtitle={(e) => [`${e.qty ?? 0} units`, e.fields?.condition, e.date ? `service ${formatShortDate(e.date)}` : undefined].filter(Boolean).join(' · ')}
        trailing={(e) => (e.amount ? formatMoney(e.amount * (e.qty ?? 1)) : undefined)}
        header={(entries) => (
          <StatRow
            items={[
              { label: 'Units', value: String(entries.reduce((s, e) => s + (e.qty ?? 0), 0)) },
              { label: 'Stock value', value: formatMoney(entries.reduce((s, e) => s + (e.amount ?? 0) * (e.qty ?? 0), 0)) },
              { label: 'Needs attention', value: String(entries.filter((e) => e.fields?.condition !== 'Good' || (e.date && daysUntil(e.date) <= 7)).length), alert: entries.some((e) => e.fields?.condition !== 'Good') },
            ]}
          />
        )}
      />
    </ToolPage>
  );
}

// ─── Suppliers ──────────────────────────────────────────────────────────────

const SUPPLIER_GROUPS = ['Flowers', 'Generator', 'Tent house', 'Printing', 'Transport', 'Staff agency', 'Food supplies', 'Other'];

export function Suppliers() {
  const account = useAccount();
  return (
    <ToolPage title="Suppliers" subtitle="The people you rely on behind the scenes">
      <EntryList
        ownerId={account.id}
        tool="vendor.suppliers"
        noun="supplier"
        groupBy="group"
        groupOrder={SUPPLIER_GROUPS}
        defaults={{ group: 'Other' }}
        fields={[
          { key: 'title', label: 'Business', kind: 'text', required: true },
          { key: 'group', label: 'Supplies', kind: 'select', options: SUPPLIER_GROUPS },
          { key: 'f.contact', label: 'Contact person', kind: 'text' },
          { key: 'f.phone', label: 'Phone', kind: 'text' },
          { key: 'amount', label: 'Typical cost per event', kind: 'money' },
          { key: 'f.terms', label: 'Payment terms', kind: 'text', placeholder: 'e.g. 50% advance, rest in 7 days' },
          { key: 'note', label: 'Notes', kind: 'multiline' },
        ]}
        subtitle={(e) => [e.fields?.contact, e.fields?.phone, e.fields?.terms].filter(Boolean).join(' · ') || undefined}
        rowActions={(e) => (e.fields?.phone ? [{ label: 'WhatsApp', onPress: () => openWhatsApp(`Namaste ${e.fields?.contact ?? ''}, `, String(e.fields?.phone)) }] : [])}
      />
    </ToolPage>
  );
}

// ─── Staff roster ───────────────────────────────────────────────────────────

export function StaffRoster() {
  const t = useRoleTheme();
  const account = useAccount();
  const { bookings, staff } = useVendorWorkspace(account);
  const shifts = useToolEntries(account.id, 'vendor.roster');
  const add = useDb((s) => s.addToolEntry);
  const remove = useDb((s) => s.removeToolEntry);
  const active = staff.filter((m) => m.active);
  const slots = bookings
    .filter((b) => b.booking.status !== 'CANCELLED')
    .flatMap((b) => bookingDates(b.project, b.booking).map((date) => ({ key: `${b.booking.id}:${date}`, date, bookingId: b.booking.id, title: `${b.project.customerName.split(' ')[0]}${b.project.partnerName ? ` & ${b.project.partnerName.split(' ')[0]}` : ''}`, service: serviceName(b.booking.serviceId) })))
    .filter((s) => daysUntil(s.date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 12);

  const onDate = (date: string) => shifts.filter((s) => s.date === date);
  const toggle = (slot: (typeof slots)[number], name: string, role: string) => {
    const existing = shifts.find((s) => s.refId === slot.bookingId && s.date === slot.date && s.title === name);
    if (existing) return remove(existing.id);
    const clash = onDate(slot.date).find((s) => s.title === name && s.refId !== slot.bookingId);
    add({ ownerId: account.id, tool: 'vendor.roster', title: name, refId: slot.bookingId, date: slot.date, group: role });
    if (clash) toast(`${name} is also rostered on another booking that day`, 'warning');
  };

  return (
    <ToolPage title="Staff roster" subtitle="Who works which event">
      {active.length === 0 && <EmptyBlock icon="people-outline" title="No active team members" message="Add your team under Business → Team & staff, then roster them here." />}
      {slots.length === 0 && <EmptyBlock icon="calendar-outline" title="No upcoming event dates" message="Confirmed bookings appear here with their function dates." />}
      {slots.map((slot) => {
        const assigned = shifts.filter((s) => s.refId === slot.bookingId && s.date === slot.date);
        return (
          <Card key={slot.key} style={{ gap: 8 }}>
            <View style={styles.between}>
              <View style={{ flex: 1 }}>
                <Text size={15} weight="semibold" color={t.c.textStrong}>
                  {formatLongDate(slot.date)}
                </Text>
                <Text size={13} color={t.c.muted}>
                  {slot.title} · {slot.service} · in {daysUntil(slot.date)} days
                </Text>
              </View>
              <StatusPill status={assigned.length ? 'confirmed' : 'pending'} label={`${assigned.length} rostered`} />
            </View>
            <ChoiceChips options={active.map((m) => m.name)} selected={assigned.map((a) => a.title)} onToggle={(name) => toggle(slot, name, active.find((m) => m.name === name)?.role ?? '')} />
          </Card>
        );
      })}
      <Hint>Tap a name to roster or un-roster them. You’ll get a warning if someone is already on another booking the same day.</Hint>
    </ToolPage>
  );
}

// ─── Halls and capacity ─────────────────────────────────────────────────────

export function Halls() {
  const t = useRoleTheme();
  const account = useAccount();
  const [area, setArea] = useState(4000);
  return (
    <ToolPage title="Halls and capacity" subtitle="Seating capacity by layout">
      <Card style={{ gap: 8 }}>
        <SectionTitle title="Quick calculator" />
        <NumberField label="Floor area (sq ft)" value={area} onChange={setArea} />
        {LAYOUTS.map((l) => (
          <View key={l.id} style={styles.between}>
            <Text size={14} color={t.c.text}>
              {l.label}
            </Text>
            <Text size={14} weight="semibold" color={t.c.textStrong}>
              {hallCapacity(area, l.sqft)} guests
            </Text>
          </View>
        ))}
      </Card>
      <EntryList
        ownerId={account.id}
        tool="vendor.halls"
        noun="hall"
        fields={[
          { key: 'title', label: 'Hall or lawn', kind: 'text', required: true },
          { key: 'f.area', label: 'Floor area (sq ft)', kind: 'number', required: true },
          { key: 'f.indoor', label: 'Indoor (covered)', kind: 'toggle' },
          { key: 'amount', label: 'Rental per function', kind: 'money' },
          { key: 'note', label: 'Features', kind: 'text', placeholder: 'Stage, AC, bridal room, parking' },
        ]}
        subtitle={(e) => {
          const a = Number(e.fields?.area ?? 0);
          return `${a.toLocaleString('en-IN')} sq ft · ${hallCapacity(a, 14)} seated · ${hallCapacity(a, 10)} standing${e.fields?.indoor ? ' · indoor' : ' · outdoor'}`;
        }}
        emptyMessage="Add each hall and lawn so your team quotes the right space for the guest count."
      />
    </ToolPage>
  );
}

// ─── Event prep checklist ───────────────────────────────────────────────────

const PREP: Record<string, string[]> = {
  venue: ['Confirm final guest count and menu', 'Generator fuel and backup test', 'Parking marshals briefed', 'Bridal room cleaned and stocked', 'Sound check with DJ', 'Fire extinguishers checked'],
  catering: ['Final plate count confirmed', 'Vegetables and meat ordered', 'Gas cylinders full', 'Service staff briefed on timings', 'Tasting notes applied'],
  photography: ['Batteries charged, cards formatted', 'Shot list received from couple', 'Second shooter confirmed', 'Drone permission checked', 'Backup body packed'],
  decoration: ['Flower order confirmed', 'Mandap frame loaded', 'Lighting rig tested', 'Setup crew transport booked'],
  default: ['Call the couple to confirm timings', 'Share the crew list with the coordinator', 'Pack equipment the night before', 'Confirm payment of the advance'],
};

export function EventPrep() {
  const t = useRoleTheme();
  const account = useAccount();
  const { bookings } = useVendorWorkspace(account);
  const add = useDb((s) => s.addToolEntry);
  const all = useToolEntries(account.id, 'vendor.prep');
  const upcoming = bookings.filter((b) => b.booking.status !== 'CANCELLED' && b.booking.status !== 'COMPLETED').sort((a, b) => a.project.weddingDate.localeCompare(b.project.weddingDate));
  const [selected, setSelected] = useState(upcoming[0]?.booking.id ?? '');
  const current = upcoming.find((b) => b.booking.id === selected);
  const items = all.filter((e) => e.refId === selected);
  const label = (b: (typeof upcoming)[number]) => `${b.project.customerName.split(' ')[0]} · ${formatShortDate(b.project.weddingDate)}`;

  if (!current) {
    return (
      <ToolPage title="Event prep checklists">
        <EmptyBlock icon="checkbox-outline" title="No upcoming bookings" message="Each confirmed booking gets its own prep checklist here." />
      </ToolPage>
    );
  }
  const template = PREP[current.booking.serviceId] ?? PREP.default;
  return (
    <ToolPage title="Event prep checklists" subtitle="A checklist per booking">
      <ChoiceChips options={upcoming.map(label)} selected={[label(current)]} onToggle={(l) => setSelected(upcoming.find((b) => label(b) === l)?.booking.id ?? selected)} />
      {items.length === 0 && (
        <KButton
          label={`Add the standard ${serviceName(current.booking.serviceId).toLowerCase()} checklist`}
          icon="list-outline"
          onPress={() => {
            template.forEach((title, i) => add({ ownerId: account.id, tool: 'vendor.prep', title, refId: selected, date: current.project.weddingDate, fields: { order: i } }));
            toast('Checklist added');
          }}
        />
      )}
      <EntryList
        key={selected}
        ownerId={account.id}
        tool="vendor.prep"
        noun="task"
        checklist
        filter={(e) => e.refId === selected}
        defaults={{ refId: selected, date: current.project.weddingDate }}
        fields={[
          { key: 'title', label: 'Task', kind: 'text', required: true },
          { key: 'f.owner', label: 'Who', kind: 'text' },
          { key: 'note', label: 'Notes', kind: 'text' },
        ]}
        subtitle={(e) => [e.fields?.owner, e.note].filter(Boolean).join(' · ') || undefined}
        emptyTitle="No prep tasks for this booking yet"
      />
      <Text size={12} color={t.c.subtle}>
        {current.project.code} · {current.project.city} · {current.project.guests} guests
      </Text>
    </ToolPage>
  );
}

// ─── Team tasks ─────────────────────────────────────────────────────────────

export function TeamTasks() {
  const t = useRoleTheme();
  const account = useAccount();
  const { staff } = useVendorWorkspace(account);
  const [show, setShow] = useState<'open' | 'all'>('open');
  return (
    <ToolPage title="Team tasks" subtitle="Internal to-dos with owners and due dates">
      <View style={styles.tabs}>
        {(['open', 'all'] as const).map((k) => (
          <Pressable key={k} onPress={() => setShow(k)} hitSlop={6}>
            <Text size={14} weight={show === k ? 'semibold' : 'regular'} color={show === k ? t.c.textStrong : t.c.muted}>
              {k === 'open' ? 'Open' : 'All'}
            </Text>
          </Pressable>
        ))}
      </View>
      <EntryList
        ownerId={account.id}
        tool="vendor.tasks"
        noun="task"
        checklist
        filter={(e) => show === 'all' || !e.done}
        defaults={{ date: today(), group: 'Normal' }}
        sort={(a, b) => (a.date ?? '9').localeCompare(b.date ?? '9')}
        fields={[
          { key: 'title', label: 'Task', kind: 'text', required: true },
          { key: 'f.assignee', label: 'Owner', kind: 'select', options: [account.name, ...staff.map((m) => m.name)] },
          { key: 'date', label: 'Due', kind: 'date' },
          { key: 'group', label: 'Priority', kind: 'select', options: ['Urgent', 'Normal', 'Later'] },
          { key: 'note', label: 'Notes', kind: 'multiline' },
        ]}
        subtitle={(e) => [e.fields?.assignee, e.date ? (daysUntil(e.date) < 0 && !e.done ? `overdue since ${formatShortDate(e.date)}` : `due ${formatShortDate(e.date)}`) : undefined, e.group !== 'Normal' ? e.group : undefined].filter(Boolean).join(' · ')}
        header={(entries) => (
          <StatRow
            items={[
              { label: 'Open', value: String(entries.filter((e) => !e.done).length) },
              { label: 'Overdue', value: String(entries.filter((e) => !e.done && e.date && daysUntil(e.date) < 0).length), alert: entries.some((e) => !e.done && e.date && daysUntil(e.date) < 0) },
              { label: 'Urgent', value: String(entries.filter((e) => !e.done && e.group === 'Urgent').length) },
            ]}
          />
        )}
      />
    </ToolPage>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  tabs: { flexDirection: 'row', gap: 20 },
});
