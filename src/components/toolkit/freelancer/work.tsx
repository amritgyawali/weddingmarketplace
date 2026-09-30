/** Freelancer toolkit: the job itself — gear, travel, deliveries, backups, diary, safety, the week and open dates. */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, ChoiceChips, EmptyBlock, KButton, SectionTitle, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { cityDistanceKm } from '@/data/cities';
import type { CraftId } from '@/data/crafts';
import { useExperience } from '@/hooks/useExperience';
import { isBlocking, statusOn } from '@/services/matching';
import { NEPAL_HOLIDAYS } from '@/services/toolkit';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import { addDays, daysUntil, formatClock, formatLongDate, formatMoney, formatShortDate, fromISODate, relativeDay, today } from '@/utils/format';
import { shareMessage } from '@/utils/links';

import { EntryList, Hint, StatRow, ToolPage, useToolEntries } from '../core';
import { type JobRef, useJobs } from './shared';

const jobOptions = (jobs: JobRef[]) => jobs.map((j) => ({ id: j.id, label: `${formatShortDate(j.date)} · ${j.label}` }));
const jobLabel = (jobs: JobRef[], id?: string) => jobs.find((j) => j.id === id)?.label;

// ─── Gear checklist ─────────────────────────────────────────────────────────

const PERSONAL = ['Comfortable shoes', 'Water and snacks', 'Rain cover', 'Vivah ID and job sheet', 'Cash for parking and tea'];

/** Starter packing lists per craft (added once, the first time the tool opens). */
const GEAR_BY_CRAFT: Partial<Record<CraftId, Record<string, string[]>>> = {
  photo: {
    Camera: ['Two camera bodies', 'Batteries charged (×4)', 'Memory cards formatted (×6)', 'Wide, standard and tele lenses', 'Lens cloth and blower'],
    Light: ['Speedlights and spare AA batteries', 'Trigger', 'LED panel', 'Light stand', 'Reflector'],
    'Power and data': ['Power bank', 'Card reader', 'Laptop or backup drive', 'Extension board', 'Charging cables'],
    Personal: PERSONAL,
  },
  music: {
    Sound: ['Controller or mixer', 'Speakers and stands', 'Two wireless mics, spare batteries', 'Headphones', 'XLR and RCA cables'],
    Music: ['Laptop with the set downloaded offline', 'Backup USB stick', 'Couple’s song requests printed'],
    Power: ['Extension boards (×3)', 'Voltage stabiliser', 'Gaffer tape'],
    Personal: PERSONAL,
  },
  technician: {
    Sound: ['Mixer', 'Wireless mic kit', 'Stage monitors', 'Spare cables and adapters'],
    Light: ['LED pars and bars', 'DMX controller', 'Clamps and safety wires'],
    Power: ['Distribution board', 'Extension drums', 'Multimeter', 'Gaffer tape'],
    Personal: PERSONAL,
  },
  driver: {
    Vehicle: ['Fuel full the night before', 'Tyre pressure and spare wheel', 'Car washed, ribbons and flowers fixed', 'First-aid box'],
    Papers: ['Bluebook', 'Insurance papers', 'Driving licence', 'Route and pickup list'],
    Personal: PERSONAL,
  },
  decor: {
    Tools: ['Drill and bits', 'Cable ties and tape', 'Floral wire and foam', 'Scissors and cutters', 'Ladder'],
    Setup: ['Design sheet and photos', 'Fabric steamer', 'Extension boards'],
    Personal: PERSONAL,
  },
};

const GENERAL_GEAR: Record<string, string[]> = {
  'Power and data': ['Power bank', 'Charging cables', 'Laptop or tablet'],
  Personal: PERSONAL,
};

export function GearChecklist() {
  const { account } = useJobs();
  const exp = useExperience();
  const toggle = useDb((s) => s.toggleToolEntry);
  const GEAR = (exp.craft && GEAR_BY_CRAFT[exp.craft]) || GENERAL_GEAR;
  return (
    <ToolPage title="Gear checklist" subtitle="Pack the night before every job">
      <EntryList
        ownerId={account.id}
        tool="freelancer.gear"
        noun="item"
        checklist
        groupBy="group"
        groupOrder={Object.keys(GEAR)}
        presets={Object.entries(GEAR).flatMap(([group, items]) => items.map((title) => ({ title, group })))}
        fields={[
          { key: 'title', label: 'Item', kind: 'text', required: true },
          { key: 'group', label: 'Bag', kind: 'select', options: Object.keys(GEAR) },
        ]}
        header={(entries) => (
          <KButton label="Untick everything for the next job" variant="ghost" onPress={() => entries.filter((e) => e.done).forEach((e) => toggle(e.id))} />
        )}
      />
    </ToolPage>
  );
}

// ─── Gear maintenance ───────────────────────────────────────────────────────

export function GearCare() {
  const { account } = useJobs();
  return (
    <ToolPage title="Gear care and insurance" subtitle="Servicing, warranty and value">
      <EntryList
        ownerId={account.id}
        tool="freelancer.gearcare"
        noun="gear item"
        sort={(a, b) => (a.date ?? '9').localeCompare(b.date ?? '9')}
        fields={[
          { key: 'title', label: 'Item', kind: 'text', required: true, placeholder: 'e.g. Sony A7 IV body' },
          { key: 'f.serial', label: 'Serial number', kind: 'text' },
          { key: 'amount', label: 'Replacement value', kind: 'money' },
          { key: 'date', label: 'Next service or sensor clean', kind: 'date' },
          { key: 'f.warranty', label: 'Warranty until', kind: 'date' },
          { key: 'f.insured', label: 'Insured', kind: 'toggle' },
          { key: 'note', label: 'Notes', kind: 'text' },
        ]}
        subtitle={(e) => [e.fields?.serial, e.date ? `service ${relativeDay(e.date)}` : undefined, e.fields?.warranty ? `warranty to ${formatShortDate(String(e.fields.warranty))}` : undefined, e.fields?.insured ? 'insured' : 'not insured'].filter(Boolean).join(' · ')}
        header={(entries) => (
          <StatRow
            items={[
              { label: 'Kit value', value: formatMoney(entries.reduce((s, e) => s + (e.amount ?? 0), 0)) },
              { label: 'Uninsured', value: String(entries.filter((e) => !e.fields?.insured).length), alert: entries.some((e) => !e.fields?.insured) },
              { label: 'Service due (30 days)', value: String(entries.filter((e) => e.date && daysUntil(e.date) <= 30).length) },
            ]}
          />
        )}
      />
    </ToolPage>
  );
}

// ─── Travel planner ─────────────────────────────────────────────────────────

export function TravelPlanner() {
  const t = useRoleTheme();
  const { account, jobs } = useJobs();
  const upcoming = jobs.filter((j) => daysUntil(j.date) >= 0);
  return (
    <ToolPage title="Travel planner" subtitle="Getting to each job on time">
      {upcoming.length > 0 && (
        <Card style={{ gap: 6 }}>
          <SectionTitle title="Distances from your base" />
          {upcoming.slice(0, 5).map((j) => {
            const km = cityDistanceKm(account.city, j.city);
            return (
              <View key={j.id} style={styles.between}>
                <Text size={14} color={t.c.text} style={{ flex: 1 }} numberOfLines={1}>
                  {formatShortDate(j.date)} · {j.city}
                </Text>
                <Text size={14} weight="semibold" color={km && km > (account.travelRadiusKm ?? 50) ? t.c.danger : t.c.textStrong}>
                  {km === null ? 'local' : `${Math.round(km)} km`}
                </Text>
              </View>
            );
          })}
          <Hint>Red means the job is beyond your {account.travelRadiusKm ?? 50} km travel radius. Plan to arrive the night before.</Hint>
        </Card>
      )}
      <EntryList
        ownerId={account.id}
        tool="freelancer.travel"
        noun="trip"
        sort={(a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (a.time ?? '').localeCompare(b.time ?? '')}
        fields={[
          { key: 'refId', label: 'Job', kind: 'select', options: jobOptions(upcoming) },
          { key: 'title', label: 'Trip', kind: 'text', required: true, placeholder: 'e.g. Bike to Bhaktapur, micro to Pokhara' },
          { key: 'date', label: 'Leave on', kind: 'date', required: true },
          { key: 'time', label: 'Leave at', kind: 'time' },
          { key: 'f.mode', label: 'How', kind: 'select', options: ['Bike', 'Car', 'Micro / bus', 'Flight', 'Ride with team'] },
          { key: 'amount', label: 'Cost', kind: 'money' },
          { key: 'note', label: 'Route and stay notes', kind: 'multiline' },
        ]}
        subtitle={(e) => [jobLabel(jobs, e.refId), e.date ? relativeDay(e.date) : undefined, e.time ? formatClock(e.time) : undefined, e.fields?.mode].filter(Boolean).join(' · ')}
        emptyMessage="Add a trip for any job outside your city so you leave with enough buffer for traffic and landslides."
      />
    </ToolPage>
  );
}

// ─── Delivery tracker ───────────────────────────────────────────────────────

const DELIVERY_STATUS = [
  { id: 'culling', label: 'Culling' },
  { id: 'editing', label: 'Editing' },
  { id: 'review', label: 'With client' },
  { id: 'delivered', label: 'Delivered' },
];

export function Deliveries() {
  const { account, jobs } = useJobs();
  return (
    <ToolPage title="Edits and deliveries" subtitle="What you owe each client, and when">
      <EntryList
        ownerId={account.id}
        tool="freelancer.deliveries"
        noun="delivery"
        statusPill
        groupBy="status"
        groupOrder={['culling', 'editing', 'review', 'delivered']}
        defaults={{ status: 'culling', date: addDays(today(), 21) }}
        sort={(a, b) => (a.date ?? '').localeCompare(b.date ?? '')}
        fields={[
          { key: 'title', label: 'Deliverable', kind: 'text', required: true, placeholder: 'e.g. 400 edited photos, 3-min highlight' },
          { key: 'refId', label: 'Job', kind: 'select', options: jobOptions(jobs) },
          { key: 'date', label: 'Due', kind: 'date', required: true },
          { key: 'status', label: 'Stage', kind: 'select', options: DELIVERY_STATUS },
          { key: 'f.link', label: 'Gallery or drive link', kind: 'text' },
        ]}
        subtitle={(e) => [jobLabel(jobs, e.refId), e.date ? (daysUntil(e.date) < 0 && e.status !== 'delivered' ? `late since ${formatShortDate(e.date)}` : `due ${relativeDay(e.date)}`) : undefined].filter(Boolean).join(' · ')}
        header={(entries) => (
          <StatRow
            items={[
              { label: 'In progress', value: String(entries.filter((e) => e.status !== 'delivered').length) },
              { label: 'Due this week', value: String(entries.filter((e) => e.status !== 'delivered' && e.date && daysUntil(e.date) >= 0 && daysUntil(e.date) <= 7).length) },
              { label: 'Late', value: String(entries.filter((e) => e.status !== 'delivered' && e.date && daysUntil(e.date) < 0).length), alert: entries.some((e) => e.status !== 'delivered' && e.date && daysUntil(e.date) < 0) },
            ]}
          />
        )}
      />
    </ToolPage>
  );
}

// ─── Card backup log ────────────────────────────────────────────────────────

export function BackupLog() {
  const t = useRoleTheme();
  const { account, jobs } = useJobs();
  const past = jobs.filter((j) => daysUntil(j.date) <= 0);
  const entries = useToolEntries(account.id, 'freelancer.backup');
  const missing = past.filter((j) => daysUntil(j.date) >= -60 && !entries.some((e) => e.refId === j.id && e.fields?.copies && Number(e.fields.copies) >= 2));
  return (
    <ToolPage title="Card backup log" subtitle="Two copies before you format a card">
      {missing.length > 0 && (
        <Card style={{ gap: 4 }}>
          <Text size={15} weight="semibold" color={t.c.danger}>
            {missing.length} recent job{missing.length > 1 ? 's' : ''} without two backups
          </Text>
          {missing.map((j) => (
            <Text key={j.id} size={13}>
              • {formatShortDate(j.date)} · {j.label}
            </Text>
          ))}
        </Card>
      )}
      <EntryList
        ownerId={account.id}
        tool="freelancer.backup"
        noun="backup"
        defaults={{ date: today(), fields: { copies: 2 } }}
        sort={(a, b) => (b.date ?? '').localeCompare(a.date ?? '')}
        fields={[
          { key: 'refId', label: 'Job', kind: 'select', options: jobOptions(past), required: true },
          { key: 'title', label: 'Cards', kind: 'text', required: true, placeholder: 'e.g. Cards A1–A4, 256 GB' },
          { key: 'f.copies', label: 'Copies made', kind: 'number' },
          { key: 'f.where', label: 'Where', kind: 'text', placeholder: 'Laptop, SSD-2, Google Drive' },
          { key: 'date', label: 'Backed up on', kind: 'date' },
          { key: 'f.formatted', label: 'Cards formatted', kind: 'toggle' },
        ]}
        subtitle={(e) => [jobLabel(jobs, e.refId), `${e.fields?.copies ?? 0} copies`, e.fields?.where, e.fields?.formatted ? 'formatted' : 'not formatted yet'].filter(Boolean).join(' · ')}
      />
    </ToolPage>
  );
}

// ─── Work diary ─────────────────────────────────────────────────────────────

export function WorkDiary() {
  const { account, jobs } = useJobs();
  return (
    <ToolPage title="Work diary" subtitle="Notes and lessons from each job">
      <EntryList
        ownerId={account.id}
        tool="freelancer.diary"
        noun="note"
        defaults={{ date: today() }}
        sort={(a, b) => (b.date ?? '').localeCompare(a.date ?? '')}
        fields={[
          { key: 'refId', label: 'Job', kind: 'select', options: jobOptions(jobs) },
          { key: 'title', label: 'Headline', kind: 'text', required: true, placeholder: 'e.g. Mandap was dark — bring the LED panel' },
          { key: 'note', label: 'What happened', kind: 'multiline' },
          { key: 'date', label: 'Date', kind: 'date' },
          { key: 'f.mood', label: 'How it went', kind: 'select', options: ['Great', 'Fine', 'Tough'] },
        ]}
        subtitle={(e) => [e.date ? formatShortDate(e.date) : undefined, jobLabel(jobs, e.refId), e.fields?.mood, e.note].filter(Boolean).join(' · ')}
        emptyMessage="A two-line note after each job makes you noticeably better within a season."
      />
    </ToolPage>
  );
}

// ─── Safety checklist ───────────────────────────────────────────────────────

const SAFETY: Record<string, string[]> = {
  'Before travel': ['Check road status for landslides (monsoon)', 'Share your route with family', 'Helmet and rain gear for the bike', 'Emergency contact saved in phone'],
  'On a long day': ['Drink water every hour', 'Eat before the evening rituals start', 'Take a 10-minute break every 3 hours', 'Watch out for firecrackers near gear'],
  'High altitude and cold': ['Warm layers for Nagarkot / Mustang shoots', 'Spare batteries in an inside pocket', 'Know the signs of altitude sickness'],
  'After the job': ['Get home safely before editing', 'Back up cards the same night', 'Log any injuries or damage with the organiser'],
};

export function SafetyChecklist() {
  const { account } = useJobs();
  return (
    <ToolPage title="Health and safety" subtitle="Look after yourself on long wedding days">
      <EntryList
        ownerId={account.id}
        tool="freelancer.safety"
        noun="item"
        checklist
        groupBy="group"
        groupOrder={Object.keys(SAFETY)}
        presets={Object.entries(SAFETY).flatMap(([group, items]) => items.map((title) => ({ title, group })))}
        fields={[
          { key: 'title', label: 'Item', kind: 'text', required: true },
          { key: 'group', label: 'When', kind: 'select', options: Object.keys(SAFETY) },
        ]}
      />
      <Hint>Emergency: ambulance 102 · police 100. For an incident during a Vivah job, also tell the coordinator from the job screen so it is logged.</Hint>
    </ToolPage>
  );
}

// ─── This week ──────────────────────────────────────────────────────────────

export function WeekPlanner() {
  const t = useRoleTheme();
  const { account, jobs } = useJobs();
  const availability = useDb((s) => s.availability);
  const rules = useDb((s) => s.availabilityRules);
  const trips = useToolEntries(account.id, 'freelancer.travel');
  const deliveries = useToolEntries(account.id, 'freelancer.deliveries');
  const days = Array.from({ length: 7 }, (_, i) => addDays(today(), i));
  return (
    <ToolPage title="This week" subtitle="Jobs, trips, deadlines and days off">
      {days.map((d, i) => {
        const dayJobs = jobs.filter((j) => j.date === d);
        const dayTrips = trips.filter((x) => x.date === d);
        const due = deliveries.filter((x) => x.date === d && x.status !== 'delivered');
        const status = statusOn(account.id, d, availability, false, rules);
        const holiday = NEPAL_HOLIDAYS.find((h) => h.date === d);
        const empty = !dayJobs.length && !dayTrips.length && !due.length;
        return (
          <Card key={d} style={{ gap: 6 }}>
            <View style={styles.between}>
              <Text size={15} weight="semibold" color={t.c.textStrong}>
                {i === 0 ? `Today · ${formatShortDate(d)}` : i === 1 ? `Tomorrow · ${formatShortDate(d)}` : formatShortDate(d)}
              </Text>
              {status !== 'AVAILABLE' && <StatusPill status={status} />}
            </View>
            {holiday && (
              <Text size={13} color={t.c.warning}>
                {holiday.name}
              </Text>
            )}
            {dayJobs.map((j) => (
              <Text key={j.id} size={14} color={t.c.text}>
                • {j.time ? formatClock(j.time) : ''} {j.label} — {j.city}
              </Text>
            ))}
            {dayTrips.map((x) => (
              <Text key={x.id} size={14} color={t.c.text}>
                • Travel: {x.title}
                {x.time ? ` at ${formatClock(x.time)}` : ''}
              </Text>
            ))}
            {due.map((x) => (
              <Text key={x.id} size={14} color={t.c.danger}>
                • Due: {x.title}
              </Text>
            ))}
            {empty && (
              <Text size={13} color={t.c.muted}>
                {isBlocking(status) ? 'Blocked on your calendar' : 'Free — good day for editing or a quick gig'}
              </Text>
            )}
          </Card>
        );
      })}
    </ToolPage>
  );
}

// ─── Open dates ─────────────────────────────────────────────────────────────

export function OpenDates() {
  const t = useRoleTheme();
  const { account, jobs } = useJobs();
  const availability = useDb((s) => s.availability);
  const rules = useDb((s) => s.availabilityRules);
  const [range, setRange] = useState('Next 30 days');
  const [weekendsOnly, setWeekendsOnly] = useState<string[]>([]);
  const span = range === 'Next 30 days' ? 30 : 60;
  const free = Array.from({ length: span }, (_, i) => addDays(today(), i + 1)).filter((d) => {
    if (jobs.some((j) => j.date === d)) return false;
    if (isBlocking(statusOn(account.id, d, availability, false, rules))) return false;
    if (weekendsOnly.length) return fromISODate(d).getDay() >= 5;
    return true;
  });
  const message = `Namaste! ${account.name} (${(account.skills ?? []).slice(0, 2).join(', ')}) is free on:\n${free.slice(0, 20).map((d) => `• ${formatLongDate(d)}`).join('\n')}\n\nBook me on Vivah or reply here.`;
  return (
    <ToolPage title="Open dates" subtitle="Share when you can take work">
      <ChoiceChips options={['Next 30 days', 'Next 60 days']} selected={[range]} onToggle={setRange} />
      <ChoiceChips options={['Fridays and Saturdays only']} selected={weekendsOnly} onToggle={(v) => setWeekendsOnly(weekendsOnly.includes(v) ? [] : [v])} />
      <StatRow items={[{ label: 'Free days', value: String(free.length) }, { label: 'Booked days', value: String(jobs.filter((j) => daysUntil(j.date) > 0 && daysUntil(j.date) <= span).length) }]} />
      {free.length === 0 ? (
        <EmptyBlock icon="calendar-outline" title="You’re fully booked" message="Nice. Consider raising your day rate for the next season." />
      ) : (
        <Card style={{ gap: 4 }}>
          {free.slice(0, 30).map((d) => (
            <Text key={d} size={14} color={t.c.text}>
              {formatLongDate(d)}
            </Text>
          ))}
        </Card>
      )}
      <KButton label="Share open dates" icon="share-outline" disabled={!free.length} onPress={() => shareMessage(message)} />
      <Hint>Uses your Vivah calendar: booked jobs, days you marked unavailable and your weekly rules.</Hint>
    </ToolPage>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
});
