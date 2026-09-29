import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BarChart, Card, KpiCard, ListRow, ProgressBar, RoleHeader, SectionTitle, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { quoteTotals } from '@/services/quotes';
import { useDb } from '@/store/useDb';
import { useAccount, useSession } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import { daysUntil, formatINRCompact } from '@/utils/format';

const COMMISSION = 0.08;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function PlatformOverview() {
  const t = useRoleTheme();
  const account = useAccount();
  const projects = useDb((s) => s.projects);
  const quotes = useDb((s) => s.quotes);
  const leads = useDb((s) => s.leads);
  const approvals = useDb((s) => s.approvals);
  const gigs = useDb((s) => s.gigs);
  const accounts = useSession((s) => s.accounts);

  const gmv = projects.flatMap((p) => p.vendors).filter((v) => v.status === 'booked').reduce((s, v) => s + v.amount, 0);
  const genieRevenue = projects.filter((p) => p.managedBy === 'platform').length * 19999;
  const accepted = quotes.filter((q) => q.status === 'accepted').length;
  const decided = quotes.filter((q) => q.status === 'accepted' || q.status === 'declined').length;
  const liveEvents = projects.flatMap((p) => p.events.filter((e) => e.status === 'live').map((e) => ({ ...e, project: p })));
  const openIncidents = projects.flatMap((p) => p.incidents.filter((i) => i.status === 'open').map((i) => ({ ...i, project: p })));
  const pendingApprovals = approvals.filter((a) => a.status === 'pending').length;
  const revisionQuotes = quotes.filter((q) => q.status === 'revision').length;
  const openGigs = gigs.filter((g) => g.status === 'open' && daysUntil(g.date) >= 0);

  const now = new Date();
  const chart = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const real = quotes
      .filter((q) => q.status === 'accepted' && new Date(q.updatedAt).getMonth() === d.getMonth())
      .reduce((s, q) => s + quoteTotals(q).total, 0);
    return { label: MONTHS[d.getMonth()], value: [42, 55, 48, 71, 66, 58][i] * 100000 + real };
  });

  const byCity = Object.entries(
    projects.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.city]: (acc[p.city] ?? 0) + 1 }), {}),
  ).sort((a, b) => b[1] - a[1]);

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <RoleHeader eyebrow={`VIVAH OPS · ${account.team?.toUpperCase() ?? 'ADMIN'}`} title="Platform overview" subtitle={`Signed in as ${account.name}`} />
      <ScrollView contentContainerStyle={{ padding: 14, gap: 14, paddingBottom: 30 }}>
        {(liveEvents.length > 0 || openIncidents.length > 0) && (
          <Card onPress={() => router.navigate('/platform/execution')} style={[styles.alert, { borderColor: t.c.danger }]} accessibilityLabel="Open control room">
            <View style={[styles.liveDot, { backgroundColor: t.c.danger }]} />
            <View style={{ flex: 1 }}>
              <Text size={14} weight="bold" color={t.c.textStrong}>
                {liveEvents.length} event{liveEvents.length === 1 ? '' : 's'} live · {openIncidents.length} open incident{openIncidents.length === 1 ? '' : 's'}
              </Text>
              <Text size={12} color={t.c.muted} numberOfLines={1}>
                {liveEvents.map((e) => `${e.project.code} ${e.name}`).join(' · ') || 'Monitor in the control room'}
              </Text>
            </View>
            <Text size={12} weight="bold" color={t.c.danger}>
              OPEN →
            </Text>
          </Card>
        )}

        <View style={styles.kpis}>
          <KpiCard label="Marketplace GMV" value={formatINRCompact(gmv)} icon="trending-up-outline" delta="+18%" />
          <KpiCard label="Platform revenue" value={formatINRCompact(gmv * COMMISSION + genieRevenue)} icon="cash-outline" tone={t.c.success} delta="+12%" />
          <KpiCard label="Active weddings" value={String(projects.filter((p) => p.stage !== 'completed').length)} icon="heart-outline" tone="#DB2777" onPress={() => router.navigate('/platform/weddings')} />
          <KpiCard label="Quote conversion" value={`${decided ? Math.round((accepted / decided) * 100) : 0}%`} icon="document-text-outline" tone={t.c.info} onPress={() => router.push('/platform/quotes')} />
          <KpiCard label="Leads (all time)" value={String(leads.length)} icon="flash-outline" tone={t.c.warning} />
          <KpiCard label="Registered users" value={String(accounts.length)} icon="people-outline" tone="#7C3AED" onPress={() => router.push('/platform/users')} />
        </View>

        <Card style={{ gap: 10 }}>
          <View style={styles.rowBetween}>
            <Text size={15} weight="bold" color={t.c.textStrong}>
              Bookings GMV
            </Text>
            <Text size={12} color={t.c.muted}>
              Last 6 months
            </Text>
          </View>
          <BarChart data={chart} format={formatINRCompact} />
        </Card>

        <View>
          <SectionTitle title="Action queue" />
          <Card padded={false} style={{ overflow: 'hidden' }}>
            <ListRow icon="shield-checkmark-outline" title="Verification requests" subtitle="Vendors, freelancers & review moderation" trailing={<StatusPill status={pendingApprovals ? 'pending' : 'done'} label={String(pendingApprovals)} />} onPress={() => router.navigate('/platform/approvals')} />
            <ListRow icon="create-outline" title="Quotes with change requests" subtitle="Couples asked vendors for revisions" trailing={<StatusPill status={revisionQuotes ? 'revision' : 'done'} label={String(revisionQuotes)} />} onPress={() => router.push('/platform/quotes')} />
            <ListRow icon="megaphone-outline" title="Open crew gigs" subtitle="Staffing for upcoming weddings" trailing={<StatusPill status="open" label={String(openGigs.length)} />} onPress={() => router.push('/platform/gigs')} />
            <ListRow icon="wallet-outline" title="Freelancer payouts" subtitle="Release pending payouts" onPress={() => router.push('/platform/payouts')} />
          </Card>
        </View>

        <Card style={{ gap: 12 }}>
          <Text size={15} weight="bold" color={t.c.textStrong}>
            Weddings by city
          </Text>
          {byCity.map(([city, count]) => (
            <View key={city} style={{ gap: 4 }}>
              <View style={styles.rowBetween}>
                <Text size={13} color={t.c.text}>
                  {city}
                </Text>
                <Text size={13} weight="bold" color={t.c.textStrong}>
                  {count}
                </Text>
              </View>
              <ProgressBar value={count / Math.max(1, byCity[0][1])} />
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  alert: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5 },
  liveDot: { width: 12, height: 12, borderRadius: 6 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
