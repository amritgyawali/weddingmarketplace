import { StyleSheet, View } from 'react-native';

import { BarChart, Card, KpiCard, ProgressBar, SectionTitle, StackHeader } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { PROVIDERS } from '@/data/providers';
import { useVendorWorkspace } from '@/hooks/useWorkspace';
import { quoteTotals } from '@/services/quotes';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import { formatMoneyCompact } from '@/utils/format';
import { seeded } from '@/utils/random';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Storefront analytics: reach, funnel, speed, reputation and how you compare. */
export default function VendorAnalytics() {
  const t = useRoleTheme();
  const account = useAccount();
  const { leads, quotes, bookings, reviews, listing } = useVendorWorkspace(account);
  const packages = useDb((s) => s.packages).filter((p) => p.providerId === account.listingId);
  const r = seeded(`${account.listingId}-analytics`);
  const impressions = r.int(8_000, 22_000);
  const views = Math.round(impressions * (0.08 + r.next() * 0.06));
  const saves = Math.round(views * 0.12);
  const contacts = Math.round(views * 0.05) + leads.length;
  const won = quotes.filter((q) => q.status === 'accepted').length;
  const sent = quotes.filter((q) => q.status !== 'draft').length;
  const revenue = bookings.filter((b) => b.booking.status !== 'CANCELLED').reduce((s, b) => s + b.booking.providerPayable, 0);
  const peers = PROVIDERS.filter((p) => p.serviceId === listing?.serviceId && p.city === listing?.city && p.id !== listing?.id);
  const peerRating = peers.length ? peers.reduce((s, p) => s + p.rating, 0) / peers.length : 0;
  const peerResponse = peers.length ? peers.reduce((s, p) => s + p.internal.responseMinutes, 0) / peers.length : 0;
  const peerPrice = peers.length ? peers.reduce((s, p) => s + p.startingPrice, 0) / peers.length : 0;
  const trend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - 5 + i, 1);
    return { label: MONTHS[d.getMonth()], value: Math.round(views / 6 + r.int(-60, 120)) };
  });
  const sources = [
    { label: 'Marketplace search', value: leads.filter((l) => l.source === 'marketplace').length },
    { label: 'Vivah coordinators', value: bookings.filter((b) => b.project.managedBy === 'platform').length },
    { label: 'Referrals', value: leads.filter((l) => l.source === 'referral').length },
    { label: 'Social media', value: leads.filter((l) => l.source === 'social').length },
  ];
  const funnel = [
    { label: 'Search impressions', value: impressions },
    { label: 'Profile views', value: views },
    { label: 'Saves', value: saves },
    { label: 'Contacts / leads', value: contacts },
    { label: 'Quotes sent', value: sent },
    { label: 'Bookings', value: won + bookings.filter((b) => b.project.managedBy === 'platform').length },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title="Analytics" subtitle="Last 6 months" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        <View style={styles.kpis}>
          <KpiCard label="Profile views" value={views.toLocaleString('en-US')} icon="eye-outline" delta="+14%" />
          <KpiCard label="Lead → quote" value={`${leads.length ? Math.round((sent / leads.length) * 100) : 0}%`} icon="document-text-outline" tone={t.c.info} />
          <KpiCard label="Quote → booking" value={`${sent ? Math.round((won / sent) * 100) : 0}%`} icon="trophy-outline" tone={t.c.success} />
          <KpiCard label="Booked revenue" value={formatMoneyCompact(revenue)} icon="cash-outline" />
          <KpiCard label="Avg booking" value={formatMoneyCompact(bookings.length ? revenue / bookings.length : 0)} icon="receipt-outline" />
          <KpiCard label="Response time" value={`${listing?.internal.responseMinutes ?? 30} min`} icon="timer-outline" tone={t.c.warning} />
        </View>
        <Card style={{ gap: 10 }}>
          <SectionTitle title="Funnel" />
          {funnel.map((f) => (
            <View key={f.label} style={{ gap: 4 }}>
              <View style={styles.rowBetween}>
                <Text size={13} color={t.c.text}>
                  {f.label}
                </Text>
                <Text size={13} weight="bold" color={t.c.textStrong}>
                  {f.value.toLocaleString('en-US')}
                </Text>
              </View>
              <ProgressBar value={Math.log10(1 + f.value) / Math.log10(1 + impressions)} />
            </View>
          ))}
        </Card>
        <Card style={{ gap: 10 }}>
          <SectionTitle title="Profile views per month" />
          <BarChart data={trend} />
        </Card>
        <Card style={{ gap: 8 }}>
          <SectionTitle title={`You vs ${peers.length} similar in ${listing?.city ?? 'your city'}`} />
          <Compare label="Rating" you={`${(reviews.length ? reviews.reduce((s, x) => s + x.overall, 0) / reviews.length : (listing?.rating ?? 0)).toFixed(1)}★`} them={`${peerRating.toFixed(1)}★`} />
          <Compare label="Response time" you={`${listing?.internal.responseMinutes ?? 0} min`} them={`${Math.round(peerResponse)} min`} />
          <Compare label="Starting price" you={formatMoneyCompact(listing?.startingPrice ?? 0)} them={formatMoneyCompact(peerPrice)} />
          <Compare label="Marketplace rank" you={`#${Math.max(1, peers.filter((p) => p.rating > (listing?.rating ?? 0)).length + 1)}`} them={`of ${peers.length + 1}`} />
        </Card>
        <Card style={{ gap: 8 }}>
          <SectionTitle title="Lead sources" />
          {sources.map((s) => (
            <View key={s.label} style={styles.rowBetween}>
              <Text size={13} color={t.c.text}>
                {s.label}
              </Text>
              <Text size={13} weight="bold" color={t.c.textStrong}>
                {s.value}
              </Text>
            </View>
          ))}
        </Card>
        {packages.length > 0 && (
          <Card style={{ gap: 8 }}>
            <SectionTitle title="Package interest" />
            {packages.map((p, i) => (
              <View key={p.id} style={{ gap: 4 }}>
                <Text size={13} color={t.c.text}>
                  {p.title}
                </Text>
                <ProgressBar value={[0.45, 0.8, 0.3, 0.6][i % 4]} />
              </View>
            ))}
            <Text size={11} color={t.c.muted}>
              Open quotes worth {formatMoneyCompact(quotes.filter((q) => q.status === 'sent' || q.status === 'viewed').reduce((s, q) => s + quoteTotals(q).total, 0))}
            </Text>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

function Compare({ label, you, them }: { label: string; you: string; them: string }) {
  const t = useRoleTheme();
  return (
    <View style={styles.rowBetween}>
      <Text size={13} color={t.c.muted} style={{ flex: 1 }}>
        {label}
      </Text>
      <Text size={13} weight="bold" color={t.c.primary} style={{ width: 90, textAlign: 'right' }}>
        {you}
      </Text>
      <Text size={13} color={t.c.muted} style={{ width: 90, textAlign: 'right' }}>
        {them}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
});
