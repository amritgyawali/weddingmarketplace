import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { BarChart, Card, KButton, KpiCard, ListRow, QuickAction, RoleHeader, SectionTitle, StatusPill } from '@/components/kit';
import { SetupChecklist } from '@/components/persona/SetupChecklist';
import { SocialHomeCard } from '@/components/social/HomeCard';
import { toolHref, useVisibleTools } from '@/components/toolkit/hub';
import { VENDOR_TOOLS } from '@/components/toolkit/vendor';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { crewFill } from '@/components/work/Bookings';
import { serviceName } from '@/data/services';
import { useExperience } from '@/hooks/useExperience';
import { useLinkOn } from '@/hooks/useFeatures';
import { useLayout } from '@/hooks/useLayout';
import { useVendorWorkspace } from '@/hooks/useWorkspace';
import { has } from '@/services/experience';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import { daysUntil, formatMoney, formatMoneyCompact, formatShortDate } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function VendorDashboard() {
  const t = useRoleTheme();
  const { columns } = useLayout();
  const linkOn = useLinkOn();
  const account = useAccount();
  const { leads, quotes, bookings, requests, payables, reviews, listing } = useVendorWorkspace(account);
  const respond = useDb((s) => s.respondToBooking);
  const exp = useExperience();
  /** The first trade tool (menu, themes, gallery…) earns a quick action. */
  const tradeTool = useVisibleTools(VENDOR_TOOLS).find((x) => !['Couples and enquiries', 'Sales and pricing', 'Money', 'Operations'].includes(x.group));

  const active = bookings.filter(({ booking }) => booking.status !== 'CANCELLED' && booking.providerResponse !== 'pending');
  const upcoming = active
    .flatMap(({ project, booking }) => project.events.filter((e) => booking.eventIds.includes(e.id) && e.date && daysUntil(e.date) >= 0).map((e) => ({ project, booking, e })))
    .sort((a, b) => (a.e.date ?? '').localeCompare(b.e.date ?? ''))
    .slice(0, 5);
  const newLeads = leads.filter((l) => l.status === 'new');
  const openQuotes = quotes.filter((q) => q.status === 'sent' || q.status === 'viewed' || q.status === 'revision');
  const payoutReady = payables.filter((p) => p.status === 'READY').reduce((s, p) => s + p.amount, 0);
  const earned = payables.filter((p) => p.status === 'PAID').reduce((s, p) => s + p.amount, 0);
  const pipeline = payables.filter((p) => p.status === 'ACCRUED' || p.status === 'READY').reduce((s, p) => s + p.amount, 0);
  const crewGaps = active.filter(({ booking }) => booking.crew.some((c) => c.staffing === 'marketplace') && crewFill(booking).filled < crewFill(booking).needed);
  const dueDeliverables = active.flatMap(({ project, booking }) => booking.deliverables.filter((d) => d.status !== 'DELIVERED' && d.status !== 'APPROVED' && daysUntil(d.due) <= 14).map((d) => ({ project, booking, d })));
  const decided = quotes.filter((q) => q.status === 'accepted' || q.status === 'declined').length;
  const conversion = decided ? Math.round((quotes.filter((q) => q.status === 'accepted').length / decided) * 100) : 0;
  const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.overall, 0) / reviews.length : (listing?.rating ?? 0);

  const chart = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - 5 + i, 1);
    const real = active.filter(({ booking }) => booking.confirmedAt && new Date(booking.confirmedAt).getMonth() === d.getMonth()).reduce((s, x) => s + x.booking.providerPayable, 0);
    return { label: MONTHS[d.getMonth()], value: real + [4, 6, 5, 9, 7, 3][i] * 100_000 };
  });

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <RoleHeader title={account.businessName ?? account.name} subtitle={`${exp.primaryService ? serviceName(exp.primaryService) : listing ? serviceName(listing.serviceId) : 'Vendor'} · ${account.city}`}>
          <View style={styles.headerStats}>
            <View style={styles.headerStat}>
              <Text size={17} weight="semibold" color={t.c.textStrong}>
                {formatMoneyCompact(pipeline)}
              </Text>
              <Text size={12} color={t.c.muted}>
                Payouts due
              </Text>
            </View>
            <View style={[styles.headerStat, styles.headerDivider, { borderLeftColor: t.c.border }]}>
              <Text size={17} weight="semibold" color={t.c.textStrong}>
                {avgRating.toFixed(1)}
              </Text>
              <Text size={12} color={t.c.muted}>
                Rating
              </Text>
            </View>
            <View style={[styles.headerStat, styles.headerDivider, { borderLeftColor: t.c.border }]}>
              <Text size={17} weight="semibold" color={t.c.textStrong}>
                {conversion}%
              </Text>
              <Text size={12} color={t.c.muted}>
                Quotes won
              </Text>
            </View>
            <View style={styles.verified}>
              <Ionicons name={account.verified ? 'checkmark-circle' : 'time-outline'} size={15} color={account.verified ? t.c.success : t.c.warning} />
              <Text size={13} weight="medium" color={account.verified ? t.c.success : t.c.warning}>
                {account.verified ? 'Verified' : 'In review'}
              </Text>
            </View>
          </View>
        </RoleHeader>

        <View style={styles.body}>
          <SetupChecklist />
          {requests.length > 0 && (
            <View>
              <SectionTitle title={`Booking requests from Vivah (${requests.length})`} />
              <View style={{ gap: 10 }}>
                {requests.map(({ project, booking }) => (
                  <Card key={booking.id} style={{ gap: 10, borderLeftColor: t.c.primary, borderLeftWidth: 3 }}>
                    <View style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <Text size={12} color={t.c.muted}>
                          {serviceName(booking.serviceId)} · {project.code}
                        </Text>
                        <Text size={16} weight="bold" color={t.c.textStrong}>
                          {project.title}
                        </Text>
                        <Text size={12} color={t.c.muted}>
                          {project.events.filter((e) => booking.eventIds.includes(e.id)).map((e) => `${e.name} ${e.date ? formatShortDate(e.date) : 'TBC'}`).join(' · ')} · {project.guests} guests
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text size={11} color={t.c.muted}>
                          You receive
                        </Text>
                        <Text size={16} weight="bold" color={t.c.textStrong}>
                          {formatMoney(booking.providerPayable)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.row}>
                      <KButton label="Decline" size="sm" variant="danger" style={{ flex: 1 }} onPress={() => { respond(project.id, booking.id, false, 'Not available'); toast('Declined'); }} />
                      <KButton label="Details" size="sm" variant="secondary" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/business/booking/[id]', params: { id: booking.id } })} />
                      <KButton label="Accept" size="sm" icon="checkmark" style={{ flex: 1.2 }} onPress={() => { respond(project.id, booking.id, true); toast('Availability confirmed'); }} />
                    </View>
                  </Card>
                ))}
              </View>
            </View>
          )}

          <View style={styles.kpis}>
            <KpiCard label="New leads" value={String(newLeads.length)} icon="flash-outline" delta={newLeads.length ? `+${newLeads.length}` : undefined} onPress={() => router.navigate('/business/leads')} style={{ minWidth: columns > 1 ? '22%' : '46%' }} />
            <KpiCard label="Quotes in play" value={String(openQuotes.length)} icon="document-text-outline" tone={t.c.warning} onPress={() => router.push('/business/quotes')} style={{ minWidth: columns > 1 ? '22%' : '46%' }} />
            <KpiCard label="Active bookings" value={String(active.filter(({ booking }) => booking.status !== 'COMPLETED').length)} icon="briefcase-outline" tone={t.c.info} onPress={() => router.navigate('/business/bookings')} style={{ minWidth: columns > 1 ? '22%' : '46%' }} />
            <KpiCard label="Payout ready" value={formatMoneyCompact(payoutReady)} icon="wallet-outline" tone={t.c.success} onPress={() => router.push('/business/finance')} style={{ minWidth: columns > 1 ? '22%' : '46%' }} />
          </View>

          <Card style={{ flexDirection: 'row', paddingVertical: 14 }}>
            <QuickAction icon="add-circle-outline" label="New quote" onPress={() => router.navigate('/business/leads')} />
            {has(exp, 'team.hire_crew') ? (
              <QuickAction icon="megaphone-outline" label="Hire crew" onPress={() => router.push('/business/gig/new')} />
            ) : (
              tradeTool && <QuickAction icon={tradeTool.icon} label={tradeTool.title} onPress={() => router.push(toolHref('vendor', tradeTool.id))} />
            )}
            <QuickAction icon="calendar-outline" label="Availability" onPress={() => router.navigate('/business/calendar')} />
            <QuickAction icon="pricetags-outline" label="Packages" onPress={() => router.push('/business/packages')} />
            {linkOn('/business/promotions') && <QuickAction icon="rocket-outline" label="Promote" onPress={() => router.push('/business/promotions')} />}
          </Card>

          <SocialHomeCard />

          {(crewGaps.length > 0 || dueDeliverables.length > 0) && (
            <View>
              <SectionTitle title="Needs your attention" />
              <Card padded={false} style={{ overflow: 'hidden' }}>
                {crewGaps.map(({ project, booking }) => (
                  <ListRow key={booking.id} icon="people-outline" title={`Crew missing · ${project.title}`} subtitle={`${crewFill(booking).filled}/${crewFill(booking).needed} assigned · ${formatShortDate(project.weddingDate)}`} trailing={<StatusPill status="pending" label="Staff" />} onPress={() => router.push({ pathname: '/business/booking/[id]', params: { id: booking.id } })} />
                ))}
                {dueDeliverables.map(({ project, booking, d }) => (
                  <ListRow key={d.id} icon="cloud-upload-outline" title={`${d.title} · ${project.title}`} subtitle={`Due ${formatShortDate(d.due)} · ${Math.round(d.progress * 100)}% done`} trailing={<StatusPill status={d.status} />} onPress={() => router.push({ pathname: '/business/booking/[id]', params: { id: booking.id } })} />
                ))}
              </Card>
            </View>
          )}

          <View>
            <SectionTitle title="Upcoming functions" action="All bookings" onAction={() => router.navigate('/business/bookings')} />
            {upcoming.length === 0 ? (
              <Card>
                <Text size={14} color={t.c.muted}>
                  No upcoming functions. Accepted bookings appear here.
                </Text>
              </Card>
            ) : (
              <Card padded={false} style={{ overflow: 'hidden' }}>
                {upcoming.map(({ project, booking, e }) => (
                  <ListRow
                    key={`${booking.id}-${e.id}`}
                    leading={
                      <View style={[styles.dateBox, { borderColor: t.c.border }]}>
                        <Text size={11} color={t.c.muted} lineHeight={13}>
                          {MONTHS[Number(e.date!.slice(5, 7)) - 1]}
                        </Text>
                        <Text size={18} weight="semibold" color={t.c.textStrong} lineHeight={22}>
                          {e.date!.slice(8)}
                        </Text>
                      </View>
                    }
                    title={`${e.name} · ${project.title}`}
                    subtitle={`${e.startTime} · ${e.venue} · ${e.guests} guests`}
                    onPress={() => router.push({ pathname: '/business/booking/[id]', params: { id: booking.id } })}
                  />
                ))}
              </Card>
            )}
          </View>

          <Card style={{ gap: 12 }}>
            <View style={styles.rowBetween}>
              <View>
                <Text size={15} weight="bold" color={t.c.textStrong}>
                  Earnings
                </Text>
                <Text size={12} color={t.c.muted}>
                  {formatMoney(earned)} paid out so far
                </Text>
              </View>
              <KButton label="Finance" size="sm" variant="ghost" onPress={() => router.push('/business/finance')} />
            </View>
            <BarChart data={chart} format={formatMoneyCompact} />
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerStats: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  headerStat: { paddingRight: 16 },
  headerDivider: { borderLeftWidth: StyleSheet.hairlineWidth, paddingLeft: 16 },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  body: { padding: 16, gap: 16 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateBox: { width: 44, height: 46, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
