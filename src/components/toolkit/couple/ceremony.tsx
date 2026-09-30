/** Couple toolkit: dates, rituals, family and the wedding day itself. */
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, ChoiceChips, KButton, SectionTitle, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { climateFor, jantiVehicles, saitDates } from '@/services/toolkit';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { ToolEntry } from '@/types/platform';
import { formatClock, formatLongDate, formatShortDate, today } from '@/utils/format';
import { shareMessage } from '@/utils/links';

import { EntryList, Hint, Line, NumberField, StatRow, ToolPage, useToolEntries, useToolState } from '../core';
import { useWedding } from './shared';

const shareList = (title: string, entries: ToolEntry[], line: (e: ToolEntry) => string) =>
  shareMessage(`${title}\n\n${entries.map((e) => `• ${line(e)}`).join('\n')}\n\nSent from Vivah`);

// ─── Sait finder ────────────────────────────────────────────────────────────

export function SaitFinder() {
  const t = useRoleTheme();
  const w = useWedding();
  const [state, setState] = useToolState(w.owner, 'couple.sait', { starred: [] as string[] });
  const [filters, setFilters] = useState<string[]>([]);
  const all = saitDates(today(), 365);
  const shown = all.filter((d) => (!filters.includes('Saturdays') || d.saturday) && (!filters.includes('Starred') || state.starred.includes(d.date)));
  const months = [...new Set(shown.map((d) => d.bsMonth))];
  const onList = all.some((d) => d.date === w.date);
  const toggleStar = (date: string) => setState({ starred: state.starred.includes(date) ? state.starred.filter((x) => x !== date) : [...state.starred, date] });

  return (
    <ToolPage title="Sait finder" subtitle="Auspicious wedding dates for the next 12 months">
      <Card style={{ gap: 6 }}>
        <Text size={15} weight="semibold" color={t.c.textStrong}>
          Your date: {formatLongDate(w.date)}
        </Text>
        <Hint>{onList ? 'It falls on one of the indicative saits below.' : 'It is not on the indicative list. Please confirm it with your purohit before booking.'}</Hint>
      </Card>
      <Hint>These are indicative dates in the wedding months (Mangsir, Magh, Falgun, Baisakh, Jestha). The final sait depends on both kundalis, so always confirm with your family purohit and the Nepali patro.</Hint>
      <ChoiceChips options={['Saturdays', 'Starred']} selected={filters} onToggle={(v) => setFilters(filters.includes(v) ? filters.filter((x) => x !== v) : [...filters, v])} />
      {months.map((m) => (
        <View key={m}>
          <SectionTitle title={m} />
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {shown
              .filter((d) => d.bsMonth === m)
              .map((d, i) => {
                const wx = climateFor(w.city, d.date);
                const starred = state.starred.includes(d.date);
                return (
                  <View key={d.date} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text size={15} weight="semibold" color={t.c.textStrong}>
                        {formatLongDate(d.date)}
                      </Text>
                      <Text size={13} color={t.c.muted}>
                        {d.weekday}
                        {d.saturday ? ' (public holiday)' : ''} · {wx.min}–{wx.max}°C in {w.city}
                      </Text>
                    </View>
                    {d.date === w.date && <StatusPill status="confirmed" label="Your date" />}
                    <Pressable onPress={() => toggleStar(d.date)} hitSlop={10} accessibilityLabel={starred ? 'Remove star' : 'Star this date'}>
                      <Ionicons name={starred ? 'star' : 'star-outline'} size={20} color={starred ? t.c.warning : t.c.subtle} />
                    </Pressable>
                  </View>
                );
              })}
          </Card>
        </View>
      ))}
      {state.starred.length > 0 && (
        <KButton
          label={`Share ${state.starred.length} starred dates with family`}
          variant="secondary"
          icon="share-outline"
          onPress={() => shareMessage(`Dates we like for our wedding:\n${[...state.starred].sort().map((d) => `• ${formatLongDate(d)}`).join('\n')}\n\nPlease check them with purohit ji.`)}
        />
      )}
    </ToolPage>
  );
}

// ─── Family duties ──────────────────────────────────────────────────────────

const DUTIES = [
  ['Kanyadan', "Bride's parents"],
  ['Welcoming the janti (swagat)', "Bride's uncles"],
  ['Leading the janti', "Groom's elder brother"],
  ['Coordinating with purohit ji', 'Family elder'],
  ['Gift and shagun table', 'Cousin with a notebook'],
  ['Elders’ seating and care', 'Aunts'],
  ['Guest pickups', 'Cousins with cars'],
  ['Vendor payments on the day', 'One trusted person'],
  ['Food tasting and kitchen check', "Bride's mama"],
  ['Bidai arrangements', "Bride's family"],
];

export function FamilyDuties() {
  const w = useWedding();
  return (
    <ToolPage title="Family duties" subtitle="Who does what on each day">
      <Hint>Give every ritual and task one owner so nothing is left to “someone”. Tick a duty once the person has agreed.</Hint>
      <EntryList
        ownerId={w.owner}
        tool="couple.duties"
        noun="duty"
        checklist
        groupBy="group"
        groupOrder={w.eventNames}
        presets={DUTIES.map(([title, person]) => ({ title, group: w.eventNames[0], fields: { person } }))}
        fields={[
          { key: 'title', label: 'Duty', kind: 'text', required: true },
          { key: 'f.person', label: 'Who', kind: 'text', placeholder: 'e.g. Sujan dai' },
          { key: 'f.phone', label: 'Phone', kind: 'text' },
          { key: 'group', label: 'Function', kind: 'select', options: w.eventNames },
          { key: 'note', label: 'Notes', kind: 'multiline' },
        ]}
        subtitle={(e) => [e.fields?.person, e.fields?.phone, e.note].filter(Boolean).join(' · ') || 'Not assigned yet'}
        header={(entries) => (
          <KButton label="Share duties on WhatsApp" variant="secondary" icon="share-outline" onPress={() => shareList(`Family duties — ${w.names}`, entries, (e) => `${e.title}: ${e.fields?.person ?? 'TBD'}${e.group ? ` (${e.group})` : ''}`)} />
        )}
      />
    </ToolPage>
  );
}

// ─── Janti planner ──────────────────────────────────────────────────────────

export function JantiPlanner() {
  const t = useRoleTheme();
  const w = useWedding();
  const [s, set] = useToolState(w.owner, 'couple.janti', { headcount: Math.round(w.guestCount * 0.35), departure: '14:00', from: '', to: w.project?.venueSelected ?? '' });
  const vehicles = useToolEntries(w.owner, 'couple.janti');
  const need = jantiVehicles(Number(s.headcount));
  const seats = vehicles.reduce((sum, v) => sum + (v.qty ?? 0), 0);
  const short = Math.max(0, Number(s.headcount) - seats);

  return (
    <ToolPage title="Janti planner" subtitle="Baraat headcount, vehicles and timing">
      <Card style={{ gap: 10 }}>
        <NumberField label="People travelling with the janti" value={Number(s.headcount)} onChange={(n) => set({ headcount: n })} />
        <Hint>
          Suggested fleet: {need.bus} bus{need.bus === 1 ? '' : 'es'} (35 seats), {need.micro} micro (14 seats), {need.car} car{need.car === 1 ? '' : 's'} — {need.seats} seats.
        </Hint>
      </Card>
      <StatRow
        items={[
          { label: 'Seats booked', value: String(seats) },
          { label: 'Still to arrange', value: String(short), alert: short > 0 },
          { label: 'Leaves at', value: formatClock(String(s.departure)) },
        ]}
      />
      <EntryList
        ownerId={w.owner}
        tool="couple.janti"
        noun="vehicle"
        fields={[
          { key: 'title', label: 'Vehicle', kind: 'text', required: true, placeholder: 'e.g. Sajha bus, Hiace' },
          { key: 'qty', label: 'Seats', kind: 'number', required: true },
          { key: 'f.driver', label: 'Driver', kind: 'text' },
          { key: 'f.phone', label: 'Driver phone', kind: 'text' },
          { key: 'amount', label: 'Hire cost', kind: 'money' },
          { key: 'note', label: 'Pickup point', kind: 'text' },
        ]}
        subtitle={(e) => [`${e.qty ?? 0} seats`, e.fields?.driver, e.fields?.phone, e.note].filter(Boolean).join(' · ')}
        emptyMessage="Add each bus, micro or car you have booked so you know exactly how many seats are covered."
      />
      <Text size={12} color={t.c.subtle}>
        Tip: plan to leave 45 minutes earlier than you think. Panche baja, traffic and the swagat always take longer.
      </Text>
    </ToolPage>
  );
}

// ─── Puja samagri ───────────────────────────────────────────────────────────

const SAMAGRI: Record<string, string[]> = {
  'Tilak and swayambar': ['Abir and sindoor', 'Akshyata (rice)', 'Dubo and flowers', 'Phool mala × 2', 'Supari and paan', 'Dahi and sagun'],
  Kanyadan: ['Kalash with water', 'Copper plate (thal)', 'Janai', 'Coconut', 'Gold or silver coin for dan', 'Sacred thread (dhago)'],
  'Sindoor and pote': ['Sindoor box', 'Pote (green beads)', 'Tilhari', 'Red saree for the bride', 'Mirror and comb'],
  'Havan and puja': ['Ghee', 'Diyo and batti', 'Havan wood and samagri', 'Til and jau', 'Incense (dhup)', 'Matches and lighter'],
  'Bidai and gharbhitryaune': ['Doko of sel roti', 'Fruits and sweets', 'Kalash for griha pravesh', 'Rice-filled pot to kick', 'Rangoli colours'],
};

export function Samagri() {
  const w = useWedding();
  return (
    <ToolPage title="Puja samagri" subtitle="Ritual items by ceremony">
      <Hint>A starting list for a Hindu Nepali wedding. Your purohit ji may add or change items; tick each one once it is packed.</Hint>
      <EntryList
        ownerId={w.owner}
        tool="couple.samagri"
        noun="item"
        checklist
        groupBy="group"
        groupOrder={Object.keys(SAMAGRI)}
        presets={Object.entries(SAMAGRI).flatMap(([group, items]) => items.map((title) => ({ title, group })))}
        fields={[
          { key: 'title', label: 'Item', kind: 'text', required: true },
          { key: 'group', label: 'Ceremony', kind: 'select', options: Object.keys(SAMAGRI) },
          { key: 'qty', label: 'Quantity', kind: 'number' },
          { key: 'note', label: 'Notes', kind: 'text', placeholder: 'Who buys it, where it is kept' },
        ]}
      />
    </ToolPage>
  );
}

// ─── Emergency kit ──────────────────────────────────────────────────────────

const KIT: Record<string, string[]> = {
  "Bride's bag": ['Safety pins and hair pins', 'Double-sided tape', 'Blotting paper and compact', 'Spare potey and bangles', 'Comfortable flats', 'Lip colour for touch-ups'],
  "Groom's bag": ['Spare dhaka topi', 'Handkerchiefs', 'Shoe polish and cloth', 'Deodorant', 'Phone power bank'],
  'For everyone': ['Paracetamol and antacid', 'Band-aids', 'ORS sachets', 'Water bottles', 'Umbrellas', 'Small scissors and thread'],
  Documents: ['Citizenship copies (for marriage registration)', 'Passport photos', 'Vendor contracts and receipts', 'Cash envelopes for tips'],
};

export function EmergencyKit() {
  const w = useWedding();
  return (
    <ToolPage title="Emergency kit" subtitle="What to pack for the day">
      <EntryList
        ownerId={w.owner}
        tool="couple.kit"
        noun="item"
        checklist
        groupBy="group"
        groupOrder={Object.keys(KIT)}
        presets={Object.entries(KIT).flatMap(([group, items]) => items.map((title) => ({ title, group })))}
        fields={[
          { key: 'title', label: 'Item', kind: 'text', required: true },
          { key: 'group', label: 'Bag', kind: 'select', options: Object.keys(KIT) },
          { key: 'note', label: 'Notes', kind: 'text' },
        ]}
      />
    </ToolPage>
  );
}

// ─── Outfits and jewellery ──────────────────────────────────────────────────

const OUTFIT_STATUS = [
  { id: 'shortlisted', label: 'Shortlisted' },
  { id: 'ordered', label: 'Ordered' },
  { id: 'fitting', label: 'Fitting' },
  { id: 'ready', label: 'Ready' },
  { id: 'collected', label: 'Collected' },
];

export function Outfits() {
  const w = useWedding();
  return (
    <ToolPage title="Outfits and jewellery" subtitle="Orders, fittings and pickups">
      <EntryList
        ownerId={w.owner}
        tool="couple.outfits"
        noun="outfit"
        groupBy="group"
        groupOrder={['Bride', 'Groom', 'Family']}
        statusPill
        defaults={{ status: 'shortlisted', group: 'Bride' }}
        fields={[
          { key: 'title', label: 'Item', kind: 'text', required: true, placeholder: 'e.g. Red Banarasi saree, daura suruwal' },
          { key: 'group', label: 'For', kind: 'select', options: ['Bride', 'Groom', 'Family'] },
          { key: 'status', label: 'Status', kind: 'select', options: OUTFIT_STATUS },
          { key: 'f.shop', label: 'Shop or tailor', kind: 'text', placeholder: 'e.g. Indra Chowk, New Road' },
          { key: 'date', label: 'Next fitting or pickup', kind: 'date' },
          { key: 'amount', label: 'Cost', kind: 'money' },
          { key: 'note', label: 'Notes', kind: 'multiline', placeholder: 'Measurements, colour, blouse design' },
        ]}
        subtitle={(e) => [e.fields?.shop, e.date ? `Next: ${formatShortDate(e.date)}` : undefined].filter(Boolean).join(' · ') || undefined}
        header={(entries) => {
          const next = entries.filter((e) => e.date && e.date >= today() && e.status !== 'collected').sort((a, b) => a.date!.localeCompare(b.date!))[0];
          return (
            <StatRow
              items={[
                { label: 'Items', value: String(entries.length) },
                { label: 'Not ready', value: String(entries.filter((e) => e.status !== 'ready' && e.status !== 'collected').length) },
                { label: 'Next visit', value: next ? formatShortDate(next.date!) : '—' },
              ]}
            />
          );
        }}
      />
    </ToolPage>
  );
}

// ─── Music ──────────────────────────────────────────────────────────────────

const MOMENTS = ['Janti arrival', 'Bride’s entry', 'Swayambar', 'Couple entry', 'First dance', 'Sangeet', 'Dance floor', 'Bidai'];

export function MusicPlan() {
  const w = useWedding();
  return (
    <ToolPage title="Music and playlist" subtitle="Songs for every moment">
      <Hint>List the songs you want for each moment, plus any you never want played. Share the list with your DJ or band a week before.</Hint>
      <EntryList
        ownerId={w.owner}
        tool="couple.music"
        noun="song"
        groupBy="group"
        groupOrder={[...MOMENTS, 'Do not play']}
        defaults={{ group: MOMENTS[0] }}
        fields={[
          { key: 'title', label: 'Song', kind: 'text', required: true },
          { key: 'f.artist', label: 'Artist', kind: 'text' },
          { key: 'group', label: 'Moment', kind: 'select', options: [...MOMENTS, 'Do not play'] },
          { key: 'note', label: 'Notes', kind: 'text', placeholder: 'Start at the chorus, live band version…' },
        ]}
        subtitle={(e) => [e.fields?.artist, e.note].filter(Boolean).join(' · ') || undefined}
        header={(entries) =>
          entries.length > 0 && <KButton label="Share with DJ or band" variant="secondary" icon="musical-notes-outline" onPress={() => shareList(`Music for ${w.names}`, entries, (e) => `${e.group}: ${e.title}${e.fields?.artist ? ` — ${e.fields.artist}` : ''}`)} />
        }
        emptyMessage="Start with the janti arrival and the couple entry — those two set the mood."
      />
    </ToolPage>
  );
}

// ─── Shot list ──────────────────────────────────────────────────────────────

const SHOTS: Record<string, string[]> = {
  'Family photos': ['Couple with both sets of parents', 'Bride with siblings', 'Groom with siblings', 'Grandparents with the couple', 'Full extended family (both sides)', 'Mama-ghar family'],
  Rituals: ['Tilak and swayambar exchange', 'Kanyadan', 'Sindoor and pote', 'Saptapadi / pheras', 'Bidai'],
  Details: ['Mehendi close-up', 'Jewellery and potey', 'Mandap decoration', 'Invitation card', 'Janti with panche baja'],
  'Couple portraits': ['Golden-hour portraits', 'Candid laughter', 'Portrait with the venue view'],
};

export function ShotList() {
  const w = useWedding();
  return (
    <ToolPage title="Photo shot list" subtitle="Must-have photos for your photographer">
      <EntryList
        ownerId={w.owner}
        tool="couple.shots"
        noun="shot"
        checklist
        groupBy="group"
        groupOrder={Object.keys(SHOTS)}
        presets={Object.entries(SHOTS).flatMap(([group, items]) => items.map((title) => ({ title, group })))}
        fields={[
          { key: 'title', label: 'Shot', kind: 'text', required: true },
          { key: 'group', label: 'Section', kind: 'select', options: Object.keys(SHOTS) },
          { key: 'note', label: 'Who should be in it', kind: 'text' },
        ]}
        header={(entries) => <KButton label="Share with photographer" variant="secondary" icon="camera-outline" onPress={() => shareList(`Shot list — ${w.names}`, entries, (e) => `${e.group}: ${e.title}${e.note ? ` (${e.note})` : ''}`)} />}
      />
    </ToolPage>
  );
}

// ─── My day schedule ────────────────────────────────────────────────────────

const MY_DAY: [string, string, string][] = [
  ['05:00', 'Wake up, bath and light breakfast', 'Home'],
  ['06:00', 'Makeup artist arrives', 'Home'],
  ['08:30', 'Getting-ready photos', 'Home'],
  ['10:00', 'Family puja before leaving', 'Home'],
  ['13:00', 'Lunch and rest (keep it light)', 'Home'],
  ['16:00', 'Janti arrives, swagat', 'Venue'],
  ['17:00', 'Swayambar and tilak', 'Mandap'],
  ['19:00', 'Kanyadan and sindoor', 'Mandap'],
  ['21:00', 'Dinner with family', 'Venue'],
];

export function MyDay() {
  const w = useWedding();
  return (
    <ToolPage title="My day schedule" subtitle={`Your personal timeline for ${formatShortDate(w.date)}`}>
      <Hint>This is your own schedule, separate from the vendor run sheet your coordinator manages. Share it with the people getting ready with you.</Hint>
      <EntryList
        ownerId={w.owner}
        tool="couple.myday"
        noun="step"
        presets={MY_DAY.map(([time, title, place], i) => ({ title, time, date: w.date, fields: { place, order: i } }))}
        defaults={{ date: w.date }}
        sort={(a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (a.time ?? '').localeCompare(b.time ?? '')}
        fields={[
          { key: 'time', label: 'Time', kind: 'time', required: true },
          { key: 'title', label: 'What', kind: 'text', required: true },
          { key: 'date', label: 'Date', kind: 'date' },
          { key: 'f.place', label: 'Where', kind: 'text' },
          { key: 'f.who', label: 'With', kind: 'text' },
        ]}
        subtitle={(e) => [e.time ? formatClock(e.time) : undefined, e.date && e.date !== w.date ? formatShortDate(e.date) : undefined, e.fields?.place, e.fields?.who].filter(Boolean).join(' · ')}
        header={(entries) => (
          <KButton
            label="Share my schedule"
            variant="secondary"
            icon="share-outline"
            onPress={() => shareList(`${w.names} — wedding day`, [...entries].sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')), (e) => `${e.time ? formatClock(e.time) : ''} ${e.title}${e.fields?.place ? ` @ ${e.fields.place}` : ''}`)}
          />
        )}
      />
    </ToolPage>
  );
}

// ─── Weather guide ──────────────────────────────────────────────────────────

export function WeatherGuide() {
  const t = useRoleTheme();
  const w = useWedding();
  const rows = w.events.filter((e) => e.date).map((e) => ({ id: e.id, name: e.name, date: e.date!, city: e.city || w.city }));
  const list = rows.length ? rows : [{ id: 'main', name: 'Wedding', date: w.date, city: w.city }];
  return (
    <ToolPage title="Weather and season" subtitle="What to expect on your dates">
      {list.map((r) => {
        const c = climateFor(r.city, r.date);
        return (
          <Card key={r.id} style={{ gap: 8 }}>
            <View style={styles.between}>
              <View style={{ flex: 1 }}>
                <Text size={16} weight="semibold" color={t.c.textStrong}>
                  {r.name}
                </Text>
                <Text size={13} color={t.c.muted}>
                  {formatLongDate(r.date)} · {r.city}
                </Text>
              </View>
              <StatusPill status={c.verdict === 'great' ? 'confirmed' : c.verdict === 'good' ? 'pending' : 'high'} label={c.verdict === 'great' ? 'Great season' : c.verdict === 'good' ? 'Plan ahead' : 'Weather risk'} />
            </View>
            <Line label="Typical temperature" value={`${c.min}–${c.max}°C`} />
            <Line label="Rainy days that month" value={`about ${c.rainDays}`} tone={c.rainDays >= 14 ? 'danger' : undefined} />
            {c.tips.map((tip) => (
              <Text key={tip} size={13} color={t.c.text}>
                • {tip}
              </Text>
            ))}
          </Card>
        );
      })}
      <Hint>Based on long-run monthly averages for the region. Check the Department of Hydrology and Meteorology forecast in the final week.</Hint>
      <KButton
        label="Copy the rain plan checklist"
        variant="ghost"
        onPress={async () => {
          await Clipboard.setStringAsync(RAIN_PLAN.map((x) => `• ${x}`).join('\n'));
          toast('Rain plan copied', 'umbrella');
        }}
      />
    </ToolPage>
  );
}

const RAIN_PLAN = ['Covered mandap or a hall booked as backup', 'Tarpaulin over the walkway and food line', 'Umbrellas and towels for elders', 'Indoor spot for family photos', 'Generator on standby'];

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  between: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
