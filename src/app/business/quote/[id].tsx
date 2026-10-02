import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { EmptyBlock, KButton, StackHeader, StatusPill } from '@/components/kit';
import { toast } from '@/components/ui/Toast';
import { QuoteDocument } from '@/components/work/QuoteDocument';
import { QuoteEditor } from '@/components/work/QuoteEditor';
import { DEFAULT_SCHEDULE } from '@/services/pricing';
import { DEFAULT_TERMS, nextQuoteNumber, TAX_RATE } from '@/services/quotes';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Quotation } from '@/types/platform';
import { addDays, today, uid } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

/** Create (id = "new", with ?leadId) or edit a vendor quotation. Sent quotes are revised as new versions. */
export default function VendorQuoteScreen() {
  const t = useRoleTheme();
  const account = useAccount();
  const { id, leadId } = useLocalSearchParams<{ id: string; leadId?: string }>();
  const quotes = useDb((s) => s.quotes);
  const lead = useDb((s) => s.leads.find((l) => l.id === leadId));
  const saveQuote = useDb((s) => s.saveQuote);
  const sendQuote = useDb((s) => s.sendQuote);
  const reviseQuote = useDb((s) => s.reviseQuote);
  const existing = quotes.find((q) => q.id === id);

  // Build a new draft once; later store updates must not reset what the vendor is typing.
  const [draft] = useState<Quotation | null>(() => {
    if (existing || !lead) return null;
    const now = new Date().toISOString();
    return {
      id: uid('qt'),
      number: nextQuoteNumber(quotes.map((q) => q.number)),
      fromKind: 'vendor',
      fromId: account.id,
      fromName: account.businessName ?? account.name,
      listingId: account.listingId,
      category: account.categoryId ?? 'default',
      leadId: lead.id,
      customerId: lead.customerId,
      customerName: lead.customerName,
      eventDate: lead.eventDate,
      city: lead.city,
      version: 1,
      items: [],
      discount: 0,
      serviceFee: 0,
      taxRate: TAX_RATE,
      notes: '',
      terms: DEFAULT_TERMS,
      validUntil: addDays(today(), 15),
      schedule: DEFAULT_SCHEDULE,
      status: 'draft',
      versions: [],
      createdAt: now,
      updatedAt: now,
    };
  });
  const quote = existing ?? draft;

  if (!quote) {
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg }}>
        <StackHeader title="Quotation" />
        <EmptyBlock title="Quotation not found" />
      </View>
    );
  }

  const editable = quote.status === 'draft';

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title={existing ? `${existing.number} · v${existing.version}` : 'New quotation'} subtitle={quote.customerName} right={existing ? <StatusPill status={existing.status} /> : undefined} />
      {editable ? (
        <QuoteEditor
          key={`${quote.id}-${quote.version}`}
          initial={quote}
          onSave={(q, send, summary) => {
            saveQuote(q);
            if (send) {
              sendQuote(q.id, summary);
              toast(`${q.number} v${q.version} sent to ${q.customerName}`, 'paper-plane');
            } else toast('Draft saved');
            router.back();
          }}
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}>
          <QuoteDocument quote={quote} />
          {(quote.status === 'revision' || quote.status === 'sent' || quote.status === 'viewed') && (
            <KButton label={`Revise → version ${quote.versions.length + 1}`} icon="create-outline" onPress={() => reviseQuote(quote.id)} />
          )}
        </ScrollView>
      )}
    </View>
  );
}
