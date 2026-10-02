import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, ChoiceChips, EmptyBlock, KButton, KField, KpiCard, Segmented, StackHeader, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { useVendorWorkspace } from '@/hooks/useWorkspace';
import { exportCsv } from '@/services/exporters';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Invoice } from '@/types/platform';
import { addDays, formatMoney, formatMoneyCompact, formatShortDate, today, uid } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

type Tab = 'settlements' | 'invoices' | 'commission';

/** Provider finance: settlements from Vivah, invoices, commission and exports. */
export default function VendorFinance() {
  const t = useRoleTheme();
  const account = useAccount();
  const { payables, bookings } = useVendorWorkspace(account);
  const invoicesAll = useDb((s) => s.invoices);
  const saveInvoice = useDb((s) => s.saveInvoice);
  const [tab, setTab] = useState<Tab>('settlements');
  const [customer, setCustomer] = useState(bookings[0]?.project.customerName ?? '');
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<Invoice['kind']>('deposit');
  const invoices = invoicesAll.filter((i) => i.issuerId === account.id);
  const paid = payables.filter((p) => p.status === 'PAID').reduce((s, p) => s + p.amount, 0);
  const ready = payables.filter((p) => p.status === 'READY').reduce((s, p) => s + p.amount, 0);
  const held = payables.filter((p) => p.status === 'ON_HOLD').reduce((s, p) => s + p.amount, 0);
  const upcoming = payables.filter((p) => p.status === 'ACCRUED').reduce((s, p) => s + p.amount, 0);
  const active = bookings.filter((b) => b.booking.status !== 'CANCELLED');
  const gross = active.reduce((s, b) => s + b.booking.agreedPrice, 0);
  const fees = active.reduce((s, b) => s + b.booking.platformFee, 0);

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title="Finance" subtitle="Settlements, invoices & commission" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        <View style={styles.kpis}>
          <KpiCard label="Paid to you" value={formatMoneyCompact(paid)} icon="checkmark-done-outline" tone={t.c.success} />
          <KpiCard label="Ready for payout" value={formatMoneyCompact(ready)} icon="wallet-outline" />
          <KpiCard label="Upcoming (escrow)" value={formatMoneyCompact(upcoming)} icon="lock-closed-outline" tone={t.c.info} />
          <KpiCard label="On hold" value={formatMoneyCompact(held)} icon="pause-circle-outline" tone={t.c.warning} />
        </View>
        <Segmented
          options={[
            { id: 'settlements', label: 'Settlements' },
            { id: 'invoices', label: 'Invoices' },
            { id: 'commission', label: 'Commission' },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === 'settlements' && (
          <>
            <KButton label="Export CSV" icon="download-outline" variant="ghost" size="sm" onPress={() => exportCsv(payables.map((p) => ({ label: p.label, amount: p.amount, status: p.status, due: p.due, paid: p.paidAt ?? '', reference: p.reference ?? '' })), 'settlements')} />
            {!payables.length && <EmptyBlock icon="wallet-outline" title="No settlements yet" message="Payouts are scheduled when bookings are confirmed: 40% before the event, 60% after completion." />}
            {payables.map((p) => (
              <Card key={p.id} style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text size={14} weight="semibold" color={t.c.textStrong}>
                    {p.label}
                  </Text>
                  <Text size={12} color={t.c.muted}>
                    {p.status === 'PAID' ? `Paid ${formatShortDate(p.paidAt!)} · ${p.reference}` : `Due ${formatShortDate(p.due)}`}
                    {p.holdReason ? ` · ${p.holdReason}` : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text size={15} weight="bold" color={t.c.textStrong}>
                    {formatMoney(p.amount)}
                  </Text>
                  <StatusPill status={p.status} />
                </View>
              </Card>
            ))}
          </>
        )}
        {tab === 'invoices' && (
          <>
            <Card style={{ gap: 10 }}>
              <Text size={15} weight="bold" color={t.c.textStrong}>
                New invoice
              </Text>
              <ChoiceChips options={[...new Set(bookings.map((b) => b.project.customerName))]} selected={[customer]} onToggle={setCustomer} />
              <ChoiceChips options={['deposit', 'instalment', 'balance', 'tax']} selected={[kind]} onToggle={(v) => setKind(v as Invoice['kind'])} />
              <KField label="Amount (incl. VAT)" value={amount} onChangeText={(v) => setAmount(v.replace(/\D/g, ''))} keyboardType="number-pad" prefix="NPR" />
              <KButton
                label="Issue invoice"
                size="sm"
                disabled={!customer || !Number(amount)}
                onPress={() => {
                  const amt = Number(amount);
                  saveInvoice({
                    id: uid('inv'),
                    number: `INV-${(account.businessName ?? 'V').slice(0, 2).toUpperCase()}-${String(invoices.length + 101).padStart(4, '0')}`,
                    issuerId: account.id,
                    issuerName: account.businessName ?? account.name,
                    projectId: bookings.find((b) => b.project.customerName === customer)?.project.id,
                    customerName: customer,
                    kind,
                    amount: amt,
                    vat: Math.round((amt * 0.13) / 1.13),
                    status: 'issued',
                    issuedAt: new Date().toISOString(),
                    dueAt: addDays(today(), 7),
                  });
                  setAmount('');
                  toast('Invoice issued', 'receipt');
                }}
              />
            </Card>
            {invoices.map((i) => (
              <Card key={i.id} style={{ gap: 6 }}>
                <View style={styles.rowBetween}>
                  <Text size={14} weight="bold" color={t.c.textStrong}>
                    {i.number} · {i.customerName}
                  </Text>
                  <StatusPill status={i.status} />
                </View>
                <Text size={12} color={t.c.muted}>
                  {i.kind} · {formatMoney(i.amount)} (VAT {formatMoney(i.vat)}) · due {formatShortDate(i.dueAt)}
                </Text>
                {i.status === 'issued' && <KButton label="Mark paid" size="sm" variant="secondary" onPress={() => saveInvoice({ ...i, status: 'paid' })} />}
              </Card>
            ))}
          </>
        )}
        {tab === 'commission' && (
          <Card style={{ gap: 8 }}>
            <Text size={15} weight="bold" color={t.c.textStrong}>
              Bookings through Vivah
            </Text>
            <Text size={13} color={t.c.muted}>
              Gross {formatMoney(gross)} · platform fees {formatMoney(fees)} ({gross ? Math.round((fees / gross) * 1000) / 10 : 0}%) · net {formatMoney(gross - fees)}
            </Text>
            {active.map(({ project, booking }) => (
              <View key={booking.id} style={styles.rowBetween}>
                <Text size={12} color={t.c.text} style={{ flex: 1 }}>
                  {project.code} · {booking.pricingModel.toLowerCase().replace('_', ' ')}
                </Text>
                <Text size={12} color={t.c.muted}>
                  {formatMoney(booking.agreedPrice)} → {formatMoney(booking.providerPayable)}
                </Text>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
});
