/** Platform toolkit: broadcasts, promos, helpdesk, macros, recruitment, payout batches, holidays, on-call, QA, win-back and exports. */
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, ChoiceChips, EmptyBlock, KButton, KField, ListRow, SectionTitle, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { SERVICES } from '@/data/services';
import { exportCsv } from '@/services/exporters';
import { NEPAL_HOLIDAYS } from '@/services/toolkit';
import { currentActor } from '@/store/db/helpers';
import { useDb } from '@/store/useDb';
import { useSession } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Broadcast, Payable } from '@/types/platform';
import { confirm } from '@/utils/confirm';
import { addDays, daysUntil, formatLongDate, formatMoney, formatShortDate, relativeDay, shortCode, timeAgo, today } from '@/utils/format';
import { openWhatsApp } from '@/utils/links';

import { EntryList, Hint, StatRow, sumAmount, ToolPage, useToolEntries, useToolState } from '../core';

const OWNER = 'platform';
const useStaffNames = () => {
  const accounts = useSession((s) => s.accounts);
  return accounts.filter((a) => a.role === 'platform' && !a.suspended);
};

// ─── Broadcasts ─────────────────────────────────────────────────────────────

const AUDIENCES: { id: Broadcast['audience']; label: string }[] = [
  { id: 'all', label: 'Everyone' },
  { id: 'customer', label: 'Couples' },
  { id: 'vendor', label: 'Vendors' },
  { id: 'freelancer', label: 'Freelancers' },
];

export function Broadcasts() {
  const t = useRoleTheme();
  const history = useDb((s) => s.broadcasts);
  const send = useDb((s) => s.sendBroadcast);
  const [audience, setAudience] = useState<Broadcast['audience']>('vendor');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const label = (id: Broadcast['audience']) => AUDIENCES.find((a) => a.id === id)?.label ?? id;
  return (
    <ToolPage title="Broadcasts" subtitle="Announcements to a whole group">
      <Card style={{ gap: 10 }}>
        <ChoiceChips options={AUDIENCES.map((a) => a.label)} selected={[label(audience)]} onToggle={(l) => setAudience(AUDIENCES.find((a) => a.label === l)?.id ?? audience)} />
        <KField label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Office closed for Dashain, 11–21 October" />
        <KField label="Message" value={body} onChangeText={setBody} multiline placeholder="Keep it short and say what people should do." />
        <KButton
          label={`Send to ${label(audience).toLowerCase()}`}
          icon="megaphone-outline"
          disabled={!title.trim() || !body.trim()}
          onPress={() =>
            confirm('Send broadcast?', `“${title.trim()}” goes to every ${label(audience).toLowerCase()} account as a notification.`, 'Send', () => {
              const b = send(audience, title, body);
              if (b) {
                toast(`Sent to ${b.recipients} accounts`, 'megaphone');
                setTitle('');
                setBody('');
              }
            })
          }
        />
      </Card>
      <SectionTitle title={`Sent (${history.length})`} />
      {history.length === 0 && <EmptyBlock icon="megaphone-outline" title="Nothing sent yet" />}
      {history.map((b) => (
        <Card key={b.id} style={{ gap: 4 }}>
          <View style={styles.between}>
            <Text size={15} weight="semibold" color={t.c.textStrong} style={{ flex: 1 }}>
              {b.title}
            </Text>
            <StatusPill status="sent" label={label(b.audience)} />
          </View>
          <Text size={14} color={t.c.text}>
            {b.body}
          </Text>
          <Text size={12} color={t.c.muted}>
            {b.sentByName} · {timeAgo(b.at)} · {b.recipients} accounts
          </Text>
        </Card>
      ))}
    </ToolPage>
  );
}

// ─── Promo campaigns ────────────────────────────────────────────────────────

export function PromoCampaigns() {
  return (
    <ToolPage title="Promo campaigns" subtitle="Platform-funded discount codes and budgets">
      <EntryList
        ownerId={OWNER}
        tool="platform.promos"
        noun="campaign"
        statusPill
        groupBy="status"
        groupOrder={['live', 'draft', 'paused', 'ended']}
        defaults={{ status: 'draft', date: today(), fields: { code: `VIVAH${shortCode(4)}`, pct: 5, spent: 0 } }}
        fields={[
          { key: 'title', label: 'Campaign', kind: 'text', required: true, placeholder: 'e.g. Falgun early-bird for Pokhara' },
          { key: 'f.code', label: 'Code', kind: 'text', required: true },
          { key: 'f.pct', label: 'Discount on service fee (%)', kind: 'number' },
          { key: 'group', label: 'Audience', kind: 'select', options: ['All couples', 'First-time couples', 'Kathmandu valley', 'Pokhara', 'Chitwan', 'Referral'] },
          { key: 'amount', label: 'Budget', kind: 'money', required: true },
          { key: 'f.spent', label: 'Spent so far', kind: 'money' },
          { key: 'date', label: 'Ends on', kind: 'date' },
          { key: 'status', label: 'Status', kind: 'select', options: [{ id: 'draft', label: 'Draft' }, { id: 'live', label: 'Live' }, { id: 'paused', label: 'Paused' }, { id: 'ended', label: 'Ended' }] },
        ]}
        subtitle={(e) => [e.fields?.code, e.fields?.pct ? `${e.fields.pct}% off` : undefined, e.group, `${formatMoney(Number(e.fields?.spent ?? 0))} spent`, e.date ? `ends ${formatShortDate(e.date)}` : undefined].filter(Boolean).join(' · ')}
        header={(entries) => {
          const live = entries.filter((e) => e.status === 'live');
          const spent = live.reduce((s, e) => s + Number(e.fields?.spent ?? 0), 0);
          const budget = sumAmount(live);
          return <StatRow items={[{ label: 'Live campaigns', value: String(live.length) }, { label: 'Live budget', value: formatMoney(budget) }, { label: 'Budget left', value: formatMoney(budget - spent), alert: budget > 0 && spent > budget * 0.9 }]} />;
        }}
      />
      <Hint>Promo spend comes out of platform revenue, never out of a provider’s payout. Changes to budgets and status are written to the audit log.</Hint>
    </ToolPage>
  );
}

// ─── Helpdesk ───────────────────────────────────────────────────────────────

const TICKET_STATUS = [
  { id: 'open', label: 'Open' },
  { id: 'pending', label: 'Waiting on customer' },
  { id: 'resolved', label: 'Resolved' },
];

export function Helpdesk() {
  const staff = useStaffNames();
  const projects = useDb((s) => s.projects);
  return (
    <ToolPage title="Helpdesk" subtitle="Support tickets from calls, chats and email">
      <EntryList
        ownerId={OWNER}
        tool="platform.tickets"
        noun="ticket"
        statusPill
        groupBy="status"
        groupOrder={['open', 'pending', 'resolved']}
        defaults={{ status: 'open', group: 'Booking', fields: { priority: 'medium' } }}
        sort={(a, b) => ['urgent', 'high', 'medium', 'low'].indexOf(String(a.fields?.priority)) - ['urgent', 'high', 'medium', 'low'].indexOf(String(b.fields?.priority)) || a.createdAt.localeCompare(b.createdAt)}
        fields={[
          { key: 'title', label: 'Issue', kind: 'text', required: true },
          { key: 'f.requester', label: 'From', kind: 'text', placeholder: 'Name and phone' },
          { key: 'group', label: 'Category', kind: 'select', options: ['Payment', 'Booking', 'Account', 'Vendor complaint', 'Freelancer', 'Technical'] },
          { key: 'f.priority', label: 'Priority', kind: 'select', options: ['low', 'medium', 'high', 'urgent'] },
          { key: 'refId', label: 'Wedding', kind: 'select', options: projects.map((p) => ({ id: p.id, label: `${p.code} · ${p.customerName}` })) },
          { key: 'f.assignee', label: 'Owner', kind: 'select', options: staff.map((a) => a.name) },
          { key: 'status', label: 'Status', kind: 'select', options: TICKET_STATUS },
          { key: 'note', label: 'Notes', kind: 'multiline' },
        ]}
        subtitle={(e) => [e.fields?.priority, e.group, e.fields?.requester, e.fields?.assignee ? `→ ${e.fields.assignee}` : 'unassigned', timeAgo(e.createdAt)].filter(Boolean).join(' · ')}
        rowActions={(e) => (e.refId ? [{ label: 'Open wedding', onPress: () => router.push({ pathname: '/platform/project/[id]', params: { id: e.refId! } }) }] : [])}
        header={(entries) => (
          <StatRow
            items={[
              { label: 'Open', value: String(entries.filter((e) => e.status !== 'resolved').length) },
              { label: 'Urgent', value: String(entries.filter((e) => e.status !== 'resolved' && e.fields?.priority === 'urgent').length), alert: entries.some((e) => e.status !== 'resolved' && e.fields?.priority === 'urgent') },
              { label: 'Unassigned', value: String(entries.filter((e) => e.status !== 'resolved' && !e.fields?.assignee).length) },
            ]}
          />
        )}
      />
    </ToolPage>
  );
}

// ─── Macros ─────────────────────────────────────────────────────────────────

const MACROS: [string, string, string][] = [
  ['Payment received', 'Payments', 'Namaste! We have received your payment and the receipt is in the app under My Wedding → Payments. Dhanyabad!'],
  ['Refund timeline', 'Payments', 'Your refund has been approved. It reaches the original eSewa/Khalti/bank account within 7 working days.'],
  ['Vendor running late', 'Wedding day', 'Namaste! The team is on the way and your coordinator is tracking them live. We will update you in 15 minutes.'],
  ['Date change request', 'Bookings', 'We can move your booking if all providers are free on the new date. Please share two preferred dates and we will check today.'],
  ['Verification documents', 'Vendors', 'Please upload a clear photo of your PAN/VAT certificate and citizenship (front and back) under Business → Verification.'],
];

export function Macros() {
  return (
    <ToolPage title="Reply macros" subtitle="Approved answers for the support team">
      <EntryList
        ownerId={OWNER}
        tool="platform.macros"
        noun="macro"
        groupBy="group"
        presets={MACROS.map(([title, group, note]) => ({ title, group, note }))}
        fields={[
          { key: 'title', label: 'Name', kind: 'text', required: true },
          { key: 'group', label: 'Topic', kind: 'select', options: ['Payments', 'Bookings', 'Wedding day', 'Vendors', 'Freelancers', 'Account'] },
          { key: 'note', label: 'Message', kind: 'multiline', required: true },
        ]}
        subtitle={(e) => e.note}
        rowActions={(e) => [{ label: 'Copy', onPress: () => Clipboard.setStringAsync(e.note ?? '').then(() => toast('Copied')) }]}
      />
    </ToolPage>
  );
}

// ─── Vendor recruitment ─────────────────────────────────────────────────────

const RECRUIT_STATUS = [
  { id: 'prospect', label: 'Prospect' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'demo', label: 'Demo done' },
  { id: 'documents', label: 'Documents' },
  { id: 'live', label: 'Live' },
  { id: 'lost', label: 'Not interested' },
];

export function Recruitment() {
  const staff = useStaffNames();
  return (
    <ToolPage title="Vendor recruitment" subtitle="Pipeline of businesses to bring on board">
      <EntryList
        ownerId={OWNER}
        tool="platform.recruit"
        noun="prospect"
        statusPill
        groupBy="status"
        groupOrder={RECRUIT_STATUS.map((s) => s.id)}
        defaults={{ status: 'prospect', fields: { city: 'Kathmandu' } }}
        fields={[
          { key: 'title', label: 'Business', kind: 'text', required: true },
          { key: 'group', label: 'Service', kind: 'select', options: SERVICES.slice(0, 16).map((s) => s.name) },
          { key: 'f.city', label: 'City', kind: 'text' },
          { key: 'f.phone', label: 'Phone', kind: 'text' },
          { key: 'f.owner', label: 'Owner', kind: 'select', options: staff.map((a) => a.name) },
          { key: 'status', label: 'Stage', kind: 'select', options: RECRUIT_STATUS },
          { key: 'date', label: 'Next step on', kind: 'date' },
          { key: 'note', label: 'Notes', kind: 'multiline' },
        ]}
        subtitle={(e) => [e.group, e.fields?.city, e.fields?.owner, e.date ? `next ${relativeDay(e.date)}` : undefined].filter(Boolean).join(' · ')}
        rowActions={(e) => (e.fields?.phone ? [{ label: 'WhatsApp', onPress: () => openWhatsApp('Namaste! This is the Vivah vendor success team. ', String(e.fields?.phone)) }] : [])}
      />
    </ToolPage>
  );
}

// ─── Payout batches ─────────────────────────────────────────────────────────

export function PayoutBatches() {
  const t = useRoleTheme();
  const payables = useDb((s) => s.payables);
  const release = useDb((s) => s.releasePayable);
  const log = useDb((s) => s.log);
  const accounts = useSession((s) => s.accounts);
  const ready = payables.filter((p) => p.status === 'READY');
  const methodOf = (p: Payable) => {
    const acc = accounts.find((a) => a.id === p.payeeId || (a.role === 'vendor' && a.listingId === p.payeeId));
    return { kind: acc?.payoutMethod?.kind ?? 'bank', detail: acc?.payoutMethod?.detail ?? 'Bank details on file' };
  };
  const groups = (['esewa', 'khalti', 'bank'] as const).map((kind) => ({ kind, items: ready.filter((p) => methodOf(p).kind === kind) })).filter((g) => g.items.length);
  const label = { esewa: 'eSewa', khalti: 'Khalti', bank: 'Bank transfer' };
  return (
    <ToolPage title="Payout batches" subtitle="Ready payouts grouped by payout method">
      <StatRow items={[{ label: 'Ready payouts', value: String(ready.length) }, { label: 'Total', value: formatMoney(ready.reduce((s, p) => s + p.amount, 0)) }]} />
      {groups.length === 0 && <EmptyBlock icon="wallet-outline" title="No payouts ready" message="Payouts become ready after the event or when a coordinator marks them ready." />}
      {groups.map((g) => {
        const total = g.items.reduce((s, p) => s + p.amount, 0);
        return (
          <Card key={g.kind} style={{ gap: 8 }}>
            <View style={styles.between}>
              <Text size={16} weight="semibold" color={t.c.textStrong}>
                {label[g.kind]}
              </Text>
              <Text size={15} weight="semibold" color={t.c.textStrong}>
                {formatMoney(total)}
              </Text>
            </View>
            {g.items.map((p) => (
              <Text key={p.id} size={13} color={t.c.text}>
                • {p.payeeName} · {formatMoney(p.amount)} · {methodOf(p).detail}
              </Text>
            ))}
            <View style={styles.actions}>
              <KButton
                label="Export CSV"
                size="sm"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => {
                  exportCsv(g.items.map((p) => ({ payee: p.payeeName, amount: p.amount, method: label[g.kind], account: methodOf(p).detail, label: p.label, due: p.due, id: p.id })), `payouts-${g.kind}-${today()}`);
                  log(currentActor(), 'export.csv', 'payables', g.kind, `${g.items.length} payouts`);
                }}
              />
              <KButton
                label="Release batch"
                size="sm"
                style={{ flex: 1 }}
                onPress={() =>
                  confirm('Release this batch?', `${g.items.length} payouts, ${formatMoney(total)} via ${label[g.kind]}. Only do this after the transfers have been made.`, 'Release', () => {
                    const ref = `BATCH-${g.kind.toUpperCase()}-${shortCode(4)}`;
                    g.items.forEach((p) => release(p.id, ref));
                    toast(`${g.items.length} payouts released · ${ref}`, 'wallet');
                  })
                }
              />
            </View>
          </Card>
        );
      })}
      <Hint>Payouts on hold for a dispute are never included. Each release is audited and notifies the payee.</Hint>
    </ToolPage>
  );
}

// ─── Holidays and closures ──────────────────────────────────────────────────

export function Holidays() {
  const t = useRoleTheme();
  const projects = useDb((s) => s.projects);
  const closures = useToolEntries(OWNER, 'platform.holidays');
  const all = [...NEPAL_HOLIDAYS.map((h) => ({ ...h, custom: false })), ...closures.filter((c) => c.date).map((c) => ({ date: c.date!, name: c.title, custom: true }))].filter((h) => daysUntil(h.date) >= 0).sort((a, b) => a.date.localeCompare(b.date));
  const clashes = (date: string) => projects.flatMap((p) => p.events.filter((e) => e.date === date && e.status !== 'cancelled').map((e) => `${p.code} ${e.name}`));
  return (
    <ToolPage title="Holidays and closures" subtitle="Festivals, bandhs and office closures">
      <Card padded={false} style={{ overflow: 'hidden' }}>
        {all.slice(0, 20).map((h, i) => {
          const c = clashes(h.date);
          return (
            <View key={`${h.date}_${h.name}`} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.border }]}>
              <View style={{ flex: 1 }}>
                <Text size={15} weight="semibold" color={t.c.textStrong}>
                  {h.name}
                </Text>
                <Text size={13} color={c.length ? t.c.danger : t.c.muted}>
                  {formatLongDate(h.date)}
                  {c.length ? ` · clashes with ${c.join(', ')}` : ''}
                </Text>
              </View>
              {h.custom && <StatusPill status="pending" label="Closure" />}
            </View>
          );
        })}
      </Card>
      <EntryList
        ownerId={OWNER}
        tool="platform.holidays"
        noun="closure"
        fields={[
          { key: 'title', label: 'Reason', kind: 'text', required: true, placeholder: 'e.g. Office closed, bandh announced' },
          { key: 'date', label: 'Date', kind: 'date', required: true },
          { key: 'note', label: 'Notes', kind: 'text' },
        ]}
        emptyTitle="No custom closures"
      />
      <Hint>Public holiday dates are approximate; the government notice and the Nepali patro are final. Weddings on festival days need extra transport and crew buffer.</Hint>
    </ToolPage>
  );
}

// ─── On-call roster ─────────────────────────────────────────────────────────

export function OnCall() {
  const t = useRoleTheme();
  const staff = useStaffNames();
  const shifts = useToolEntries(OWNER, 'platform.oncall');
  const next = Array.from({ length: 14 }, (_, i) => addDays(today(), i));
  const gaps = next.filter((d) => !shifts.some((s) => s.date === d));
  const tonight = shifts.filter((s) => s.date === today());
  return (
    <ToolPage title="On-call roster" subtitle="Who picks up the emergency line">
      <Card style={{ gap: 4 }}>
        <Text size={13} color={t.c.muted}>
          On call today
        </Text>
        <Text size={17} weight="semibold" color={t.c.textStrong}>
          {tonight.length ? tonight.map((s) => `${s.title} (${s.group ?? 'all day'})`).join(', ') : 'Nobody yet'}
        </Text>
        {gaps.length > 0 && (
          <Text size={13} color={t.c.danger}>
            {gaps.length} of the next 14 days have no one on call: {gaps.slice(0, 5).map((d) => formatShortDate(d)).join(', ')}
            {gaps.length > 5 ? '…' : ''}
          </Text>
        )}
      </Card>
      <EntryList
        ownerId={OWNER}
        tool="platform.oncall"
        noun="shift"
        defaults={{ date: today(), group: 'Night' }}
        filter={(e) => !!e.date && daysUntil(e.date) >= -1}
        sort={(a, b) => (a.date ?? '').localeCompare(b.date ?? '')}
        fields={[
          { key: 'title', label: 'Staff', kind: 'select', options: staff.map((a) => a.name), required: true },
          { key: 'date', label: 'Date', kind: 'date', required: true },
          { key: 'group', label: 'Shift', kind: 'select', options: ['Morning', 'Evening', 'Night', 'All day'] },
          { key: 'note', label: 'Notes', kind: 'text' },
        ]}
        subtitle={(e) => [e.date ? relativeDay(e.date) : undefined, e.group, e.note].filter(Boolean).join(' · ')}
      />
    </ToolPage>
  );
}

// ─── Post-event QA ──────────────────────────────────────────────────────────

const QA_KEYS = ['punctuality', 'food', 'decor', 'media', 'coordination'] as const;

export function QualityAudits() {
  const projects = useDb((s) => s.projects);
  const done = projects.filter((p) => p.status === 'COMPLETED' || p.status === 'CLOSED' || p.status === 'IN_PROGRESS');
  const audits = useToolEntries(OWNER, 'platform.qa');
  const missing = done.filter((p) => !audits.some((a) => a.refId === p.id));
  const score = (e: { fields?: Record<string, unknown> }) => {
    const vals = QA_KEYS.map((k) => Number(e.fields?.[k] ?? 0)).filter(Boolean);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  };
  return (
    <ToolPage title="Quality audits" subtitle="Score every wedding after the event">
      {missing.length > 0 && (
        <Card padded={false} style={{ overflow: 'hidden' }}>
          {missing.map((p) => (
            <ListRow key={p.id} icon="clipboard-outline" title={`${p.code} needs an audit`} subtitle={`${p.customerName} · ${formatShortDate(p.weddingDate)}`} />
          ))}
        </Card>
      )}
      <EntryList
        ownerId={OWNER}
        tool="platform.qa"
        noun="audit"
        defaults={{ date: today(), fields: { punctuality: 5, food: 5, decor: 5, media: 5, coordination: 5 } }}
        fields={[
          { key: 'refId', label: 'Wedding', kind: 'select', options: done.map((p) => ({ id: p.id, label: `${p.code} · ${p.customerName}` })), required: true },
          { key: 'title', label: 'Summary', kind: 'text', required: true, placeholder: 'e.g. Smooth day, catering ran 40 min late' },
          ...QA_KEYS.map((k) => ({ key: `f.${k}` as const, label: `${k.charAt(0).toUpperCase()}${k.slice(1)} (1–5)`, kind: 'number' as const })),
          { key: 'note', label: 'Follow-ups', kind: 'multiline' },
          { key: 'date', label: 'Audited on', kind: 'date' },
        ]}
        subtitle={(e) => `${projects.find((p) => p.id === e.refId)?.code ?? ''} · ${score(e).toFixed(1)} / 5${e.note ? ` · ${e.note}` : ''}`}
        header={(entries) => (
          <StatRow
            items={[
              { label: 'Audited', value: String(entries.length) },
              { label: 'Average score', value: entries.length ? (entries.reduce((s, e) => s + score(e), 0) / entries.length).toFixed(1) : '—' },
              { label: 'Waiting', value: String(missing.length), alert: missing.length > 0 },
            ]}
          />
        )}
      />
    </ToolPage>
  );
}

// ─── Win-back ───────────────────────────────────────────────────────────────

export function WinBack() {
  const t = useRoleTheme();
  const projects = useDb((s) => s.projects);
  const quotes = useDb((s) => s.quotes);
  const [s, set] = useToolState(OWNER, 'platform.winback', { contacted: [] as string[] });
  const lost = projects.filter((p) => p.status === 'QUOTE_REJECTED' || p.status === 'CANCELLED').map((p) => ({ id: p.id, name: p.customerName, phone: p.customerPhone, why: p.status === 'CANCELLED' ? 'Cancelled wedding' : 'Declined our quote', date: p.weddingDate }));
  const cold = quotes.filter((q) => (q.status === 'declined' || q.status === 'expired') && !lost.some((l) => l.name === q.customerName)).map((q) => ({ id: q.id, name: q.customerName, phone: '', why: `Quote ${q.number} ${q.status}`, date: q.eventDate }));
  const list = [...lost, ...cold].filter((x) => daysUntil(x.date) > 14);
  const mark = (id: string) => set({ contacted: s.contacted.includes(id) ? s.contacted.filter((x) => x !== id) : [...s.contacted, id] });
  return (
    <ToolPage title="Win-back list" subtitle="Couples worth one more conversation">
      <StatRow items={[{ label: 'To call', value: String(list.filter((x) => !s.contacted.includes(x.id)).length) }, { label: 'Contacted', value: String(list.filter((x) => s.contacted.includes(x.id)).length) }]} />
      {list.length === 0 && <EmptyBlock icon="heart-outline" title="No lost couples with a future date" />}
      {list.map((x) => {
        const done = s.contacted.includes(x.id);
        return (
          <Card key={x.id} style={{ gap: 6 }}>
            <View style={styles.between}>
              <Text size={15} weight="semibold" color={done ? t.c.muted : t.c.textStrong}>
                {x.name}
              </Text>
              {done && <StatusPill status="done" label="Contacted" />}
            </View>
            <Text size={13} color={t.c.muted}>
              {x.why} · wedding {formatShortDate(x.date)} ({daysUntil(x.date)} days away)
            </Text>
            <View style={styles.actions}>
              {!!x.phone && <KButton label="WhatsApp" size="sm" variant="secondary" style={{ flex: 1 }} onPress={() => openWhatsApp(`Namaste ${x.name.split(' ')[0]}! This is Vivah. Is your wedding still on for ${formatShortDate(x.date)}? We have new venue and photographer options that may fit better.`, x.phone)} />}
              <KButton label={done ? 'Undo' : 'Mark contacted'} size="sm" variant={done ? 'ghost' : 'primary'} style={{ flex: 1 }} onPress={() => mark(x.id)} />
            </View>
          </Card>
        );
      })}
      <Hint>Only couples whose date is more than two weeks away. Be respectful: one message, and never after they have asked not to be contacted.</Hint>
    </ToolPage>
  );
}

// ─── Export centre ──────────────────────────────────────────────────────────

export function ExportCentre() {
  const s = {
    projects: useDb((st) => st.projects),
    payments: useDb((st) => st.payments),
    payables: useDb((st) => st.payables),
    revenue: useDb((st) => st.revenue),
    reviews: useDb((st) => st.reviews),
    leads: useDb((st) => st.leads),
    log: useDb((st) => st.log),
  };
  const accounts = useSession((st) => st.accounts);
  const sets: { id: string; title: string; subtitle: string; rows: () => Record<string, unknown>[] }[] = [
    { id: 'projects', title: 'Weddings', subtitle: `${s.projects.length} projects`, rows: () => s.projects.map((p) => ({ code: p.code, couple: p.customerName, city: p.city, date: p.weddingDate, guests: p.guests, budget: p.budget, status: p.status, coordinator: p.coordinatorName ?? '', source: p.source })) },
    { id: 'payments', title: 'Customer payments', subtitle: `${s.payments.length} payments`, rows: () => s.payments.map((p) => ({ receipt: p.receiptNo, project: p.projectId, payer: p.payerName, amount: p.amount, method: p.method, status: p.status, refunded: p.refunded, at: p.at })) },
    { id: 'payables', title: 'Payouts', subtitle: `${s.payables.length} payables`, rows: () => s.payables.map((p) => ({ payee: p.payeeName, kind: p.payeeKind, amount: p.amount, status: p.status, due: p.due, paidAt: p.paidAt ?? '', reference: p.reference ?? '', label: p.label })) },
    { id: 'revenue', title: 'Platform revenue', subtitle: `${s.revenue.length} entries`, rows: () => s.revenue.map((r) => ({ kind: r.kind, amount: r.amount, project: r.projectId ?? '', provider: r.providerId ?? '', note: r.note ?? '', at: r.at })) },
    { id: 'reviews', title: 'Reviews', subtitle: `${s.reviews.length} reviews`, rows: () => s.reviews.map((r) => ({ target: r.targetName, author: r.authorName, rating: r.overall, status: r.status, text: r.text, at: r.at })) },
    { id: 'leads', title: 'Vendor enquiries', subtitle: `${s.leads.length} leads`, rows: () => s.leads.map((l) => ({ listing: l.listingName, couple: l.customerName, city: l.city, date: l.eventDate, guests: l.guests ?? '', status: l.status, created: l.createdAt })) },
    { id: 'accounts', title: 'Accounts', subtitle: `${accounts.length} accounts`, rows: () => accounts.map((a) => ({ name: a.name, role: a.role, city: a.city, verified: a.verified, suspended: !!a.suspended, created: a.createdAt })) },
  ];
  return (
    <ToolPage title="Export centre" subtitle="CSV downloads for finance and reporting">
      <Card padded={false} style={{ overflow: 'hidden' }}>
        {sets.map((x) => (
          <ListRow
            key={x.id}
            icon="download-outline"
            title={x.title}
            subtitle={x.subtitle}
            onPress={() => {
              exportCsv(x.rows(), `vivah-${x.id}-${today()}`);
              s.log(currentActor(), 'export.csv', x.id, 'all', `${x.rows().length} rows`);
            }}
          />
        ))}
      </Card>
      <Hint>Account exports leave out phone numbers on purpose. Every export is recorded in the audit log with who downloaded it.</Hint>
    </ToolPage>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 11 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
