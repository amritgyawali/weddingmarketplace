/**
 * Trade tools: the vendor tools only some businesses get (menu for caterers,
 * themes for decorators, gallery for studios…). Each is shown by its rule in
 * `TOOL_RULES`; all of them store records in the shared tool collections.
 */
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, ChoiceChips, EmptyBlock, KButton, ProgressBar, SectionTitle, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { type BookingRef, useVendorWorkspace } from '@/hooks/useWorkspace';
import { bookingDates } from '@/store/db/helpers';
import { generatorFor } from '@/services/toolkit';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { ToolEntry } from '@/types/platform';
import { daysUntil, formatClock, formatMoney, formatShortDate, relativeDay } from '@/utils/format';
import { shareMessage } from '@/utils/links';

import { EntryList, Hint, Line, StatRow, ToolPage } from '../core';

const names = (r: BookingRef) => `${r.project.customerName.split(' ')[0]}${r.project.partnerName ? ` & ${r.project.partnerName.split(' ')[0]}` : ''}`;

/** Upcoming, not-cancelled bookings as select options ("Aakriti & Sujan · 12 Dec"). */
function useBookingOptions() {
  const account = useAccount();
  const { bookings } = useVendorWorkspace(account);
  const live = bookings.filter((b) => b.booking.status !== 'CANCELLED');
  return {
    live,
    options: live.map((b) => ({ id: b.booking.id, label: `${names(b)} · ${formatShortDate(bookingDates(b.project, b.booking)[0] ?? b.project.weddingDate)}` })),
    label: (id?: string) => live.find((b) => b.booking.id === id),
  };
}

const when = (e: ToolEntry) => [e.date ? relativeDay(e.date) : undefined, e.time ? formatClock(e.time) : undefined].filter(Boolean).join(' · ');

// ─── Catering: menu ─────────────────────────────────────────────────────────

const COURSES = ['Welcome drinks', 'Starters', 'Mains', 'Rice and breads', 'Sides and achar', 'Desserts'];

const MENU_PRESET = [
  { title: 'Aloo chop and pakoda', group: 'Starters', amount: 45, fields: { diet: 'Veg' } },
  { title: 'Chicken choila', group: 'Starters', amount: 90, fields: { diet: 'Non-veg' } },
  { title: 'Paneer butter masala', group: 'Mains', amount: 85, fields: { diet: 'Veg' } },
  { title: 'Khasi ko masu', group: 'Mains', amount: 160, fields: { diet: 'Non-veg' } },
  { title: 'Jeera rice and puri', group: 'Rice and breads', amount: 40, fields: { diet: 'Veg' } },
  { title: 'Aloo tama and gundruk achar', group: 'Sides and achar', amount: 30, fields: { diet: 'Veg' } },
  { title: 'Rasbari and lalmohan', group: 'Desserts', amount: 45, fields: { diet: 'Veg' } },
];

/** Per-plate cost of the veg set and of the full non-veg set. */
const plateCosts = (entries: ToolEntry[]) => {
  const veg = entries.filter((e) => e.fields?.diet !== 'Non-veg').reduce((s, e) => s + (e.amount ?? 0), 0);
  const all = entries.reduce((s, e) => s + (e.amount ?? 0), 0);
  return { veg, nonVeg: all };
};

export function MenuBuilder() {
  const account = useAccount();
  const [margin, setMargin] = useState('35%');
  const pct = Number(margin.replace(/\D/g, '')) / 100;
  return (
    <ToolPage title="Menu" subtitle="Dishes, veg and non-veg sets, per-plate cost">
      <EntryList
        ownerId={account.id}
        tool="vendor.menu"
        noun="dish"
        groupBy="group"
        groupOrder={COURSES}
        presets={MENU_PRESET}
        defaults={{ group: 'Mains', fields: { diet: 'Veg' } }}
        fields={[
          { key: 'title', label: 'Dish', kind: 'text', required: true },
          { key: 'group', label: 'Course', kind: 'select', options: COURSES },
          { key: 'f.diet', label: 'Diet', kind: 'select', options: ['Veg', 'Non-veg', 'Jain', 'Vegan'] },
          { key: 'amount', label: 'Cost per plate', kind: 'money' },
          { key: 'note', label: 'Notes', kind: 'text', placeholder: 'Spice level, allergens, live counter…' },
        ]}
        subtitle={(e) => [e.fields?.diet, e.note].filter(Boolean).join(' · ') || undefined}
        header={(entries) => {
          const { veg, nonVeg } = plateCosts(entries);
          const price = (cost: number) => Math.round((cost * (1 + pct)) / 5) * 5;
          return (
            <View style={{ gap: 10 }}>
              <StatRow
                items={[
                  { label: 'Veg plate cost', value: formatMoney(veg) },
                  { label: 'Non-veg plate cost', value: formatMoney(nonVeg) },
                  { label: 'Dishes', value: String(entries.length) },
                ]}
              />
              <Card style={{ gap: 8 }}>
                <Text size={14} weight="semibold">
                  Price per plate at your margin
                </Text>
                <ChoiceChips options={['25%', '35%', '45%', '60%']} selected={[margin]} onToggle={setMargin} />
                <Line label="Veg plate" value={formatMoney(price(veg))} />
                <Line label="Non-veg plate" value={formatMoney(price(nonVeg))} strong />
                <KButton
                  label="Share menu"
                  size="sm"
                  variant="secondary"
                  icon="share-outline"
                  onPress={() =>
                    shareMessage(
                      `${account.businessName ?? account.name} menu\n\n${COURSES.map((c) => {
                        const dishes = entries.filter((e) => e.group === c);
                        return dishes.length ? `${c}: ${dishes.map((d) => `${d.title}${d.fields?.diet === 'Non-veg' ? ' (non-veg)' : ''}`).join(', ')}` : '';
                      })
                        .filter(Boolean)
                        .join('\n')}\n\nVeg ${formatMoney(price(veg))} · Non-veg ${formatMoney(price(nonVeg))} per plate (+13% VAT)`,
                    )
                  }
                />
              </Card>
            </View>
          );
        }}
      />
    </ToolPage>
  );
}

// ─── Catering: tastings ─────────────────────────────────────────────────────

const TASTING_STATUS = [
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'done', label: 'Tasted' },
  { id: 'booked', label: 'Booked' },
  { id: 'lost', label: 'Went elsewhere' },
];

export function Tastings() {
  const account = useAccount();
  const { leads } = useVendorWorkspace(account);
  return (
    <ToolPage title="Tastings" subtitle="Tasting sessions linked to enquiries">
      <EntryList
        ownerId={account.id}
        tool="vendor.tastings"
        noun="tasting"
        statusPill
        defaults={{ status: 'scheduled' }}
        sort={(a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (a.time ?? '').localeCompare(b.time ?? '')}
        fields={[
          { key: 'title', label: 'Family', kind: 'text', required: true },
          { key: 'refId', label: 'Linked enquiry', kind: 'select', options: leads.map((l) => ({ id: l.id, label: l.customerName })) },
          { key: 'date', label: 'Date', kind: 'date', required: true },
          { key: 'time', label: 'Time', kind: 'time' },
          { key: 'qty', label: 'People tasting', kind: 'number' },
          { key: 'f.dishes', label: 'Dishes to serve', kind: 'multiline' },
          { key: 'status', label: 'Status', kind: 'select', options: TASTING_STATUS },
          { key: 'note', label: 'Feedback', kind: 'multiline' },
        ]}
        subtitle={(e) => [when(e), e.qty ? `${e.qty} people` : undefined, e.note].filter(Boolean).join(' · ') || undefined}
        header={(entries) => (
          <StatRow
            items={[
              { label: 'Next 7 days', value: String(entries.filter((e) => e.status === 'scheduled' && e.date && daysUntil(e.date) >= 0 && daysUntil(e.date) <= 7).length) },
              { label: 'Tasted', value: String(entries.filter((e) => e.status === 'done' || e.status === 'booked' || e.status === 'lost').length) },
              { label: 'Booked after tasting', value: String(entries.filter((e) => e.status === 'booked').length) },
            ]}
          />
        )}
      />
    </ToolPage>
  );
}

// ─── Decor: themes ──────────────────────────────────────────────────────────

const THEME_STYLES = ['Traditional', 'Floral', 'Royal', 'Minimal', 'Rustic', 'Newari', 'Pastel', 'Other'];

export function Themes() {
  const account = useAccount();
  return (
    <ToolPage title="Themes" subtitle="Your decor looks, price bands and inclusions">
      <EntryList
        ownerId={account.id}
        tool="vendor.themes"
        noun="theme"
        groupBy="group"
        groupOrder={THEME_STYLES}
        defaults={{ group: 'Traditional' }}
        fields={[
          { key: 'title', label: 'Theme name', kind: 'text', required: true, placeholder: 'e.g. Marigold and brass' },
          { key: 'group', label: 'Style', kind: 'select', options: THEME_STYLES },
          { key: 'amount', label: 'Price from', kind: 'money', required: true },
          { key: 'f.priceTo', label: 'Price up to', kind: 'money' },
          { key: 'f.includes', label: 'Includes', kind: 'multiline', placeholder: 'Mandap, stage backdrop, entrance arch, 40 table centrepieces…' },
          { key: 'f.leadDays', label: 'Days needed to prepare', kind: 'number' },
          { key: 'note', label: 'Notes', kind: 'text' },
        ]}
        subtitle={(e) => [e.fields?.includes ? String(e.fields.includes).split('\n')[0] : undefined, e.fields?.leadDays ? `${e.fields.leadDays} days to prepare` : undefined].filter(Boolean).join(' · ') || undefined}
        trailing={(e) => (e.amount ? `${formatMoney(e.amount)}${e.fields?.priceTo ? `–${formatMoney(Number(e.fields.priceTo)).replace('NPR ', '')}` : '+'}` : undefined)}
        emptyMessage="Couples choose from themes faster than from a blank page. Start with your two best sellers."
      />
    </ToolPage>
  );
}

// ─── Decor: rentals ─────────────────────────────────────────────────────────

const RENTAL_STATUS = [
  { id: 'reserved', label: 'Reserved' },
  { id: 'out', label: 'Out at event' },
  { id: 'returned', label: 'Returned' },
  { id: 'damaged', label: 'Damaged or missing' },
];

export function Rentals() {
  const account = useAccount();
  const { options, label } = useBookingOptions();
  return (
    <ToolPage title="Rentals" subtitle="Stock reserved per event, returns and damage">
      <EntryList
        ownerId={account.id}
        tool="vendor.rentals"
        noun="reservation"
        statusPill
        groupBy="status"
        groupOrder={RENTAL_STATUS.map((s) => s.id)}
        defaults={{ status: 'reserved' }}
        fields={[
          { key: 'title', label: 'Item', kind: 'text', required: true, placeholder: 'e.g. Brass diyo stands' },
          { key: 'qty', label: 'Quantity', kind: 'number', required: true },
          { key: 'refId', label: 'Booking', kind: 'select', options },
          { key: 'date', label: 'Event date', kind: 'date', required: true },
          { key: 'f.returnBy', label: 'Return by', kind: 'date' },
          { key: 'status', label: 'Status', kind: 'select', options: RENTAL_STATUS },
          { key: 'amount', label: 'Damage charge', kind: 'money' },
          { key: 'note', label: 'Notes', kind: 'text' },
        ]}
        subtitle={(e) => [`${e.qty ?? 0} units`, e.date ? formatShortDate(e.date) : undefined, label(e.refId) ? names(label(e.refId)!) : undefined, e.fields?.returnBy ? `back by ${formatShortDate(String(e.fields.returnBy))}` : undefined].filter(Boolean).join(' · ')}
        header={(entries) => {
          const overdue = entries.filter((e) => e.status === 'out' && e.fields?.returnBy && daysUntil(String(e.fields.returnBy)) < 0);
          return (
            <StatRow
              items={[
                { label: 'Out now', value: String(entries.filter((e) => e.status === 'out').reduce((s, e) => s + (e.qty ?? 0), 0)) },
                { label: 'Overdue returns', value: String(overdue.length), alert: overdue.length > 0 },
                { label: 'Damage charged', value: formatMoney(entries.filter((e) => e.status === 'damaged').reduce((s, e) => s + (e.amount ?? 0), 0)) },
              ]}
            />
          );
        }}
      />
    </ToolPage>
  );
}

// ─── Decor and AV: setup sheets ─────────────────────────────────────────────

export function SetupSheets() {
  const account = useAccount();
  const { options, label } = useBookingOptions();
  return (
    <ToolPage title="Setup and teardown" subtitle="Crew, vehicle and access times per event">
      <EntryList
        ownerId={account.id}
        tool="vendor.setup"
        noun="setup sheet"
        checklist
        sort={(a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (a.time ?? '').localeCompare(b.time ?? '')}
        fields={[
          { key: 'title', label: 'Event', kind: 'text', required: true, placeholder: 'e.g. Reception, Everest main hall' },
          { key: 'refId', label: 'Booking', kind: 'select', options },
          { key: 'date', label: 'Date', kind: 'date', required: true },
          { key: 'time', label: 'Venue access from', kind: 'time' },
          { key: 'f.ready', label: 'Ready by', kind: 'time' },
          { key: 'f.teardown', label: 'Teardown starts', kind: 'time' },
          { key: 'qty', label: 'Crew', kind: 'number' },
          { key: 'f.vehicle', label: 'Vehicle', kind: 'text', placeholder: 'e.g. Tata 407, Ba 2 Kha 1234' },
          { key: 'note', label: 'Venue contact and notes', kind: 'multiline' },
        ]}
        subtitle={(e) =>
          [e.date ? relativeDay(e.date) : undefined, e.time ? `in ${formatClock(e.time)}` : undefined, e.fields?.ready ? `ready ${formatClock(String(e.fields.ready))}` : undefined, e.qty ? `${e.qty} crew` : undefined, label(e.refId) ? names(label(e.refId)!) : undefined]
            .filter(Boolean)
            .join(' · ')
        }
        emptyMessage="One sheet per function: when you can get in, when it must be ready, who goes and in which vehicle."
      />
    </ToolPage>
  );
}

// ─── Photo and film: gallery delivery ───────────────────────────────────────

const PROOF_STATUS = [
  { id: 'proofing', label: 'Proofs shared' },
  { id: 'selected', label: 'Selections in' },
  { id: 'revising', label: 'Revising' },
  { id: 'final', label: 'Final delivered' },
];

export function GalleryDelivery() {
  const t = useRoleTheme();
  const account = useAccount();
  const { live, options, label } = useBookingOptions();
  const update = useDb((s) => s.updateDeliverable);
  const items = live.flatMap((r) => r.booking.deliverables.map((d) => ({ r, d }))).sort((a, b) => a.d.due.localeCompare(b.d.due));
  const open = items.filter(({ d }) => d.status !== 'DELIVERED' && d.status !== 'APPROVED');
  return (
    <ToolPage title="Gallery delivery" subtitle="Deliverables, proofing and revision rounds">
      <StatRow
        items={[
          { label: 'Open deliverables', value: String(open.length) },
          { label: 'Due in 14 days', value: String(open.filter(({ d }) => daysUntil(d.due) <= 14).length), alert: open.some(({ d }) => daysUntil(d.due) < 0) },
          { label: 'Delivered', value: String(items.length - open.length) },
        ]}
      />
      <View>
        <SectionTitle title="From your bookings" />
        {open.length === 0 ? (
          <EmptyBlock icon="images-outline" title="Nothing waiting" message="Confirmed bookings create their deliverables here automatically." />
        ) : (
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {open.map(({ r, d }, i) => (
              <View key={d.id} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.border }]}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text size={15} weight="semibold" color={t.c.textStrong} numberOfLines={1}>
                    {d.title} · {names(r)}
                  </Text>
                  <Text size={13} color={daysUntil(d.due) < 0 ? t.c.danger : t.c.muted}>
                    Due {formatShortDate(d.due)} · revisions {d.revisions}/{d.revisionLimit}
                  </Text>
                  <ProgressBar value={d.progress} />
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <StatusPill status={d.status} />
                  {d.status !== 'READY_FOR_REVIEW' && (
                    <KButton
                      label="Ready for review"
                      size="sm"
                      variant="ghost"
                      onPress={() => {
                        update(r.project.id, r.booking.id, d.id, { status: 'READY_FOR_REVIEW', progress: Math.max(d.progress, 0.9) }, 'Shared for review');
                        toast('Sent to the couple for review');
                      }}
                    />
                  )}
                </View>
              </View>
            ))}
          </Card>
        )}
      </View>
      <SectionTitle title="Proofing links" />
      <EntryList
        ownerId={account.id}
        tool="vendor.gallery"
        noun="proofing round"
        statusPill
        defaults={{ status: 'proofing' }}
        fields={[
          { key: 'title', label: 'Couple or album', kind: 'text', required: true },
          { key: 'refId', label: 'Booking', kind: 'select', options },
          { key: 'f.link', label: 'Proofing link', kind: 'text', placeholder: 'Drive, Pixieset or Dropbox link' },
          { key: 'qty', label: 'Photos selected', kind: 'number' },
          { key: 'date', label: 'Selections due', kind: 'date' },
          { key: 'status', label: 'Status', kind: 'select', options: PROOF_STATUS },
          { key: 'note', label: 'Notes', kind: 'text' },
        ]}
        subtitle={(e) => [label(e.refId) ? names(label(e.refId)!) : undefined, e.qty ? `${e.qty} selected` : undefined, e.date ? `due ${formatShortDate(e.date)}` : undefined].filter(Boolean).join(' · ') || undefined}
        rowActions={(e) => (e.fields?.link ? [{ label: 'Share link', onPress: () => shareMessage(`Namaste! Your photos are ready to choose from: ${e.fields?.link}`) }] : [])}
      />
    </ToolPage>
  );
}

// ─── Photo and film: couples' shot lists ────────────────────────────────────

/** Records a couple keeps in one of their planning tools, grouped by the booking they belong to. */
function useCoupleLists(tool: string) {
  const { live } = useBookingOptions();
  const entries = useDb((s) => s.toolEntries);
  return live
    .filter((r) => r.booking.status !== 'COMPLETED')
    .map((r) => ({ r, items: entries.filter((e) => e.ownerId === r.project.id && e.tool === tool) }))
    .filter((x) => x.items.length > 0);
}

function CoupleList({ tool, title, subtitle, empty, render }: { tool: string; title: string; subtitle: string; empty: string; render: (e: ToolEntry) => string }) {
  const t = useRoleTheme();
  const lists = useCoupleLists(tool);
  return (
    <>
      {lists.length === 0 && <EmptyBlock icon="list-outline" title={`No ${title.toLowerCase()} yet`} message={empty} />}
      {lists.map(({ r, items }) => {
        const groups = [...new Set(items.map((e) => e.group ?? 'Other'))];
        return (
          <View key={r.booking.id}>
            <SectionTitle title={`${names(r)} · ${formatShortDate(r.project.weddingDate)}`} action="Share" onAction={() => shareMessage(`${subtitle} for ${names(r)}\n\n${items.map(render).join('\n')}`)} />
            <Card style={{ gap: 10 }}>
              {groups.map((g) => (
                <View key={g} style={{ gap: 4 }}>
                  <Text size={13} weight="semibold" color={t.c.textStrong}>
                    {g}
                  </Text>
                  {items
                    .filter((e) => (e.group ?? 'Other') === g)
                    .map((e) => (
                      <View key={e.id} style={styles.item}>
                        <Ionicons name={e.done ? 'checkmark' : 'ellipse-outline'} size={e.done ? 16 : 8} color={e.done ? t.c.success : t.c.subtle} style={styles.bullet} />
                        <Text size={14} color={e.done ? t.c.muted : t.c.text} style={{ flex: 1 }}>
                          {render(e)}
                        </Text>
                      </View>
                    ))}
                </View>
              ))}
            </Card>
          </View>
        );
      })}
    </>
  );
}

export function CoupleShotLists() {
  return (
    <ToolPage title="Couples’ shot lists" subtitle="The must-have photos each couple asked for">
      <Hint>Couples build these in their planner. You see the list for every confirmed booking; ticks show shots they already have.</Hint>
      <CoupleList tool="couple.shots" title="Shot lists" subtitle="Shot list" empty="When your couples add must-have shots in their planner, they appear here." render={(e) => `${e.title}${e.note ? ` (${e.note})` : ''}`} />
    </ToolPage>
  );
}

// ─── Music: song requests ───────────────────────────────────────────────────

export function SongRequests() {
  const account = useAccount();
  return (
    <ToolPage title="Song requests" subtitle="What each couple wants played, and never played">
      <CoupleList tool="couple.music" title="Song requests" subtitle="Songs" empty="When your couples plan their music, their requests and do-not-play lists appear here." render={(e) => `${e.title}${e.fields?.artist ? ` — ${e.fields.artist}` : ''}`} />
      <SectionTitle title="Your house list" />
      <EntryList
        ownerId={account.id}
        tool="vendor.requests"
        noun="song"
        groupBy="group"
        groupOrder={['Crowd favourites', 'Janti and entry', 'First dance', 'Never play']}
        defaults={{ group: 'Crowd favourites' }}
        fields={[
          { key: 'title', label: 'Song', kind: 'text', required: true },
          { key: 'f.artist', label: 'Artist', kind: 'text' },
          { key: 'group', label: 'List', kind: 'select', options: ['Crowd favourites', 'Janti and entry', 'First dance', 'Never play'] },
          { key: 'note', label: 'Notes', kind: 'text' },
        ]}
        subtitle={(e) => [e.fields?.artist, e.note].filter(Boolean).join(' · ') || undefined}
      />
    </ToolPage>
  );
}

// ─── Beauty: trials and looks ───────────────────────────────────────────────

const LOOK_GROUPS = ['Upcoming trials', 'Looks book'];

export function TrialsAndLooks() {
  const account = useAccount();
  return (
    <ToolPage title="Trials and looks" subtitle="Trial bookings and the looks you offer">
      <EntryList
        ownerId={account.id}
        tool="vendor.trials"
        noun="trial or look"
        groupBy="group"
        groupOrder={LOOK_GROUPS}
        defaults={{ group: 'Upcoming trials' }}
        presets={[
          { title: 'Classic Nepali bridal (red and gold)', group: 'Looks book', amount: 35_000, note: 'HD base, gold smokey eye, tika and sindoor-ready' },
          { title: 'Soft glam reception', group: 'Looks book', amount: 25_000, note: 'Airbrush base, nude lip, loose curls' },
        ]}
        fields={[
          { key: 'title', label: 'Client or look name', kind: 'text', required: true },
          { key: 'group', label: 'Type', kind: 'select', options: LOOK_GROUPS },
          { key: 'date', label: 'Trial date', kind: 'date' },
          { key: 'time', label: 'Time', kind: 'time' },
          { key: 'amount', label: 'Price', kind: 'money' },
          { key: 'f.products', label: 'Products and shades', kind: 'multiline' },
          { key: 'note', label: 'Notes', kind: 'multiline' },
        ]}
        subtitle={(e) => [when(e), e.note].filter(Boolean).join(' · ') || undefined}
      />
    </ToolPage>
  );
}

// ─── Sound, light and AV: power ─────────────────────────────────────────────

const POWER_PRESET = [
  { title: 'Line array speakers', qty: 4, fields: { watts: 800 } },
  { title: 'Subwoofers', qty: 2, fields: { watts: 1200 } },
  { title: 'LED par lights', qty: 24, fields: { watts: 60 } },
  { title: 'Moving heads', qty: 8, fields: { watts: 250 } },
  { title: 'DJ console and monitors', qty: 1, fields: { watts: 600 } },
];

export function PowerPlanner() {
  const account = useAccount();
  return (
    <ToolPage title="Power planner" subtitle="Connected load and the generator to hire">
      <EntryList
        ownerId={account.id}
        tool="vendor.power"
        noun="item"
        presets={POWER_PRESET}
        fields={[
          { key: 'title', label: 'Equipment', kind: 'text', required: true },
          { key: 'qty', label: 'How many', kind: 'number', required: true },
          { key: 'f.watts', label: 'Watts each', kind: 'number', required: true },
          { key: 'note', label: 'Notes', kind: 'text' },
        ]}
        subtitle={(e) => `${e.qty ?? 0} × ${Number(e.fields?.watts ?? 0)} W`}
        trailing={(e) => `${(((e.qty ?? 0) * Number(e.fields?.watts ?? 0)) / 1000).toFixed(1)} kW`}
        header={(entries) => {
          const watts = entries.reduce((s, e) => s + (e.qty ?? 0) * Number(e.fields?.watts ?? 0), 0);
          const g = generatorFor(watts);
          return (
            <Card style={{ gap: 6 }}>
              <Line label="Connected load" value={`${g.kw} kW`} note={`${g.amps} A on a single 230 V phase`} />
              <Line label="Needed with 25% headroom" value={`${g.kva} kVA`} />
              <Line label="Generator to hire" value={`${g.size} kVA`} strong />
              <Hint>Venue supply in Nepal often trips above 15–20 A per circuit. Split heavy loads across circuits or run them from the generator, and keep the NEA line as backup.</Hint>
            </Card>
          );
        }}
      />
    </ToolPage>
  );
}

// ─── Transport: fleet ───────────────────────────────────────────────────────

const VEHICLE_TYPES = ['Decorated car', 'Car', 'Jeep', 'Micro-bus', 'Coaster', 'Bus'];
const FLEET_STATUS = [
  { id: 'available', label: 'Available' },
  { id: 'booked', label: 'Booked' },
  { id: 'service', label: 'In the workshop' },
];

export function Fleet() {
  const account = useAccount();
  return (
    <ToolPage title="Fleet" subtitle="Vehicles, drivers and papers">
      <EntryList
        ownerId={account.id}
        tool="vendor.fleet"
        noun="vehicle"
        groupBy="group"
        groupOrder={VEHICLE_TYPES}
        statusPill
        defaults={{ group: 'Car', status: 'available' }}
        fields={[
          { key: 'title', label: 'Vehicle', kind: 'text', required: true, placeholder: 'e.g. Toyota Hiace, Ba 3 Kha 4521' },
          { key: 'group', label: 'Type', kind: 'select', options: VEHICLE_TYPES },
          { key: 'f.seats', label: 'Seats', kind: 'number', required: true },
          { key: 'f.driver', label: 'Driver', kind: 'text' },
          { key: 'f.phone', label: 'Driver phone', kind: 'text' },
          { key: 'amount', label: 'Day rate', kind: 'money' },
          { key: 'date', label: 'Bluebook or insurance renewal', kind: 'date' },
          { key: 'status', label: 'Status', kind: 'select', options: FLEET_STATUS },
        ]}
        subtitle={(e) => [`${Number(e.fields?.seats ?? 0)} seats`, e.fields?.driver, e.date ? `papers ${daysUntil(e.date) < 0 ? 'expired' : `renew ${formatShortDate(e.date)}`}` : undefined].filter(Boolean).join(' · ')}
        header={(entries) => (
          <StatRow
            items={[
              { label: 'Vehicles', value: String(entries.length) },
              { label: 'Seats', value: String(entries.reduce((s, e) => s + Number(e.fields?.seats ?? 0), 0)) },
              { label: 'Papers due in 30 days', value: String(entries.filter((e) => e.date && daysUntil(e.date) <= 30).length), alert: entries.some((e) => e.date && daysUntil(e.date) < 0) },
            ]}
          />
        )}
      />
    </ToolPage>
  );
}

// ─── Fashion: fittings ──────────────────────────────────────────────────────

const FITTING_STATUS = [
  { id: 'measured', label: 'Measured' },
  { id: 'first', label: 'First fitting' },
  { id: 'alteration', label: 'Alterations' },
  { id: 'ready', label: 'Ready' },
  { id: 'delivered', label: 'Delivered' },
];

export function Fittings() {
  const account = useAccount();
  return (
    <ToolPage title="Fittings" subtitle="Measurements, fittings and alteration dates">
      <EntryList
        ownerId={account.id}
        tool="vendor.fittings"
        noun="fitting"
        statusPill
        groupBy="status"
        groupOrder={FITTING_STATUS.map((s) => s.id)}
        defaults={{ status: 'measured' }}
        fields={[
          { key: 'title', label: 'Client', kind: 'text', required: true },
          { key: 'f.piece', label: 'Piece', kind: 'text', placeholder: 'e.g. Red Banarasi lehenga, daura suruwal' },
          { key: 'f.measurements', label: 'Measurements', kind: 'multiline', placeholder: 'Bust 34, waist 28, length 41…' },
          { key: 'date', label: 'Next fitting', kind: 'date' },
          { key: 'time', label: 'Time', kind: 'time' },
          { key: 'f.eventDate', label: 'Needed by', kind: 'date' },
          { key: 'amount', label: 'Balance due', kind: 'money' },
          { key: 'status', label: 'Stage', kind: 'select', options: FITTING_STATUS },
        ]}
        subtitle={(e) => [e.fields?.piece, when(e), e.fields?.eventDate ? `needed ${formatShortDate(String(e.fields.eventDate))}` : undefined].filter(Boolean).join(' · ') || undefined}
      />
    </ToolPage>
  );
}

// ─── Rituals: muhurta and samagri ───────────────────────────────────────────

const CEREMONIES = ['Wedding', 'Bratabandha', 'Pasni', 'Nwaran', 'Griha pravesh', 'Puja', 'Other'];

export function MuhurtaPlanner() {
  const account = useAccount();
  return (
    <ToolPage title="Muhurta and samagri" subtitle="Auspicious times and what each family must bring">
      <EntryList
        ownerId={account.id}
        tool="vendor.muhurta"
        noun="ceremony"
        groupBy="group"
        groupOrder={CEREMONIES}
        defaults={{ group: 'Wedding' }}
        sort={(a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (a.time ?? '').localeCompare(b.time ?? '')}
        fields={[
          { key: 'title', label: 'Family', kind: 'text', required: true },
          { key: 'group', label: 'Ceremony', kind: 'select', options: CEREMONIES },
          { key: 'date', label: 'Date', kind: 'date', required: true },
          { key: 'time', label: 'Muhurta', kind: 'time' },
          { key: 'f.samagri', label: 'Samagri the family brings', kind: 'multiline', placeholder: 'Kalash, supari, jwano, dubo, akshata…' },
          { key: 'amount', label: 'Dakshina agreed', kind: 'money' },
          { key: 'note', label: 'Notes', kind: 'text' },
        ]}
        subtitle={(e) => [when(e), e.note].filter(Boolean).join(' · ') || undefined}
        rowActions={(e) => (e.fields?.samagri ? [{ label: 'Share samagri list', onPress: () => shareMessage(`Namaste! Samagri for the ${e.group?.toLowerCase() ?? 'ceremony'} on ${e.date ? formatShortDate(e.date) : ''}:\n${e.fields?.samagri}`) }] : [])}
      />
    </ToolPage>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bullet: { width: 16, textAlign: 'center' },
});
