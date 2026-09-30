/**
 * Craft tools: the freelancer tools only some crafts get (a product kit for
 * makeup and mehendi artists, a setlist for DJs and musicians, a vehicle log
 * for drivers). Each is shown by its rule in `TOOL_RULES` and stores records
 * in the shared tool collections.
 */
import { useState } from 'react';
import { View } from 'react-native';

import { Card, KButton, Segmented } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import type { ToolEntry } from '@/types/platform';
import { daysUntil, formatMoney, formatShortDate, relativeDay, today } from '@/utils/format';
import { shareMessage } from '@/utils/links';

import { EntryList, Hint, Line, StatRow, ToolPage } from '../core';
import { useJobs } from './shared';

const expiryNote = (date?: string) => {
  if (!date) return undefined;
  const d = daysUntil(date);
  return d < 0 ? `expired ${formatShortDate(date)}` : d <= 30 ? `expires ${relativeDay(date)}` : `use by ${formatShortDate(date)}`;
};

// ─── Makeup and mehendi: product kit and hygiene log ────────────────────────

const KIT_GROUPS = ['Base', 'Eyes', 'Lips', 'Hair', 'Mehendi', 'Tools'];

const KIT_PRESET = [
  { title: 'Foundation, three shades', group: 'Base', fields: { type: 'product' } },
  { title: 'Setting spray', group: 'Base', fields: { type: 'product' } },
  { title: 'Waterproof kajal and liner', group: 'Eyes', fields: { type: 'product' } },
  { title: 'Long-wear lipsticks, bridal reds', group: 'Lips', fields: { type: 'product' } },
  { title: 'Hair pins, net and spray', group: 'Hair', fields: { type: 'product' } },
  { title: 'Natural henna cones (×20)', group: 'Mehendi', fields: { type: 'product' } },
  { title: 'Brush set and sponges', group: 'Tools', fields: { type: 'product' } },
];

const HYGIENE_CHECKS = ['Brushes washed and dried', 'Sponges replaced', 'Palettes sanitised', 'Patch test done', 'Kit bag wiped down'];

export function ProductKit() {
  const { account, jobs } = useJobs();
  const [tab, setTab] = useState<'product' | 'hygiene'>('product');
  const upcoming = jobs.filter((j) => j.date >= today());
  return (
    <ToolPage title="Product kit" subtitle="Products, expiry dates and your hygiene log">
      <Segmented
        options={[
          { id: 'product', label: 'Products' },
          { id: 'hygiene', label: 'Hygiene log' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'product' ? (
        <EntryList
          key="product"
          ownerId={account.id}
          tool="freelancer.kit"
          noun="product"
          groupBy="group"
          groupOrder={KIT_GROUPS}
          presets={KIT_PRESET}
          filter={(e) => e.fields?.type !== 'hygiene'}
          defaults={{ group: 'Base', fields: { type: 'product' } }}
          fields={[
            { key: 'title', label: 'Product', kind: 'text', required: true, placeholder: 'e.g. Huda Beauty FauxFilter 220' },
            { key: 'group', label: 'Section', kind: 'select', options: KIT_GROUPS },
            { key: 'date', label: 'Use by', kind: 'date' },
            { key: 'qty', label: 'How many', kind: 'number' },
            { key: 'amount', label: 'Cost to replace', kind: 'money' },
          ]}
          subtitle={(e) => [expiryNote(e.date), e.qty ? `× ${e.qty}` : undefined, e.note].filter(Boolean).join(' · ') || undefined}
          header={(entries) => {
            const expired = entries.filter((e) => e.date && daysUntil(e.date) < 0);
            const soon = entries.filter((e) => e.date && daysUntil(e.date) >= 0 && daysUntil(e.date) <= 30);
            return (
              <View style={{ gap: 10 }}>
                <StatRow
                  items={[
                    { label: 'Products', value: String(entries.length) },
                    { label: 'Expire in 30 days', value: String(soon.length), alert: soon.length > 0 },
                    { label: 'Expired', value: String(expired.length), alert: expired.length > 0 },
                  ]}
                />
                {(expired.length > 0 || soon.length > 0) && (
                  <Card style={{ gap: 4 }}>
                    <Text size={14} weight="semibold">
                      Replace before your next booking
                    </Text>
                    {[...expired, ...soon].slice(0, 5).map((e) => (
                      <Line key={e.id} label={e.title} value={expiryNote(e.date) ?? ''} tone={daysUntil(e.date!) < 0 ? 'danger' : undefined} />
                    ))}
                  </Card>
                )}
              </View>
            );
          }}
          emptyMessage="List what you carry, with use-by dates, so nothing expired touches a bride's skin."
        />
      ) : (
        <EntryList
          key="hygiene"
          ownerId={account.id}
          tool="freelancer.kit"
          noun="hygiene check"
          filter={(e) => e.fields?.type === 'hygiene'}
          defaults={{ date: today(), fields: { type: 'hygiene' } }}
          sort={(a, b) => (b.date ?? '').localeCompare(a.date ?? '')}
          fields={[
            { key: 'title', label: 'Check', kind: 'select', options: HYGIENE_CHECKS, required: true },
            { key: 'date', label: 'Date', kind: 'date', required: true },
            { key: 'refId', label: 'Before which job', kind: 'select', options: upcoming.map((j) => ({ id: j.id, label: `${formatShortDate(j.date)} · ${j.label}` })) },
            { key: 'note', label: 'Notes', kind: 'text' },
          ]}
          subtitle={(e) => [e.date ? formatShortDate(e.date) : undefined, jobs.find((j) => j.id === e.refId)?.label, e.note].filter(Boolean).join(' · ') || undefined}
          header={(entries) => (
            <Hint>
              {entries.length
                ? `Last check ${formatShortDate(entries.map((e) => e.date ?? '').sort().at(-1) ?? today())}. Organisers and brides trust artists who can show this log.`
                : 'Log each clean-down before a job. Organisers and brides trust artists who can show this log.'}
            </Hint>
          )}
        />
      )}
    </ToolPage>
  );
}

// ─── DJs and musicians: setlist ─────────────────────────────────────────────

const SET_SECTIONS = ['Entry', 'First dance', 'Dinner', 'Party', 'Last song', 'Do not play'];

const SETLIST_PRESET = [
  { title: 'Bihe ko bela', group: 'Entry', fields: { artist: 'Traditional', minutes: 4 } },
  { title: 'Timro mero maya', group: 'First dance', fields: { artist: 'Sugam Pokharel', minutes: 5 } },
  { title: 'Resham firiri', group: 'Dinner', fields: { artist: 'Folk', minutes: 4 } },
  { title: 'Rato ra chandra surya', group: 'Party', fields: { artist: 'Folk remix', minutes: 4 } },
  { title: 'Kutu ma kutu', group: 'Party', fields: { artist: 'Rajesh Payal Rai', minutes: 5 } },
];

const minutesOf = (e: ToolEntry) => Number(e.fields?.minutes ?? 0);

export function Setlist() {
  const { account, jobs } = useJobs();
  const upcoming = jobs.filter((j) => j.date >= today());
  const [job, setJob] = useState<string>('all');
  return (
    <ToolPage title="Setlist" subtitle="Songs per moment and the do-not-play list">
      {upcoming.length > 0 && (
        <Segmented options={[{ id: 'all', label: 'My library' }, ...upcoming.slice(0, 3).map((j) => ({ id: j.id, label: formatShortDate(j.date) }))]} value={job} onChange={setJob} />
      )}
      <EntryList
        key={job}
        ownerId={account.id}
        tool="freelancer.setlist"
        noun="song"
        groupBy="group"
        groupOrder={SET_SECTIONS}
        presets={SETLIST_PRESET}
        filter={(e) => job === 'all' || e.refId === job}
        defaults={{ group: 'Party', refId: job === 'all' ? undefined : job }}
        fields={[
          { key: 'title', label: 'Song', kind: 'text', required: true },
          { key: 'f.artist', label: 'Artist', kind: 'text' },
          { key: 'group', label: 'Moment', kind: 'select', options: SET_SECTIONS },
          { key: 'f.minutes', label: 'Length (minutes)', kind: 'number' },
          { key: 'refId', label: 'For a job', kind: 'select', options: upcoming.map((j) => ({ id: j.id, label: `${formatShortDate(j.date)} · ${j.label}` })) },
          { key: 'note', label: 'Notes', kind: 'text', placeholder: 'Requested by the bride’s sister, fade at 2:30…' },
        ]}
        subtitle={(e) => [e.fields?.artist, minutesOf(e) ? `${minutesOf(e)} min` : undefined, e.note].filter(Boolean).join(' · ') || undefined}
        header={(entries) => {
          const playing = entries.filter((e) => e.group !== 'Do not play');
          const minutes = playing.reduce((s, e) => s + minutesOf(e), 0);
          return (
            <View style={{ gap: 10 }}>
              <StatRow
                items={[
                  { label: 'Songs', value: String(playing.length) },
                  { label: 'Running time', value: `${Math.floor(minutes / 60)} h ${minutes % 60} min` },
                  { label: 'Do not play', value: String(entries.length - playing.length) },
                ]}
              />
              <KButton
                label="Share setlist"
                size="sm"
                variant="secondary"
                icon="share-outline"
                disabled={!entries.length}
                onPress={() =>
                  shareMessage(
                    `${account.name} setlist${job === 'all' ? '' : ` · ${jobs.find((j) => j.id === job)?.label ?? ''}`}\n\n${SET_SECTIONS.map((sec) => {
                      const songs = entries.filter((e) => e.group === sec);
                      return songs.length ? `${sec}: ${songs.map((s) => `${s.title}${s.fields?.artist ? ` (${s.fields.artist})` : ''}`).join(', ')}` : '';
                    })
                      .filter(Boolean)
                      .join('\n')}`,
                  )
                }
              />
            </View>
          );
        }}
        emptyMessage={job === 'all' ? 'Build your library once, then pick songs for each job.' : 'No songs picked for this job yet.'}
      />
    </ToolPage>
  );
}

// ─── Drivers: vehicle log ───────────────────────────────────────────────────

const VEHICLE_GROUPS = ['Documents', 'Service', 'Fuel'];

const VEHICLE_PRESET = [
  { title: 'Bluebook tax renewal', group: 'Documents', fields: { kind: 'renewal' } },
  { title: 'Third-party insurance', group: 'Documents', fields: { kind: 'renewal' } },
  { title: 'Pollution test (green sticker)', group: 'Documents', fields: { kind: 'renewal' } },
  { title: 'Driving licence', group: 'Documents', fields: { kind: 'renewal' } },
  { title: 'Engine oil and filter', group: 'Service', fields: { kind: 'service' } },
];

export function VehicleLog() {
  const { account } = useJobs();
  const month = today().slice(0, 7);
  return (
    <ToolPage title="Vehicle log" subtitle="Fuel, servicing and papers">
      <EntryList
        ownerId={account.id}
        tool="freelancer.vehicle"
        noun="record"
        groupBy="group"
        groupOrder={VEHICLE_GROUPS}
        presets={VEHICLE_PRESET}
        defaults={{ group: 'Fuel', date: today() }}
        fields={[
          { key: 'title', label: 'What', kind: 'text', required: true, placeholder: 'e.g. Diesel, Thankot pump' },
          { key: 'group', label: 'Type', kind: 'select', options: VEHICLE_GROUPS },
          { key: 'date', label: 'Date (renewal due for papers)', kind: 'date' },
          { key: 'amount', label: 'Cost', kind: 'money' },
          { key: 'f.km', label: 'Odometer (km)', kind: 'number' },
          { key: 'note', label: 'Notes', kind: 'text' },
        ]}
        subtitle={(e) =>
          [e.group === 'Documents' ? (e.date ? (daysUntil(e.date) < 0 ? `overdue since ${formatShortDate(e.date)}` : `due ${relativeDay(e.date)}`) : 'add the due date') : e.date ? formatShortDate(e.date) : undefined, e.fields?.km ? `${e.fields.km} km` : undefined, e.note]
            .filter(Boolean)
            .join(' · ') || undefined
        }
        header={(entries) => {
          const fuel = entries.filter((e) => e.group === 'Fuel' && (e.date ?? '').startsWith(month)).reduce((s, e) => s + (e.amount ?? 0), 0);
          const papers = entries.filter((e) => e.group === 'Documents' && e.date).sort((a, b) => a.date!.localeCompare(b.date!));
          const next = papers.find((e) => daysUntil(e.date!) >= 0);
          const overdue = papers.filter((e) => daysUntil(e.date!) < 0);
          return (
            <View style={{ gap: 10 }}>
              <StatRow
                items={[
                  { label: 'Fuel this month', value: formatMoney(fuel) },
                  { label: 'Next renewal', value: next ? relativeDay(next.date!) : 'None set' },
                  { label: 'Overdue papers', value: String(overdue.length), alert: overdue.length > 0 },
                ]}
              />
              <Hint>Traffic police check the bluebook, insurance and green sticker. Keep them current before a janti run.</Hint>
            </View>
          );
        }}
      />
    </ToolPage>
  );
}
