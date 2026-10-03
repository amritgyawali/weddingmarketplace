/** Platform toolkit: SLAs, workload, funnel, cash flow, scorecards, demand, city supply, targets and risk watch. */
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BarChart, Card, ChoiceChips, EmptyBlock, KButton, ListRow, ProgressBar, SectionTitle, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { BS_MONTHS, bsMonthLabel } from '@/data/events';
import { FREELANCER_DIRECTORY } from '@/data/freelancers';
import { PROVIDERS } from '@/data/providers';
import { sameServiceArea } from '@/data/cities';
import { useLayout } from '@/hooks/useLayout';
import { milestoneStatus } from '@/services/pricing';
import { quoteTotals } from '@/services/quotes';
import { projectRisks } from '@/services/risk';
import { hoursBetween, monthKey, monthLabel, netFlow, weeklyBuckets } from '@/services/toolkit';
import { useDb } from '@/store/useDb';
import { useSession } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Project } from '@/types/platform';
import { addDays, formatMoney, formatMoneyCompact, formatMonthDay, formatShortDate, percent, timeAgo, today } from '@/utils/format';

import { Col, Cols, Hint, Line, NumberField, StatRow, ToolPage, useToolState } from '../core';

const ACTIVE = (p: Project) => !['COMPLETED', 'CLOSED', 'CANCELLED', 'QUOTE_REJECTED'].includes(p.status);
const WON = ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'];
const nowIso = () => new Date().toISOString();
const openProject = (id: string) => router.push({ pathname: '/platform/project/[id]', params: { id } });

// ─── SLA monitor ────────────────────────────────────────────────────────────

export function SlaMonitor() {
  const t = useRoleTheme();
  const projects = useDb((s) => s.projects);
  const quotes = useDb((s) => s.quotes);
  const disputes = useDb((s) => s.disputes);
  const refunds = useDb((s) => s.refunds);
  const verifications = useDb((s) => s.verifications);
  const [s, set] = useToolState('platform', 'platform.sla', { newHours: 24, quoteDays: 5, providerHours: 48, disputeDays: 3, refundDays: 2, kycDays: 3 });
  const now = nowIso();
  const breaches: { id: string; title: string; detail: string; age: number; onPress?: () => void }[] = [];
  for (const p of projects) {
    const last = p.statusHistory[p.statusHistory.length - 1]?.at ?? p.createdAt;
    if ((p.status === 'NEW' || p.status === 'REVIEWING') && hoursBetween(last, now) > Number(s.newHours)) breaches.push({ id: `new_${p.id}`, title: `${p.code} waiting in ${p.status.toLowerCase()}`, detail: `${p.customerName} · no progress for ${timeAgo(last)}`, age: hoursBetween(last, now), onPress: () => openProject(p.id) });
    for (const b of p.bookings) if (b.providerResponse === 'pending' && b.status !== 'CANCELLED' && hoursBetween(b.createdAt, now) > Number(s.providerHours)) breaches.push({ id: `bk_${b.id}`, title: `${b.providerName} hasn’t confirmed`, detail: `${p.code} · asked ${timeAgo(b.createdAt)}`, age: hoursBetween(b.createdAt, now), onPress: () => openProject(p.id) });
  }
  for (const q of quotes) {
    const sent = q.versions[q.versions.length - 1]?.sentAt;
    if ((q.status === 'sent' || q.status === 'viewed') && sent && hoursBetween(sent, now) > Number(s.quoteDays) * 24) breaches.push({ id: `qt_${q.id}`, title: `${q.number} unanswered`, detail: `${q.customerName} · sent ${timeAgo(sent)}`, age: hoursBetween(sent, now), onPress: () => router.push({ pathname: '/platform/quote/[id]', params: { id: q.id } }) });
  }
  for (const d of disputes) if ((d.status === 'OPEN' || d.status === 'INVESTIGATING') && hoursBetween(d.at, now) > Number(s.disputeDays) * 24) breaches.push({ id: `ds_${d.id}`, title: `Dispute: ${d.against}`, detail: `${d.raisedByName} · open ${timeAgo(d.at)}`, age: hoursBetween(d.at, now), onPress: () => router.push('/platform/finance?tab=disputes') });
  for (const r of refunds) if (r.status === 'REQUESTED' && hoursBetween(r.at, now) > Number(s.refundDays) * 24) breaches.push({ id: `rf_${r.id}`, title: `Refund of ${formatMoney(r.amount)} waiting`, detail: `${r.requestedBy} · ${timeAgo(r.at)}`, age: hoursBetween(r.at, now), onPress: () => router.push('/platform/finance?tab=disputes') });
  for (const v of verifications) if ((v.status === 'DOCUMENT_SUBMITTED' || v.status === 'UNDER_REVIEW') && hoursBetween(v.submittedAt, now) > Number(s.kycDays) * 24) breaches.push({ id: `kyc_${v.id}`, title: `KYC: ${v.title}`, detail: `Submitted ${timeAgo(v.submittedAt)}`, age: hoursBetween(v.submittedAt, now), onPress: () => router.push('/platform/approvals') });
  breaches.sort((a, b) => b.age - a.age);

  return (
    <ToolPage title="SLA monitor" subtitle="Work that has waited too long">
      <StatRow items={[{ label: 'Breaches', value: String(breaches.length), alert: breaches.length > 0 }, { label: 'Oldest', value: breaches[0] ? `${Math.round(breaches[0].age / 24)} days` : '—' }]} />
      {breaches.length === 0 ? (
        <EmptyBlock icon="checkmark-done-outline" title="Everything is within SLA" />
      ) : (
        <Card padded={false} style={{ overflow: 'hidden' }}>
          {breaches.map((b) => (
            <ListRow key={b.id} icon="time-outline" title={b.title} subtitle={b.detail} onPress={b.onPress} />
          ))}
        </Card>
      )}
      <SectionTitle title="Targets" />
      <Card style={{ gap: 10 }}>
        <Cols>
          <Col>
            <NumberField label="New project reviewed within (h)" value={Number(s.newHours)} onChange={(n) => set({ newHours: Math.max(1, n) })} />
          </Col>
          <Col>
            <NumberField label="Provider confirms within (h)" value={Number(s.providerHours)} onChange={(n) => set({ providerHours: Math.max(1, n) })} />
          </Col>
        </Cols>
        <Cols>
          <Col>
            <NumberField label="Quote answered within (days)" value={Number(s.quoteDays)} onChange={(n) => set({ quoteDays: Math.max(1, n) })} />
          </Col>
          <Col>
            <NumberField label="Dispute resolved within (days)" value={Number(s.disputeDays)} onChange={(n) => set({ disputeDays: Math.max(1, n) })} />
          </Col>
        </Cols>
        <Cols>
          <Col>
            <NumberField label="Refund decided within (days)" value={Number(s.refundDays)} onChange={(n) => set({ refundDays: Math.max(1, n) })} />
          </Col>
          <Col>
            <NumberField label="KYC decided within (days)" value={Number(s.kycDays)} onChange={(n) => set({ kycDays: Math.max(1, n) })} />
          </Col>
        </Cols>
      </Card>
      <Text size={12} color={t.c.muted}>
        Targets are shared by the whole operations team.
      </Text>
    </ToolPage>
  );
}

// ─── Coordinator workload ───────────────────────────────────────────────────

export function Workload() {
  const t = useRoleTheme();
  const projects = useDb((s) => s.projects);
  const gigs = useDb((s) => s.gigs);
  const quotes = useDb((s) => s.quotes);
  const assign = useDb((s) => s.assignCoordinator);
  const accounts = useSession((s) => s.accounts);
  const staff = accounts.filter((a) => a.role === 'platform' && !a.suspended && (a.staffRole === 'coordinator' || a.staffRole === 'admin' || a.staffRole === 'super_admin'));
  const active = projects.filter(ACTIVE);
  const unassigned = active.filter((p) => !p.coordinatorId);
  const rows = staff
    .map((a) => {
      const mine = active.filter((p) => p.coordinatorId === a.id);
      const soon = mine.filter((p) => p.events.some((e) => e.date && e.date >= today() && e.date <= addDays(today(), 30)));
      const risks = mine.reduce((n, p) => n + projectRisks(p, { gigs, quotes }).filter((r) => r.severity === 'high').length, 0);
      return { a, count: mine.length, soon: soon.length, risks };
    })
    .sort((x, y) => x.count - y.count);
  const lightest = rows[0]?.a;
  return (
    <ToolPage title="Coordinator workload" subtitle="Balance weddings across the team">
      <StatRow items={[{ label: 'Active weddings', value: String(active.length) }, { label: 'Unassigned', value: String(unassigned.length), alert: unassigned.length > 0 }, { label: 'Coordinators', value: String(staff.length) }]} />
      <Card padded={false} style={{ overflow: 'hidden' }}>
        {rows.map((r, i) => (
          <View key={r.a.id} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.border }]}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text size={15} weight="semibold" color={t.c.textStrong}>
                {r.a.name}
              </Text>
              <Text size={13} color={t.c.muted}>
                {r.count} active · {r.soon} with events in 30 days · {r.risks} high risks
              </Text>
              <ProgressBar value={Math.min(1, r.count / 12)} color={r.count > 10 ? t.c.danger : undefined} />
            </View>
          </View>
        ))}
      </Card>
      {unassigned.length > 0 && lightest && (
        <View>
          <SectionTitle title="Waiting for a coordinator" />
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {unassigned.map((p) => (
              <ListRow key={p.id} icon="person-add-outline" title={`${p.code} · ${p.customerName}`} subtitle={`${p.city} · ${formatShortDate(p.weddingDate)}`} onPress={() => openProject(p.id)} />
            ))}
          </Card>
          <KButton
            label={`Assign all to ${lightest.name} (lightest load)`}
            style={{ marginTop: 10 }}
            onPress={() => {
              unassigned.forEach((p) => assign(p.id, { id: lightest.id, name: lightest.name }));
              toast(`${unassigned.length} weddings assigned to ${lightest.name}`);
            }}
          />
        </View>
      )}
      <Hint>Around 10–12 active weddings per coordinator is sustainable in peak season. High risks come from the same rules as the control room.</Hint>
    </ToolPage>
  );
}

// ─── Source funnel ──────────────────────────────────────────────────────────

const SOURCE_LABEL: Record<string, string> = { plan_wizard: 'Plan wizard', enquiry: 'Vendor enquiry', concierge: 'Planner package', assistant: 'Quick help', phone: 'Phone', referral: 'Referral' };

export function SourceFunnel() {
  const t = useRoleTheme();
  const projects = useDb((s) => s.projects);
  const sources = [...new Set(projects.map((p) => p.source))];
  const rows = sources
    .map((src) => {
      const list = projects.filter((p) => p.source === src);
      const won = list.filter((p) => WON.includes(p.status));
      const gmv = won.reduce((s, p) => s + p.bookings.filter((b) => b.status !== 'CANCELLED').reduce((n, b) => n + b.agreedPrice, 0), 0);
      return { src, total: list.length, won: won.length, gmv, quoted: list.filter((p) => ['QUOTE_SENT', 'CUSTOMER_NEGOTIATING', ...WON, 'QUOTE_REJECTED'].includes(p.status)).length };
    })
    .sort((a, b) => b.gmv - a.gmv);
  return (
    <ToolPage title="Source funnel" subtitle="Where weddings come from and how they convert">
      <Card style={{ gap: 10 }}>
        <SectionTitle title="Booked value by source" />
        <BarChart data={rows.map((r) => ({ label: (SOURCE_LABEL[r.src] ?? r.src).split(' ')[0], value: r.gmv }))} format={formatMoneyCompact} />
      </Card>
      {rows.map((r) => (
        <Card key={r.src} style={{ gap: 4 }}>
          <Text size={15} weight="semibold" color={t.c.textStrong}>
            {SOURCE_LABEL[r.src] ?? r.src}
          </Text>
          <Line label="Projects" value={String(r.total)} />
          <Line label="Reached a quote" value={`${r.quoted} (${percent(r.total ? r.quoted / r.total : 0)})`} />
          <Line label="Confirmed" value={`${r.won} (${percent(r.total ? r.won / r.total : 0)})`} />
          <Line label="Booked value" value={formatMoney(r.gmv)} strong />
        </Card>
      ))}
    </ToolPage>
  );
}

// ─── Cash-flow forecast ─────────────────────────────────────────────────────

export function CashFlow() {
  const t = useRoleTheme();
  const projects = useDb((s) => s.projects);
  const payables = useDb((s) => s.payables);
  const [weeks, setWeeks] = useState(12);
  const inflow = projects.flatMap((p) => p.milestones.filter((m) => !['PAID', 'WAIVED'].includes(milestoneStatus(m))).map((m) => ({ date: m.due < today() ? today() : m.due, amount: m.amount - m.paidAmount })));
  const outflow = payables.filter((p) => ['ACCRUED', 'READY'].includes(p.status)).map((p) => ({ date: p.due < today() ? today() : p.due, amount: p.amount }));
  const ins = weeklyBuckets(today(), weeks, inflow);
  const outs = weeklyBuckets(today(), weeks, outflow);
  const rows = netFlow(ins, outs);
  const low = Math.min(0, ...rows.map((r) => r.running));
  return (
    <ToolPage title="Cash-flow forecast" subtitle="Customer milestones in, provider payouts out">
      <ChoiceChips options={['8 weeks', '12 weeks', '26 weeks']} selected={[`${weeks} weeks`]} onToggle={(v) => setWeeks(Number(v.split(' ')[0]))} />
      <StatRow
        items={[
          { label: 'Expected in', value: formatMoneyCompact(rows.reduce((s, r) => s + r.in, 0)) },
          { label: 'Due out', value: formatMoneyCompact(rows.reduce((s, r) => s + r.out, 0)) },
          { label: 'Lowest running balance', value: formatMoneyCompact(low), alert: low < 0 },
        ]}
      />
      <Card style={{ gap: 10 }}>
        <SectionTitle title="Customer money expected by week" />
        <BarChart data={rows.slice(0, 8).map((r) => ({ label: formatMonthDay(r.week), value: r.in }))} format={formatMoneyCompact} />
      </Card>
      <Card padded={false} style={{ overflow: 'hidden' }}>
        {rows.map((r, i) => (
          <View key={r.week} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.border }]}>
            <Text size={13} weight="semibold" color={t.c.textStrong} style={{ width: 70 }}>
              {formatShortDate(r.week)}
            </Text>
            <Text size={13} color={t.c.muted} style={{ flex: 1 }}>
              in {formatMoneyCompact(r.in)} · out {formatMoneyCompact(r.out)}
            </Text>
            <Text size={13} weight="semibold" color={r.running < 0 ? t.c.danger : t.c.textStrong}>
              {formatMoneyCompact(r.running)}
            </Text>
          </View>
        ))}
      </Card>
      <Hint>Overdue milestones and payouts are counted in the current week. Escrow on hand today is not included; the running figure is the change from today.</Hint>
    </ToolPage>
  );
}

// ─── Provider scorecards ────────────────────────────────────────────────────

export function Scorecards() {
  const t = useRoleTheme();
  const projects = useDb((s) => s.projects);
  const reviews = useDb((s) => s.reviews);
  const disputes = useDb((s) => s.disputes);
  const bookings = projects.flatMap((p) => p.bookings.map((b) => ({ p, b })));
  const ids = [...new Set(bookings.map((x) => x.b.providerId))];
  const rows = ids
    .map((id) => {
      const mine = bookings.filter((x) => x.b.providerId === id);
      const name = mine[0].b.providerName;
      const cancelled = mine.filter((x) => x.b.status === 'CANCELLED' || x.b.providerResponse === 'declined').length;
      const deliverables = mine.flatMap((x) => x.b.deliverables);
      const late = deliverables.filter((d) => d.due < today() && !['APPROVED', 'DELIVERED'].includes(d.status)).length;
      const rv = reviews.filter((r) => r.targetId === id && r.status === 'published');
      const avg = rv.length ? rv.reduce((s, r) => s + r.overall, 0) / rv.length : 0;
      const dsp = disputes.filter((d) => d.against === name).length;
      const score = Math.round(Math.max(0, 100 - cancelled * 15 - late * 10 - dsp * 20 + (avg ? (avg - 4) * 10 : 0)));
      return { id, name, jobs: mine.length, cancelled, late, avg, dsp, score };
    })
    .sort((a, b) => b.score - a.score);
  return (
    <ToolPage title="Provider scorecards" subtitle="Reliability from real bookings">
      {rows.map((r) => (
        <Card key={r.id} style={{ gap: 6 }}>
          <View style={styles.between}>
            <Text size={15} weight="semibold" color={t.c.textStrong} style={{ flex: 1 }} numberOfLines={1}>
              {r.name}
            </Text>
            <Text size={20} weight="semibold" color={r.score < 70 ? t.c.danger : t.c.textStrong}>
              {r.score}
            </Text>
          </View>
          <Text size={13} color={t.c.muted}>
            {r.jobs} bookings · {r.cancelled} cancelled or declined · {r.late} late deliverables · {r.dsp} disputes · {r.avg ? `${r.avg.toFixed(1)}★` : 'no reviews'}
          </Text>
          <KButton label="Open provider" size="sm" variant="ghost" onPress={() => router.push({ pathname: '/platform/provider/[id]', params: { id: r.id } })} />
        </Card>
      ))}
      <Hint>Starts at 100: −15 per cancellation or decline, −10 per late deliverable, −20 per dispute, ±10 per star away from 4.0.</Hint>
    </ToolPage>
  );
}

// ─── Demand by season ───────────────────────────────────────────────────────

export function DemandHeatmap() {
  const t = useRoleTheme();
  const { medium } = useLayout();
  const projects = useDb((s) => s.projects);
  const leads = useDb((s) => s.leads);
  const events = projects.flatMap((p) => p.events.filter((e) => e.date && e.status !== 'cancelled').map((e) => ({ date: e.date!, city: e.city || p.city })));
  const dates = [...events.map((e) => ({ date: e.date, city: e.city })), ...leads.map((l) => ({ date: l.eventDate, city: l.city }))];
  const cities = [...new Set(dates.map((d) => d.city))].slice(0, medium ? 8 : 4);
  const count = (m: string, c?: string) => dates.filter((d) => bsMonthLabel(d.date).startsWith(m) && (!c || d.city === c)).length;
  const max = Math.max(1, ...BS_MONTHS.flatMap((m) => cities.map((c) => count(m, c))));
  return (
    <ToolPage title="Demand by season" subtitle="Functions and enquiries by Nepali month">
      <Card style={{ gap: 10 }}>
        <BarChart data={BS_MONTHS.map((m) => ({ label: m.slice(0, 3), value: count(m) }))} />
      </Card>
      <Card padded={false} style={{ overflow: 'hidden' }}>
        <View style={[styles.row, { backgroundColor: t.c.surfaceAlt }]}>
          <Text size={12} color={t.c.muted} style={{ width: 70 }}>
            Month
          </Text>
          {cities.map((c) => (
            <Text key={c} size={12} color={t.c.muted} style={styles.heatCell} numberOfLines={1}>
              {c}
            </Text>
          ))}
        </View>
        {BS_MONTHS.map((m) => (
          <View key={m} style={[styles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.border }]}>
            <Text size={13} color={t.c.textStrong} style={{ width: 70 }}>
              {m}
            </Text>
            {cities.map((c) => {
              const n = count(m, c);
              return (
                <View key={c} style={[styles.heatCell, { backgroundColor: n ? `${t.c.primary}${Math.round(20 + (n / max) * 200).toString(16).padStart(2, '0')}` : 'transparent', borderRadius: 4 }]}>
                  <Text size={12} align="center" color={n / max > 0.5 ? t.c.onPrimary : t.c.text}>
                    {n || ''}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
      </Card>
      <Hint>Counts every dated function in a project plus every vendor enquiry. Use it to plan coordinator leave, recruitment drives and featured-listing prices.</Hint>
    </ToolPage>
  );
}

// ─── City supply ────────────────────────────────────────────────────────────

export function CitySupply() {
  const t = useRoleTheme();
  const projects = useDb((s) => s.projects);
  const leads = useDb((s) => s.leads);
  const settings = useDb((s) => s.settings);
  const cities = [...new Set([...settings.cities, ...projects.map((p) => p.city)])];
  const rows = cities
    .map((city) => {
      const demand = projects.filter((p) => p.city === city && ACTIVE(p)).length + leads.filter((l) => l.city === city && !['lost', 'archived'].includes(l.status)).length;
      const providers = PROVIDERS.filter((p) => sameServiceArea(p.city, city) || p.serviceAreas.includes(city)).length;
      const crew = FREELANCER_DIRECTORY.filter((f) => sameServiceArea(f.city, city)).length;
      return { city, demand, providers, crew, ratio: demand ? (providers + crew) / demand : Infinity, live: settings.cities.includes(city) };
    })
    .sort((a, b) => a.ratio - b.ratio);
  return (
    <ToolPage title="City supply" subtitle="Where we need more providers and crew">
      {rows.map((r) => (
        <Card key={r.city} style={{ gap: 4 }}>
          <View style={styles.between}>
            <Text size={15} weight="semibold" color={t.c.textStrong}>
              {r.city}
            </Text>
            {r.ratio < 3 ? <StatusPill status="high" label="Undersupplied" /> : !r.live ? <StatusPill status="pending" label="Not launched" /> : <StatusPill status="confirmed" label="Healthy" />}
          </View>
          <Text size={13} color={t.c.muted}>
            {r.demand} open weddings and enquiries · {r.providers} providers · {r.crew} freelancers
          </Text>
        </Card>
      ))}
      <Hint>Undersupplied means fewer than three providers and freelancers per open wedding or enquiry in that service area.</Hint>
    </ToolPage>
  );
}

// ─── Monthly targets ────────────────────────────────────────────────────────

export function Targets() {
  const t = useRoleTheme();
  const revenue = useDb((s) => s.revenue);
  const projects = useDb((s) => s.projects);
  const quotes = useDb((s) => s.quotes);
  const [s, set] = useToolState('platform', 'platform.targets', { revenue: 400_000, gmv: 8_000_000, newProjects: 12, confirmed: 5 });
  const key = monthKey(today());
  const confirmedNow = projects.filter((p) => p.statusHistory.some((h) => h.status === 'CONFIRMED' && h.at.startsWith(key)));
  const actual = {
    revenue: revenue.filter((r) => r.at.startsWith(key)).reduce((n, r) => n + r.amount, 0),
    gmv: quotes.filter((q) => q.status === 'accepted' && q.updatedAt.startsWith(key)).reduce((n, q) => n + quoteTotals(q).total, 0),
    newProjects: projects.filter((p) => p.createdAt.startsWith(key)).length,
    confirmed: confirmedNow.length,
  };
  const rows: { id: keyof typeof actual; label: string; money?: boolean }[] = [
    { id: 'revenue', label: 'Platform revenue', money: true },
    { id: 'gmv', label: 'Accepted quote value (GMV)', money: true },
    { id: 'newProjects', label: 'New weddings' },
    { id: 'confirmed', label: 'Weddings confirmed' },
  ];
  return (
    <ToolPage title="Monthly targets" subtitle={`${monthLabel(key)} progress`}>
      {rows.map((r) => {
        const target = Number(s[r.id]);
        const v = actual[r.id];
        return (
          <Card key={r.id} style={{ gap: 8 }}>
            <View style={styles.between}>
              <Text size={15} weight="semibold" color={t.c.textStrong}>
                {r.label}
              </Text>
              <Text size={14} color={t.c.muted}>
                {r.money ? formatMoneyCompact(v) : v} / {r.money ? formatMoneyCompact(target) : target}
              </Text>
            </View>
            <ProgressBar value={target ? v / target : 0} height={6} color={v >= target ? t.c.success : undefined} />
            <NumberField label="Target" money={r.money} value={target} onChange={(n) => set({ [r.id]: n })} />
          </Card>
        );
      })}
    </ToolPage>
  );
}

// ─── Risk and fraud watch ───────────────────────────────────────────────────

export function RiskWatch() {
  const accounts = useSession((s) => s.accounts);
  const payments = useDb((s) => s.payments);
  const refunds = useDb((s) => s.refunds);
  const disputes = useDb((s) => s.disputes);
  const reviews = useDb((s) => s.reviews);
  const projects = useDb((s) => s.projects);
  const signals: { id: string; title: string; detail: string; severity: 'high' | 'medium' | 'low'; onPress?: () => void }[] = [];
  const phones = new Map<string, string[]>();
  accounts.forEach((a) => phones.set(a.phone, [...(phones.get(a.phone) ?? []), a.name]));
  phones.forEach((names, phone) => names.length > 1 && signals.push({ id: `ph_${phone}`, title: 'Shared phone number', detail: `${names.join(', ')} use the same number`, severity: 'medium', onPress: () => router.push('/platform/users') }));
  payments.filter((p) => p.method === 'cash' && p.amount >= 100_000).forEach((p) => signals.push({ id: `cash_${p.id}`, title: `Large cash payment ${formatMoney(p.amount)}`, detail: `${p.payerName} · ${p.receiptNo} — check the receipt was signed`, severity: 'medium' }));
  projects.forEach((pr) => {
    const paid = payments.filter((p) => p.projectId === pr.id).reduce((s, p) => s + p.amount, 0);
    const refunded = refunds.filter((r) => r.projectId === pr.id && r.status !== 'REJECTED').reduce((s, r) => s + r.amount, 0);
    if (paid && refunded / paid > 0.2) signals.push({ id: `rf_${pr.id}`, title: `${pr.code}: ${percent(refunded / paid)} refunded`, detail: `${formatMoney(refunded)} of ${formatMoney(paid)}`, severity: 'high', onPress: () => openProject(pr.id) });
  });
  const against = new Map<string, number>();
  disputes.forEach((d) => against.set(d.against, (against.get(d.against) ?? 0) + 1));
  against.forEach((n, name) => n >= 2 && signals.push({ id: `dsp_${name}`, title: `${name}: ${n} disputes`, detail: 'Review before the next booking', severity: 'high' }));
  const flagged = reviews.filter((r) => r.status === 'flagged').length;
  if (flagged) signals.push({ id: 'rv', title: `${flagged} flagged reviews`, detail: 'Contact details, links or reports', severity: 'low', onPress: () => router.push('/platform/approvals?tab=reviews') });
  const suspended = accounts.filter((a) => a.suspended).length;
  if (suspended) signals.push({ id: 'susp', title: `${suspended} suspended accounts`, detail: 'Check none of them has an active booking', severity: 'low', onPress: () => router.push('/platform/users') });
  const order = { high: 0, medium: 1, low: 2 };
  signals.sort((a, b) => order[a.severity] - order[b.severity]);
  return (
    <ToolPage title="Risk and fraud watch" subtitle="Patterns worth a second look">
      <StatRow items={[{ label: 'High', value: String(signals.filter((s) => s.severity === 'high').length), alert: signals.some((s) => s.severity === 'high') }, { label: 'Medium', value: String(signals.filter((s) => s.severity === 'medium').length) }, { label: 'Low', value: String(signals.filter((s) => s.severity === 'low').length) }]} />
      {signals.length === 0 ? (
        <EmptyBlock icon="shield-checkmark-outline" title="Nothing unusual" />
      ) : (
        <Card padded={false} style={{ overflow: 'hidden' }}>
          {signals.map((s) => (
            <ListRow key={s.id} icon="alert-circle-outline" title={s.title} subtitle={s.detail} trailing={<StatusPill status={s.severity} />} onPress={s.onPress} />
          ))}
        </Card>
      )}
      <Hint>Signals are computed live and never stored. None of them is proof of fraud; they are prompts for a human check.</Hint>
    </ToolPage>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  heatCell: { flex: 1, paddingVertical: 3 },
});
