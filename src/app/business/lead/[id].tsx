import { router, useLocalSearchParams } from 'expo-router';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar, Card, EmptyBlock, KButton, KeyValue, ListRow, SectionTitle, StackHeader, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { quoteTotals } from '@/services/quotes';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import { daysUntil, formatINR, formatLongDate, formatShortDate } from '@/utils/format';

export default function LeadDetail() {
  const t = useRoleTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const lead = useDb((s) => s.leads.find((l) => l.id === id));
  const allQuotes = useDb((s) => s.quotes);
  const setLeadStatus = useDb((s) => s.setLeadStatus);

  if (!lead) {
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg }}>
        <StackHeader title="Lead" />
        <EmptyBlock title="Lead not found" />
      </View>
    );
  }
  const quotes = allQuotes.filter((q) => q.leadId === lead.id);
  const phone = lead.customerPhone.replace(/\D/g, '');

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title={lead.customerName} subtitle={`Lead · ${formatShortDate(lead.createdAt)}`} right={<StatusPill status={lead.status} />} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        <Card style={{ gap: 14 }}>
          <View style={styles.row}>
            <Avatar name={lead.customerName} size={52} />
            <View style={{ flex: 1 }}>
              <Text size={18} weight="bold" color={t.c.textStrong}>
                {lead.customerName}
              </Text>
              <Text size={13} color={t.c.muted}>
                +91 {lead.customerPhone} · {lead.city}
              </Text>
            </View>
          </View>
          <View style={styles.row}>
            <KButton
              label="Call"
              icon="call-outline"
              variant="secondary"
              size="sm"
              style={{ flex: 1 }}
              onPress={() => {
                if (lead.status === 'new') setLeadStatus(lead.id, 'contacted');
                Linking.openURL(`tel:+91${phone}`);
              }}
            />
            <KButton
              label="WhatsApp"
              icon="logo-whatsapp"
              variant="secondary"
              size="sm"
              style={{ flex: 1 }}
              onPress={() => {
                if (lead.status === 'new') setLeadStatus(lead.id, 'contacted');
                Linking.openURL(`https://wa.me/91${phone}?text=${encodeURIComponent(`Hi ${lead.customerName.split(' ')[0]}, thanks for your enquiry with ${lead.listingName}!`)}`);
              }}
            />
          </View>
        </Card>

        <Card style={{ gap: 4 }}>
          <SectionTitle title="Requirement" />
          <KeyValue label="Event date" value={`${formatLongDate(lead.eventDate)} (${daysUntil(lead.eventDate)} days)`} />
          <KeyValue label="Functions" value={lead.functions.join(', ')} />
          <KeyValue label="Guests" value={lead.guests ? String(lead.guests) : 'Not shared'} />
          {!!lead.budget && <KeyValue label="Budget" value={formatINR(lead.budget)} />}
          <KeyValue label="Enquired for" value={lead.listingName} />
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
                No quotation sent yet. Couples who get a quote within 2 hours are 3× more likely to book.
              </Text>
            </Card>
          ) : (
            <Card padded={false} style={{ overflow: 'hidden' }}>
              {quotes.map((q) => (
                <ListRow
                  key={q.id}
                  icon="document-text-outline"
                  title={`${q.number} · ${formatINR(quoteTotals(q).total)}`}
                  subtitle={`Updated ${formatShortDate(q.updatedAt)}`}
                  trailing={<StatusPill status={q.status} />}
                  onPress={() => router.push({ pathname: '/business/quote/[id]', params: { id: q.id } })}
                />
              ))}
            </Card>
          )}
        </View>

        {lead.status !== 'won' && lead.status !== 'lost' && (
          <View style={{ gap: 10 }}>
            <KButton label="Create quotation" icon="add-circle-outline" size="lg" onPress={() => router.push({ pathname: '/business/quote/[id]', params: { id: 'new', leadId: lead.id } })} />
            <View style={styles.row}>
              {lead.status === 'new' && (
                <KButton label="Mark contacted" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => { setLeadStatus(lead.id, 'contacted'); toast('Marked as contacted'); }} />
              )}
              <KButton label="Mark lost" variant="danger" size="sm" style={{ flex: 1 }} onPress={() => { setLeadStatus(lead.id, 'lost'); toast('Lead closed', 'close-circle'); }} />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  msg: { borderRadius: 10, padding: 12, marginTop: 8 },
});
