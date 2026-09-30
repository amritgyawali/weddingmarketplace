/** Vendor toolkit: expenses, profit, tax, pricing, vouchers, referrals, goals and market benchmark. */
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BarChart, Card, ChoiceChips, KButton, KField, ProgressBar, SectionTitle } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { sameServiceArea } from '@/data/cities';
import { PROVIDERS } from '@/data/providers';
import { serviceName } from '@/data/services';
import { useVendorWorkspace } from '@/hooks/useWorkspace';
import { lastMonths, monthKey, monthLabel, suggestPrice, vatPosition } from '@/services/toolkit';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import { addDays, formatMoney, formatMoneyCompact, formatShortDate, percent, shortCode, today } from '@/utils/format';

import { Col, Cols, EntryList, Hint, Line, NumberField, StatRow, sumAmount, ToolPage, useToolEntries, useToolState } from '../core';

export const EXPENSE_CATEGORIES = ['Rent', 'Staff wages', 'Fuel and transport', 'Food supplies', 'Decor stock', 'Marketing', 'Utilities', 'Equipment', 'Other'];

/** Income the vendor actually received (paid payouts), by month key. */
function useIncome() {
  const account = useAccount();
  const { payables } = useVendorWorkspace(account);
  const paid = payables.filter((p) => p.status === 'PAID' && p.paidAt);
  return { account, paid, byMonth: (key: string) => paid.filter((p) => p.paidAt!.startsWith(key)).reduce((s, p) => s + p.amount, 0) };
}

// ─── Expenses ───────────────────────────────────────────────────────────────

export function Expenses() {
  const account = useAccount();
  const thisMonth = monthKey(today());
  const lastMonth = lastMonths(today(), 2)[0];
  return (
    <ToolPage title="Expenses" subtitle="What the business spends, by category">
      <EntryList
        ownerId={account.id}
        tool="vendor.expenses"
        noun="expense"
        groupBy="group"
        groupOrder={EXPENSE_CATEGORIES}
        defaults={{ date: today(), group: 'Other', fields: { via: 'Cash' } }}
        sort={(a, b) => (b.date ?? '').localeCompare(a.date ?? '')}
        fields={[
          { key: 'title', label: 'What for', kind: 'text', required: true },
          { key: 'amount', label: 'Amount', kind: 'money', required: true },
          { key: 'date', label: 'Date', kind: 'date', required: true },
          { key: 'group', label: 'Category', kind: 'select', options: EXPENSE_CATEGORIES },
          { key: 'f.via', label: 'Paid by', kind: 'select', options: ['Cash', 'eSewa', 'Khalti', 'Fonepay', 'Bank'] },
          { key: 'f.vat', label: 'VAT bill (claim input credit)', kind: 'toggle' },
          { key: 'note', label: 'Notes', kind: 'text' },
        ]}
        subtitle={(e) => [e.date ? formatShortDate(e.date) : undefined, e.fields?.via, e.fields?.vat ? 'VAT bill' : undefined, e.note].filter(Boolean).join(' · ')}
        header={(entries) => {
          const now = sumAmount(entries, (e) => !!e.date?.startsWith(thisMonth));
          const prev = sumAmount(entries, (e) => !!e.date?.startsWith(lastMonth));
          const byCat = EXPENSE_CATEGORIES.map((c) => ({ c, v: sumAmount(entries, (e) => e.group === c && !!e.date?.startsWith(thisMonth)) })).sort((a, b) => b.v - a.v)[0];
          return (
            <StatRow
              items={[
                { label: 'This month', value: formatMoney(now) },
                { label: 'Last month', value: formatMoney(prev) },
                { label: 'Biggest this month', value: byCat?.v ? byCat.c : '—' },
              ]}
            />
          );
        }}
      />
    </ToolPage>
  );
}

// ─── Profit and loss ────────────────────────────────────────────────────────

export function ProfitLoss() {
  const t = useRoleTheme();
  const { account, byMonth } = useIncome();
  const expenses = useToolEntries(account.id, 'vendor.expenses');
  const months = lastMonths(today(), 6).map((key) => {
    const income = byMonth(key);
    const spend = sumAmount(expenses, (e) => !!e.date?.startsWith(key));
    return { key, income, spend, profit: income - spend };
  });
  const total = months.reduce((s, m) => ({ income: s.income + m.income, spend: s.spend + m.spend }), { income: 0, spend: 0 });
  const margin = total.income ? (total.income - total.spend) / total.income : 0;
  return (
    <ToolPage title="Profit and loss" subtitle="Last six months">
      <StatRow
        items={[
          { label: 'Received', value: formatMoneyCompact(total.income) },
          { label: 'Spent', value: formatMoneyCompact(total.spend) },
          { label: 'Profit margin', value: percent(margin), alert: margin < 0 },
        ]}
      />
      <Card style={{ gap: 10 }}>
        <SectionTitle title="Profit by month" />
        <BarChart data={months.map((m) => ({ label: monthLabel(m.key), value: Math.max(0, m.profit) }))} format={formatMoneyCompact} />
      </Card>
      <Card padded={false} style={{ overflow: 'hidden' }}>
        {[...months].reverse().map((m, i) => (
          <View key={m.key} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.border }]}>
            <Text size={14} weight="semibold" color={t.c.textStrong} style={{ width: 48 }}>
              {monthLabel(m.key)}
            </Text>
            <Text size={13} color={t.c.muted} style={{ flex: 1 }}>
              in {formatMoneyCompact(m.income)} · out {formatMoneyCompact(m.spend)}
            </Text>
            <Text size={14} weight="semibold" color={m.profit < 0 ? t.c.danger : t.c.textStrong}>
              {formatMoney(m.profit)}
            </Text>
          </View>
        ))}
      </Card>
      <Hint>Income is what Vivah has paid out to you (your share after the platform fee). Expenses come from the Expenses tool.</Hint>
    </ToolPage>
  );
}

// ─── VAT and tax ────────────────────────────────────────────────────────────

/** Nepal's fiscal year starts on 1 Shrawan (about 16 July). */
const fyStart = (iso: string) => {
  const y = Number(iso.slice(0, 4));
  const start = `${y}-07-16`;
  return iso >= start ? start : `${y - 1}-07-16`;
};

export function TaxSummary() {
  const { account, paid } = useIncome();
  const expenses = useToolEntries(account.id, 'vendor.expenses');
  const [period, setPeriod] = useState('This month');
  const from = period === 'This month' ? `${monthKey(today())}-01` : period === 'Last month' ? `${lastMonths(today(), 2)[0]}-01` : fyStart(today());
  const to = period === 'Last month' ? `${monthKey(today())}-01` : addDays(today(), 1);
  const inRange = (d?: string) => !!d && d >= from && d < to;
  const sales = paid.filter((p) => inRange(p.paidAt!.slice(0, 10))).reduce((s, p) => s + p.amount, 0);
  const purchases = sumAmount(expenses, (e) => !!e.fields?.vat && inRange(e.date));
  const vat = vatPosition(sales, purchases);
  return (
    <ToolPage title="VAT and tax" subtitle={account.panVat ? `PAN/VAT ${account.panVat}` : 'Add your PAN/VAT number in settings'}>
      <ChoiceChips options={['This month', 'Last month', 'This fiscal year']} selected={[period]} onToggle={setPeriod} />
      <Card style={{ gap: 2 }}>
        <Line label="Taxable sales" value={formatMoney(sales)} note={`${formatShortDate(from)} – ${formatShortDate(addDays(to, -1))}`} />
        <Line label="Output VAT (13%)" value={formatMoney(vat.output)} />
        <Line label="VAT-billed purchases" value={formatMoney(purchases)} />
        <Line label="Input credit" value={`− ${formatMoney(vat.input)}`} />
        <Line label={vat.credit ? 'Credit carried forward' : 'VAT payable'} value={formatMoney(vat.credit || vat.payable)} strong tone={vat.credit ? 'success' : undefined} />
      </Card>
      <Hint>An estimate to help you prepare your monthly VAT return (due by the 25th of the next Nepali month). Your payouts from Vivah are pre-VAT; issue your own VAT bill for them. Confirm figures with your auditor before filing on the IRD portal.</Hint>
    </ToolPage>
  );
}

// ─── Price calculator ───────────────────────────────────────────────────────

export function PriceCalculator() {
  const t = useRoleTheme();
  const account = useAccount();
  const { listing } = useVendorWorkspace(account);
  const [s, set] = useToolState(account.id, 'vendor.pricing', { base: listing?.startingPrice ?? 150_000, included: 300, perGuest: 450, peak: 20, saturday: 10, lastMinute: 10 });
  const [date, setDate] = useState(addDays(today(), 60));
  const [guests, setGuests] = useState(350);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const q = valid ? suggestPrice({ base: Number(s.base), date, guests, includedGuests: Number(s.included), perExtraGuest: Number(s.perGuest), peakPct: Number(s.peak), saturdayPct: Number(s.saturday), lastMinutePct: Number(s.lastMinute) }) : null;
  return (
    <ToolPage title="Price calculator" subtitle="Seasonal and date-based pricing">
      <Card style={{ gap: 10 }}>
        <Cols>
          <Col>
            <KField label="Event date" value={date} onChangeText={setDate} placeholder="yyyy-mm-dd" autoCapitalize="none" error={valid ? null : 'Use yyyy-mm-dd'} />
          </Col>
          <Col>
            <NumberField label="Guests" value={guests} onChange={setGuests} />
          </Col>
        </Cols>
      </Card>
      {q && (
        <Card style={{ gap: 2 }}>
          {q.lines.map((l) => (
            <Line key={l.label} label={l.label} value={formatMoney(l.amount)} />
          ))}
          <Line label="Suggested price (pre-VAT)" value={formatMoney(q.total)} strong />
          <KButton
            label="Copy for a quote"
            size="sm"
            variant="secondary"
            style={{ marginTop: 8 }}
            onPress={async () => {
              await Clipboard.setStringAsync(`${listing ? serviceName(listing.serviceId) : 'Package'} for ${guests} guests on ${formatShortDate(date)}: ${formatMoney(q.total)} + 13% VAT`);
              toast('Copied');
            }}
          />
        </Card>
      )}
      <SectionTitle title="Your pricing rules" />
      <Card style={{ gap: 10 }}>
        <NumberField label="Base price" money value={Number(s.base)} onChange={(n) => set({ base: n })} />
        <Cols>
          <Col>
            <NumberField label="Guests included" value={Number(s.included)} onChange={(n) => set({ included: n })} />
          </Col>
          <Col>
            <NumberField label="Per extra guest" money value={Number(s.perGuest)} onChange={(n) => set({ perGuest: n })} />
          </Col>
        </Cols>
        <Cols>
          <Col>
            <NumberField label="Peak season %" value={Number(s.peak)} onChange={(n) => set({ peak: Math.min(100, n) })} />
          </Col>
          <Col>
            <NumberField label="Saturday %" value={Number(s.saturday)} onChange={(n) => set({ saturday: Math.min(100, n) })} />
          </Col>
          <Col>
            <NumberField label="Last-minute discount %" value={Number(s.lastMinute)} onChange={(n) => set({ lastMinute: Math.min(90, n) })} />
          </Col>
        </Cols>
        <Text size={12} color={t.c.subtle}>
          Peak season is Mangsir, Magh, Falgun and Baisakh. Last-minute applies to dates within 30 days.
        </Text>
      </Card>
    </ToolPage>
  );
}

// ─── Gift vouchers ──────────────────────────────────────────────────────────

const VOUCHER_STATUS = [
  { id: 'active', label: 'Active' },
  { id: 'redeemed', label: 'Redeemed' },
  { id: 'expired', label: 'Expired' },
];

export function Vouchers() {
  const account = useAccount();
  const prefix = (account.businessName ?? 'VV').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || 'VV';
  return (
    <ToolPage title="Gift vouchers" subtitle="Sell vouchers families can gift the couple">
      <EntryList
        ownerId={account.id}
        tool="vendor.vouchers"
        noun="voucher"
        statusPill
        defaults={{ status: 'active', date: addDays(today(), 365), fields: { code: `${prefix}-${shortCode(5)}` } }}
        fields={[
          { key: 'title', label: 'Bought by / for', kind: 'text', required: true },
          { key: 'f.code', label: 'Code', kind: 'text', required: true },
          { key: 'amount', label: 'Value', kind: 'money', required: true },
          { key: 'date', label: 'Valid until', kind: 'date' },
          { key: 'status', label: 'Status', kind: 'select', options: VOUCHER_STATUS },
          { key: 'note', label: 'Notes', kind: 'text' },
        ]}
        subtitle={(e) => [e.fields?.code, e.date ? `valid to ${formatShortDate(e.date)}` : undefined].filter(Boolean).join(' · ')}
        rowActions={(e) => [{ label: 'Copy code', onPress: () => Clipboard.setStringAsync(String(e.fields?.code ?? '')).then(() => toast('Code copied')) }]}
        header={(entries) => (
          <StatRow
            items={[
              { label: 'Sold', value: formatMoney(sumAmount(entries)) },
              { label: 'Outstanding', value: formatMoney(sumAmount(entries, (e) => e.status === 'active')) },
              { label: 'Redeemed', value: String(entries.filter((e) => e.status === 'redeemed').length) },
            ]}
          />
        )}
        emptyMessage="Vouchers are popular Tihar and Dashain gifts. Outstanding vouchers are a liability until they're redeemed."
      />
    </ToolPage>
  );
}

// ─── Referral partners ──────────────────────────────────────────────────────

const REF_STATUS = [
  { id: 'pending', label: 'Enquiry' },
  { id: 'booked', label: 'Booked, commission owed' },
  { id: 'paid', label: 'Commission paid' },
  { id: 'lost', label: 'Did not book' },
];

const commission = (e: { amount?: number; fields?: Record<string, unknown> }) => Math.round(((e.amount ?? 0) * Number(e.fields?.rate ?? 0)) / 100);

export function Referrals() {
  const account = useAccount();
  return (
    <ToolPage title="Referral partners" subtitle="Planners, hotels and friends who send couples">
      <EntryList
        ownerId={account.id}
        tool="vendor.referrals"
        noun="referral"
        statusPill
        groupBy="status"
        groupOrder={['booked', 'pending', 'paid', 'lost']}
        defaults={{ status: 'pending', fields: { rate: 5 } }}
        fields={[
          { key: 'title', label: 'Couple', kind: 'text', required: true },
          { key: 'f.partner', label: 'Referred by', kind: 'text', required: true },
          { key: 'amount', label: 'Booking value', kind: 'money' },
          { key: 'f.rate', label: 'Commission %', kind: 'number' },
          { key: 'status', label: 'Status', kind: 'select', options: REF_STATUS },
          { key: 'date', label: 'Date', kind: 'date' },
        ]}
        subtitle={(e) => [`via ${e.fields?.partner ?? '—'}`, e.fields?.rate ? `${e.fields.rate}%` : undefined].filter(Boolean).join(' · ')}
        trailing={(e) => (e.amount ? formatMoney(commission(e)) : undefined)}
        header={(entries) => {
          const partners = new Set(entries.map((e) => String(e.fields?.partner ?? ''))).size;
          return (
            <StatRow
              items={[
                { label: 'Partners', value: String(partners) },
                { label: 'Commission owed', value: formatMoney(entries.filter((e) => e.status === 'booked').reduce((s, e) => s + commission(e), 0)) },
                { label: 'Conversion', value: percent(entries.length ? entries.filter((e) => e.status === 'booked' || e.status === 'paid').length / entries.length : 0) },
              ]}
            />
          );
        }}
      />
    </ToolPage>
  );
}

// ─── Monthly goals ──────────────────────────────────────────────────────────

export function Goals() {
  const t = useRoleTheme();
  const { account, byMonth } = useIncome();
  const { leads, bookings } = useVendorWorkspace(account);
  const [s, set] = useToolState(account.id, 'vendor.goals', { revenue: 500_000, bookings: 4, leads: 20 });
  const key = monthKey(today());
  const actual = {
    revenue: byMonth(key),
    bookings: bookings.filter((b) => b.booking.confirmedAt?.startsWith(key)).length,
    leads: leads.filter((l) => l.createdAt.startsWith(key)).length,
  };
  const rows: { id: 'revenue' | 'bookings' | 'leads'; label: string; fmt: (n: number) => string }[] = [
    { id: 'revenue', label: 'Payouts received', fmt: formatMoney },
    { id: 'bookings', label: 'Bookings confirmed', fmt: String },
    { id: 'leads', label: 'New enquiries', fmt: String },
  ];
  return (
    <ToolPage title="Monthly goals" subtitle={`${monthLabel(key)} targets and progress`}>
      {rows.map((r) => {
        const target = Number(s[r.id]);
        const value = actual[r.id];
        return (
          <Card key={r.id} style={{ gap: 8 }}>
            <View style={styles.between}>
              <Text size={15} weight="semibold" color={t.c.textStrong}>
                {r.label}
              </Text>
              <Text size={14} color={t.c.muted}>
                {r.fmt(value)} / {r.fmt(target)}
              </Text>
            </View>
            <ProgressBar value={target ? value / target : 0} height={6} color={value >= target ? t.c.success : undefined} />
            <NumberField label="Target" money={r.id === 'revenue'} value={target} onChange={(n) => set({ [r.id]: n })} />
          </Card>
        );
      })}
      <Hint>Progress updates as payouts land, couples confirm and new enquiries arrive.</Hint>
    </ToolPage>
  );
}

// ─── Market benchmark ───────────────────────────────────────────────────────

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

export function Benchmark() {
  const t = useRoleTheme();
  const account = useAccount();
  const { listing } = useVendorWorkspace(account);
  if (!listing) {
    return (
      <ToolPage title="Market benchmark">
        <Hint>Link your business to a listing to compare yourself with similar providers.</Hint>
      </ToolPage>
    );
  }
  const peers = PROVIDERS.filter((p) => p.serviceId === listing.serviceId && p.id !== listing.id && sameServiceArea(p.city, listing.city));
  const all = [...peers, listing];
  const priceRank = [...all].sort((a, b) => a.startingPrice - b.startingPrice).findIndex((p) => p.id === listing.id) + 1;
  const ratingRank = [...all].sort((a, b) => b.rating - a.rating).findIndex((p) => p.id === listing.id) + 1;
  const rows = [
    { label: 'Starting price', you: formatMoney(listing.startingPrice), market: formatMoney(median(peers.map((p) => p.startingPrice))), note: `${priceRank} of ${all.length} from cheapest` },
    { label: 'Rating', you: `${listing.rating.toFixed(1)}★`, market: `${(peers.reduce((s, p) => s + p.rating, 0) / Math.max(1, peers.length)).toFixed(1)}★`, note: `${ratingRank} of ${all.length} by rating` },
    { label: 'Reviews', you: String(listing.reviewCount), market: String(median(peers.map((p) => p.reviewCount))), note: 'More reviews lift you in search' },
    { label: 'Reply time', you: `${listing.internal.responseMinutes} min`, market: `${median(peers.map((p) => p.internal.responseMinutes))} min`, note: 'Median first reply to a couple' },
    { label: 'Experience', you: `${listing.experienceYears} yrs`, market: `${median(peers.map((p) => p.experienceYears))} yrs`, note: 'Years in business' },
  ];
  return (
    <ToolPage title="Market benchmark" subtitle={`${serviceName(listing.serviceId)} in ${listing.city} · ${peers.length} similar providers`}>
      <Card padded={false} style={{ overflow: 'hidden' }}>
        <View style={[styles.row, { backgroundColor: t.c.surfaceAlt }]}>
          <Text size={13} color={t.c.muted} style={{ flex: 1 }}>
            Measure
          </Text>
          <Text size={13} color={t.c.muted} style={styles.cell}>
            You
          </Text>
          <Text size={13} color={t.c.muted} style={styles.cell}>
            Market
          </Text>
        </View>
        {rows.map((r) => (
          <View key={r.label} style={[styles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.border }]}>
            <View style={{ flex: 1 }}>
              <Text size={14} weight="semibold" color={t.c.textStrong}>
                {r.label}
              </Text>
              <Text size={12} color={t.c.muted}>
                {r.note}
              </Text>
            </View>
            <Text size={14} weight="semibold" color={t.c.textStrong} style={styles.cell}>
              {r.you}
            </Text>
            <Text size={14} color={t.c.text} style={styles.cell}>
              {r.market}
            </Text>
          </View>
        ))}
      </Card>
      <Hint>“Market” is the median of verified and unverified listings in the same service and service area. Reply time is the strongest lever you control: couples book the first vendor who answers well.</Hint>
    </ToolPage>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 11 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cell: { width: 96, textAlign: 'right' },
});
