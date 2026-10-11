import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, ChoiceChips, EmptyBlock, KButton, KField } from '@/components/kit';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { QuoteDocument } from '@/components/work/QuoteDocument';
import { colors, themed } from '@/constants/theme';
import { quoteHtml } from '@/services/documents';
import { sharePdf } from '@/services/exporters';
import { negotiationPoints } from '@/services/planner';
import { quoteTotals } from '@/services/quotes';
import { useDb } from '@/store/useDb';
import { daysUntil, formatMoney } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

const CHANGE_PRESETS = ['Lower the total', 'Add a service', 'Remove a service', 'Change dates', 'Softer payment schedule'];

/** Couple's quotation: compare versions, accept (books everything), ask for changes or decline. */
export default function CustomerQuote() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const quote = useDb((s) => s.quotes.find((q) => q.id === id));
  const markViewed = useDb((s) => s.markQuoteViewed);
  const respond = useDb((s) => s.respondToQuote);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [tips, setTips] = useState(false);
  const [note, setNote] = useState('');
  const [presets, setPresets] = useState<string[]>([]);

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
  const expired = daysUntil(quote.validUntil) < 0;
  const total = quoteTotals(quote).total;
  const firstStep = quote.schedule[0];

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={quote.title ?? quote.fromName}
        subtitle={`${quote.number} · v${quote.version}`}
        right={
          <Pressable onPress={() => sharePdf(quoteHtml(quote), quote.number)} hitSlop={10} accessibilityLabel="Download PDF">
            <Ionicons name="download-outline" size={22} color={colors.heading} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 190, gap: 12 }}>
        {quote.fromKind === 'platform' && (
          <Card style={styles.row}>
            <Ionicons name="shield-checkmark" size={22} color={colors.success} />
            <Text size={13} color={colors.text} style={{ flex: 1 }}>
              One package, one payment schedule. Vivah books and manages every provider in this quote and holds your payments in escrow.
            </Text>
          </Card>
        )}
        <QuoteDocument quote={quote} />
        {actionable && (
          <Pressable onPress={() => setTips(true)} style={styles.tipLink}>
            <Ionicons name="bulb-outline" size={16} color={colors.primary} />
            <Text size={13} weight="semibold" color={colors.primary}>
              Negotiation tips from our assistant
            </Text>
          </Pressable>
        )}
        {quote.status === 'accepted' && <KButton label="View in My Wedding" icon="heart-outline" variant="secondary" onPress={() => router.replace({ pathname: '/my-wedding', params: { tab: 'payments' } })} />}
        {quote.status === 'revision' && (
          <Card>
            <Text size={13} color={colors.text}>
              You asked for changes. Your {quote.fromKind === 'platform' ? 'coordinator' : 'vendor'} is preparing version {quote.version + (quote.versions.some((v) => v.version === quote.version) ? 1 : 0)}.
            </Text>
          </Card>
        )}
      </ScrollView>

      {actionable && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          {expired && (
            <Text size={12} color={colors.danger} align="center">
              This quote has expired — ask for an updated version.
            </Text>
          )}
          <KButton
            label={`Accept · ${formatMoney(total)}`}
            icon="checkmark-circle"
            size="lg"
            missing={expired && 'This quote has expired. Ask for an updated version below.'}
            onPress={() => {
              respond(quote.id, 'accept');
              triggerHaptic('success');
              toast('Confirmed. We’re booking your providers now.', 'heart');
              router.replace({ pathname: '/my-wedding', params: { tab: 'payments' } });
            }}
          />
          {firstStep && (
            <Text size={12} color={colors.textMuted} align="center">
              Pay {firstStep.percent}% ({formatMoney(Math.round((total * firstStep.percent) / 100))}) to confirm · rest per schedule
            </Text>
          )}
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
            Tell {quote.fromName} what to change — you’ll get a new version and can compare it with this one.
          </Text>
          <ChoiceChips options={CHANGE_PRESETS} selected={presets} onToggle={(v) => setPresets((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))} />
          <KField value={note} onChangeText={setNote} multiline maxLength={500} minLength={presets.length ? undefined : 5} placeholder="e.g. Bring catering to NPR 1,150/plate and include the entrance gate" />
          <KButton
            label="Send request"
            missing={note.trim().length < 5 && !presets.length && 'Pick what to change, or describe it in at least 5 characters'}
            onPress={() => {
              respond(quote.id, 'revision', [presets.join(', '), note.trim()].filter(Boolean).join(' — '));
              setRevisionOpen(false);
              toast('Change request sent', 'paper-plane');
              router.back();
            }}
          />
        </View>
      </Sheet>
      <Sheet visible={tips} onClose={() => setTips(false)} title="Before you accept">
        <View style={{ paddingHorizontal: 20, gap: 10, paddingBottom: 10 }}>
          {negotiationPoints(quote).map((p) => (
            <Text key={p} size={14} color={colors.text}>
              • {p}
            </Text>
          ))}
        </View>
      </Sheet>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgSoft },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tipLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', padding: 6 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, gap: 8, backgroundColor: colors.white, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
}));
