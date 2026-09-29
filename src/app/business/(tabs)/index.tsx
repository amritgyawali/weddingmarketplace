import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Avatar, BarChart, Card, KpiCard, ListRow, QuickAction, RoleHeader, SectionTitle, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { useVendorWorkspace } from '@/hooks/useWorkspace';
import { quoteTotals } from '@/services/quotes';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import { daysUntil, formatINRCompact, formatShortDate } from '@/utils/format';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function VendorDashboard() {
  const t = useRoleTheme();
  const account = useAccount();
  const { leads, quotes, projects } = useVendorWorkspace(account);

  const accepted = quotes.filter((q) => q.status === 'accepted');
  const decided = quotes.filter((q) => q.status === 'accepted' || q.status === 'declined').length;
  const conversion = decided ? Math.round((accepted.length / decided) * 100) : 0;
  const booked = accepted.reduce((s, q) => s + quoteTotals(q).total, 0);
  const newLeads = leads.filter((l) => l.status === 'new');
  const revisions = quotes.filter((q) => q.status === 'revision');
  const pendingQuotes = quotes.filter((q) => q.status === 'sent' || q.status === 'viewed');

  // Last 6 months of booked revenue (seeded baseline + real accepted quotes).
  const now = new Date();
  const chart = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const real = accepted
      .filter((q) => {
        const c = new Date(q.updatedAt);
        return c.getMonth() === d.getMonth() && c.getFullYear() === d.getFullYear();
      })
      .reduce((s, q) => s + quoteTotals(q).total, 0);
    const baseline = [6, 9, 7, 12, 10, 8][i] * 100000;
    return { label: MONTHS[d.getMonth()], value: baseline + real };
  });

  const upcoming = projects
    .flatMap((p) => p.events.map((e) => ({ ...e, project: p })))
    .filter((e) => daysUntil(e.date) >= 0 && e.status !== 'done')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <RoleHeader eyebrow="VIVAH FOR BUSINESS" title={account.businessName ?? account.name} subtitle={`${account.city} · ${account.name}`}>
          <View style={styles.headerStats}>
            <View style={styles.headerStat}>
              <Text size={11} weight="semibold" color="rgba(255,255,255,0.75)">
                BOOKED REVENUE
              </Text>
              <Text size={22} weight="extrabold" color="#FFFFFF">
                {formatINRCompact(booked)}
              </Text>
            </View>
            <View style={styles.headerStat}>
              <Text size={11} weight="semibold" color="rgba(255,255,255,0.75)">
                CONVERSION
              </Text>
              <Text size={22} weight="extrabold" color="#FFFFFF">
                {conversion}%
              </Text>
            </View>
            <View style={[styles.verified, { backgroundColor: account.verified ? 'rgba(255,255,255,0.2)' : 'rgba(245,158,11,0.3)' }]}>
              <Ionicons name={account.verified ? 'shield-checkmark' : 'time-outline'} size={14} color="#FFFFFF" />
              <Text size={11} weight="bold" color="#FFFFFF">
                {account.verified ? 'Verified' : 'In review'}
              </Text>
            </View>
          </View>
        </RoleHeader>

        <View style={styles.body}>
          <View style={styles.kpis}>
            <KpiCard label="New leads" value={String(newLeads.length)} icon="flash-outline" delta={newLeads.length ? `+${newLeads.length} today` : undefined} onPress={() => router.navigate('/business/leads')} />
            <KpiCard label="Quotes awaiting reply" value={String(pendingQuotes.length)} icon="hourglass-outline" tone={t.c.warning} onPress={() => router.navigate('/business/quotes')} />
            <KpiCard label="Active projects" value={String(projects.filter((p) => p.stage !== 'completed').length)} icon="briefcase-outline" tone={t.c.info} onPress={() => router.navigate('/business/projects')} />
            <KpiCard label="Won quotations" value={String(accepted.length)} icon="trophy-outline" tone={t.c.success} />
          </View>

          <Card style={{ flexDirection: 'row', paddingVertical: 14 }}>
            <QuickAction icon="add-circle-outline" label="New quote" onPress={() => router.navigate('/business/leads')} />
            <QuickAction icon="megaphone-outline" label="Hire crew" onPress={() => router.push('/business/gig/new')} />
            <QuickAction icon="people-circle-outline" label="My gigs" onPress={() => router.push('/business/gigs')} />
            <QuickAction icon="storefront-outline" label="Storefront" onPress={() => router.navigate('/business/account')} />
          </Card>

          {(newLeads.length > 0 || revisions.length > 0) && (
            <View>
              <SectionTitle title="Needs your attention" />
              <Card padded={false} style={{ overflow: 'hidden' }}>
                {revisions.map((q) => (
                  <ListRow
                    key={q.id}
                    icon="create-outline"
                    title={`${q.customerName} requested changes`}
                    subtitle={q.revisionNote ?? q.number}
                    trailing={<StatusPill status="revision" />}
                    onPress={() => router.push({ pathname: '/business/quote/[id]', params: { id: q.id } })}
                  />
                ))}
                {newLeads.slice(0, 3).map((l) => (
                  <ListRow
                    key={l.id}
                    leading={<Avatar name={l.customerName} />}
                    title={l.customerName}
                    subtitle={`${l.functions.join(', ')} · ${l.guests ?? '—'} guests · ${formatShortDate(l.eventDate)}`}
                    trailing={<StatusPill status="new" />}
                    onPress={() => router.push({ pathname: '/business/lead/[id]', params: { id: l.id } })}
                  />
                ))}
              </Card>
            </View>
          )}

          <Card style={{ gap: 12 }}>
            <View style={styles.rowBetween}>
              <View>
                <Text size={15} weight="bold" color={t.c.textStrong}>
                  Bookings value
                </Text>
                <Text size={12} color={t.c.muted}>
                  Last 6 months
                </Text>
              </View>
              <Text size={18} weight="extrabold" color={t.c.primary}>
                {formatINRCompact(chart.reduce((s, c) => s + c.value, 0))}
              </Text>
            </View>
            <BarChart data={chart} format={formatINRCompact} />
          </Card>

          <View>
            <SectionTitle title="Upcoming events" action="All projects" onAction={() => router.navigate('/business/projects')} />
            {upcoming.length === 0 ? (
              <Card>
                <Text size={14} color={t.c.muted}>
                  No upcoming events. Accepted quotations become projects here.
                </Text>
              </Card>
            ) : (
              <Card padded={false} style={{ overflow: 'hidden' }}>
                {upcoming.map((e) => (
                  <ListRow
                    key={e.id}
                    leading={
                      <View style={[styles.dateBox, { backgroundColor: t.c.soft }]}>
                        <Text size={16} weight="extrabold" color={t.c.primary} lineHeight={18}>
                          {e.date.slice(8)}
                        </Text>
                        <Text size={10} weight="bold" color={t.c.primary}>
                          {MONTHS[Number(e.date.slice(5, 7)) - 1].toUpperCase()}
                        </Text>
                      </View>
                    }
                    title={`${e.name} · ${e.project.title}`}
                    subtitle={`${e.startTime} · ${e.venue} · ${e.guests} guests`}
                    onPress={() => router.push({ pathname: '/business/project/[id]', params: { id: e.project.id } })}
                  />
                ))}
              </Card>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerStats: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 18 },
  headerStat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 14, padding: 12 },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  body: { padding: 16, gap: 16 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateBox: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
