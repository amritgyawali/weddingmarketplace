import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { EmptyBlock, StackHeader, StatusPill } from '@/components/kit';
import { toast } from '@/components/ui/Toast';
import { QuoteDocument } from '@/components/work/QuoteDocument';
import { QuoteEditor } from '@/components/work/QuoteEditor';
import { day } from '@/data/seed';
import { DEFAULT_TERMS, GST_RATE, nextQuoteNumber } from '@/services/quotes';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Quotation } from '@/types/platform';
import { uid } from '@/utils/format';

/** Create (id = "new", with ?leadId) or edit a vendor quotation. */
export default function VendorQuoteScreen() {
  const t = useRoleTheme();
  const account = useAccount();
  const { id, leadId } = useLocalSearchParams<{ id: string; leadId?: string }>();
  const quotes = useDb((s) => s.quotes);
  const lead = useDb((s) => s.leads.find((l) => l.id === leadId));
  const saveQuote = useDb((s) => s.saveQuote);
  const sendQuote = useDb((s) => s.sendQuote);
  const existing = quotes.find((q) => q.id === id);

  // Build the draft once; later store updates must not reset what the vendor is typing.
  const [initial] = useState<Quotation | null>(() => {
    if (existing) return existing;
    if (!lead) return null;
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
      items: [],
      discount: 0,
      taxRate: GST_RATE,
      notes: '',
      terms: DEFAULT_TERMS,
      validUntil: day(15),
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };
  });

  if (!initial) {
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg }}>
        <StackHeader title="Quotation" />
        <EmptyBlock title="Quotation not found" />
      </View>
    );
  }

  const readOnly = existing && (existing.status === 'accepted' || existing.status === 'declined');

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader
        title={existing ? existing.number : 'New quotation'}
        subtitle={initial.customerName}
        right={existing ? <StatusPill status={existing.status} /> : undefined}
      />
      {readOnly ? (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <QuoteDocument quote={existing} />
        </ScrollView>
      ) : (
        <QuoteEditor
          initial={initial}
          onSave={(quote, send) => {
            saveQuote(quote);
            if (send) {
              sendQuote(quote.id);
              toast(`${quote.number} sent to ${quote.customerName}`, 'paper-plane');
            } else {
              toast('Draft saved');
            }
            router.back();
          }}
        />
      )}
    </View>
  );
}
