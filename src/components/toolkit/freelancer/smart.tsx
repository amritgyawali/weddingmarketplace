/** Freelancer toolkit, smart work: best gigs for you, season planner, rest and workload, income statement and testimonials. */
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BarChart, Card, ChoiceChips, EmptyBlock, KButton, ListRow, ProgressBar, SectionTitle, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { cityDistanceKm } from '@/data/cities';
import { incomeStatementHtml } from '@/services/documents';
import { exportCsv, sharePdf } from '@/services/exporters';
import { gigFit, workloadSummary, type WorkDay } from '@/services/insights';
import { isBlocking, statusOn } from '@/services/matching';
import { lastMonths, monthLabel, saitDates } from '@/services/toolkit';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import { addDays, formatMoney, formatMoneyCompact, formatShortDate, percent, today } from '@/utils/format';
import { shareMessage } from '@/utils/links';

import { EntryList, Hint, Line, NumberField, StatRow, ToolPage, useToolEntries, useToolState } from '../core';
import { useJobs } from './shared';

/** Dates this freelancer already works or has blocked. */
function useBusy() {
  const { account, ws, jobs } = useJobs();
  const availability = useDb((s) => s.availability);
  const rules = useDb((s) => s.availabilityRules);
  const jobDates = new Set(jobs.map((j) => j.date));
  const busyOn = (date: string) => jobDates.has(date) || isBlocking(statusOn(account.id, date, availability, false, rules));
  return { account, ws, jobs, jobDates, busyOn };
}

const endTime = (start: string, hours: number) => {
  const [h, m] = start.split(':').map(Number);
  const total = ((h || 0) * 60 + (m || 0) + Math.round(hours * 60)) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

// ─── Best gigs for you ──────────────────────────────────────────────────────

export function GigFit() {
  const t = useRoleTheme();
  const { account, ws, busyOn } = useBusy();
  const [s, set] = useToolState(account.id, 'freelancer.gigfit', { perKm: 12 });
  const ranked = ws.open
    .map((g) => ({
      g,
      fit: gigFit(
        { pay: g.pay, hours: g.hours, skill: g.skill, date: g.date, emergency: g.emergency, km: cityDistanceKm(account.city, g.city) },
        { skills: account.skills ?? [], hourlyRate: account.hourlyRate ?? 0, dayRate: account.dayRate ?? 0, travelRadiusKm: account.travelRadiusKm ?? 50, perKm: Number(s.perKm), busy: busyOn(g.date) },
      ),
    }))
    .sort((a, b) => b.fit.score - a.fit.score);
  return (
    <ToolPage title="Best gigs for you" subtitle="Open gigs ranked by what you really take home">
      <StatRow
        items={[
          { label: 'Open gigs', value: String(ranked.length) },
          { label: 'Strong fits', value: String(ranked.filter((r) => r.fit.score >= 60).length) },
          { label: 'Best per hour', value: ranked.length ? formatMoney(Math.max(...ranked.map((r) => r.fit.perHour))) : '—' },
        ]}
      />
      {ranked.length === 0 ? (
        <EmptyBlock icon="briefcase-outline" title="No open gigs right now" message="New gigs near you appear on your home screen and here, ranked." />
      ) : (
        ranked.map(({ g, fit }) => (
          <Card key={g.id} style={{ gap: 6 }}>
            <View style={styles.between}>
              <View style={{ flex: 1 }}>
                <Text size={15} weight="semibold" color={t.c.textStrong} numberOfLines={1}>
                  {g.title}
                </Text>
                <Text size={13} color={t.c.muted}>
                  {g.postedByName} · {formatShortDate(g.date)} · {g.city} · {g.hours} h
                </Text>
              </View>
              <Text size={22} weight="semibold" color={fit.score < 40 ? t.c.danger : t.c.textStrong}>
                {fit.score}
              </Text>
            </View>
            <ProgressBar value={fit.score / 100} color={fit.score >= 60 ? t.c.success : fit.score < 40 ? t.c.danger : undefined} />
            <Line label="Pay" value={formatMoney(g.pay)} />
            {fit.travelCost > 0 && <Line label="Travel, both ways" value={`− ${formatMoney(fit.travelCost)}`} />}
            <Line label="You take home" value={formatMoney(fit.net)} note={`${formatMoney(fit.perHour)} an hour including travel time`} strong />
            {fit.reasons.length > 0 && (
              <Text size={13} color={t.c.muted}>
                {fit.reasons.join(' · ')}
              </Text>
            )}
            <KButton label="Open gig" size="sm" variant="ghost" onPress={() => router.push({ pathname: '/freelancer/gig/[id]', params: { id: g.id } })} />
          </Card>
        ))
      )}
      <Card style={{ gap: 10 }}>
        <NumberField label="Your travel cost per km (fuel or fares)" money value={Number(s.perKm)} onChange={(n) => set({ perKm: n })} />
        <Text size={12} color={t.c.muted}>
          Scores weigh your skills, pay per hour after travel against your rate ({formatMoney(account.hourlyRate ?? 0)} an hour), your {account.travelRadiusKm ?? 50} km radius and your calendar.
        </Text>
      </Card>
    </ToolPage>
  );
}

// ─── Season planner ─────────────────────────────────────────────────────────

export function SeasonPlanner() {
  const t = useRoleTheme();
  const { account, busyOn, jobDates } = useBusy();
  const [months, setMonths] = useState(6);
  const [uplift, setUplift] = useToolState(account.id, 'freelancer.season', { peakPct: 20 });
  const dates = saitDates(today(), Math.round(months * 30.4));
  const rows = dates.map((d) => ({ ...d, status: jobDates.has(d.date) ? ('booked' as const) : busyOn(d.date) ? ('blocked' as const) : ('open' as const) }));
  const groups = [...new Set(rows.map((r) => r.bsMonth))];
  const open = rows.filter((r) => r.status === 'open').length;
  const booked = rows.filter((r) => r.status === 'booked').length;
  const peakRate = Math.round(((account.dayRate ?? 0) * (1 + Number(uplift.peakPct) / 100)) / 500) * 500;
  return (
    <ToolPage title="Season planner" subtitle="Sait dates ahead and how many you have filled">
      <ChoiceChips options={['3 months', '6 months', '12 months']} selected={[`${months} months`]} onToggle={(x) => setMonths(Number(x.split(' ')[0]))} />
      <StatRow
        items={[
          { label: 'Sait dates', value: String(rows.length) },
          { label: 'Booked', value: String(booked) },
          { label: 'Still open', value: String(open) },
        ]}
      />
      <Card style={{ gap: 8 }}>
        <Text size={15} weight="semibold" color={t.c.textStrong}>
          Filled {rows.length ? percent(booked / rows.length) : '0%'} of the season
        </Text>
        <ProgressBar value={rows.length ? booked / rows.length : 0} height={6} />
        <Line label="Your day rate" value={formatMoney(account.dayRate ?? 0)} />
        <Line label="Suggested peak sait rate" value={formatMoney(peakRate)} strong note={`+${uplift.peakPct}% on sait dates in Mangsir, Magh, Falgun and Baisakh`} />
        <NumberField label="Peak uplift (%)" value={Number(uplift.peakPct)} onChange={(n) => setUplift({ peakPct: Math.min(100, n) })} />
      </Card>
      {groups.map((g) => (
        <View key={g}>
          <SectionTitle title={g} />
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {rows
              .filter((r) => r.bsMonth === g)
              .map((r, i) => (
                <View key={r.date} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.border }]}>
                  <Text size={14} weight="semibold" color={t.c.textStrong} style={{ flex: 1 }}>
                    {formatShortDate(r.date)} · {r.weekday}
                  </Text>
                  {r.peak && r.status === 'open' && (
                    <Text size={12} color={t.c.muted}>
                      {formatMoneyCompact(peakRate)}
                    </Text>
                  )}
                  <StatusPill status={r.status === 'booked' ? 'booked' : r.status === 'blocked' ? 'unavailable' : 'available'} label={r.status === 'booked' ? 'Working' : r.status === 'blocked' ? 'Blocked' : 'Open'} />
                </View>
              ))}
          </Card>
        </View>
      ))}
      <KButton label="Open my calendar" variant="secondary" onPress={() => router.push('/freelancer/calendar')} />
      <Hint>Sait dates are indicative; the official list comes from the Nepali patro. Studios hire for these dates months ahead, so keep them open in your calendar and apply early.</Hint>
    </ToolPage>
  );
}

// ─── Rest and workload ──────────────────────────────────────────────────────

export function RestAndWorkload() {
  const t = useRoleTheme();
  const { account, ws } = useBusy();
  const [s, set] = useToolState(account.id, 'freelancer.workload', { maxStreak: 5, maxHours: 50 });
  const days: WorkDay[] = [
    ...ws.assignments.filter((a) => !['CANCELLED', 'EMERGENCY_REPLACEMENT', 'NO_SHOW'].includes(a.assignment.status)).map((a) => ({ date: a.assignment.date, start: a.assignment.startTime, end: a.assignment.endTime })),
    ...ws.standalone.map((g) => ({ date: g.date, start: g.startTime, end: endTime(g.startTime, g.hours) })),
  ];
  const from = addDays(today(), -56);
  const until = addDays(today(), 56);
  const sum = workloadSummary(days.filter((d) => d.date >= from && d.date <= until));
  const heavy = sum.weeks.filter((w) => w.hours > Number(s.maxHours) || w.days >= 6);
  const warnings: string[] = [];
  if (sum.longestStreak > Number(s.maxStreak)) warnings.push(`${sum.longestStreak} work days in a row from ${formatShortDate(sum.longestStreakStart)}. Keep a day free before or after this run.`);
  if (heavy.length) warnings.push(`${heavy.length} week${heavy.length > 1 ? 's' : ''} over ${s.maxHours} hours or six days. Say no to new gigs those weeks, or bring an assistant.`);
  if (sum.lateFinishes >= 3) warnings.push(`${sum.lateFinishes} late finishes after 10 pm. Book a ride home and avoid early calls the next morning.`);
  return (
    <ToolPage title="Rest and workload" subtitle="Eight weeks back and eight ahead">
      <StatRow
        items={[
          { label: 'Work days', value: String(sum.workDays) },
          { label: 'Longest run', value: `${sum.longestStreak} day${sum.longestStreak === 1 ? '' : 's'}`, alert: sum.longestStreak > Number(s.maxStreak) },
          { label: 'Late finishes', value: String(sum.lateFinishes) },
        ]}
      />
      {warnings.length === 0 ? (
        <EmptyBlock icon="leaf-outline" title="Your workload looks healthy" message="No long runs or heavy weeks in this window." />
      ) : (
        warnings.map((w) => (
          <Card key={w}>
            <Text size={14} color={t.c.text}>
              {w}
            </Text>
          </Card>
        ))
      )}
      {sum.weeks.length > 0 && (
        <Card style={{ gap: 10 }}>
          <SectionTitle title="Hours by week" />
          <BarChart data={sum.weeks.slice(-8).map((w) => ({ label: formatShortDate(w.week).split(' ').slice(0, 2).join(' '), value: w.hours }))} format={(n) => `${n} h`} />
          {sum.weeks.map((w) => (
            <Line key={w.week} label={`Week of ${formatShortDate(w.week)}`} value={`${w.hours} h`} note={`${w.days} day${w.days === 1 ? '' : 's'}`} tone={w.hours > Number(s.maxHours) ? 'danger' : undefined} />
          ))}
        </Card>
      )}
      <SectionTitle title="Your limits" />
      <Card style={{ gap: 10 }}>
        <NumberField label="Most work days in a row" value={Number(s.maxStreak)} onChange={(n) => set({ maxStreak: Math.max(1, n) })} />
        <NumberField label="Most hours in a week" value={Number(s.maxHours)} onChange={(n) => set({ maxHours: Math.max(1, n) })} />
      </Card>
      <Hint>Peak season can mean ten weddings in two weeks. Tired crew miss shots, run late and get hurt on the road; rest days protect your reliability score too.</Hint>
    </ToolPage>
  );
}

// ─── Income statement ───────────────────────────────────────────────────────

type Period = 'This fiscal year' | 'Last fiscal year' | 'Last 12 months';
const fyStart = (iso: string) => {
  const y = Number(iso.slice(0, 4));
  return iso >= `${y}-07-16` ? `${y}-07-16` : `${y - 1}-07-16`;
};

export function IncomeStatement() {
  const t = useRoleTheme();
  const { account, ws } = useBusy();
  const invoices = useToolEntries(account.id, 'freelancer.invoices');
  const [period, setPeriod] = useState<Period>('This fiscal year');
  const fy = fyStart(today());
  const range: Record<Period, [string, string]> = {
    'This fiscal year': [fy, today()],
    'Last fiscal year': [fyStart(addDays(fy, -1)), addDays(fy, -1)],
    'Last 12 months': [addDays(today(), -365), today()],
  };
  const [from, to] = range[period];
  const within = (d?: string) => !!d && d >= from && d <= to;
  const rows = [
    ...ws.payables.filter((p) => p.status === 'PAID' && within(p.paidAt?.slice(0, 10))).map((p) => ({ date: p.paidAt!.slice(0, 10), source: 'vivah' as const, label: p.label, amount: p.amount })),
    ...invoices.filter((i) => i.status === 'paid' && within(i.date)).map((i) => ({ date: i.date!, source: 'private' as const, label: `${i.title}${i.note ? ` · ${i.note}` : ''}`, amount: i.amount ?? 0 })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const vivah = rows.filter((r) => r.source === 'vivah').reduce((s, r) => s + r.amount, 0);
  const own = rows.filter((r) => r.source === 'private').reduce((s, r) => s + r.amount, 0);
  const months = lastMonths(to, 12).filter((m) => m >= from.slice(0, 7));
  const fileName = `income-${account.name.split(' ')[0].toLowerCase()}-${from}`;
  return (
    <ToolPage title="Income statement" subtitle="Proof of income for loans, visas and tax">
      <ChoiceChips options={['This fiscal year', 'Last fiscal year', 'Last 12 months']} selected={[period]} onToggle={(x) => setPeriod(x as Period)} />
      <StatRow
        items={[
          { label: 'Through Vivah', value: formatMoneyCompact(vivah) },
          { label: 'Private clients', value: formatMoneyCompact(own) },
          { label: 'Total', value: formatMoneyCompact(vivah + own) },
        ]}
      />
      {months.length > 1 && (
        <Card style={{ gap: 10 }}>
          <SectionTitle title="By month" />
          <BarChart data={months.map((m) => ({ label: monthLabel(m), value: rows.filter((r) => r.date.startsWith(m)).reduce((s, r) => s + r.amount, 0) }))} format={formatMoneyCompact} />
        </Card>
      )}
      <View style={styles.actions}>
        <KButton label="Download PDF" icon="document-outline" style={{ flex: 1 }} onPress={() => sharePdf(incomeStatementHtml({ name: account.name, phone: account.phone, pan: account.panVat, from, to, rows }), fileName)} />
        <KButton label="Download CSV" icon="download-outline" variant="secondary" style={{ flex: 1 }} onPress={() => exportCsv(rows.map((r) => ({ date: r.date, source: r.source === 'vivah' ? 'Vivah payout' : 'Private client', job: r.label, amount: r.amount })), fileName)} />
      </View>
      {rows.length === 0 ? (
        <EmptyBlock icon="wallet-outline" title="No income in this period" message="Paid Vivah payouts and private invoices marked paid appear here." />
      ) : (
        <Card padded={false} style={{ overflow: 'hidden' }}>
          {rows.map((r, i) => (
            <ListRow key={`${r.source}-${i}`} icon={r.source === 'vivah' ? 'shield-checkmark-outline' : 'person-outline'} title={r.label} subtitle={`${formatShortDate(r.date)} · ${r.source === 'vivah' ? 'Vivah payout' : 'Private client'}`} trailing={<Text size={14} weight="semibold" color={t.c.textStrong}>{formatMoney(r.amount)}</Text>} />
          ))}
        </Card>
      )}
      <Hint>Nepal’s fiscal year starts on 1 Shrawan (mid-July). Vivah payouts come from Vivah’s records; private income comes from your invoices marked paid and is shown as self-declared. Banks usually also ask for bank statements.</Hint>
    </ToolPage>
  );
}

// ─── Testimonials ───────────────────────────────────────────────────────────

export function Testimonials() {
  const t = useRoleTheme();
  const { account, ws } = useBusy();
  const add = useDb((s) => s.addToolEntry);
  const entries = useToolEntries(account.id, 'freelancer.testimonials');
  const imported = new Set(entries.map((e) => e.refId).filter(Boolean));
  const fresh = ws.reviews.filter((r) => r.text.trim() && !imported.has(r.id));
  const quote = (title: string, text?: string, event?: string) => `“${(text ?? '').trim()}”\n— ${title}${event ? `, ${event}` : ''}`;
  const best = [...entries].sort((a, b) => Number(!!b.fields?.featured) - Number(!!a.fields?.featured) || Number(b.fields?.stars ?? 0) - Number(a.fields?.stars ?? 0)).slice(0, 3);
  return (
    <ToolPage title="Testimonials" subtitle="Kind words from clients, ready to share">
      {fresh.length > 0 && (
        <Card style={{ gap: 8 }}>
          <Text size={14} color={t.c.text}>
            {fresh.length} review{fresh.length === 1 ? '' : 's'} on Vivah can be added as testimonials.
          </Text>
          <KButton
            label="Add them"
            size="sm"
            variant="secondary"
            onPress={() => {
              fresh.forEach((r) => add({ ownerId: account.id, tool: 'freelancer.testimonials', title: r.authorName, note: r.text.slice(0, 500), refId: r.id, date: r.at.slice(0, 10), fields: { stars: String(Math.round(r.overall)), source: 'Vivah review' } }));
              toast('Reviews added');
            }}
          />
        </Card>
      )}
      {best.length > 0 && (
        <KButton label="Share my best three" icon="share-social-outline" onPress={() => shareMessage(`What clients say about ${account.name}\n\n${best.map((e) => quote(e.title, e.note, e.fields?.event ? String(e.fields.event) : undefined)).join('\n\n')}`)} />
      )}
      <EntryList
        ownerId={account.id}
        tool="freelancer.testimonials"
        noun="testimonial"
        defaults={{ date: today(), fields: { stars: '5' } }}
        sort={(a, b) => Number(!!b.fields?.featured) - Number(!!a.fields?.featured) || (b.date ?? '').localeCompare(a.date ?? '')}
        fields={[
          { key: 'title', label: 'Client', kind: 'text', required: true, placeholder: 'e.g. Sujata and Bibek' },
          { key: 'note', label: 'What they said', kind: 'multiline', required: true },
          { key: 'f.event', label: 'Event', kind: 'text', placeholder: 'e.g. Wedding at Pokhara' },
          { key: 'date', label: 'Date', kind: 'date' },
          { key: 'f.stars', label: 'Stars', kind: 'select', options: ['5', '4', '3'] },
          { key: 'f.featured', label: 'Show first when sharing', kind: 'toggle' },
        ]}
        subtitle={(e) => [e.fields?.stars ? `${e.fields.stars}★` : undefined, e.fields?.event, e.date ? formatShortDate(e.date) : undefined, e.fields?.featured ? 'Shown first' : undefined].filter(Boolean).join(' · ')}
        rowActions={(e) => [
          {
            label: 'Copy',
            onPress: () => {
              Clipboard.setStringAsync(quote(e.title, e.note, e.fields?.event ? String(e.fields.event) : undefined));
              toast('Copied');
            },
          },
        ]}
        emptyMessage="Ask clients for two lines after each job, or add your Vivah reviews above."
      />
      <Hint>Only share words clients actually wrote, with their permission. Put your best three in your Instagram highlights and your gig applications.</Hint>
    </ToolPage>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  actions: { flexDirection: 'row', gap: 10 },
});
