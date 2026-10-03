import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { staffScreen } from '@/components/persona/StaffGate';
import { BarChart, Card, ChoiceChips, EmptyBlock, KButton, KField, KpiCard, ProgressBar, Segmented, StackHeader, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { PAYMENT_METHODS } from '@/components/work/Payments';
import { exportCsv } from '@/services/exporters';
import { milestoneStatus, releasable } from '@/services/pricing';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Dispute, RevenueKind } from '@/types/platform';
import { formatMoney, formatMoneyCompact, formatShortDate, timeAgo } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

type Tab = 'overview' | 'payments' | 'payables' | 'revenue' | 'refunds' | 'disputes';

const REVENUE_LABEL: Record<RevenueKind, string> = {
  COMMISSION: 'Commission (A)',
  MARKUP: 'Markup (B)',
  LEAD_FEE: 'Lead fees (C)',
  FREELANCER_MARGIN: 'Freelancer margin (D)',
  SERVICE_FEE: 'Service fees (net of discounts)',
  SUBSCRIPTION: 'Provider subscriptions',
  FEATURED: 'Featured listings',
  EMERGENCY_FEE: 'Emergency coordination',
};

function DisputeCard({ d }: { d: Dispute }) {
  const t = useRoleTheme();
  const update = useDb((s) => s.updateDispute);
  const [note, setNote] = useState('');
  return (
    <Card style={{ gap: 8 }}>
      <View style={styles.rowBetween}>
        <Text size={14} weight="bold" color={t.c.textStrong} style={{ flex: 1 }}>
          {d.raisedByName} vs {d.against}
        </Text>
        <StatusPill status={d.status} />
      </View>
      <Text size={13} color={t.c.text}>
        {d.reason}
      </Text>
      <Text size={12} color={t.c.muted}>
        {d.amount ? `${formatMoney(d.amount)} in question · ` : ''}
        {d.paymentFrozen ? 'Settlement frozen' : 'Settlement not frozen'} · {timeAgo(d.at)}
      </Text>
      {d.log.map((l, i) => (
        <Text key={i} size={11} color={t.c.muted}>
          {formatShortDate(l.at)} · {l.by}: {l.text}
        </Text>
      ))}
      {d.status !== 'RESOLVED' && d.status !== 'REJECTED' && (
        <>
          <KField placeholder="Resolution note" value={note} onChangeText={setNote} />
          <View style={styles.row}>
            {d.status === 'OPEN' && <KButton label="Investigate" size="sm" variant="secondary" style={{ flex: 1 }} onPress={() => { const err = update(d.id, 'INVESTIGATING', note.trim() || 'Investigating with both parties'); if (err) toast(err, 'alert-circle'); }} />}
            <KButton label="Reject" size="sm" variant="ghost" style={{ flex: 1 }} onPress={() => { const err = update(d.id, 'REJECTED', note.trim() || 'Rejected', { unfreeze: true }); if (err) toast(err, 'alert-circle'); }} />
            <KButton label="Resolve & release" size="sm" variant="success" style={{ flex: 1.3 }} onPress={() => { const err = update(d.id, 'RESOLVED', note.trim() || 'Resolved', { resolution: note.trim(), unfreeze: true }); if (err) toast(err, 'alert-circle'); }} />
          </View>
        </>
      )}
    </Card>
  );
}

/** Finance: customer money in, escrow, payouts out and platform revenue by business model. */
function Finance() {
  const t = useRoleTheme();
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const [tab, setTab] = useState<Tab>(params.tab ?? 'overview');
  const [payableFilter, setPayableFilter] = useState('Ready');
  const projects = useDb((s) => s.projects);
  const payments = useDb((s) => s.payments);
  const payables = useDb((s) => s.payables);
  const revenue = useDb((s) => s.revenue);
  const refunds = useDb((s) => s.refunds);
  const disputes = useDb((s) => s.disputes);
  const release = useDb((s) => s.releasePayable);
  const hold = useDb((s) => s.holdPayable);
  const markReady = useDb((s) => s.markPayableReady);
  const decideRefund = useDb((s) => s.decideRefund);

  const collected = payments.filter((p) => p.status !== 'FAILED' && p.status !== 'PENDING').reduce((s, p) => s + p.amount - p.refunded, 0);
  const paidOut = payables.filter((p) => p.status === 'PAID').reduce((s, p) => s + p.amount, 0);
  const ready = payables.filter((p) => p.status === 'READY' || (p.status === 'ACCRUED' && releasable(p, projects.find((x) => x.id === p.projectId))));
  const outstanding = projects.flatMap((p) => p.milestones).reduce((s, m) => s + (m.status === 'WAIVED' ? 0 : m.amount - m.paidAmount), 0);
  const overdue = projects.flatMap((p) => p.milestones.filter((m) => milestoneStatus(m) === 'OVERDUE').map((m) => ({ p, m })));
  const byKind = (Object.keys(REVENUE_LABEL) as RevenueKind[]).map((k) => ({ kind: k, value: revenue.filter((r) => r.kind === k).reduce((s, r) => s + r.amount, 0) }));
  const totalRev = byKind.reduce((s, x) => s + x.value, 0);
  const payableList = payables
    .filter((p) => (payableFilter === 'Ready' ? ready.includes(p) : payableFilter === 'Accrued' ? p.status === 'ACCRUED' && !ready.includes(p) : payableFilter === 'On hold' ? p.status === 'ON_HOLD' : payableFilter === 'Paid' ? p.status === 'PAID' : true))
    .sort((a, b) => a.due.localeCompare(b.due));

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title="Finance" subtitle="Payments, escrow, payouts & revenue" />
      <View style={{ paddingTop: 12 }}>
        <Segmented
          options={[
            { id: 'overview', label: 'Overview' },
            { id: 'payments', label: 'Payments in' },
            { id: 'payables', label: 'Payouts' },
            { id: 'revenue', label: 'Revenue' },
            { id: 'refunds', label: 'Refunds' },
            { id: 'disputes', label: 'Disputes' },
          ]}
          value={tab}
          onChange={setTab}
          counts={{ payables: ready.length || undefined, refunds: refunds.filter((r) => r.status === 'REQUESTED').length || undefined, disputes: disputes.filter((d) => d.status === 'OPEN' || d.status === 'INVESTIGATING').length || undefined }}
        />
      </View>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 40 }}>
        {tab === 'overview' && (
          <>
            <View style={styles.kpis}>
              <KpiCard label="Collected from customers" value={formatMoneyCompact(collected)} icon="arrow-down-circle-outline" tone={t.c.success} />
              <KpiCard label="Paid out" value={formatMoneyCompact(paidOut)} icon="arrow-up-circle-outline" />
              <KpiCard label="Escrow balance" value={formatMoneyCompact(collected - paidOut)} icon="lock-closed-outline" tone={t.c.info} />
              <KpiCard label="Outstanding receivables" value={formatMoneyCompact(outstanding)} icon="hourglass-outline" tone={t.c.warning} />
              <KpiCard label="Payouts ready" value={`${ready.length} · ${formatMoneyCompact(ready.reduce((s, p) => s + p.amount, 0))}`} icon="wallet-outline" onPress={() => setTab('payables')} />
              <KpiCard label="Platform revenue" value={formatMoneyCompact(totalRev)} icon="cash-outline" tone={t.c.success} onPress={() => setTab('revenue')} />
            </View>
            {overdue.length > 0 && (
              <Card style={{ gap: 6, borderColor: t.c.danger }}>
                <Text size={14} weight="bold" color={t.c.danger}>
                  Overdue customer payments
                </Text>
                {overdue.map(({ p, m }) => (
                  <Text key={m.id} size={13} color={t.c.text} onPress={() => router.push({ pathname: '/platform/project/[id]', params: { id: p.id, tab: 'payments' } })}>
                    {p.code} · {m.label} · {formatMoney(m.amount - m.paidAmount)} · due {formatShortDate(m.due)}
                  </Text>
                ))}
              </Card>
            )}
            <Card style={{ gap: 10 }}>
              <Text size={15} weight="bold" color={t.c.textStrong}>
                Revenue by business model
              </Text>
              <BarChart data={byKind.filter((x) => x.value).map((x) => ({ label: x.kind.slice(0, 5), value: x.value }))} format={formatMoneyCompact} />
            </Card>
          </>
        )}

        {tab === 'payments' && (
          <>
            <KButton label="Export CSV" icon="download-outline" variant="ghost" size="sm" onPress={() => exportCsv(payments.map((p) => ({ receipt: p.receiptNo, project: projects.find((x) => x.id === p.projectId)?.code ?? '', payer: p.payerName, method: p.method, amount: p.amount, refunded: p.refunded, status: p.status, reference: p.reference, date: p.at })), 'vivah-payments')} />
            {payments.map((p) => (
              <Card key={p.id} style={styles.rowBetween}>
                <View style={[styles.method, { backgroundColor: PAYMENT_METHODS.find((m) => m.id === p.method)?.color ?? t.c.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text size={14} weight="semibold" color={t.c.textStrong}>
                    {formatMoney(p.amount)} · {p.payerName}
                  </Text>
                  <Text size={12} color={t.c.muted}>
                    {projects.find((x) => x.id === p.projectId)?.code} · {PAYMENT_METHODS.find((m) => m.id === p.method)?.label} · {p.reference} · {formatShortDate(p.at)}
                  </Text>
                </View>
                <StatusPill status={p.status} />
              </Card>
            ))}
          </>
        )}

        {tab === 'payables' && (
          <>
            <ChoiceChips options={['Ready', 'Accrued', 'On hold', 'Paid', 'All']} selected={[payableFilter]} onToggle={setPayableFilter} />
            {!payableList.length && <EmptyBlock icon="wallet-outline" title="Nothing here" />}
            {payableList.map((p) => (
              <Card key={p.id} style={{ gap: 8 }}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text size={14} weight="semibold" color={t.c.textStrong}>
                      {p.payeeName}
                    </Text>
                    <Text size={12} color={t.c.muted}>
                      {p.label} · {p.payeeKind} · due {formatShortDate(p.due)}
                      {p.holdReason ? ` · ${p.holdReason}` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text size={15} weight="bold" color={t.c.textStrong}>
                      {formatMoney(p.amount)}
                    </Text>
                    <StatusPill status={ready.includes(p) ? 'READY' : p.status} />
                  </View>
                </View>
                {p.status !== 'PAID' && p.status !== 'CANCELLED' && (
                  <View style={styles.row}>
                    {p.status === 'ON_HOLD' ? (
                      <KButton label="Release hold" size="sm" variant="secondary" style={{ flex: 1 }} onPress={() => markReady(p.id)} />
                    ) : (
                      <KButton label="Hold" size="sm" variant="ghost" style={{ flex: 1 }} onPress={() => { const err = hold(p.id, 'Held by finance'); if (err) toast(err, 'alert-circle'); }} />
                    )}
                    {ready.includes(p) && (
                      <KButton
                        label="Pay out"
                        size="sm"
                        variant="success"
                        style={{ flex: 1.3 }}
                        onPress={() => {
                          const err = release(p.id);
                          toast(err ?? `${formatMoney(p.amount)} sent to ${p.payeeName}`, err ? 'alert-circle' : 'cash');
                        }}
                      />
                    )}
                  </View>
                )}
              </Card>
            ))}
          </>
        )}

        {tab === 'revenue' && (
          <>
            <Card style={{ gap: 10 }}>
              <Text size={24} weight="bold" color={t.c.success}>
                {formatMoney(totalRev)}
              </Text>
              {byKind.map((x) => (
                <View key={x.kind} style={{ gap: 4 }}>
                  <View style={styles.rowBetween}>
                    <Text size={13} color={t.c.text}>
                      {REVENUE_LABEL[x.kind]}
                    </Text>
                    <Text size={13} weight="bold" color={x.value >= 0 ? t.c.textStrong : t.c.danger}>
                      {formatMoney(x.value)}
                    </Text>
                  </View>
                  <ProgressBar value={totalRev ? Math.max(0, x.value) / totalRev : 0} />
                </View>
              ))}
            </Card>
            {revenue.slice(0, 30).map((r) => (
              <View key={r.id} style={styles.rowBetween}>
                <Text size={12} color={t.c.muted} style={{ flex: 1 }}>
                  {formatShortDate(r.at)} · {REVENUE_LABEL[r.kind]} {r.note ? `· ${r.note}` : ''} {r.projectId ? `· ${projects.find((p) => p.id === r.projectId)?.code ?? ''}` : ''}
                </Text>
                <Text size={12} weight="bold" color={r.amount >= 0 ? t.c.success : t.c.danger}>
                  {formatMoney(r.amount)}
                </Text>
              </View>
            ))}
          </>
        )}

        {tab === 'refunds' &&
          (refunds.length ? (
            refunds.map((r) => (
              <Card key={r.id} style={{ gap: 8 }}>
                <View style={styles.rowBetween}>
                  <Text size={14} weight="bold" color={t.c.textStrong} style={{ flex: 1 }}>
                    {formatMoney(r.amount)} · {r.requestedBy}
                  </Text>
                  <StatusPill status={r.status} />
                </View>
                <Text size={13} color={t.c.text}>
                  {r.reason}
                </Text>
                <Text size={12} color={t.c.muted}>
                  {projects.find((p) => p.id === r.projectId)?.code} · {timeAgo(r.at)}
                </Text>
                {r.status === 'REQUESTED' && (
                  <View style={styles.row}>
                    <KButton label="Reject" size="sm" variant="danger" style={{ flex: 1 }} onPress={() => { const err = decideRefund(r.id, false); if (err) toast(err, 'alert-circle'); }} />
                    <KButton label="Approve & refund" size="sm" variant="success" style={{ flex: 1 }} onPress={() => { const err = decideRefund(r.id, true); if (err) toast(err, 'alert-circle'); }} />
                  </View>
                )}
              </Card>
            ))
          ) : (
            <EmptyBlock icon="return-down-back-outline" title="No refund requests" />
          ))}

        {tab === 'disputes' && (disputes.length ? disputes.map((d) => <DisputeCard key={d.id} d={d} />) : <EmptyBlock icon="alert-circle-outline" title="No disputes" />)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  method: { width: 8, alignSelf: 'stretch', borderRadius: 4 },
});

export default staffScreen('/platform/finance', Finance);
