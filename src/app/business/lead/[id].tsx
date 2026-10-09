import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Avatar, Card, ChoiceChips, EmptyBlock, KButton, KeyValue, KField, ListRow, SectionTitle, StackHeader, StatusPill } from '@/components/kit';
import { Calendar } from '@/components/ui/Calendar';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { serviceName } from '@/data/services';
import { quoteTotals } from '@/services/quotes';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { LeadStatus } from '@/types/platform';
import { daysUntil, formatLongDate, formatMoney, formatPhone, formatShortDate, timeAgo } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

const STATUSES: LeadStatus[] = ['new', 'contacted', 'responded', 'quoted', 'negotiating', 'meeting', 'won', 'lost', 'archived'];
const LABELS = ['Site visit', 'Big wedding', 'Budget', 'Repeat family', 'Destination', 'VIP'];

/** Lead CRM record: status pipeline, priority, labels, follow-ups, notes, quotations. */
export default function LeadDetail() {
  const t = useRoleTheme();
  const account = useAccount();
  const { id } = useLocalSearchParams<{ id: string }>();
  const lead = useDb((s) => s.leads.find((l) => l.id === id));
  const allQuotes = useDb((s) => s.quotes);
  const threads = useDb((s) => s.threads);
  const setLeadStatus = useDb((s) => s.setLeadStatus);
  const updateLead = useDb((s) => s.updateLead);
  const addNote = useDb((s) => s.addLeadNote);
  const [note, setNote] = useState('');
  const [followOpen, setFollowOpen] = useState(false);

  if (!lead) {
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg }}>
        <StackHeader title="Lead" />
        <EmptyBlock title="Lead not found" />
      </View>
    );
  }
  const quotes = allQuotes.filter((q) => q.leadId === lead.id);
  const thread = threads.find((th) => th.kind === 'direct' && th.listingId === lead.listingId && th.members.some((m) => m.id === lead.customerId));
  const phone = lead.customerPhone.replace(/\D/g, '');
  const touch = () => lead.status === 'new' && setLeadStatus(lead.id, 'contacted');

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title={lead.customerName} subtitle={`Lead · ${timeAgo(lead.createdAt)}`} right={<StatusPill status={lead.status} />} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        <Card style={{ gap: 14 }}>
          <View style={styles.row}>
            <Avatar name={lead.customerName} size={52} />
            <View style={{ flex: 1 }}>
              <Text size={18} weight="bold" color={t.c.textStrong}>
                {lead.customerName}
              </Text>
              <Text size={13} color={t.c.muted}>
                {formatPhone(lead.customerPhone)} · {lead.city}
              </Text>
            </View>
          </View>
          <View style={styles.row}>
            <KButton label="Call" icon="call-outline" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => { touch(); Linking.openURL(`tel:+977${phone}`); }} />
            <KButton label="WhatsApp" icon="logo-whatsapp" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => { touch(); Linking.openURL(`https://wa.me/977${phone}?text=${encodeURIComponent(`Namaste ${lead.customerName.split(' ')[0]}, thank you for your enquiry with ${lead.listingName}!`)}`); }} />
            {thread && <KButton label="Chat" icon="chatbubbles-outline" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => { touch(); router.push({ pathname: '/business/inbox/[id]', params: { id: thread.id } }); }} />}
          </View>
        </Card>

        <Card style={{ gap: 10 }}>
          <SectionTitle title="Pipeline" />
          <ChoiceChips options={STATUSES} selected={[lead.status]} onToggle={(s) => { setLeadStatus(lead.id, s as LeadStatus); toast(`Moved to ${s}`); }} />
          <Text size={13} weight="semibold" color={t.c.muted}>
            Priority
          </Text>
          <ChoiceChips options={['low', 'medium', 'high']} selected={[lead.priority ?? 'medium']} onToggle={(p) => updateLead(lead.id, { priority: p as 'low' | 'medium' | 'high' })} />
          <Text size={13} weight="semibold" color={t.c.muted}>
            Labels
          </Text>
          <ChoiceChips options={LABELS} selected={lead.labels ?? []} onToggle={(l) => updateLead(lead.id, { labels: (lead.labels ?? []).includes(l) ? (lead.labels ?? []).filter((x) => x !== l) : [...(lead.labels ?? []), l] })} />
          <ListRow icon="alarm-outline" title={lead.followUp ? `Follow up ${formatShortDate(lead.followUp)}` : 'Set a follow-up reminder'} subtitle={lead.followUp ? (daysUntil(lead.followUp) <= 0 ? 'Due today' : `In ${daysUntil(lead.followUp)} days`) : undefined} onPress={() => setFollowOpen(true)} />
          {lead.history && lead.history.length > 1 && (
            <Text size={11} color={t.c.muted}>
              {lead.history.map((h) => `${h.status} ${formatShortDate(h.at)}`).join(' → ')}
            </Text>
          )}
        </Card>

        <Card style={{ gap: 4 }}>
          <SectionTitle title="Requirement" />
          <KeyValue label="Event date" value={`${formatLongDate(lead.eventDate)} (${daysUntil(lead.eventDate)} days)`} />
          <KeyValue label="Functions" value={lead.functions.join(', ')} />
          {!!lead.services?.length && <KeyValue label="Services" value={lead.services.map(serviceName).join(', ')} />}
          <KeyValue label="Guests" value={lead.guests ? String(lead.guests) : 'Not shared'} />
          {!!lead.budget && <KeyValue label="Budget" value={formatMoney(lead.budget)} />}
          <KeyValue label="Lead value" value={lead.budget ? formatMoney(lead.budget) : '—'} />
          {!!lead.message && (
            <View style={[styles.msg, { backgroundColor: t.c.surfaceAlt }]}>
              <Text size={14} color={t.c.text}>
                “{lead.message}”
              </Text>
            </View>
          )}
        </Card>

        <View>
          <SectionTitle title="Quotations" />
          {quotes.length === 0 ? (
            <Card>
              <Text size={14} color={t.c.muted}>
                No quotation yet. Couples who get a quote within 2 hours are 3× more likely to book.
              </Text>
            </Card>
          ) : (
            <Card padded={false} style={{ overflow: 'hidden' }}>
              {quotes.map((q) => (
                <ListRow key={q.id} icon="document-text-outline" title={`${q.number} v${q.version} · ${formatMoney(quoteTotals(q).total)}`} subtitle={`Updated ${formatShortDate(q.updatedAt)}`} trailing={<StatusPill status={q.status} />} onPress={() => router.push({ pathname: '/business/quote/[id]', params: { id: q.id } })} />
              ))}
            </Card>
          )}
        </View>

        <Card style={{ gap: 10 }}>
          <SectionTitle title="Notes" />
          <KField placeholder="Add a note (call outcome, preferences…)" value={note} onChangeText={setNote} multiline maxLength={500} />
          <KButton label="Save note" size="sm" missing={!note.trim() && 'Write the note first'} onPress={() => { addNote(lead.id, note.trim(), account.name); setNote(''); }} />
          {(lead.notes ?? []).map((n) => (
            <View key={n.id} style={{ gap: 2 }}>
              <Text size={13} color={t.c.text}>
                {n.text}
              </Text>
              <Text size={11} color={t.c.muted}>
                {n.by} · {timeAgo(n.at)}
              </Text>
            </View>
          ))}
        </Card>

        {lead.status !== 'won' && lead.status !== 'lost' && (
          <View style={{ gap: 10 }}>
            <KButton label="Create quotation" icon="add-circle-outline" size="lg" onPress={() => router.push({ pathname: '/business/quote/[id]', params: { id: 'new', leadId: lead.id } })} />
            <KButton label="Mark lost" variant="danger" size="sm" onPress={() => { setLeadStatus(lead.id, 'lost'); toast('Lead closed', 'close-circle'); }} />
          </View>
        )}
      </ScrollView>
      <Sheet visible={followOpen} onClose={() => setFollowOpen(false)} title="Follow-up date">
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          <Calendar value={lead.followUp ?? null} onChange={(d) => { updateLead(lead.id, { followUp: d }); setFollowOpen(false); toast(`Reminder set for ${formatShortDate(d)}`, 'alarm'); }} />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  msg: { borderRadius: 10, padding: 12, marginTop: 8 },
});
