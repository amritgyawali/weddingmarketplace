/** Couple toolkit: gifts, tips, savings, what-if budgets, honeymoon and the bhoj menu. */
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, ChoiceChips, KButton, ProgressBar, SectionTitle } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { CORE_SERVICES, serviceName } from '@/data/services';
import { useExperience } from '@/hooks/useExperience';
import { estimateTotal } from '@/services/planner';
import { HONEYMOON_SPOTS, honeymoonEstimate, savingsPlan, TIERS, tipFor, type Tier } from '@/services/toolkit';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { ToolState } from '@/types/platform';
import { formatLakhRange, formatMoney, formatShortDate } from '@/utils/format';
import { openWhatsApp } from '@/utils/links';

import { EntryList, Hint, Line, NumberField, StatRow, sumAmount, ToolPage, useToolEntries, useToolState } from '../core';
import { useWedding } from './shared';

// ─── Shagun and gifts ───────────────────────────────────────────────────────

export function GiftLedger() {
  const w = useWedding();
  const update = useDb((s) => s.updateToolEntry);
  const fromGuestList = w.guests.filter((g) => g.gift).length;
  const exp = useExperience();
  const sides = ['wedding', 'engagement', 'anniversary'].includes(exp.occasion?.id ?? 'wedding') ? ['Bride', 'Groom', 'Both'] : ['Mother’s side', 'Father’s side', 'Friends'];
  return (
    <ToolPage title="Shagun and gifts" subtitle="Who gave what, and thank-yous">
      <EntryList
        ownerId={w.owner}
        tool="couple.gifts"
        noun="gift"
        groupBy="group"
        groupOrder={w.eventNames}
        defaults={{ group: w.eventNames[0], fields: { side: sides[0] } }}
        fields={[
          { key: 'title', label: 'From', kind: 'text', required: true, placeholder: 'e.g. Hari mama and family' },
          { key: 'amount', label: 'Cash (shagun)', kind: 'money' },
          { key: 'f.item', label: 'Gift item', kind: 'text', placeholder: 'e.g. Gold chain, dinner set' },
          { key: 'group', label: 'Function', kind: 'select', options: w.eventNames },
          { key: 'f.side', label: 'Side', kind: 'select', options: sides },
          { key: 'f.phone', label: 'Phone (for the thank-you)', kind: 'text' },
          { key: 'done', label: 'Thank-you sent', kind: 'toggle' },
        ]}
        subtitle={(e) => [e.fields?.item, e.fields?.side, e.done ? 'Thanked' : 'Thank-you pending'].filter(Boolean).join(' · ')}
        rowActions={(e) =>
          e.done
            ? []
            : [
                {
                  label: 'Send thank-you',
                  onPress: () => {
                    openWhatsApp(`Namaste ${e.title}! Thank you so much for your blessings${e.fields?.item ? ` and the lovely ${e.fields.item}` : ''}. It meant a lot to us. — ${w.names}`, e.fields?.phone ? String(e.fields.phone) : undefined);
                    update(e.id, { done: true });
                  },
                },
              ]
        }
        header={(entries) => (
          <>
            <StatRow
              items={[
                { label: 'Cash received', value: formatMoney(sumAmount(entries)) },
                { label: 'Gifts', value: String(entries.filter((e) => e.fields?.item).length) },
                { label: 'Thank-yous pending', value: String(entries.filter((e) => !e.done).length), alert: entries.some((e) => !e.done) },
              ]}
            />
            {fromGuestList > 0 && <Hint>{fromGuestList} more gifts are noted on guest cards in your guest list.</Hint>}
          </>
        )}
        emptyMessage="Keep the envelope list here on the day — a cousin with a phone is easier than a notebook."
      />
    </ToolPage>
  );
}

// ─── Tips and dakshina ──────────────────────────────────────────────────────

export function TipsPlanner() {
  const t = useRoleTheme();
  const w = useWedding();
  const [s, set] = useToolState(w.owner, 'couple.tips', { paid: [] as string[] });
  const rows = [
    { id: 'priest', label: 'Purohit ji (dakshina)', note: 'Customary, usually in an odd number', amount: 11_001 },
    ...(w.project?.bookings ?? [])
      .filter((b) => b.status !== 'CANCELLED' && b.serviceId !== 'venue')
      .map((b) => {
        const crew = b.crew.reduce((n, c) => n + c.count, 0) || b.assignments.length || 1;
        const tip = tipFor(b.serviceId, crew);
        return { id: b.id, label: b.providerName, note: `${tip.label} · ${crew} people`, amount: tip.amount };
      }),
  ].map((r) => ({ ...r, amount: Number((s as ToolState)[`amt_${r.id}`] ?? r.amount) }));
  const total = rows.reduce((n, r) => n + r.amount, 0);
  const paid = rows.filter((r) => s.paid.includes(r.id)).reduce((n, r) => n + r.amount, 0);
  const togglePaid = (id: string) => set({ paid: s.paid.includes(id) ? s.paid.filter((x) => x !== id) : [...s.paid, id] });

  return (
    <ToolPage title="Tips and dakshina" subtitle="Envelopes for the crew and purohit ji">
      <StatRow
        items={[
          { label: 'Envelopes', value: String(rows.length) },
          { label: 'Total', value: formatMoney(total) },
          { label: 'Handed over', value: formatMoney(paid) },
        ]}
      />
      <Hint>Suggested amounts are customary guides, not rules. Tap an amount to change it, and tick an envelope once it has been handed over.</Hint>
      <Card padded={false} style={{ overflow: 'hidden' }}>
        {rows.map((r, i) => {
          const done = s.paid.includes(r.id);
          return (
            <View key={r.id} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.border }]}>
              <Pressable onPress={() => togglePaid(r.id)} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={r.label}>
                <Ionicons name={done ? 'checkbox' : 'square-outline'} size={22} color={done ? t.c.success : t.c.subtle} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text size={15} weight="semibold" color={t.c.textStrong}>
                  {r.label}
                </Text>
                <Text size={13} color={t.c.muted}>
                  {r.note}
                </Text>
              </View>
              <View style={{ width: 110 }}>
                <NumberField label="" money value={r.amount} onChange={(n) => set({ [`amt_${r.id}`]: n })} />
              </View>
            </View>
          );
        })}
      </Card>
    </ToolPage>
  );
}

// ─── What-if budget ─────────────────────────────────────────────────────────

export function WhatIfBudget() {
  const t = useRoleTheme();
  const w = useWedding();
  const planServices = w.project?.requirements.filter((r) => r.status !== 'CANCELLED').map((r) => r.serviceId) ?? CORE_SERVICES;
  const [guests, setGuests] = useState(w.guestCount);
  const [events, setEvents] = useState(Math.max(1, w.events.length || 2));
  const [services, setServices] = useState<string[]>(planServices);
  const options = [...new Set([...planServices, ...CORE_SERVICES, 'mehendi', 'band', 'invitations', 'transport'])];
  const [lo, hi] = estimateTotal(services, guests, events);
  const [baseLo, baseHi] = estimateTotal(planServices, w.guestCount, Math.max(1, w.events.length || 2));
  const budget = w.project?.budget ?? 0;
  const mid = Math.round((lo + hi) / 2);

  return (
    <ToolPage title="What-if budget" subtitle="See how guests and services move the total">
      <Card style={{ gap: 10 }}>
        <NumberField label="Guests" value={guests} onChange={setGuests} />
        <NumberField label="Functions" value={events} onChange={(n) => setEvents(Math.max(1, n))} />
        <Text size={13} weight="medium" color={t.c.text}>
          Services
        </Text>
        <ChoiceChips options={options.map(serviceName)} selected={services.map(serviceName)} onToggle={(label) => { const id = options.find((o) => serviceName(o) === label)!; setServices(services.includes(id) ? services.filter((x) => x !== id) : [...services, id]); }} />
      </Card>
      <Card style={{ gap: 4 }}>
        <Line label="Typical total" value={formatLakhRange(lo, hi)} strong />
        <Line label="Per guest (midpoint)" value={formatMoney(guests ? mid / guests : 0)} />
        <Line label="Your current plan" value={formatLakhRange(baseLo, baseHi)} note={`${w.guestCount} guests · ${planServices.length} services`} />
        {budget > 0 && <Line label="Your budget" value={formatMoney(budget)} tone={mid > budget ? 'danger' : 'success'} note={mid > budget ? `About ${formatMoney(mid - budget)} over at the midpoint` : 'Fits at the midpoint'} />}
      </Card>
      <Hint>Estimates use typical Nepal market prices for each service. Every 50 guests you remove usually saves more on catering than dropping a whole service.</Hint>
      <KButton label="Reset to my plan" variant="ghost" onPress={() => { setGuests(w.guestCount); setServices(planServices); setEvents(Math.max(1, w.events.length || 2)); }} />
    </ToolPage>
  );
}

// ─── Savings goal ───────────────────────────────────────────────────────────

export function SavingsGoal() {
  const t = useRoleTheme();
  const w = useWedding();
  const [s, set] = useToolState(w.owner, 'couple.savings', { target: w.project?.budget ?? 1_500_000, monthly: 50_000 });
  const deposits = useToolEntries(w.owner, 'couple.savings');
  const saved = sumAmount(deposits);
  const plan = savingsPlan(Number(s.target), saved, Number(s.monthly), w.date);
  return (
    <ToolPage title="Savings goal" subtitle={`Saving for ${formatShortDate(w.date)}`}>
      <Card style={{ gap: 10 }}>
        <View style={styles.between}>
          <Text size={15} weight="semibold" color={t.c.textStrong}>
            {formatMoney(saved)} of {formatMoney(Number(s.target))}
          </Text>
          <Text size={13} color={t.c.muted}>
            {Math.round(plan.progress * 100)}%
          </Text>
        </View>
        <ProgressBar value={plan.progress} height={6} />
        <Line label="Months to the wedding" value={String(plan.months)} />
        <Line label="Needed each month" value={formatMoney(plan.needed)} />
        <Line label="At your current pace" value={formatMoney(plan.projected)} tone={plan.onTrack ? 'success' : 'danger'} note={plan.onTrack ? 'You’re on track' : `Short by ${formatMoney(Number(s.target) - plan.projected)}`} />
      </Card>
      <Card style={{ gap: 10 }}>
        <NumberField label="Target" money value={Number(s.target)} onChange={(n) => set({ target: n })} />
        <NumberField label="You plan to save each month" money value={Number(s.monthly)} onChange={(n) => set({ monthly: n })} />
      </Card>
      <EntryList
        ownerId={w.owner}
        tool="couple.savings"
        noun="deposit"
        sort={(a, b) => (b.date ?? '').localeCompare(a.date ?? '')}
        fields={[
          { key: 'title', label: 'From', kind: 'text', required: true, placeholder: 'e.g. Salary, parents, dhukuti' },
          { key: 'amount', label: 'Amount', kind: 'money', required: true },
          { key: 'date', label: 'Date', kind: 'date' },
          { key: 'note', label: 'Notes', kind: 'text' },
        ]}
      />
    </ToolPage>
  );
}

// ─── Honeymoon planner ──────────────────────────────────────────────────────

export function HoneymoonPlanner() {
  const t = useRoleTheme();
  const w = useWedding();
  const [s, set] = useToolState(w.owner, 'couple.honeymoon', { spot: 'pokhara', nights: 4, tier: 'Comfort' as string, saved: '' });
  const est = honeymoonEstimate(String(s.spot), Number(s.nights), s.tier as Tier);
  return (
    <ToolPage title="Honeymoon planner" subtitle="Nepal getaways for two">
      <Card style={{ gap: 10 }}>
        <Text size={13} weight="medium" color={t.c.text}>
          Where
        </Text>
        <ChoiceChips options={HONEYMOON_SPOTS.map((x) => x.name)} selected={[est.spot.name]} onToggle={(name) => set({ spot: HONEYMOON_SPOTS.find((x) => x.name === name)!.id })} />
        <Hint>{est.spot.blurb}</Hint>
        <NumberField label="Nights" value={Number(s.nights)} onChange={(n) => set({ nights: Math.max(1, Math.min(21, n)) })} />
        <ChoiceChips options={[...TIERS]} selected={[String(s.tier)]} onToggle={(v) => set({ tier: v })} />
      </Card>
      <Card style={{ gap: 2 }}>
        <Line label="Stay" value={formatMoney(est.stay)} />
        <Line label="Food" value={formatMoney(est.food)} />
        <Line label="Activities" value={formatMoney(est.activities)} />
        <Line label="Travel (return, for two)" value={formatMoney(est.travel)} />
        <Line label="Estimated total" value={formatMoney(est.total)} strong />
      </Card>
      <KButton
        label={s.saved === `${s.spot}:${s.nights}:${s.tier}` ? 'Saved as your plan' : 'Save as our plan'}
        icon="bookmark-outline"
        onPress={() => {
          set({ saved: `${s.spot}:${s.nights}:${s.tier}` });
          toast(`${est.spot.name} saved · ${formatMoney(est.total)}`);
        }}
      />
      <SectionTitle title="Compare" />
      <Card padded={false} style={{ overflow: 'hidden' }}>
        {HONEYMOON_SPOTS.map((x, i) => (
          <View key={x.id} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.border }]}>
            <Text size={14} color={t.c.textStrong} style={{ flex: 1 }}>
              {x.name}
            </Text>
            <Text size={14} weight="semibold" color={t.c.textStrong}>
              {formatMoney(honeymoonEstimate(x.id, Number(s.nights), s.tier as Tier).total)}
            </Text>
          </View>
        ))}
      </Card>
      <Hint>Estimates for two in {String(s.tier).toLowerCase()} stays. Book 6–8 weeks ahead in Mangsir and Falgun, when resorts fill up with honeymooners.</Hint>
    </ToolPage>
  );
}

// ─── Bhoj menu ──────────────────────────────────────────────────────────────

const COURSES = ['Welcome drinks', 'Starters', 'Main course', 'Desserts', 'Late snacks'];
const MENU: [string, string, string, number][] = [
  ['Lassi and fresh juice', 'Welcome drinks', 'Veg', 60],
  ['Chicken choila', 'Starters', 'Non-veg', 120],
  ['Paneer pakoda', 'Starters', 'Veg', 90],
  ['Aloo sadeko', 'Starters', 'Veg', 40],
  ['Jeera pulao', 'Main course', 'Veg', 60],
  ['Mutton curry', 'Main course', 'Non-veg', 220],
  ['Kalo dal', 'Main course', 'Veg', 40],
  ['Mixed tarkari', 'Main course', 'Veg', 50],
  ['Achar platter', 'Main course', 'Veg', 25],
  ['Gulab jamun', 'Desserts', 'Veg', 50],
  ['Jeri and swari', 'Desserts', 'Veg', 45],
];

export function MenuPlanner() {
  const t = useRoleTheme();
  const w = useWedding();
  const [guests, setGuests] = useToolState(w.owner, 'couple.menu', { guests: w.guestCount });
  return (
    <ToolPage title="Bhoj menu" subtitle="Dishes, diets and per-plate cost">
      <EntryList
        ownerId={w.owner}
        tool="couple.menu"
        noun="dish"
        groupBy="group"
        groupOrder={COURSES}
        presets={MENU.map(([title, group, diet, amount]) => ({ title, group, amount, fields: { diet } }))}
        defaults={{ group: 'Main course', fields: { diet: 'Veg' } }}
        fields={[
          { key: 'title', label: 'Dish', kind: 'text', required: true },
          { key: 'group', label: 'Course', kind: 'select', options: COURSES },
          { key: 'f.diet', label: 'Diet', kind: 'select', options: ['Veg', 'Non-veg', 'Jain', 'Vegan'] },
          { key: 'amount', label: 'Cost per plate', kind: 'money' },
          { key: 'note', label: 'Notes', kind: 'text', placeholder: 'Less spicy, live counter…' },
        ]}
        subtitle={(e) => [e.fields?.diet, e.note].filter(Boolean).join(' · ') || undefined}
        header={(entries) => {
          const perPlate = sumAmount(entries);
          return (
            <Card style={{ gap: 6 }}>
              <NumberField label="Guests eating" value={Number(guests.guests)} onChange={(n) => setGuests({ guests: n })} />
              <Line label="Per plate" value={formatMoney(perPlate)} />
              <Line label="Veg / non-veg dishes" value={`${entries.filter((e) => e.fields?.diet !== 'Non-veg').length} / ${entries.filter((e) => e.fields?.diet === 'Non-veg').length}`} />
              <Line label="Estimated food cost" value={formatMoney(perPlate * Number(guests.guests))} strong note="Before VAT and service charge; caterers usually add 10% for extra plates" />
              <Text size={12} color={t.c.subtle}>
                Share this with your caterer before the tasting so they can quote against it.
              </Text>
            </Card>
          );
        }}
      />
    </ToolPage>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
