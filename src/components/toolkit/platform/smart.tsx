/** Platform toolkit, smart operations: money reconciliation, peak-date capacity, commission simulator, customer satisfaction and listing quality. */
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BarChart, Card, ChoiceChips, EmptyBlock, KButton, ListRow, ProgressBar, SectionTitle, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { sameServiceArea } from '@/data/cities';
import { FREELANCER_DIRECTORY } from '@/data/freelancers';
import { findProvider, PROVIDERS } from '@/data/providers';
import { serviceName } from '@/data/services';
import { exportCsv } from '@/services/exporters';
import { busyDates, listingQuality, reconcileProject, satisfaction, simulateRates, type ReconIssue } from '@/services/insights';
import { isBlocking, statusOn } from '@/services/matching';
import { saitDates } from '@/services/toolkit';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { PricingModel } from '@/types/platform';
import { addDays, formatMoney, formatMoneyCompact, formatShortDate, percent, today } from '@/utils/format';

import { Hint, Line, NumberField, StatRow, ToolPage } from '../core';

const openProject = (id: string) => router.push({ pathname: '/platform/project/[id]', params: { id } });
const openProvider = (id: string) => router.push({ pathname: '/platform/provider/[id]', params: { id } });

// ─── Money reconciliation ───────────────────────────────────────────────────

const ISSUE_GROUP: Record<ReconIssue['kind'], string> = {
  milestones: 'Quote and milestones',
  booking_split: 'Booking splits',
  payables: 'Provider payouts',
  overpaid: 'Over-collected milestones',
  payment_link: 'Receipts and milestones',
  refund: 'Refunds',
};

export function Reconciliation() {
  const projects = useDb((s) => s.projects);
  const quotes = useDb((s) => s.quotes);
  const payments = useDb((s) => s.payments);
  const payables = useDb((s) => s.payables);
  const refunds = useDb((s) => s.refunds);
  const issues = projects.flatMap((p) => reconcileProject(p, { quotes, payments, payables, refunds }));
  const groups = (Object.keys(ISSUE_GROUP) as ReconIssue['kind'][]).filter((k) => issues.some((i) => i.kind === k));
  const affected = new Set(issues.map((i) => i.projectId)).size;
  return (
    <ToolPage title="Money reconciliation" subtitle="Every project’s money checked against the rules">
      <StatRow
        items={[
          { label: 'Projects checked', value: String(projects.length) },
          { label: 'Issues', value: String(issues.length), alert: issues.length > 0 },
          { label: 'Projects affected', value: String(affected) },
          { label: 'Out by', value: formatMoneyCompact(issues.reduce((s, i) => s + i.diff, 0)), alert: issues.length > 0 },
        ]}
      />
      {issues.length === 0 ? (
        <EmptyBlock icon="checkmark-done-outline" title="Everything reconciles" message="Quotes, milestones, booking splits, payouts and refunds all agree." />
      ) : (
        groups.map((k) => (
          <View key={k}>
            <SectionTitle title={`${ISSUE_GROUP[k]} (${issues.filter((i) => i.kind === k).length})`} />
            <Card padded={false} style={{ overflow: 'hidden' }}>
              {issues
                .filter((i) => i.kind === k)
                .sort((a, b) => b.diff - a.diff)
                .map((i) => (
                  <ListRow key={i.id} icon="alert-circle-outline" title={i.title} subtitle={i.detail} trailing={<StatusPill status={i.severity} />} onPress={() => openProject(i.projectId)} />
                ))}
            </Card>
          </View>
        ))
      )}
      {issues.length > 0 && <KButton label="Export issues as CSV" icon="download-outline" variant="secondary" onPress={() => exportCsv(issues.map((i) => ({ project: projects.find((p) => p.id === i.projectId)?.code ?? i.projectId, check: ISSUE_GROUP[i.kind], severity: i.severity, issue: i.title, detail: i.detail, diff: i.diff })), `reconciliation-${today()}`)} />}
      <Hint>Checks: accepted quote total = sum of its milestones; booking price = provider payable + platform fee; provider payouts = provider payable; no milestone paid beyond its amount; receipts match what each milestone shows; refunds never exceed the payment. Nothing is changed here; fix records from the project.</Hint>
    </ToolPage>
  );
}

// ─── Peak-date capacity ─────────────────────────────────────────────────────

export function PeakDates() {
  const t = useRoleTheme();
  const projects = useDb((s) => s.projects);
  const availability = useDb((s) => s.availability);
  const rules = useDb((s) => s.availabilityRules);
  const [days, setDays] = useState(90);
  const sait = new Set(saitDates(today(), days).map((d) => d.date));
  const rows = busyDates(projects, today(), days).map((d) => {
    const cities = [...d.cities];
    const inArea = (city: string, areas: string[] = []) => cities.some((c) => sameServiceArea(city, c) || areas.includes(c));
    const services = Object.entries(d.byService).map(([serviceId, needed]) => {
      const free = PROVIDERS.filter((p) => p.serviceId === serviceId && inArea(p.city, p.serviceAreas) && !isBlocking(statusOn(p.id, d.date, availability, true, rules))).length;
      return { serviceId, needed, free, tight: free < needed * 3 };
    });
    const crew = FREELANCER_DIRECTORY.filter((f) => f.available && inArea(f.city) && !isBlocking(statusOn(f.id, d.date, availability, false, rules))).length;
    return { ...d, cities, services, crew, sait: sait.has(d.date), tight: services.filter((s) => s.tight).length };
  });
  const tightDates = rows.filter((r) => r.tight > 0);
  return (
    <ToolPage title="Peak-date capacity" subtitle="Dates where supply could run short">
      <ChoiceChips options={['30 days', '90 days', '180 days']} selected={[`${days} days`]} onToggle={(x) => setDays(Number(x.split(' ')[0]))} />
      <StatRow
        items={[
          { label: 'Dates with functions', value: String(rows.length) },
          { label: 'Tight dates', value: String(tightDates.length), alert: tightDates.length > 0 },
          { label: 'Busiest', value: rows.length ? `${Math.max(...rows.map((r) => r.functions))} functions` : '—' },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyBlock icon="calendar-outline" title="No functions booked in this window" />
      ) : (
        [...rows]
          .sort((a, b) => b.tight - a.tight || b.functions - a.functions || a.date.localeCompare(b.date))
          .map((r) => (
            <Card key={r.date} style={{ gap: 6 }}>
              <View style={styles.between}>
                <View style={{ flex: 1 }}>
                  <Text size={15} weight="semibold" color={t.c.textStrong}>
                    {formatShortDate(r.date)}
                  </Text>
                  <Text size={13} color={t.c.muted}>
                    {r.functions} function{r.functions === 1 ? '' : 's'} · {r.cities.join(', ')} · {r.crew} freelancers free{r.sait ? ' · sait' : ''}
                  </Text>
                </View>
                {r.tight > 0 ? <StatusPill status="high" label={`${r.tight} tight`} /> : <StatusPill status="confirmed" label="Covered" />}
              </View>
              {r.services.map((s) => (
                <Line key={s.serviceId} label={serviceName(s.serviceId)} value={`${s.free} free for ${s.needed}`} tone={s.tight ? 'danger' : undefined} />
              ))}
            </Card>
          ))
      )}
      <Hint>Tight means fewer than three free providers per function needing that service in the same service area. Lock providers early on those dates, and line up backups in the freelancer pool.</Hint>
    </ToolPage>
  );
}

// ─── Commission simulator ───────────────────────────────────────────────────

const MODEL_LABEL: Record<PricingModel, string> = { COMMISSION: 'Commission', MARKUP: 'Markup', LEAD_FEE: 'Lead fee', FREELANCER_MARGIN: 'Freelancer margin' };

export function CommissionSimulator() {
  const t = useRoleTheme();
  const projects = useDb((s) => s.projects);
  const settings = useDb((s) => s.settings);
  const [commission, setCommission] = useState(Math.round(settings.commissionRate * 100));
  const [markup, setMarkup] = useState(Math.round(settings.markupRate * 100));
  const [leadFee, setLeadFee] = useState(settings.leadFee);
  const since = addDays(today(), -365);
  const bookings = projects.flatMap((p) => p.bookings).filter((b) => b.status !== 'CANCELLED' && b.createdAt.slice(0, 10) >= since);
  const sim = simulateRates(bookings, { commissionRate: commission / 100, markupRate: markup / 100, leadFee });
  return (
    <ToolPage title="Commission simulator" subtitle="What-if on platform rates, on the last 12 months of bookings">
      <Card style={{ gap: 10 }}>
        <NumberField label={`Commission (%) · now ${Math.round(settings.commissionRate * 100)}%`} value={commission} onChange={(n) => setCommission(Math.min(50, n))} />
        <NumberField label={`Markup (%) · now ${Math.round(settings.markupRate * 100)}%`} value={markup} onChange={(n) => setMarkup(Math.min(100, n))} />
        <NumberField label={`Lead fee · now ${formatMoney(settings.leadFee)}`} money value={leadFee} onChange={setLeadFee} />
      </Card>
      <StatRow
        items={[
          { label: 'Platform fee now', value: formatMoneyCompact(sim.current) },
          { label: 'With new rates', value: formatMoneyCompact(sim.proposed) },
          { label: 'Change', value: `${sim.delta >= 0 ? '+' : '−'}${formatMoneyCompact(Math.abs(sim.delta))}`, alert: sim.delta < 0 },
        ]}
      />
      {sim.rows.length === 0 ? (
        <EmptyBlock icon="calculator-outline" title="No bookings in the last 12 months" />
      ) : (
        sim.rows.map((r) => (
          <Card key={r.model} style={{ gap: 2 }}>
            <Text size={15} weight="semibold" color={t.c.textStrong}>
              {MODEL_LABEL[r.model]} · {r.count} booking{r.count === 1 ? '' : 's'}
            </Text>
            <Line label="Platform fee now" value={formatMoney(r.current)} />
            <Line label="With new rates" value={formatMoney(r.proposed)} strong tone={r.proposed < r.current ? 'danger' : r.proposed > r.current ? 'success' : undefined} />
            {r.customer !== 0 && <Line label="Couples would pay" value={`${r.customer > 0 ? '+' : '−'}${formatMoney(Math.abs(r.customer))}`} note="Markup bookings: the provider’s price stays the same" />}
            {r.provider !== 0 && <Line label="Providers would receive" value={`${r.provider > 0 ? '+' : '−'}${formatMoney(Math.abs(r.provider))}`} note={r.model === 'LEAD_FEE' ? 'Lead fee comes out of the provider’s price' : 'Commission comes out of the provider’s price'} />}
            {r.model === 'FREELANCER_MARGIN' && <Text size={12} color={t.c.muted}>Freelancer margin is not simulated here.</Text>}
          </Card>
        ))
      )}
      <KButton label="Open marketplace settings" variant="secondary" onPress={() => router.push('/platform/marketplace')} />
      <Hint>Nothing changes until an admin saves new rates in Marketplace settings, and new rates apply only to new bookings. A higher commission earns more per booking but can push good providers to deal with couples directly.</Hint>
    </ToolPage>
  );
}

// ─── Customer satisfaction ──────────────────────────────────────────────────

export function Satisfaction() {
  const reviews = useDb((s) => s.reviews);
  const projects = useDb((s) => s.projects);
  const [span, setSpan] = useState<'90 days' | '12 months' | 'All time'>('12 months');
  const since = span === '90 days' ? addDays(today(), -90) : span === '12 months' ? addDays(today(), -365) : '';
  const list = reviews.filter((r) => r.status === 'published' && r.authorRole === 'customer' && r.at.slice(0, 10) >= since);
  const all = satisfaction(list);
  const serviceOf = (r: (typeof list)[number]) => {
    const booking = r.bookingId ? projects.flatMap((p) => p.bookings).find((b) => b.id === r.bookingId) : undefined;
    return booking?.serviceId ?? findProvider(r.targetId)?.serviceId ?? (r.targetKind === 'freelancer' ? 'crew' : 'other');
  };
  const byService = [...new Set(list.map(serviceOf))]
    .map((id) => ({ id, ...satisfaction(list.filter((r) => serviceOf(r) === id)) }))
    .sort((a, b) => a.average - b.average);
  const byCoordinator = [...new Set(list.map((r) => projects.find((p) => p.id === r.projectId)?.coordinatorName).filter((n): n is string => !!n))]
    .map((name) => ({ name, ...satisfaction(list.filter((r) => projects.find((p) => p.id === r.projectId)?.coordinatorName === name)) }))
    .sort((a, b) => a.average - b.average);
  const detractors = list.filter((r) => r.overall < 3.75).sort((a, b) => a.overall - b.overall);
  return (
    <ToolPage title="Customer satisfaction" subtitle="What couples say, and who needs a call back">
      <ChoiceChips options={['90 days', '12 months', 'All time']} selected={[span]} onToggle={(x) => setSpan(x as typeof span)} />
      <StatRow
        items={[
          { label: 'Reviews', value: String(all.count) },
          { label: 'Average', value: all.count ? `${all.average.toFixed(2)}★` : '—' },
          { label: 'Net score', value: all.count ? String(all.nps) : '—', alert: all.count > 0 && all.nps < 30 },
          { label: 'Unhappy', value: String(all.detractors), alert: all.detractors > 0 },
        ]}
      />
      <Card style={{ gap: 10 }}>
        <SectionTitle title="Star ratings" />
        <BarChart data={all.stars.map((n, i) => ({ label: `${i + 1}★`, value: n }))} />
      </Card>
      {byService.length > 0 && (
        <Card style={{ gap: 2 }}>
          <SectionTitle title="By service, lowest first" />
          {byService.map((s) => (
            <Line key={s.id} label={s.id === 'crew' ? 'Freelance crew' : s.id === 'other' ? 'Other' : serviceName(s.id)} value={`${s.average.toFixed(1)}★`} note={`${s.count} reviews · net score ${s.nps}`} tone={s.average < 4 ? 'danger' : undefined} />
          ))}
        </Card>
      )}
      {byCoordinator.length > 0 && (
        <Card style={{ gap: 2 }}>
          <SectionTitle title="By coordinator" />
          {byCoordinator.map((c) => (
            <Line key={c.name} label={c.name} value={`${c.average.toFixed(1)}★`} note={`${c.count} reviews on their weddings`} tone={c.average < 4 ? 'danger' : undefined} />
          ))}
        </Card>
      )}
      <SectionTitle title={`Call back (${detractors.length})`} />
      {detractors.length === 0 ? (
        <EmptyBlock icon="happy-outline" title="No unhappy couples in this window" />
      ) : (
        <Card padded={false} style={{ overflow: 'hidden' }}>
          {detractors.map((r) => (
            <ListRow key={r.id} icon="call-outline" title={`${r.authorName} → ${r.targetName}`} subtitle={`${r.overall.toFixed(1)}★ · ${formatShortDate(r.at.slice(0, 10))} · ${r.text.slice(0, 90)}`} onPress={() => (r.projectId ? openProject(r.projectId) : router.push('/platform/approvals?tab=reviews'))} />
          ))}
        </Card>
      )}
      <Hint>{`Net score = share of 5★ reviews minus share of 3★ and below (${percent(all.count ? all.promoters / all.count : 0)} promoters now). Calling unhappy couples within a week often turns a bad review into a resolved one.`}</Hint>
    </ToolPage>
  );
}

// ─── Listing quality ────────────────────────────────────────────────────────

export function ListingQuality() {
  const t = useRoleTheme();
  const packages = useDb((s) => s.packages);
  const portfolio = useDb((s) => s.portfolio);
  const settings = useDb((s) => s.settings);
  const [city, setCity] = useState('All cities');
  const rows = PROVIDERS.filter((p) => city === 'All cities' || sameServiceArea(p.city, city))
    .map((p) => ({
      p,
      q: listingQuality({
        verified: p.verification === 'VERIFIED',
        hasPhoto: !!p.image,
        styles: p.styles.length,
        reviewCount: p.reviewCount,
        rating: p.rating,
        responseMinutes: p.internal.responseMinutes,
        priceListed: p.startingPrice > 0,
        languages: p.languages.length,
        packages: packages.filter((x) => x.providerId === p.id && x.active).length,
        portfolio: portfolio.filter((x) => x.providerId === p.id).length,
      }),
    }))
    .sort((a, b) => a.q.score - b.q.score);
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.q.score, 0) / rows.length) : 0;
  const weak = rows.filter((r) => r.q.score < 60);
  return (
    <ToolPage title="Listing quality" subtitle="Profiles that need work before they win couples">
      <ChoiceChips options={['All cities', ...settings.cities]} selected={[city]} onToggle={setCity} />
      <StatRow
        items={[
          { label: 'Listings', value: String(rows.length) },
          { label: 'Average score', value: String(avg) },
          { label: 'Below 60', value: String(weak.length), alert: weak.length > 0 },
        ]}
      />
      <Card padded={false} style={{ overflow: 'hidden' }}>
        {rows.slice(0, 40).map(({ p, q }, i) => (
          <View key={p.id} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.border }]}>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={styles.between}>
                <Text size={14} weight="semibold" color={t.c.textStrong} numberOfLines={1} style={{ flex: 1 }}>
                  {p.name}
                </Text>
                <Text size={15} weight="semibold" color={q.score < 60 ? t.c.danger : t.c.textStrong}>
                  {q.score}
                </Text>
              </View>
              <ProgressBar value={q.score / 100} color={q.score < 60 ? t.c.danger : q.score >= 85 ? t.c.success : undefined} />
              <Text size={12} color={t.c.muted} numberOfLines={2}>
                {serviceName(p.serviceId)} · {p.city}
                {q.missing.length ? ` · missing: ${q.missing.slice(0, 3).join(', ').toLowerCase()}` : ' · complete'}
              </Text>
              <KButton label="Open provider" size="sm" variant="ghost" onPress={() => openProvider(p.id)} />
            </View>
          </View>
        ))}
      </Card>
      {rows.length > 40 && <Hint>{`Showing the 40 lowest of ${rows.length}.`}</Hint>}
      <Hint>Score out of 100: verified 20, five or more reviews 15, cover photo, price, packages, three portfolio albums, rating of 4.3 or more and replies within an hour 10 each, styles and languages 5. Vendor Success can share the missing items with the business.</Hint>
    </ToolPage>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
});
