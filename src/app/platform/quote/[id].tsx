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
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Quotation } from '@/types/platform';
import { uid } from '@/utils/format';

/**
 * Genie quotations are built here (id = "new" with ?projectId). Vendor
 * quotes open read-only so ops can audit pricing.
 */
export default function PlatformQuote() {
  const t = useRoleTheme();
  const { id, projectId } = useLocalSearchParams<{ id: string; projectId?: string }>();
  const quotes = useDb((s) => s.quotes);
  const project = useDb((s) => s.projects.find((p) => p.id === projectId));
  const saveQuote = useDb((s) => s.saveQuote);
  const sendQuote = useDb((s) => s.sendQuote);
  const existing = quotes.find((q) => q.id === id);

  const [initial] = useState<Quotation | null>(() => {
    if (existing) return existing;
    if (!project) return null;
    const now = new Date().toISOString();
    return {
      id: uid('qt'),
      number: nextQuoteNumber(quotes.map((q) => q.number)),
      fromKind: 'platform',
      fromId: 'platform',
      fromName: 'Vivah Genie',
      category: 'platform',
      projectId: project.id,
      customerId: project.customerId,
      customerName: project.customerName,
      eventDate: project.weddingDate,
      city: project.city,
      items: [],
      discount: 0,
      taxRate: GST_RATE,
      notes: '',
      terms: DEFAULT_TERMS,
      validUntil: day(10),
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

  const editable = initial.fromKind === 'platform' && initial.status !== 'accepted' && initial.status !== 'declined';

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title={existing ? existing.number : 'New Genie quotation'} subtitle={`${initial.customerName} · from ${initial.fromName}`} right={existing ? <StatusPill status={existing.status} /> : undefined} />
      {editable ? (
        <QuoteEditor
          initial={initial}
          onSave={(quote, send) => {
            saveQuote(quote);
            if (send) {
              sendQuote(quote.id);
              toast(`${quote.number} sent to ${quote.customerName}`, 'paper-plane');
            } else toast('Draft saved');
            router.back();
          }}
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <QuoteDocument quote={existing ?? initial} />
        </ScrollView>
      )}
    </View>
  );
}
