import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, BarChart, Card, KButton, KpiCard, RoleHeader, SectionTitle, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { RiskList } from '@/components/work/Collab';
import { STATUS_LABEL } from '@/components/work/Pipeline';
import { TodayFocus } from '@/components/work/TodayFocus';
import { serviceName } from '@/data/services';
import { useExperience } from '@/hooks/useExperience';
import { useLayout } from '@/hooks/useLayout';
import { can } from '@/services/experience';
import { milestoneStatus } from '@/services/pricing';
import { quoteTotals } from '@/services/quotes';
import { projectRisks } from '@/services/risk';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Project } from '@/types/platform';
import { addDays, daysUntil, formatDateAlt, formatLongDate, formatMoneyCompact, formatShortDate, today } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Per-service status line for the operations calendar ("Catering: Missing"). */
function ServiceStatusLine({ project }: { project: Project }) {
  const t = useRoleTheme();
  return (
    <View style={styles.serviceLine}>
      {project.requirements
        .filter((r) => r.status !== 'CANCELLED')
        .map((r) => {
          const b = project.bookings.find((x) => x.requirementId === r.id && x.status !== 'CANCELLED');
          const ok = b && (b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS' || b.status === 'COMPLETED');
          return (
            <View key={r.id} style={[styles.svc, { backgroundColor: ok ? `${t.c.success}14` : b ? `${t.c.warning}1A` : `${t.c.danger}14` }]}>
              <Text size={11} weight="semibold" color={ok ? t.c.success : b ? t.c.warning : t.c.danger}>
                {serviceName(r.serviceId).split(' ')[0]}: {ok ? 'Confirmed' : b ? 'Pending' : 'Missing'}
              </Text>
            </View>
          );
        })}
    </View>
  );
}

export default function PlatformToday() {
  const t = useRoleTheme();
  const account = useAccount();
  const { columns } = useLayout();
  const projects = useDb((s) => s.projects);
  const quotes = useDb((s) => s.quotes);
  const gigs = useDb((s) => s.gigs);
  const revenue = useDb((s) => s.revenue);
  const assign = useDb((s) => s.assignCoordinator);
  const exp = useExperience();

  const now = today();
  const active = projects.filter((p) => !['COMPLETED', 'CLOSED', 'CANCELLED', 'QUOTE_REJECTED'].includes(p.status));
  const todayEvents = projects.flatMap((p) => p.events.filter((e) => e.date === now && e.status !== 'cancelled').map((e) => ({ e, p })));
  const todayAssignments = projects.flatMap((p) => p.bookings.flatMap((b) => b.assignments.filter((a) => a.date === now && a.status !== 'CANCELLED')));
  const pendingConfirmations = projects.flatMap((p) => p.bookings.filter((b) => (b.status === 'PROPOSED' || b.status === 'HELD') && b.providerResponse === 'pending'));
  const overdue = projects.flatMap((p) => p.milestones.filter((m) => milestoneStatus(m) === 'OVERDUE'));
  const risks = active.flatMap((p) => projectRisks(p, { gigs, quotes }));
  const highRisk = new Set(risks.filter((r) => r.severity === 'high').map((r) => r.projectId));
  const unfilled = gigs.filter((g) => g.status === 'open' && daysUntil(g.date) >= 0 && daysUntil(g.date) <= 7);
  const newLeads = projects.filter((p) => p.status === 'NEW' || (p.status === 'REVIEWING' && !p.coordinatorId));
  const mine = active.filter((p) => p.coordinatorId === account.id).sort((a, b) => a.weddingDate.localeCompare(b.weddingDate));

  const gmv = projects.flatMap((p) => p.bookings).filter((b) => b.status !== 'CANCELLED' && b.status !== 'PROPOSED').reduce((s, b) => s + b.agreedPrice, 0);
  const rev = revenue.reduce((s, r) => s + r.amount, 0);
  const decided = quotes.filter((q) => q.status === 'accepted' || q.status === 'declined');
  const conversion = decided.length ? Math.round((decided.filter((q) => q.status === 'accepted').length / decided.length) * 100) : 0;
  const chart = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - 5 + i, 1);
    const real = revenue.filter((r) => new Date(r.at).getMonth() === d.getMonth() && new Date(r.at).getFullYear() === d.getFullYear()).reduce((s, r) => s + r.amount, 0);
    return { label: MONTHS[d.getMonth()], value: real + [180, 240, 210, 320, 290, 0][i] * 1000 };
  });
  const week = Array.from({ length: 7 }, (_, i) => addDays(now, i)).map((date) => ({
    date,
    items: projects.flatMap((p) => p.events.filter((e) => e.date === date && e.status !== 'cancelled').map((e) => ({ p, e }))),
  }));

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <RoleHeader eyebrow={`${formatLongDate(now)} · ${formatDateAlt(now)}`} title={`Namaste, ${account.name.split(' ')[0]}`} subtitle={`${account.team ?? 'Operations'} · ${active.length} active projects`} />
      <ScrollView contentContainerStyle={{ padding: 14, gap: 16, paddingBottom: 40 }}>
        <TodayFocus />
        <View>
          <SectionTitle title="Today" />
          <View style={styles.kpis}>
            <KpiCard label="Weddings today" value={String(new Set(todayEvents.map((x) => x.p.id)).size)} icon="heart-outline" onPress={() => router.navigate('/platform/execution')} style={{ minWidth: columns > 1 ? '15%' : '46%' }} />
            <KpiCard label="Crew assignments" value={String(todayAssignments.length)} icon="people-outline" style={{ minWidth: columns > 1 ? '15%' : '46%' }} />
            <KpiCard label="Pending confirmations" value={String(pendingConfirmations.length)} icon="hourglass-outline" tone={t.c.warning} style={{ minWidth: columns > 1 ? '15%' : '46%' }} />
            <KpiCard label="Payments overdue" value={String(overdue.length)} icon="card-outline" tone={t.c.danger} onPress={() => router.push('/platform/finance')} style={{ minWidth: columns > 1 ? '15%' : '46%' }} />
            <KpiCard label="High-risk projects" value={String(highRisk.size)} icon="warning-outline" tone={t.c.danger} style={{ minWidth: columns > 1 ? '15%' : '46%' }} />
            <KpiCard label="Gigs unfilled (7d)" value={String(unfilled.length)} icon="megaphone-outline" tone={t.c.info} onPress={() => router.push('/platform/gigs')} style={{ minWidth: columns > 1 ? '15%' : '46%' }} />
          </View>
        </View>

        {todayEvents.length > 0 && (
          <Card onPress={() => router.navigate('/platform/execution')} style={[styles.row, { borderLeftColor: t.c.danger, borderLeftWidth: 3 }]}>
            <View style={[styles.liveDot, { backgroundColor: t.c.danger }]} />
            <View style={{ flex: 1 }}>
              <Text size={14} weight="bold" color={t.c.textStrong}>
                {todayEvents.length} function{todayEvents.length > 1 ? 's' : ''} today
              </Text>
              <Text size={12} color={t.c.muted} numberOfLines={1}>
                {todayEvents.map(({ e, p }) => `${p.code} ${e.name}`).join(' · ')}
              </Text>
            </View>
            <Text size={13} weight="semibold" color={t.c.danger}>
              Open control room
            </Text>
          </Card>
        )}

        <View style={[styles.cols, columns > 1 && { flexDirection: 'row' }]}>
          <View style={{ flex: 1, gap: 16 }}>
            <View>
              <SectionTitle title={`Risk alerts (${risks.length})`} />
              <RiskList risks={risks} limit={8} onPress={(r) => router.push({ pathname: '/platform/project/[id]', params: { id: r.projectId } })} />
            </View>
            {newLeads.length > 0 && can(exp, 'project.manage') && (
              <View>
                <SectionTitle title="New wedding leads" action="Pipeline" onAction={() => router.navigate('/platform/leads')} />
                <View style={{ gap: 8 }}>
                  {newLeads.map((p) => (
                    <Card key={p.id} style={{ gap: 8 }}>
                      {/* Row and claim button are siblings: a pressable card around a button nests <button>s on web. */}
                      <Pressable onPress={() => router.push({ pathname: '/platform/project/[id]', params: { id: p.id } })} accessibilityRole="button" style={styles.row}>
                        <Avatar name={p.customerName} />
                        <View style={{ flex: 1 }}>
                          <Text size={15} weight="semibold" color={t.c.textStrong}>
                            {p.title}
                          </Text>
                          <Text size={12} color={t.c.muted}>
                            {p.city} · {p.guests} guests · {p.requirements.length} services · {p.budget ? formatMoneyCompact(p.budget) : 'budget TBC'}
                          </Text>
                        </View>
                        <StatusPill status={p.status} />
                      </Pressable>
                      {!p.coordinatorId && (
                        <KButton
                          label="Claim: I’ll coordinate this"
                          size="sm"
                          icon="hand-right-outline"
                          onPress={() => {
                            const err = assign(p.id, { id: account.id, name: account.name });
                            toast(err ?? `You own ${p.code}`);
                          }}
                        />
                      )}
                    </Card>
                  ))}
                </View>
              </View>
            )}
          </View>
          <View style={{ flex: 1, gap: 16 }}>
            <View>
              <SectionTitle title="Next 7 days" action="Calendar" onAction={() => router.push('/platform/calendar')} />
              <View style={{ gap: 8 }}>
                {week
                  .filter((d) => d.items.length)
                  .map((d) => (
                    <Card key={d.date} style={{ gap: 8 }}>
                      <Text size={13} weight="semibold" color={t.c.muted}>
                        {formatShortDate(d.date)}{d.date === now ? ' · Today' : ''}
                      </Text>
                      {d.items.map(({ p, e }) => (
                        <Pressable key={e.id} onPress={() => router.push({ pathname: '/platform/project/[id]', params: { id: p.id } })} style={{ gap: 4 }}>
                          <Text size={14} weight="semibold" color={t.c.textStrong}>
                            {p.code} · {p.title}, {e.name}
                          </Text>
                          <Text size={12} color={t.c.muted}>
                            {e.venue} · {e.guests} guests · {STATUS_LABEL[p.status]}
                          </Text>
                          <ServiceStatusLine project={p} />
                        </Pressable>
                      ))}
                    </Card>
                  ))}
                {!week.some((d) => d.items.length) && (
                  <Text size={13} color={t.c.muted}>
                    No functions this week.
                  </Text>
                )}
              </View>
            </View>
            {mine.length > 0 && (
              <View>
                <SectionTitle title="My projects" action="All" onAction={() => router.navigate('/platform/weddings')} />
                <Card padded={false} style={{ overflow: 'hidden' }}>
                  {mine.slice(0, 6).map((p, i) => (
                    <Pressable key={p.id} onPress={() => router.push({ pathname: '/platform/project/[id]', params: { id: p.id } })} style={[styles.mineRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text size={14} weight="semibold" color={t.c.textStrong}>
                          {p.code} · {p.title}
                        </Text>
                        <Text size={12} color={t.c.muted}>
                          {formatShortDate(p.weddingDate)} · {daysUntil(p.weddingDate)}d
                        </Text>
                      </View>
                      {highRisk.has(p.id) && <Ionicons name="warning" size={16} color={t.c.danger} />}
                      <StatusPill status={p.status} />
                    </Pressable>
                  ))}
                </Card>
              </View>
            )}
          </View>
        </View>

        {(can(exp, 'audit.view') || can(exp, 'settings.edit')) && (
        <View>
          <SectionTitle title="Business" action="Analytics" onAction={() => router.push('/platform/analytics')} />
          <View style={styles.kpis}>
            <KpiCard label="Booked GMV" value={formatMoneyCompact(gmv)} icon="trending-up-outline" delta="+18%" style={{ minWidth: columns > 1 ? '22%' : '46%' }} />
            <KpiCard label="Platform revenue" value={formatMoneyCompact(rev)} icon="cash-outline" tone={t.c.success} style={{ minWidth: columns > 1 ? '22%' : '46%' }} />
            <KpiCard label="Quote conversion" value={`${conversion}%`} icon="document-text-outline" tone={t.c.info} onPress={() => router.push('/platform/quotes')} style={{ minWidth: columns > 1 ? '22%' : '46%' }} />
            <KpiCard label="Open quote value" value={formatMoneyCompact(quotes.filter((q) => q.status === 'sent' || q.status === 'viewed').reduce((s, q) => s + quoteTotals(q).total, 0))} icon="hourglass-outline" tone={t.c.warning} style={{ minWidth: columns > 1 ? '22%' : '46%' }} />
          </View>
          <Card style={{ gap: 10, marginTop: 10 }}>
            <Text size={15} weight="bold" color={t.c.textStrong}>
              Revenue · last 6 months
            </Text>
            <BarChart data={chart} format={formatMoneyCompact} />
          </Card>
        </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  cols: { gap: 16 },
  serviceLine: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  svc: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  mineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
});
