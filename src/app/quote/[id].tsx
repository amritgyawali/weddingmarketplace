import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyBlock, KButton, KField } from '@/components/kit';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { QuoteDocument } from '@/components/work/QuoteDocument';
import { colors } from '@/constants/theme';
import { quoteTotals } from '@/services/quotes';
import { useDb } from '@/store/useDb';
import { formatINR } from '@/utils/format';

/** Couple's view of a quotation: accept (creates the booking), ask for changes or decline. */
export default function CustomerQuote() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const quote = useDb((s) => s.quotes.find((q) => q.id === id));
  const markViewed = useDb((s) => s.markQuoteViewed);
  const respond = useDb((s) => s.respondToQuote);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (quote?.status === 'sent') markViewed(quote.id);
  }, [quote?.id, quote?.status, markViewed]);

  if (!quote) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Quotation" />
        <EmptyBlock title="Quotation not found" />
      </View>
    );
  }

  const actionable = quote.status === 'sent' || quote.status === 'viewed';
  const total = quoteTotals(quote).total;

  return (
    <View style={styles.root}>
      <ScreenHeader title={quote.fromName} subtitle={quote.number} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 170, gap: 12 }}>
        <QuoteDocument quote={quote} />
        {quote.status === 'accepted' && (
          <KButton label="View in My Wedding" icon="heart-outline" variant="secondary" onPress={() => router.replace({ pathname: '/my-wedding', params: { tab: 'plan' } })} />
        )}
      </ScrollView>

      {actionable && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <KButton
            label={`Accept & book · ${formatINR(total)}`}
            icon="checkmark-circle"
            size="lg"
            onPress={() => {
              respond(quote.id, 'accept');
              triggerHaptic('success');
              toast(`${quote.fromName} booked! 🎉`, 'heart');
              router.replace({ pathname: '/my-wedding', params: { tab: 'plan' } });
            }}
          />
          <View style={styles.row}>
            <KButton label="Request changes" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => setRevisionOpen(true)} />
            <KButton
              label="Decline"
              variant="ghost"
              size="sm"
              style={{ flex: 1 }}
              onPress={() => {
                respond(quote.id, 'decline');
                toast('Quotation declined', 'close-circle');
                router.back();
              }}
            />
          </View>
        </View>
      )}

      <Sheet visible={revisionOpen} onClose={() => setRevisionOpen(false)} title="Request changes">
        <View style={{ paddingHorizontal: 20, gap: 14 }}>
          <Text size={14} color={colors.textBody}>
            Tell {quote.fromName} what you’d like changed — they’ll send a revised quotation.
          </Text>
          <KField value={note} onChangeText={setNote} multiline placeholder="e.g. Can you include the sangeet night and reduce the per-plate cost?" />
          <KButton
            label="Send request"
            disabled={note.trim().length < 5}
            onPress={() => {
              respond(quote.id, 'revision', note.trim());
              setRevisionOpen(false);
              toast('Change request sent', 'paper-plane');
              router.back();
            }}
          />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgSoft },
  row: { flexDirection: 'row', gap: 10 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 14,
    gap: 10,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
});
