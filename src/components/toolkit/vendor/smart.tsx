/** Vendor toolkit, smart selling: lead scores, revenue forecast, date demand pricing, review requests and win/loss analysis. */
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BarChart, Card, ChoiceChips, EmptyBlock, KButton, ListRow, ProgressBar, SectionTitle, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { sameServiceArea } from '@/data/cities';
import { useVendorWorkspace } from '@/hooks/useWorkspace';
import { dailyCapacity, listingAvailability } from '@/services/customerPlanning';
import { budgetBand, conversionBy, dateDemand, leadScore, replyBand, revenueForecast, STAGE_ODDS, type LeadBand } from '@/services/insights';
import { isBlocking } from '@/services/matching';
import { monthLabel, saitDates } from '@/services/toolkit';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Lead, LeadStatus } from '@/types/platform';
import { addDays, formatMoney, formatMoneyCompact, formatShortDate, percent, timeAgo, today } from '@/utils/format';
import { openWhatsApp, webUrl } from '@/utils/links';

import { Hint, Line, NumberField, StatRow, ToolPage, useToolEntries, useToolState } from '../core';

const CLOSED: LeadStatus[] = ['won', 'lost', 'archived'];
const openLead = (id: string) => router.push({ pathname: '/business/lead/[id]', params: { id } });

/** The vendor, their listing and a "is this date still free?" check against their real calendar. */
function useVendor() {
  const account = useAccount();
  const ws = useVendorWorkspace(account);
  const entries = useDb((s) => s.availability);
  const rules = useDb((s) => s.availabilityRules);
  const owners = [...new Set([account.listingId ?? account.id, account.id])];
  const capacity = dailyCapacity(account);
  const freeOn = (date: string) => !isBlocking(listingAvailability(owners, date, entries, rules, capacity).status);
  return { account, ws, listing: ws.listing, startingPrice: ws.listing?.startingPrice ?? 0, freeOn };
}

// ─── Lead scores ────────────────────────────────────────────────────────────

const BAND: Record<LeadBand, { label: string; status: string }> = {
  hot: { label: 'Hot', status: 'won' },
  warm: { label: 'Warm', status: 'pending' },
  cold: { label: 'Cold', status: 'archived' },
};

export function LeadScores() {
  const t = useRoleTheme();
  const v = useVendor();
  const [band, setBand] = useState<'All' | 'Hot' | 'Warm' | 'Cold'>('All');
  const now = new Date().toISOString();
  const scored = v.ws.leads
    .filter((l) => !CLOSED.includes(l.status))
    .map((l) => ({ l, s: leadScore(l, { startingPrice: v.startingPrice, capacity: v.listing?.capacity, free: v.freeOn(l.eventDate), nowIso: now }) }))
    .sort((a, b) => b.s.score - a.s.score);
  const count = (b: LeadBand) => scored.filter((x) => x.s.band === b).length;
  const shown = scored.filter((x) => band === 'All' || BAND[x.s.band].label === band);
  return (
    <ToolPage title="Lead scores" subtitle="Which enquiries to call first">
      <StatRow items={[{ label: 'Hot', value: String(count('hot')) }, { label: 'Warm', value: String(count('warm')) }, { label: 'Cold', value: String(count('cold')) }]} />
      <ChoiceChips options={['All', 'Hot', 'Warm', 'Cold']} selected={[band]} onToggle={(x) => setBand(x as typeof band)} />
      {shown.length === 0 ? (
        <EmptyBlock icon="flash-outline" title="No open enquiries" message="New enquiries from couples are scored here as they arrive." />
      ) : (
        shown.map(({ l, s }) => (
          <Card key={l.id} style={{ gap: 6 }}>
            <View style={styles.between}>
              <View style={{ flex: 1 }}>
                <Text size={15} weight="semibold" color={t.c.textStrong} numberOfLines={1}>
                  {l.customerName}
                </Text>
                <Text size={13} color={t.c.muted}>
                  {formatShortDate(l.eventDate)} · {l.guests ? `${l.guests} guests · ` : ''}
                  {l.budget ? formatMoneyCompact(l.budget) : 'no budget'} · {l.status}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text size={22} weight="semibold" color={t.c.textStrong}>
                  {s.score}
                </Text>
                <StatusPill status={BAND[s.band].status} label={BAND[s.band].label} />
              </View>
            </View>
            <ProgressBar value={s.score / 100} color={s.band === 'hot' ? t.c.success : s.band === 'cold' ? t.c.subtle : undefined} />
            <Text size={13} color={t.c.muted}>
              {s.reasons.slice(0, 3).join(' · ')}
            </Text>
            <KButton label="Open enquiry" size="sm" variant="ghost" onPress={() => openLead(l.id)} />
          </Card>
        ))
      )}
      <Hint>Scores weigh budget against your starting price, how soon and how sought-after the date is, whether you are free, guest fit, how detailed the enquiry is, its stage and how long it has sat. Answer hot leads first: couples usually book the first good reply.</Hint>
    </ToolPage>
  );
}

// ─── Revenue forecast ───────────────────────────────────────────────────────

const ODD_STAGES: LeadStatus[] = ['new', 'contacted', 'responded', 'quoted', 'negotiating', 'meeting'];

export function RevenueForecast() {
  const t = useRoleTheme();
  const v = useVendor();
  const [months, setMonths] = useState(6);
  const [goals] = useToolState(v.account.id, 'vendor.goals', { revenue: 500_000 });
  const [odds, setOdds] = useToolState(v.account.id, 'vendor.forecast', Object.fromEntries(ODD_STAGES.map((s) => [s, Math.round(STAGE_ODDS[s] * 100)])) as Record<string, number>);
  const thisMonth = today().slice(0, 7);
  const certain = v.ws.payables
    .filter((p) => !['CANCELLED'].includes(p.status) && (p.status !== 'PAID' || p.paidAt?.startsWith(thisMonth)))
    .map((p) => ({ date: p.status === 'PAID' ? p.paidAt!.slice(0, 10) : p.due < today() ? today() : p.due, amount: p.amount }));
  const pipeline = v.ws.leads.filter((l) => !CLOSED.includes(l.status)).map((l) => ({ date: l.eventDate < today() ? today() : l.eventDate, value: l.budget ?? v.startingPrice, status: l.status }));
  const rows = revenueForecast(today(), months, certain, pipeline, Object.fromEntries(ODD_STAGES.map((s) => [s, Number(odds[s]) / 100])));
  const target = Number(goals.revenue);
  const short = rows.filter((r) => r.total < target).length;
  const decided = v.ws.leads.filter((l) => CLOSED.includes(l.status));
  const winRate = decided.length ? decided.filter((l) => l.status === 'won').length / decided.length : null;
  return (
    <ToolPage title="Revenue forecast" subtitle="Payouts booked plus enquiries likely to book">
      <ChoiceChips options={['3 months', '6 months', '12 months']} selected={[`${months} months`]} onToggle={(x) => setMonths(Number(x.split(' ')[0]))} />
      <StatRow
        items={[
          { label: 'Booked payouts', value: formatMoneyCompact(rows.reduce((s, r) => s + r.certain, 0)) },
          { label: 'Likely from enquiries', value: formatMoneyCompact(rows.reduce((s, r) => s + r.likely, 0)) },
          { label: 'Months under goal', value: String(short), alert: short > 0 },
        ]}
      />
      <Card style={{ gap: 10 }}>
        <SectionTitle title="Expected income by month" />
        <BarChart data={rows.map((r) => ({ label: monthLabel(r.month), value: r.total }))} format={formatMoneyCompact} />
      </Card>
      <Card padded={false} style={{ overflow: 'hidden' }}>
        {rows.map((r, i) => (
          <View key={r.month} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.border }]}>
            <Text size={14} weight="semibold" color={t.c.textStrong} style={{ width: 54 }}>
              {monthLabel(r.month)}
            </Text>
            <Text size={13} color={t.c.muted} style={{ flex: 1 }}>
              booked {formatMoneyCompact(r.certain)} · likely {formatMoneyCompact(r.likely)} from {r.open} enquir{r.open === 1 ? 'y' : 'ies'}
            </Text>
            <Text size={14} weight="semibold" color={r.total < target ? t.c.danger : t.c.textStrong}>
              {formatMoneyCompact(r.total)}
            </Text>
          </View>
        ))}
      </Card>
      <Hint>{`Goal: ${formatMoney(target)} a month (set it in Monthly goals). Red months need more enquiries or a promotion now, while there is time to book them.`}</Hint>
      <SectionTitle title="Chance an enquiry books, by stage" />
      <Card style={{ gap: 10 }}>
        {ODD_STAGES.map((s) => (
          <NumberField key={s} label={`${s.charAt(0).toUpperCase()}${s.slice(1)} (%)`} value={Number(odds[s])} onChange={(n) => setOdds({ [s]: Math.min(100, n) })} />
        ))}
        <Text size={12} color={t.c.muted}>
          {`Your win rate so far: ${winRate === null ? 'not enough data' : percent(winRate)}. Adjust the chances to match it.`}
        </Text>
      </Card>
    </ToolPage>
  );
}

// ─── Date demand and pricing ────────────────────────────────────────────────

export function DateDemand() {
  const t = useRoleTheme();
  const v = useVendor();
  const leads = useDb((s) => s.leads);
  const projects = useDb((s) => s.projects);
  const [days, setDays] = useState(90);
  const [onlyOpen, setOnlyOpen] = useState(true);
  const city = v.listing?.city ?? v.account.city;
  const sait = new Set(saitDates(today(), days).map((d) => d.date));
  const requests = new Map<string, number>();
  const bump = (date: string, c: string) => sameServiceArea(c, city) && requests.set(date, (requests.get(date) ?? 0) + 1);
  leads.filter((l) => !CLOSED.includes(l.status)).forEach((l) => bump(l.eventDate, l.city));
  projects.forEach((p) => p.events.forEach((e) => e.date && e.status !== 'cancelled' && bump(e.date, e.city || p.city)));
  const rows = Array.from({ length: days }, (_, i) => addDays(today(), i + 1))
    .map((date) => ({ d: dateDemand(date, { sait: sait.has(date), requests: requests.get(date) ?? 0 }), free: v.freeOn(date) }))
    .filter((r) => r.d.demand >= 35 && (!onlyOpen || r.free));
  const openSait = [...sait].filter((d) => v.freeOn(d)).length;
  return (
    <ToolPage title="Date demand and pricing" subtitle={`Your best dates in ${city}`}>
      <ChoiceChips options={['60 days', '90 days', '180 days']} selected={[`${days} days`]} onToggle={(x) => setDays(Number(x.split(' ')[0]))} />
      <StatRow
        items={[
          { label: 'Sait dates ahead', value: String(sait.size) },
          { label: 'Still open', value: String(openSait) },
          { label: 'Booked', value: String(sait.size - openSait) },
        ]}
      />
      <ChoiceChips options={['Open dates only', 'All high-demand dates']} selected={[onlyOpen ? 'Open dates only' : 'All high-demand dates']} onToggle={(x) => setOnlyOpen(x === 'Open dates only')} />
      {rows.length === 0 ? (
        <EmptyBlock icon="calendar-outline" title="No high-demand dates in this window" message="Try a longer window. Sait dates in Mangsir, Magh, Falgun and Baisakh fill first." />
      ) : (
        <Card padded={false} style={{ overflow: 'hidden' }}>
          {rows.map(({ d, free }, i) => (
            <View key={d.date} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.border }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text size={14} weight="semibold" color={t.c.textStrong}>
                  {formatShortDate(d.date)}
                </Text>
                <Text size={12} color={t.c.muted}>
                  {[d.sait && 'Sait', d.saturday && 'Saturday', d.peak && 'Peak season', d.requests && `${d.requests} requests nearby`].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                {free ? (
                  <Text size={14} weight="semibold" color={t.c.textStrong}>
                    {v.startingPrice ? formatMoneyCompact(Math.round((v.startingPrice * (1 + d.upliftPct / 100)) / 1000) * 1000) : `+${d.upliftPct}%`}
                  </Text>
                ) : (
                  <StatusPill status="booked" label="Booked" />
                )}
                {free && d.upliftPct > 0 && (
                  <Text size={12} color={t.c.muted}>
                    +{d.upliftPct}%
                  </Text>
                )}
              </View>
            </View>
          ))}
        </Card>
      )}
      <Hint>Demand mixes sait dates, Saturdays, peak months and real enquiries and functions in your area. Suggested prices start from your listed starting price; publish a deal on quiet dates and hold your price on the busy ones.</Hint>
    </ToolPage>
  );
}

// ─── Review requests ────────────────────────────────────────────────────────

export function ReviewRequests() {
  const t = useRoleTheme();
  const v = useVendor();
  const reviews = useDb((s) => s.reviews);
  const add = useDb((s) => s.addToolEntry);
  const asked = useToolEntries(v.account.id, 'vendor.reviewask');
  const listingId = v.account.listingId ?? '';
  const business = v.account.businessName ?? v.listing?.name ?? v.account.name;
  const reviewed = (projectId: string, bookingId: string) => reviews.some((r) => r.bookingId === bookingId || (r.projectId === projectId && r.targetId === listingId));
  const done = v.ws.bookings.filter(({ project, booking }) => booking.status === 'COMPLETED' || (booking.status !== 'CANCELLED' && project.events.some((e) => booking.eventIds.includes(e.id) && e.date && e.date < today())));
  const waiting = done.filter(({ project, booking }) => !reviewed(project.id, booking.id));
  const published = v.ws.reviews.filter((r) => r.status === 'published');
  const avg = published.length ? published.reduce((s, r) => s + r.overall, 0) / published.length : 0;
  const unreplied = published.filter((r) => !r.reply).length;
  const ask = (projectId: string, bookingId: string, name: string, phone: string) => {
    const url = webUrl(`/write-review?providerId=${encodeURIComponent(listingId)}&name=${encodeURIComponent(business)}`);
    openWhatsApp(`Namaste ${name.split(' ')[0]}! Thank you for choosing ${business} for your celebration. If you have two minutes, a short review on Vivah helps other couples find us: ${url}`, phone);
    add({ ownerId: v.account.id, tool: 'vendor.reviewask', title: name, refId: bookingId, date: today(), fields: { projectId } });
    toast('Request opened in WhatsApp');
  };
  return (
    <ToolPage title="Review requests" subtitle="Ask happy couples while the day is fresh">
      <StatRow
        items={[
          { label: 'Rating', value: avg ? `${avg.toFixed(1)}★` : '—' },
          { label: 'Reviews', value: String(published.length) },
          { label: 'Waiting for a review', value: String(waiting.length) },
        ]}
      />
      {waiting.length === 0 ? (
        <EmptyBlock icon="star-outline" title="Every finished booking has a review" message="Couples appear here after their event until they leave one." />
      ) : (
        <Card padded={false} style={{ overflow: 'hidden' }}>
          {waiting.map(({ project, booking }) => {
            const last = asked.filter((a) => a.refId === booking.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
            return (
              <ListRow
                key={booking.id}
                icon="logo-whatsapp"
                title={project.customerName}
                subtitle={`${booking.packageName ?? project.title} · ${formatShortDate(project.weddingDate)}${last ? ` · asked ${timeAgo(last.createdAt)}` : ''}`}
                trailing={<StatusPill status={last ? 'sent' : 'pending'} label={last ? 'Asked' : 'Ask'} />}
                onPress={() => ask(project.id, booking.id, project.customerName, project.customerPhone)}
              />
            );
          })}
        </Card>
      )}
      {unreplied > 0 && (
        <Card style={{ gap: 8 }}>
          <Text size={14} color={t.c.text}>
            {unreplied} review{unreplied === 1 ? '' : 's'} without your reply. A short thank-you under each review lifts trust with couples reading them.
          </Text>
          <KButton label="Reply to reviews" size="sm" variant="secondary" onPress={() => router.push('/business/reviews')} />
        </Card>
      )}
      <Hint>Ask within a week of the event, once. Never offer discounts or gifts for reviews: Vivah removes reviews that were paid for.</Hint>
    </ToolPage>
  );
}

// ─── Win and loss analysis ──────────────────────────────────────────────────

export const LOSS_REASONS = ['Price too high', 'Date not free', 'Chose another vendor', 'No reply from couple', 'Plans changed', 'Other'];

export function WinLoss() {
  const t = useRoleTheme();
  const v = useVendor();
  const add = useDb((s) => s.addToolEntry);
  const update = useDb((s) => s.updateToolEntry);
  const tags = useToolEntries(v.account.id, 'vendor.winloss');
  const [by, setBy] = useState<'Source' | 'Budget' | 'Reply speed' | 'Month'>('Source');
  const leads = v.ws.leads;
  const decided = leads.filter((l) => CLOSED.includes(l.status));
  const won = decided.filter((l) => l.status === 'won');
  const lost = decided.filter((l) => l.status !== 'won');
  const keyOf: Record<typeof by, (l: Lead) => string> = {
    Source: (l) => ({ marketplace: 'Marketplace', platform: 'Vivah team', referral: 'Referral', walk_in: 'Walk-in', social: 'Social media' })[l.source ?? 'marketplace'] ?? 'Marketplace',
    Budget: (l) => budgetBand(l.budget, v.startingPrice),
    'Reply speed': (l) => replyBand(l),
    Month: (l) => monthLabel(l.createdAt.slice(0, 7)),
  };
  const rows = conversionBy(leads, keyOf[by]);
  const daysToWin = won.map((l) => {
    const at = l.history?.find((h) => h.status === 'won')?.at;
    return at ? (new Date(at).getTime() - new Date(l.createdAt).getTime()) / 86_400_000 : null;
  }).filter((n): n is number => n !== null);
  const reasonOf = (leadId: string) => tags.find((x) => x.refId === leadId);
  const tag = (lead: Lead, reason: string) => {
    const existing = reasonOf(lead.id);
    if (existing) update(existing.id, { group: reason });
    else add({ ownerId: v.account.id, tool: 'vendor.winloss', title: lead.customerName, refId: lead.id, group: reason, date: today() });
  };
  const reasonCounts = LOSS_REASONS.map((r) => ({ label: r, value: lost.filter((l) => reasonOf(l.id)?.group === r).length })).filter((r) => r.value > 0);
  const untagged = lost.filter((l) => !reasonOf(l.id));
  return (
    <ToolPage title="Win and loss analysis" subtitle="What wins you bookings, and why you lose them">
      <StatRow
        items={[
          { label: 'Win rate', value: decided.length ? percent(won.length / decided.length) : '—' },
          { label: 'Won', value: String(won.length) },
          { label: 'Lost', value: String(lost.length) },
          { label: 'Days to win', value: daysToWin.length ? String(Math.round(daysToWin.reduce((s, n) => s + n, 0) / daysToWin.length)) : '—' },
        ]}
      />
      <ChoiceChips options={['Source', 'Budget', 'Reply speed', 'Month']} selected={[by]} onToggle={(x) => setBy(x as typeof by)} />
      <Card padded={false} style={{ overflow: 'hidden' }}>
        {rows.length === 0 && (
          <View style={styles.row}>
            <Text size={14} color={t.c.muted}>
              No enquiries yet.
            </Text>
          </View>
        )}
        {rows.map((r, i) => (
          <View key={r.key} style={[styles.row, { flexDirection: 'column', alignItems: 'stretch', gap: 4 }, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.border }]}>
            <View style={styles.between}>
              <Text size={14} weight="semibold" color={t.c.textStrong} style={{ flex: 1 }}>
                {r.key}
              </Text>
              <Text size={14} weight="semibold" color={t.c.textStrong}>
                {r.rate === null ? '—' : percent(r.rate)}
              </Text>
            </View>
            <ProgressBar value={r.rate ?? 0} />
            <Text size={12} color={t.c.muted}>
              {r.total} enquiries · {r.won} won · {r.lost} lost · {r.open} open
            </Text>
          </View>
        ))}
      </Card>
      {reasonCounts.length > 0 && (
        <Card style={{ gap: 10 }}>
          <SectionTitle title="Why you lose" />
          <BarChart data={reasonCounts.map((r) => ({ label: r.label.split(' ')[0], value: r.value }))} />
          {reasonCounts.map((r) => (
            <Line key={r.label} label={r.label} value={String(r.value)} />
          ))}
        </Card>
      )}
      {untagged.length > 0 && (
        <View>
          <SectionTitle title={`Tag lost enquiries (${untagged.length})`} />
          {untagged.slice(0, 8).map((l) => (
            <Card key={l.id} style={{ gap: 8 }}>
              <Text size={14} weight="semibold" color={t.c.textStrong}>
                {l.customerName} · {formatShortDate(l.eventDate)}
              </Text>
              <ChoiceChips options={LOSS_REASONS} selected={[]} onToggle={(r) => tag(l, r)} />
            </Card>
          ))}
        </View>
      )}
      <Hint>Win rate counts won out of decided enquiries (won, lost or archived). Tag each lost enquiry with one reason: after a season you will see whether price, dates or replies cost you the most.</Hint>
    </ToolPage>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
});
