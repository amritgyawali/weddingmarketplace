import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarChart, Card, ChoiceChips, EmptyBlock, KButton, KField, SectionTitle, Segmented, StatusPill } from '@/components/kit';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { useFreelancerWorkspace } from '@/hooks/useWorkspace';
import { exportCsv } from '@/services/exporters';
import { useAccount, useSession } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Account, Payable } from '@/types/platform';
import { formatMoney, formatMoneyCompact, formatShortDate } from '@/utils/format';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const METHODS: { id: NonNullable<Account['payoutMethod']>['kind']; label: string; hint: string }[] = [
  { id: 'esewa', label: 'eSewa', hint: 'eSewa ID (mobile number)' },
  { id: 'khalti', label: 'Khalti', hint: 'Khalti ID (mobile number)' },
  { id: 'bank', label: 'Bank transfer', hint: 'Bank, branch and account number' },
];
const STAGE: Record<Payable['status'], string> = {
  ACCRUED: 'Earned — releases after the event is confirmed',
  READY: 'Approved — in the next payout run',
  ON_HOLD: 'On hold',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
};

type Filter = 'all' | 'pending' | 'paid';

/** Wallet for crew: what's earned, what's releasing next, payout history, method and statements. */
export default function Earnings() {
  const t = useRoleTheme();
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const updateAccount = useSession((s) => s.updateAccount);
  const { payables, upcoming } = useFreelancerWorkspace(account);
  const [filter, setFilter] = useState<Filter>('all');
  const [methodOpen, setMethodOpen] = useState(false);
  const [kind, setKind] = useState(account.payoutMethod?.kind ?? 'esewa');
  const [detail, setDetail] = useState(account.payoutMethod?.detail ?? account.phone);

  const sum = (list: Payable[]) => list.reduce((s, p) => s + p.amount, 0);
  const paid = payables.filter((p) => p.status === 'PAID');
  const ready = payables.filter((p) => p.status === 'READY');
  const accrued = payables.filter((p) => p.status === 'ACCRUED');
  const held = payables.filter((p) => p.status === 'ON_HOLD');
  const bookedAhead = upcoming.reduce((s, x) => s + x.assignment.pay, 0);
  const now = new Date();
  const year = paid.filter((p) => new Date(p.paidAt ?? p.due).getFullYear() === now.getFullYear());

  const chart = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const value = sum(
      paid.filter((p) => {
        const pd = new Date(p.paidAt ?? p.due);
        return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear();
      }),
    );
    return { label: MONTHS[d.getMonth()], value };
  });

  const list = [...payables]
    .filter((p) => p.status !== 'CANCELLED')
    .filter((p) => (filter === 'paid' ? p.status === 'PAID' : filter === 'pending' ? p.status !== 'PAID' : true))
    .sort((a, b) => (b.paidAt ?? b.due).localeCompare(a.paidAt ?? a.due));
  const method = METHODS.find((m) => m.id === account.payoutMethod?.kind);

  const statement = async () => {
    if (!payables.length) return toast('Nothing to export yet');
    try {
      await exportCsv(
        payables.map((p) => ({ job: p.label, amount_npr: p.amount, status: p.status, due: p.due, paid_on: p.paidAt?.slice(0, 10) ?? '', reference: p.reference ?? '' })),
        `vivah-earnings-${account.name.split(' ')[0].toLowerCase()}`,
      );
    } catch {
      toast('Couldn’t export the statement', 'alert-circle');
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.c.bg }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, gap: 16, paddingBottom: 130 }}>
      <View style={styles.head}>
        <Text size={28} weight="bold" color={t.c.textStrong} style={{ flex: 1 }}>
          Earnings
        </Text>
        <KButton label="Statement" icon="download-outline" variant="secondary" size="sm" onPress={statement} />
      </View>

      <LinearGradient colors={t.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.balance}>
        <Text size={13} weight="bold" color={t.c.onPrimary} tracking={1}>
          NEXT PAYOUT
        </Text>
        <Text size={40} weight="bold" color={t.c.onPrimary} lineHeight={46}>
          {formatMoney(sum(ready))}
        </Text>
        <Text size={13} color={t.c.onPrimary}>
          {ready.length ? `${ready.length} job${ready.length > 1 ? 's' : ''} approved · paid within 2 working days` : 'Nothing approved yet — check out after each job'}
        </Text>
        <View style={styles.balanceRow}>
          <View style={styles.pill}>
            <Ionicons name="time-outline" size={14} color={t.c.onPrimary} />
            <Text size={12} weight="bold" color={t.c.onPrimary}>
              {formatMoneyCompact(sum(accrued))} earned, releasing
            </Text>
          </View>
          <View style={styles.pill}>
            <Ionicons name="calendar-outline" size={14} color={t.c.onPrimary} />
            <Text size={12} weight="bold" color={t.c.onPrimary}>
              {formatMoneyCompact(bookedAhead)} booked ahead
            </Text>
          </View>
        </View>
      </LinearGradient>

      {held.length > 0 && (
        <Card style={[styles.alert, { borderColor: t.c.warning }]}>
          <Ionicons name="pause-circle" size={22} color={t.c.warning} />
          <View style={{ flex: 1 }}>
            <Text size={14} weight="bold" color={t.c.textStrong}>
              {formatMoney(sum(held))} on hold
            </Text>
            <Text size={12} color={t.c.muted}>
              {held.map((h) => h.holdReason ?? h.label).join(' · ')}
            </Text>
          </View>
          <KButton label="Ask ops" size="sm" variant="ghost" onPress={() => router.push('/freelancer/inbox')} />
        </Card>
      )}

      <View style={styles.stats}>
        {[
          { label: 'Paid this year', value: formatMoneyCompact(sum(year)) },
          { label: 'Lifetime', value: formatMoneyCompact(sum(paid)) },
          { label: 'Avg per job', value: formatMoneyCompact(paid.length ? Math.round(sum(paid) / paid.length) : 0) },
        ].map((s) => (
          <Card key={s.label} style={styles.stat}>
            <Text size={17} weight="bold" color={t.c.primary}>
              {s.value}
            </Text>
            <Text size={11} color={t.c.muted}>
              {s.label}
            </Text>
          </Card>
        ))}
      </View>

      <Card style={{ gap: 12 }}>
        <Text size={15} weight="bold" color={t.c.textStrong}>
          Paid out, last 6 months
        </Text>
        <BarChart data={chart} format={formatMoneyCompact} />
      </Card>

      <Card style={styles.alert} onPress={() => setMethodOpen(true)}>
        <Ionicons name="wallet-outline" size={22} color={t.c.primary} />
        <View style={{ flex: 1 }}>
          <Text size={14} weight="bold" color={t.c.textStrong}>
            {method ? `Payouts to ${method.label}` : 'Add a payout method'}
          </Text>
          <Text size={12} color={t.c.muted}>
            {account.payoutMethod?.detail ?? 'eSewa, Khalti or any Nepali bank account'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={t.c.muted} />
      </Card>

      <View style={{ gap: 10 }}>
        <SectionTitle title="Payouts" />
        <Segmented
          options={[
            { id: 'all', label: 'All' },
            { id: 'pending', label: 'Pending' },
            { id: 'paid', label: 'Paid' },
          ]}
          value={filter}
          onChange={setFilter}
        />
        {list.length === 0 ? (
          <EmptyBlock icon="wallet-outline" title="No payouts here" message="Check out of a completed job to trigger your payout." />
        ) : (
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {list.map((p, i) => (
              <View key={p.id} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.border }]}>
                <View style={[styles.icon, { backgroundColor: t.c.soft }]}>
                  <Ionicons name={p.status === 'PAID' ? 'arrow-down' : p.status === 'ON_HOLD' ? 'pause' : 'hourglass-outline'} size={18} color={t.c.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text size={14} weight="semibold" color={t.c.textStrong} numberOfLines={1}>
                    {p.label}
                  </Text>
                  <Text size={12} color={t.c.muted} numberOfLines={1}>
                    {p.status === 'PAID' ? `Paid ${formatShortDate(p.paidAt ?? p.due)}${p.reference ? ` · ref ${p.reference}` : ''}` : `${STAGE[p.status]} · due ${formatShortDate(p.due)}`}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text size={15} weight="bold" color={t.c.textStrong}>
                    {formatMoney(p.amount)}
                  </Text>
                  <StatusPill status={p.status} />
                </View>
              </View>
            ))}
          </Card>
        )}
      </View>

      <Sheet visible={methodOpen} onClose={() => setMethodOpen(false)} title="Payout method">
        <View style={{ paddingHorizontal: 20, gap: 14 }}>
          <ChoiceChips options={METHODS.map((m) => m.label)} selected={[METHODS.find((m) => m.id === kind)!.label]} onToggle={(label) => setKind(METHODS.find((m) => m.label === label)!.id)} />
          <KField label={METHODS.find((m) => m.id === kind)!.hint} value={detail} onChangeText={setDetail} />
          <Text size={12} color={t.c.muted}>
            The name on the account must match your verified citizenship. Vivah never asks for your PIN or password.
          </Text>
          <KButton
            label="Save payout method"
            disabled={detail.trim().length < 5}
            onPress={() => {
              updateAccount(account.id, { payoutMethod: { kind, detail: detail.trim() } });
              setMethodOpen(false);
              toast('Payout method saved', 'wallet');
            }}
          />
        </View>
      </Sheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  balance: { borderRadius: 24, padding: 20, gap: 6 },
  balanceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.12)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  alert: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, alignItems: 'center', gap: 2, padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
