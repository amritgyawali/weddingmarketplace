/** Vendor toolkit: saved replies, follow-ups, site visits, reply-time goals, policies and business hours. */
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, ChoiceChips, KButton, KField, ListRow, SectionTitle, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { toast } from '@/components/ui/Toast';
import { useVendorWorkspace } from '@/hooks/useWorkspace';
import { hoursBetween } from '@/services/toolkit';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Lead } from '@/types/platform';
import { daysUntil, formatClock, formatMoney, formatShortDate, percent, relativeDay, timeAgo } from '@/utils/format';
import { openWhatsApp, shareMessage } from '@/utils/links';

import { Col, Cols, EntryList, Hint, Line, NumberField, StatRow, ToolPage, useToolState } from '../core';

const firstName = (name: string) => name.split(' ')[0];

/** Fill {name}, {date}, {guests}, {business} placeholders from a lead. */
export function fillTemplate(text: string, lead: Lead | undefined, business: string) {
  return text
    .replace(/\{name\}/g, lead ? firstName(lead.customerName) : 'ji')
    .replace(/\{date\}/g, lead ? formatShortDate(lead.eventDate) : 'your date')
    .replace(/\{guests\}/g, lead?.guests ? String(lead.guests) : 'your')
    .replace(/\{business\}/g, business);
}

// ─── Saved replies ──────────────────────────────────────────────────────────

const REPLIES: [string, string][] = [
  ['First reply', 'Namaste {name}! Thank you for thinking of {business} for {date}. The date is currently open. Could we call you today to understand your plans for {guests} guests?'],
  ['Site visit invite', 'Namaste {name}, you are welcome to visit us any day between 10 AM and 6 PM. Saturdays get busy, so please tell us a time and we will keep the hall ready for you.'],
  ['Quote follow-up', 'Namaste {name}, just checking whether you had a chance to look at our quotation for {date}. Happy to adjust the package if anything does not fit.'],
  ['Date is taken', 'Namaste {name}, we are sorry — {date} is already booked. We have availability two days before and after; would either work for your family?'],
  ['Thank you after the event', 'Dhanyabad {name}! It was an honour to be part of your wedding. If you have a minute, a review on Vivah would help us a lot.'],
];

export function SavedReplies() {
  const t = useRoleTheme();
  const account = useAccount();
  const { leads } = useVendorWorkspace(account);
  const recent = leads.filter((l) => l.status !== 'archived' && l.status !== 'lost').slice(0, 6);
  const [leadId, setLeadId] = useState<string | undefined>(recent[0]?.id);
  const lead = recent.find((l) => l.id === leadId);
  const business = account.businessName ?? account.name;
  return (
    <ToolPage title="Saved replies" subtitle="Answer enquiries in seconds">
      <Card style={{ gap: 8 }}>
        <Text size={13} weight="medium" color={t.c.text}>
          Fill in details for
        </Text>
        {recent.length ? (
          <ChoiceChips options={recent.map((l) => l.customerName)} selected={lead ? [lead.customerName] : []} onToggle={(n) => setLeadId(recent.find((l) => l.customerName === n)?.id)} />
        ) : (
          <Hint>No open enquiries — placeholders will be left generic.</Hint>
        )}
        <Text size={12} color={t.c.subtle}>
          Placeholders: {'{name}'}, {'{date}'}, {'{guests}'}, {'{business}'}
        </Text>
      </Card>
      <EntryList
        ownerId={account.id}
        tool="vendor.replies"
        noun="reply"
        presets={REPLIES.map(([title, note]) => ({ title, note }))}
        fields={[
          { key: 'title', label: 'Name', kind: 'text', required: true },
          { key: 'note', label: 'Message', kind: 'multiline', required: true },
        ]}
        subtitle={(e) => fillTemplate(e.note ?? '', lead, business)}
        rowActions={(e) => [
          { label: 'Copy', onPress: () => Clipboard.setStringAsync(fillTemplate(e.note ?? '', lead, business)).then(() => toast('Copied')) },
          ...(lead ? [{ label: 'WhatsApp', onPress: () => openWhatsApp(fillTemplate(e.note ?? '', lead, business), lead.customerPhone) }] : []),
        ]}
      />
    </ToolPage>
  );
}

// ─── Follow-ups ─────────────────────────────────────────────────────────────

export function FollowUps() {
  const t = useRoleTheme();
  const account = useAccount();
  const { leads } = useVendorWorkspace(account);
  const open = leads.filter((l) => !['won', 'lost', 'archived'].includes(l.status));
  const crm = open.filter((l) => l.followUp).sort((a, b) => a.followUp!.localeCompare(b.followUp!));
  return (
    <ToolPage title="Follow-ups" subtitle="Never let a warm enquiry go cold">
      {crm.length > 0 && (
        <View>
          <SectionTitle title="Set on your leads" />
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {crm.map((l) => (
              <ListRow
                key={l.id}
                icon="person-outline"
                title={l.customerName}
                subtitle={`${relativeDay(l.followUp!)} · ${l.status} · event ${formatShortDate(l.eventDate)}`}
                trailing={daysUntil(l.followUp!) < 0 ? <StatusPill status="overdue" /> : undefined}
                onPress={() => router.push({ pathname: '/business/lead/[id]', params: { id: l.id } })}
              />
            ))}
          </Card>
        </View>
      )}
      <EntryList
        ownerId={account.id}
        tool="vendor.followups"
        noun="follow-up"
        checklist
        sort={(a, b) => Number(!!a.done) - Number(!!b.done) || (a.date ?? '').localeCompare(b.date ?? '')}
        fields={[
          { key: 'refId', label: 'Enquiry', kind: 'select', options: open.map((l) => ({ id: l.id, label: l.customerName })), required: true },
          { key: 'title', label: 'What to do', kind: 'text', required: true, placeholder: 'e.g. Send revised menu, call about the advance' },
          { key: 'date', label: 'When', kind: 'date', required: true },
          { key: 'time', label: 'Time', kind: 'time' },
        ]}
        subtitle={(e) => {
          const l = leads.find((x) => x.id === e.refId);
          return [l?.customerName, e.date ? relativeDay(e.date) : undefined, e.time ? formatClock(e.time) : undefined].filter(Boolean).join(' · ');
        }}
        rowActions={(e) => {
          const l = leads.find((x) => x.id === e.refId);
          return l ? [{ label: 'WhatsApp', onPress: () => openWhatsApp(`Namaste ${firstName(l.customerName)}! `, l.customerPhone) }] : [];
        }}
        header={(entries) => (
          <StatRow
            items={[
              { label: 'Due today', value: String(entries.filter((e) => !e.done && e.date && daysUntil(e.date) === 0).length) },
              { label: 'Overdue', value: String(entries.filter((e) => !e.done && e.date && daysUntil(e.date) < 0).length), alert: entries.some((e) => !e.done && e.date && daysUntil(e.date) < 0) },
              { label: 'Open enquiries', value: String(open.length) },
            ]}
          />
        )}
      />
      <Text size={12} color={t.c.subtle}>
        Couples who hear back within a day are about three times more likely to book a visit.
      </Text>
    </ToolPage>
  );
}

// ─── Site visits ────────────────────────────────────────────────────────────

const VISIT_STATUS = [
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'done', label: 'Visited' },
  { id: 'booked', label: 'Booked after visit' },
  { id: 'no_show', label: 'No show' },
];

export function SiteVisits() {
  const account = useAccount();
  const { leads } = useVendorWorkspace(account);
  return (
    <ToolPage title="Site visits" subtitle="Tours, tastings and walk-throughs">
      <EntryList
        ownerId={account.id}
        tool="vendor.visits"
        noun="visit"
        statusPill
        defaults={{ status: 'scheduled' }}
        sort={(a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (a.time ?? '').localeCompare(b.time ?? '')}
        fields={[
          { key: 'title', label: 'Couple or family', kind: 'text', required: true },
          { key: 'refId', label: 'Linked enquiry', kind: 'select', options: leads.map((l) => ({ id: l.id, label: l.customerName })) },
          { key: 'date', label: 'Date', kind: 'date', required: true },
          { key: 'time', label: 'Time', kind: 'time' },
          { key: 'f.host', label: 'Shown by', kind: 'text' },
          { key: 'status', label: 'Status', kind: 'select', options: VISIT_STATUS },
          { key: 'note', label: 'What they liked / asked', kind: 'multiline' },
        ]}
        subtitle={(e) => [e.date ? relativeDay(e.date) : undefined, e.time ? formatClock(e.time) : undefined, e.fields?.host ? `with ${e.fields.host}` : undefined, e.note].filter(Boolean).join(' · ')}
        header={(entries) => {
          const visited = entries.filter((e) => e.status === 'done' || e.status === 'booked').length;
          return (
            <StatRow
              items={[
                { label: 'Next 7 days', value: String(entries.filter((e) => e.status === 'scheduled' && e.date && daysUntil(e.date) >= 0 && daysUntil(e.date) <= 7).length) },
                { label: 'Visited', value: String(visited) },
                { label: 'Visit → booking', value: percent(visited ? entries.filter((e) => e.status === 'booked').length / visited : 0) },
              ]}
            />
          );
        }}
      />
    </ToolPage>
  );
}

// ─── Reply-time goals ───────────────────────────────────────────────────────

/** Hours from enquiry to the first status change away from "new", or null while unanswered. */
const responseHours = (l: Lead) => {
  const first = (l.history ?? []).filter((h) => h.status !== 'new').sort((a, b) => a.at.localeCompare(b.at))[0];
  return first ? hoursBetween(l.createdAt, first.at) : null;
};

export function ResponseTime() {
  const t = useRoleTheme();
  const account = useAccount();
  const { leads } = useVendorWorkspace(account);
  const [s, set] = useToolState(account.id, 'vendor.response', { targetHours: 2 });
  const answered = leads.map((l) => ({ l, h: responseHours(l) })).filter((x): x is { l: Lead; h: number } => x.h !== null);
  const sorted = answered.map((x) => x.h).sort((a, b) => a - b);
  const med = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const within = answered.filter((x) => x.h <= Number(s.targetHours)).length;
  const waiting = leads.filter((l) => l.status === 'new').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return (
    <ToolPage title="Reply-time goal" subtitle="How fast couples hear back from you">
      <StatRow
        items={[
          { label: 'Median first reply', value: sorted.length ? `${med < 1 ? Math.round(med * 60) + ' min' : med.toFixed(1) + ' h'}` : '—' },
          { label: `Within ${s.targetHours} h`, value: percent(answered.length ? within / answered.length : 0) },
          { label: 'Waiting now', value: String(waiting.length), alert: waiting.length > 0 },
        ]}
      />
      <Card style={{ gap: 8 }}>
        <NumberField label="Your target (hours)" value={Number(s.targetHours)} onChange={(n) => set({ targetHours: Math.max(1, n) })} />
        <Hint>Faster replies raise your response score, which is 5 of the 100 matching points Vivah uses to recommend providers.</Hint>
      </Card>
      {waiting.length > 0 && (
        <View>
          <SectionTitle title="Still waiting for a reply" />
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {waiting.map((l) => (
              <ListRow key={l.id} icon="alert-circle-outline" title={l.customerName} subtitle={`Asked ${timeAgo(l.createdAt)} · ${l.guests ?? '?'} guests · ${formatShortDate(l.eventDate)}`} onPress={() => router.push({ pathname: '/business/lead/[id]', params: { id: l.id } })} />
            ))}
          </Card>
        </View>
      )}
      <Text size={12} color={t.c.subtle}>
        Measured from the enquiry to the first time you moved it past “new”.
      </Text>
    </ToolPage>
  );
}

// ─── Cancellation policy ────────────────────────────────────────────────────

export function PolicyBuilder() {
  const t = useRoleTheme();
  const account = useAccount();
  const [s, set] = useToolState(account.id, 'vendor.policy', { advance: 30, over90: 90, d30to90: 50, d7to30: 25, under7: 0, changeFee: 5_000, freeChanges: 1 });
  const text = `Booking and cancellation policy — ${account.businessName ?? account.name}

• A ${s.advance}% advance confirms the booking; dates are not held without it.
• Cancelled more than 90 days before the event: ${s.over90}% of the advance is refunded.
• Cancelled 30–90 days before: ${s.d30to90}% refunded.
• Cancelled 7–30 days before: ${s.d7to30}% refunded.
• Cancelled within 7 days: ${s.under7 ? `${s.under7}% refunded` : 'no refund'}.
• ${Number(s.freeChanges) ? `${s.freeChanges} date change${Number(s.freeChanges) > 1 ? 's are' : ' is'} free, subject to availability; after that` : 'Each date change'} costs ${formatMoney(Number(s.changeFee))}.
• Refunds are processed through Vivah within 7 working days to the original payment method.
• Events postponed by government order or natural disaster can be moved once without a fee.`;
  const tiers: { id: 'over90' | 'd30to90' | 'd7to30' | 'under7'; label: string }[] = [
    { id: 'over90', label: 'More than 90 days' },
    { id: 'd30to90', label: '30–90 days' },
    { id: 'd7to30', label: '7–30 days' },
    { id: 'under7', label: 'Under 7 days' },
  ];
  return (
    <ToolPage title="Cancellation policy" subtitle="Clear terms couples can trust">
      <Card style={{ gap: 10 }}>
        <NumberField label="Advance to confirm (%)" value={Number(s.advance)} onChange={(n) => set({ advance: Math.min(100, n) })} />
        <SectionTitle title="Refund of the advance if cancelled" />
        <Cols>
          {tiers.slice(0, 2).map((x) => (
            <Col key={x.id}>
              <NumberField label={`${x.label} (%)`} value={Number(s[x.id])} onChange={(n) => set({ [x.id]: Math.min(100, n) })} />
            </Col>
          ))}
        </Cols>
        <Cols>
          {tiers.slice(2).map((x) => (
            <Col key={x.id}>
              <NumberField label={`${x.label} (%)`} value={Number(s[x.id])} onChange={(n) => set({ [x.id]: Math.min(100, n) })} />
            </Col>
          ))}
        </Cols>
        <Cols>
          <Col>
            <NumberField label="Date-change fee" money value={Number(s.changeFee)} onChange={(n) => set({ changeFee: n })} />
          </Col>
          <Col>
            <NumberField label="Free date changes" value={Number(s.freeChanges)} onChange={(n) => set({ freeChanges: Math.min(5, n) })} />
          </Col>
        </Cols>
      </Card>
      <Card>
        <Text size={14} color={t.c.text} lineHeight={21}>
          {text}
        </Text>
      </Card>
      <Cols>
        <Col>
          <KButton label="Copy" variant="secondary" icon="copy-outline" onPress={() => Clipboard.setStringAsync(text).then(() => toast('Policy copied'))} />
        </Col>
        <Col>
          <KButton label="Share" icon="share-outline" onPress={() => shareMessage(text)} />
        </Col>
      </Cols>
      <Hint>Paste this into your quotation terms so every couple sees the same rules. Vivah’s platform terms still apply to bookings made through Vivah.</Hint>
    </ToolPage>
  );
}

// ─── Business hours and away message ────────────────────────────────────────

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function BusinessHours() {
  const t = useRoleTheme();
  const account = useAccount();
  const [s, set] = useToolState(account.id, 'vendor.hours', {
    open: '10:00',
    close: '19:00',
    closedDays: ['Saturday'] as string[],
    away: false as boolean,
    awayMessage: 'Namaste! We are away for a family festival and will reply by tomorrow evening. For urgent bookings call us directly. Dhanyabad!',
  });
  const weekday = DAYS[new Date().getDay()];
  const openToday = !s.closedDays.includes(weekday);
  return (
    <ToolPage title="Hours and away message" subtitle="Tell couples when to expect a reply">
      <Card style={{ gap: 10 }}>
        <Cols>
          <Col>
            <KField label="Opens" value={String(s.open)} onChangeText={(v) => set({ open: v })} placeholder="HH:mm" autoCapitalize="none" />
          </Col>
          <Col>
            <KField label="Closes" value={String(s.close)} onChangeText={(v) => set({ close: v })} placeholder="HH:mm" autoCapitalize="none" />
          </Col>
        </Cols>
        <Text size={13} weight="medium" color={t.c.text}>
          Closed on
        </Text>
        <ChoiceChips options={DAYS} selected={s.closedDays} onToggle={(d) => set({ closedDays: s.closedDays.includes(d) ? s.closedDays.filter((x) => x !== d) : [...s.closedDays, d] })} />
        <Line label="Today" value={openToday ? `Open ${s.open}–${s.close}` : 'Closed'} tone={openToday ? 'success' : 'danger'} />
      </Card>
      <Card style={{ gap: 10 }}>
        <View style={styles.between}>
          <View style={{ flex: 1 }}>
            <Text size={15} weight="semibold" color={t.c.textStrong}>
              Away mode
            </Text>
            <Text size={12} color={t.c.muted}>
              Use during Dashain, Tihar or when you’re fully booked
            </Text>
          </View>
          <Toggle value={!!s.away} onValueChange={(v) => { set({ away: v }); toast(v ? 'Away message on' : 'Away message off'); }} accessibilityLabel="Away mode" />
        </View>
        <KField label="Away message" value={String(s.awayMessage)} onChangeText={(v) => set({ awayMessage: v })} multiline />
        <KButton label="Copy away message" size="sm" variant="secondary" onPress={() => Clipboard.setStringAsync(String(s.awayMessage)).then(() => toast('Copied'))} />
      </Card>
      <Hint>Your hours show on your storefront. Paste the away message as your first reply when away mode is on.</Hint>
    </ToolPage>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
});
