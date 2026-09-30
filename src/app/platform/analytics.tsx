import { ScrollView, StyleSheet, View } from 'react-native';

import { staffScreen } from '@/components/persona/StaffGate';
import { BarChart, Card, KpiCard, ProgressBar, SectionTitle, StackHeader } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { serviceName } from '@/data/services';
import { useLayout } from '@/hooks/useLayout';
import { useDb } from '@/store/useDb';
import { useSession } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import { formatMoneyCompact } from '@/utils/format';

const hoursBetween = (a: string, b: string) => Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000);

/** Marketplace analytics: funnel, GMV mix, revenue by model, speed and staffing. */
function Analytics() {
  const t = useRoleTheme();
  const { columns } = useLayout();
  const projects = useDb((s) => s.projects);
  const revenue = useDb((s) => s.revenue);
  const gigs = useDb((s) => s.gigs);
  const reviews = useDb((s) => s.reviews);
  const accounts = useSession((s) => s.accounts);

  const reached = (status: string) => projects.filter((p) => p.statusHistory.some((h) => h.status === status) || p.status === status).length;
  const funnel = [
    { label: 'Requirements', value: projects.length },
    { label: 'Matched', value: reached('MATCHING_PROVIDERS') },
    { label: 'Quoted', value: reached('QUOTE_SENT') },
    { label: 'Confirmed', value: reached('CONFIRMED') },
    { label: 'Completed', value: reached('COMPLETED') },
  ];
  const bookings = projects.flatMap((p) => p.bookings.filter((b) => b.status !== 'CANCELLED' && b.status !== 'PROPOSED'));
  const gmv = bookings.reduce((s, b) => s + b.agreedPrice, 0);
  const byService = Object.entries(bookings.reduce<Record<string, number>>((acc, b) => ({ ...acc, [b.serviceId]: (acc[b.serviceId] ?? 0) + b.agreedPrice }), {})).sort((a, b) => b[1] - a[1]);
  const byCity = Object.entries(projects.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.city]: (acc[p.city] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  const byProvider = Object.entries(bookings.reduce<Record<string, number>>((acc, b) => ({ ...acc, [b.providerName]: (acc[b.providerName] ?? 0) + b.agreedPrice }), {})).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const timeToQuote = projects
    .map((p) => {
      const sent = p.statusHistory.find((h) => h.status === 'QUOTE_SENT');
      return sent ? hoursBetween(p.createdAt, sent.at) : null;
    })
    .filter((x): x is number => x !== null);
  const avgQuoteHours = timeToQuote.length ? Math.round(timeToQuote.reduce((a, b) => a + b, 0) / timeToQuote.length) : 0;
  const crewSlots = projects.flatMap((p) => p.bookings.flatMap((b) => b.crew.filter((c) => c.staffing === 'marketplace').map((c) => ({ c, b }))));
  const needed = crewSlots.reduce((s, x) => s + x.c.count, 0);
  const filled = crewSlots.reduce((s, x) => s + Math.min(x.c.count, x.b.assignments.filter((a) => a.crewId === x.c.id && !['CANCELLED', 'EMERGENCY_REPLACEMENT', 'NO_SHOW'].includes(a.status)).length), 0);
  const avgRating = reviews.filter((r) => r.status === 'published').reduce((s, r, _, arr) => s + r.overall / arr.length, 0);
  const takeRate = gmv ? revenue.reduce((s, r) => s + r.amount, 0) / gmv : 0;
  const maxFunnel = Math.max(1, funnel[0].value);

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title="Analytics" subtitle="Marketplace performance" />
      <ScrollView contentContainerStyle={{ padding: 14, gap: 16, paddingBottom: 40 }}>
        <View style={styles.kpis}>
          <KpiCard label="Booked GMV" value={formatMoneyCompact(gmv)} icon="trending-up-outline" style={{ minWidth: columns > 1 ? '22%' : '46%' }} />
          <KpiCard label="Take rate" value={`${Math.round(takeRate * 1000) / 10}%`} icon="pie-chart-outline" tone={t.c.success} style={{ minWidth: columns > 1 ? '22%' : '46%' }} />
          <KpiCard label="Avg booking" value={formatMoneyCompact(bookings.length ? gmv / bookings.length : 0)} icon="receipt-outline" style={{ minWidth: columns > 1 ? '22%' : '46%' }} />
          <KpiCard label="Time to quote" value={`${avgQuoteHours}h`} icon="timer-outline" tone={t.c.info} style={{ minWidth: columns > 1 ? '22%' : '46%' }} />
          <KpiCard label="Crew fill rate" value={`${needed ? Math.round((filled / needed) * 100) : 100}%`} icon="people-outline" tone={t.c.warning} style={{ minWidth: columns > 1 ? '22%' : '46%' }} />
          <KpiCard label="Avg review" value={`${avgRating.toFixed(1)}★`} icon="star-outline" style={{ minWidth: columns > 1 ? '22%' : '46%' }} />
          <KpiCard label="Open gigs" value={String(gigs.filter((g) => g.status === 'open').length)} icon="megaphone-outline" style={{ minWidth: columns > 1 ? '22%' : '46%' }} />
          <KpiCard label="Accounts" value={String(accounts.length)} icon="person-outline" style={{ minWidth: columns > 1 ? '22%' : '46%' }} />
        </View>

        <Card style={{ gap: 10 }}>
          <SectionTitle title="Conversion funnel" />
          {funnel.map((f, i) => (
            <View key={f.label} style={{ gap: 4 }}>
              <View style={styles.rowBetween}>
                <Text size={13} color={t.c.text}>
                  {f.label}
                </Text>
                <Text size={13} weight="bold" color={t.c.textStrong}>
                  {f.value}
                  {i > 0 && funnel[i - 1].value ? `  (${Math.round((f.value / funnel[i - 1].value) * 100)}%)` : ''}
                </Text>
              </View>
              <ProgressBar value={f.value / maxFunnel} height={10} />
            </View>
          ))}
        </Card>

        <View style={[styles.cols, columns > 1 && { flexDirection: 'row' }]}>
          <Card style={{ gap: 10, flex: 1 }}>
            <SectionTitle title="GMV by service" />
            <BarChart data={byService.slice(0, 6).map(([k, v]) => ({ label: serviceName(k).split(' ')[0].slice(0, 7), value: v }))} format={formatMoneyCompact} />
          </Card>
          <Card style={{ gap: 10, flex: 1 }}>
            <SectionTitle title="Projects by city" />
            {byCity.map(([c, n]) => (
              <View key={c} style={{ gap: 4 }}>
                <View style={styles.rowBetween}>
                  <Text size={13} color={t.c.text}>
                    {c}
                  </Text>
                  <Text size={13} weight="bold" color={t.c.textStrong}>
                    {n}
                  </Text>
                </View>
                <ProgressBar value={n / Math.max(1, byCity[0][1])} />
              </View>
            ))}
          </Card>
        </View>

        <Card style={{ gap: 8 }}>
          <SectionTitle title="Top providers by GMV" />
          {byProvider.map(([name, v]) => (
            <View key={name} style={styles.rowBetween}>
              <Text size={13} color={t.c.text} style={{ flex: 1 }} numberOfLines={1}>
                {name}
              </Text>
              <Text size={13} weight="bold" color={t.c.textStrong}>
                {formatMoneyCompact(v)}
              </Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cols: { gap: 16 },
});

export default staffScreen('/platform/analytics', Analytics);
