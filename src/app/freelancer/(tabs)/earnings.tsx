import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarChart, Card, EmptyBlock, SectionTitle, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { useFreelancerWorkspace } from '@/hooks/useWorkspace';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import { formatINR, formatINRCompact, formatShortDate } from '@/utils/format';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function Earnings() {
  const t = useRoleTheme();
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const { payouts, applied } = useFreelancerWorkspace(account);

  const paid = payouts.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const pending = payouts.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
  const upcomingValue = applied
    .filter((g) => g.applications.some((a) => a.freelancerId === account.id && a.status === 'hired'))
    .reduce((s, g) => s + g.pay, 0);

  const now = new Date();
  const chart = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const value = payouts
      .filter((p) => {
        const pd = new Date(p.date);
        return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear();
      })
      .reduce((s, p) => s + p.amount, 0);
    return { label: MONTHS[d.getMonth()], value: value + [12, 18, 9, 22, 15, 0][i] * 1000 };
  });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.c.bg }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, gap: 16, paddingBottom: 130 }}>
      <Text size={28} weight="bold" color={t.c.textStrong}>
        Earnings
      </Text>

      <LinearGradient colors={t.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.balance}>
        <Text size={13} weight="bold" color={t.c.onPrimary} tracking={1}>
          TOTAL PAID OUT
        </Text>
        <Text size={40} weight="bold" color={t.c.onPrimary} lineHeight={46}>
          {formatINR(paid)}
        </Text>
        <View style={styles.balanceRow}>
          <View style={styles.pill}>
            <Ionicons name="time-outline" size={14} color={t.c.onPrimary} />
            <Text size={12} weight="bold" color={t.c.onPrimary}>
              {formatINR(pending)} pending
            </Text>
          </View>
          <View style={styles.pill}>
            <Ionicons name="calendar-outline" size={14} color={t.c.onPrimary} />
            <Text size={12} weight="bold" color={t.c.onPrimary}>
              {formatINRCompact(upcomingValue)} booked ahead
            </Text>
          </View>
        </View>
      </LinearGradient>

      <Card style={{ gap: 12 }}>
        <Text size={15} weight="bold" color={t.c.textStrong}>
          Monthly earnings
        </Text>
        <BarChart data={chart} format={formatINRCompact} />
      </Card>

      <View>
        <SectionTitle title="Payouts" />
        {payouts.length === 0 ? (
          <EmptyBlock icon="wallet-outline" title="No payouts yet" message="Check out of a completed job to trigger your payout." />
        ) : (
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {[...payouts]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((p, i) => (
                <View key={p.id} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.border }]}>
                  <View style={[styles.icon, { backgroundColor: t.c.soft }]}>
                    <Ionicons name={p.status === 'paid' ? 'arrow-down' : 'hourglass-outline'} size={18} color={t.c.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text size={14} weight="semibold" color={t.c.textStrong} numberOfLines={1}>
                      {p.title}
                    </Text>
                    <Text size={12} color={t.c.muted}>
                      {formatShortDate(p.date)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text size={15} weight="bold" color={t.c.textStrong}>
                      {formatINR(p.amount)}
                    </Text>
                    <StatusPill status={p.status} />
                  </View>
                </View>
              ))}
          </Card>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  balance: { borderRadius: 24, padding: 20, gap: 6 },
  balanceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.12)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
