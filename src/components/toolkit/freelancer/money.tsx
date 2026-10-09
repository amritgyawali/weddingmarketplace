/** Freelancer toolkit: tax, expenses and mileage, private invoices, goals, savings pots and the rate calculator. */
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, ChoiceChips, KButton, ProgressBar, SectionTitle } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { toast } from '@/components/ui/Toast';
import { freelancerQuote, lastMonths, monthKey, monthLabel, nepalIncomeTax } from '@/services/toolkit';
import { useRoleTheme } from '@/theme/RoleTheme';
import { addDays, formatMoney, formatShortDate, percent, shortCode, today } from '@/utils/format';
import { shareMessage } from '@/utils/links';

import { Col, Cols, EntryList, Hint, Line, NumberField, StatRow, sumAmount, ToolPage, useToolEntries, useToolState } from '../core';
import { useJobs } from './shared';

const fyStart = (iso: string) => {
  const y = Number(iso.slice(0, 4));
  return iso >= `${y}-07-16` ? `${y}-07-16` : `${y - 1}-07-16`;
};

/** Payouts received plus paid private invoices, optionally from a date. */
function useEarnings(from?: string) {
  const { account, ws } = useJobs();
  const invoices = useToolEntries(account.id, 'freelancer.invoices');
  const inRange = (d?: string) => !!d && (!from || d >= from);
  const platform = ws.payables.filter((p) => p.status === 'PAID' && inRange(p.paidAt?.slice(0, 10)));
  const privatePaid = invoices.filter((i) => i.status === 'paid' && inRange(i.date));
  return {
    account,
    ws,
    invoices,
    platform: platform.reduce((s, p) => s + p.amount, 0),
    private: sumAmount(privatePaid),
    byMonth: (key: string) => platform.filter((p) => p.paidAt!.startsWith(key)).reduce((s, p) => s + p.amount, 0) + sumAmount(privatePaid, (i) => !!i.date?.startsWith(key)),
  };
}

// ─── Income tax estimate ────────────────────────────────────────────────────

export function TaxEstimate() {
  const t = useRoleTheme();
  const start = fyStart(today());
  const e = useEarnings(start);
  const expenses = useToolEntries(e.account.id, 'freelancer.expenses');
  const [s, set] = useToolState(e.account.id, 'freelancer.tax', { married: false as boolean, otherIncome: 0, ssf: 0 });
  const spent = sumAmount(expenses, (x) => !!x.date && x.date >= start);
  const gross = e.platform + e.private + Number(s.otherIncome);
  const taxable = Math.max(0, gross - spent - Number(s.ssf));
  const est = nepalIncomeTax(taxable, !!s.married);
  return (
    <ToolPage title="Income tax estimate" subtitle={`Fiscal year from ${formatShortDate(start)}`}>
      <StatRow
        items={[
          { label: 'Earned so far', value: formatMoney(gross) },
          { label: 'Estimated tax', value: formatMoney(est.tax) },
          { label: 'Effective rate', value: percent(est.effective, 1) },
        ]}
      />
      <Card style={{ gap: 2 }}>
        <Line label="Vivah payouts" value={formatMoney(e.platform)} />
        <Line label="Private clients (paid invoices)" value={formatMoney(e.private)} />
        <Line label="Other income" value={formatMoney(Number(s.otherIncome))} />
        <Line label="Work expenses" value={`− ${formatMoney(spent)}`} />
        <Line label="SSF / retirement contribution" value={`− ${formatMoney(Number(s.ssf))}`} />
        <Line label="Taxable income" value={formatMoney(taxable)} strong />
      </Card>
      <Card style={{ gap: 2 }}>
        <SectionTitle title="By slab" />
        {est.rows.map((r) => (
          <Line key={r.rate} label={`${formatMoney(r.amount)} at ${percent(r.rate)}`} value={formatMoney(r.tax)} />
        ))}
        {!est.rows.length && <Hint>No tax yet.</Hint>}
      </Card>
      <Card style={{ gap: 10 }}>
        <View style={styles.between}>
          <Text size={15} color={t.c.textStrong}>
            Assessed as a couple (married)
          </Text>
          <Toggle value={!!s.married} onValueChange={(v) => set({ married: v })} accessibilityLabel="Married" />
        </View>
        <NumberField label="Other income this year" money value={Number(s.otherIncome)} onChange={(n) => set({ otherIncome: n })} />
        <NumberField label="SSF or approved retirement contribution" money value={Number(s.ssf)} onChange={(n) => set({ ssf: n })} />
      </Card>
      <Hint>An estimate using the resident individual slabs (the first slab is the 1% social security tax). It is not tax advice; confirm with a tax consultant or the IRD before filing.</Hint>
    </ToolPage>
  );
}

// ─── Expenses and mileage ───────────────────────────────────────────────────

const EXP_GROUPS = ['Travel and fuel', 'Gear rental', 'Repairs', 'Software and storage', 'Food on shoots', 'Other'];

export function ExpensesMileage() {
  const { account } = useJobs();
  const [s, set] = useToolState(account.id, 'freelancer.expenses', { perKm: 12 });
  return (
    <ToolPage title="Expenses and mileage" subtitle="Keep receipts and kilometres for tax time">
      <EntryList
        ownerId={account.id}
        tool="freelancer.expenses"
        noun="expense"
        groupBy="group"
        groupOrder={EXP_GROUPS}
        defaults={{ date: today(), group: 'Travel and fuel' }}
        sort={(a, b) => (b.date ?? '').localeCompare(a.date ?? '')}
        fields={[
          { key: 'title', label: 'What for', kind: 'text', required: true, placeholder: 'e.g. Bike fuel to Bhaktapur' },
          { key: 'group', label: 'Category', kind: 'select', options: EXP_GROUPS },
          { key: 'amount', label: 'Amount', kind: 'money' },
          { key: 'f.km', label: 'Kilometres (for travel)', kind: 'number' },
          { key: 'date', label: 'Date', kind: 'date', required: true },
          { key: 'note', label: 'Notes', kind: 'text' },
        ]}
        subtitle={(e) => [e.date ? formatShortDate(e.date) : undefined, e.fields?.km ? `${e.fields.km} km` : undefined, e.note].filter(Boolean).join(' · ')}
        trailing={(e) => formatMoney((e.amount ?? 0) || Number(e.fields?.km ?? 0) * Number(s.perKm))}
        header={(entries) => {
          const km = entries.reduce((n, e) => n + Number(e.fields?.km ?? 0), 0);
          return (
            <>
              <StatRow
                items={[
                  { label: 'This month', value: formatMoney(sumAmount(entries, (e) => !!e.date?.startsWith(monthKey(today())))) },
                  { label: 'Kilometres logged', value: String(km) },
                  { label: 'Mileage value', value: formatMoney(km * Number(s.perKm)) },
                ]}
              />
              <NumberField label="Mileage rate per km (when no receipt amount)" money value={Number(s.perKm)} onChange={(n) => set({ perKm: n })} />
            </>
          );
        }}
      />
    </ToolPage>
  );
}

// ─── Private invoices ───────────────────────────────────────────────────────

export function PrivateInvoices() {
  const { account } = useJobs();
  const invoiceText = (e: { title: string; amount?: number; date?: string; note?: string; fields?: Record<string, unknown> }) =>
    `Invoice ${e.fields?.number ?? ''}\nFrom: ${account.name} (${account.phone})\nTo: ${e.title}\nFor: ${e.note ?? 'Wedding services'}\nAmount: ${formatMoney(e.amount ?? 0)}\nDue: ${e.date ? formatShortDate(e.date) : 'on receipt'}\nPay by: ${account.payoutMethod ? `${account.payoutMethod.kind} ${account.payoutMethod.detail}` : 'eSewa / Khalti / bank transfer'}\n\nThank you!`;
  return (
    <ToolPage title="Private invoices" subtitle="Bill clients you found outside Vivah">
      <EntryList
        ownerId={account.id}
        tool="freelancer.invoices"
        noun="invoice"
        statusPill
        groupBy="status"
        groupOrder={['sent', 'overdue', 'draft', 'paid']}
        defaults={{ status: 'sent', date: addDays(today(), 7), fields: { number: `INV-${shortCode(4)}` } }}
        sort={(a, b) => (a.date ?? '').localeCompare(b.date ?? '')}
        fields={[
          { key: 'title', label: 'Client', kind: 'text', required: true },
          { key: 'f.number', label: 'Invoice number', kind: 'text' },
          { key: 'note', label: 'For', kind: 'text', placeholder: 'e.g. Engagement shoot, 6 hours' },
          { key: 'amount', label: 'Amount', kind: 'money', required: true },
          { key: 'date', label: 'Due date', kind: 'date' },
          { key: 'status', label: 'Status', kind: 'select', options: [{ id: 'draft', label: 'Draft' }, { id: 'sent', label: 'Sent' }, { id: 'paid', label: 'Paid' }, { id: 'overdue', label: 'Overdue' }] },
        ]}
        subtitle={(e) => [e.fields?.number, e.note, e.date ? `due ${formatShortDate(e.date)}` : undefined].filter(Boolean).join(' · ')}
        rowActions={(e) => [
          { label: 'Share', onPress: () => shareMessage(invoiceText(e)) },
          { label: 'Copy', onPress: () => Clipboard.setStringAsync(invoiceText(e)).then(() => toast('Invoice copied')) },
        ]}
        header={(entries) => (
          <StatRow
            items={[
              { label: 'Unpaid', value: formatMoney(sumAmount(entries, (e) => e.status === 'sent' || e.status === 'overdue')) },
              { label: 'Paid this year', value: formatMoney(sumAmount(entries, (e) => e.status === 'paid' && !!e.date && e.date >= fyStart(today()))) },
              { label: 'Overdue', value: String(entries.filter((e) => e.status !== 'paid' && e.status !== 'draft' && !!e.date && e.date < today()).length), alert: entries.some((e) => e.status !== 'paid' && e.status !== 'draft' && !!e.date && e.date < today()) },
            ]}
          />
        )}
      />
    </ToolPage>
  );
}

// ─── Earnings goal ──────────────────────────────────────────────────────────

export function EarningsGoal() {
  const t = useRoleTheme();
  const e = useEarnings();
  const [s, set] = useToolState(e.account.id, 'freelancer.goals', { monthly: 60_000, jobs: 6 });
  const key = monthKey(today());
  const earned = e.byMonth(key);
  const { jobs } = useJobs();
  const jobsThisMonth = jobs.filter((j) => j.date.startsWith(key)).length;
  const history = lastMonths(today(), 6).map((k) => ({ k, v: e.byMonth(k) }));
  return (
    <ToolPage title="Earnings goal" subtitle={`${monthLabel(key)} target`}>
      <Card style={{ gap: 8 }}>
        <View style={styles.between}>
          <Text size={15} weight="semibold" color={t.c.textStrong}>
            {formatMoney(earned)} of {formatMoney(Number(s.monthly))}
          </Text>
          <Text size={13} color={t.c.muted}>
            {Math.round((earned / Math.max(1, Number(s.monthly))) * 100)}%
          </Text>
        </View>
        <ProgressBar value={earned / Math.max(1, Number(s.monthly))} height={6} color={earned >= Number(s.monthly) ? t.c.success : undefined} />
        <Line label="Jobs this month" value={`${jobsThisMonth} / ${s.jobs}`} />
      </Card>
      <Card style={{ gap: 10 }}>
        <Cols>
          <Col>
            <NumberField label="Monthly earnings target" money value={Number(s.monthly)} onChange={(n) => set({ monthly: n })} />
          </Col>
          <Col>
            <NumberField label="Jobs per month" value={Number(s.jobs)} onChange={(n) => set({ jobs: n })} />
          </Col>
        </Cols>
      </Card>
      <Card padded={false} style={{ overflow: 'hidden' }}>
        {history.reverse().map((h, i) => (
          <View key={h.k} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.border }]}>
            <Text size={14} color={t.c.textStrong} style={{ flex: 1 }}>
              {monthLabel(h.k)}
            </Text>
            <Text size={14} weight="semibold" color={h.v >= Number(s.monthly) ? t.c.success : t.c.textStrong}>
              {formatMoney(h.v)}
            </Text>
          </View>
        ))}
      </Card>
      <Hint>Counts Vivah payouts when they are paid and private invoices marked paid.</Hint>
    </ToolPage>
  );
}

// ─── Savings pots ───────────────────────────────────────────────────────────

const POTS: { id: 'tax' | 'gear' | 'emergency'; label: string; hint: string }[] = [
  { id: 'tax', label: 'Tax', hint: 'For your year-end income tax' },
  { id: 'gear', label: 'Gear fund', hint: 'New lens, body or lights' },
  { id: 'emergency', label: 'Emergency', hint: 'Off-season months and sick days' },
];

export function SavingsPots() {
  const t = useRoleTheme();
  const e = useEarnings();
  const [s, set] = useToolState(e.account.id, 'freelancer.pots', { tax: 10, gear: 10, emergency: 10, tax_saved: 0, gear_saved: 0, emergency_saved: 0 });
  const month = e.byMonth(monthKey(today()));
  const total = e.platform + e.private;
  return (
    <ToolPage title="Savings pots" subtitle="Set aside a share of every payout">
      <StatRow
        items={[
          { label: 'Earned this month', value: formatMoney(month) },
          { label: 'Set aside this month', value: formatMoney(POTS.reduce((n, p) => n + Math.round((month * Number(s[p.id])) / 100), 0)) },
        ]}
      />
      {POTS.map((p) => {
        const pct = Number(s[p.id]);
        const target = Math.round((total * pct) / 100);
        const saved = Number(s[`${p.id}_saved`]);
        return (
          <Card key={p.id} style={{ gap: 8 }}>
            <View style={styles.between}>
              <View style={{ flex: 1 }}>
                <Text size={15} weight="semibold" color={t.c.textStrong}>
                  {p.label} · {pct}%
                </Text>
                <Text size={12} color={t.c.muted}>
                  {p.hint}
                </Text>
              </View>
              <Text size={14} color={t.c.textStrong}>
                {formatMoney(saved)} / {formatMoney(target)}
              </Text>
            </View>
            <ProgressBar value={target ? saved / target : 0} />
            <Cols>
              <Col>
                <NumberField label="Share of income (%)" value={pct} onChange={(n) => set({ [p.id]: Math.min(60, n) })} />
              </Col>
              <Col>
                <NumberField label="Saved so far" money value={saved} onChange={(n) => set({ [`${p.id}_saved`]: n })} />
              </Col>
            </Cols>
          </Card>
        );
      })}
      <Hint>Targets are your percentage of everything earned so far. Many freelancers park these in a separate savings account the day a payout lands.</Hint>
    </ToolPage>
  );
}

// ─── Rate calculator ────────────────────────────────────────────────────────

export function RateCalculator() {
  const { account } = useJobs();
  const [hours, setHours] = useState(8);
  const [km, setKm] = useState(15);
  const [assistants, setAssistants] = useState(0);
  const [extras, setExtras] = useState<string[]>([]);
  const q = freelancerQuote({ hours, hourlyRate: account.hourlyRate ?? 1_500, dayRate: account.dayRate ?? 10_000, travelKm: km, assistants, rush: extras.includes('Rush delivery'), overnight: extras.includes('Overnight stay') });
  const text = `Quote from ${account.name}\n${q.lines.map((l) => `• ${l.label}: ${formatMoney(l.amount)}`).join('\n')}\nTotal: ${formatMoney(q.total)}`;
  return (
    <ToolPage title="Rate calculator" subtitle="Quote a private job in a minute">
      <Card style={{ gap: 10 }}>
        <Cols>
          <Col>
            <NumberField label="Hours on site" value={hours} onChange={(n) => setHours(Math.min(24, n))} />
          </Col>
          <Col>
            <NumberField label="Travel (km one way)" value={km} onChange={setKm} />
          </Col>
          <Col>
            <NumberField label="Assistants" value={assistants} onChange={(n) => setAssistants(Math.min(5, n))} />
          </Col>
        </Cols>
        <ChoiceChips options={['Rush delivery', 'Overnight stay']} selected={extras} onToggle={(v) => setExtras(extras.includes(v) ? extras.filter((x) => x !== v) : [...extras, v])} />
      </Card>
      <Card style={{ gap: 2 }}>
        {q.lines.map((l) => (
          <Line key={l.label} label={l.label} value={formatMoney(l.amount)} />
        ))}
        <Line label="Quote" value={formatMoney(q.total)} strong />
      </Card>
      <Cols>
        <Col>
          <KButton label="Copy" variant="secondary" icon="copy-outline" onPress={() => Clipboard.setStringAsync(text).then(() => toast('Quote copied'))} />
        </Col>
        <Col>
          <KButton label="Share" icon="share-outline" onPress={() => shareMessage(text)} />
        </Col>
      </Cols>
      <Hint>
        Uses your profile rates: {formatMoney(account.hourlyRate ?? 1_500)}/hour up to your {formatMoney(account.dayRate ?? 10_000)} day rate, 1.5× after 10 hours, and NPR 25/km beyond 20 km. Update your rates on your profile.
      </Hint>
    </ToolPage>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
});
