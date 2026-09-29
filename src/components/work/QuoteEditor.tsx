import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, Divider, KButton, KeyValue, KField } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { inputReset } from '@/constants/theme';
import { lineTotal, QUOTE_TEMPLATES, quoteTotals } from '@/services/quotes';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { QuoteItem, Quotation } from '@/types/platform';
import { formatINR, formatLongDate, uid } from '@/utils/format';

import { QuoteDocument } from './QuoteDocument';

const num = (s: string) => {
  const n = Number(s.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

function ItemEditor({ item, onChange, onRemove }: { item: QuoteItem; onChange: (i: QuoteItem) => void; onRemove: () => void }) {
  const t = useRoleTheme();
  const inputStyle = [styles.cellInput, inputReset, { color: t.c.textStrong, fontFamily: t.fonts.semibold, borderColor: t.c.border, backgroundColor: t.dark ? t.c.surfaceAlt : t.c.bg }];
  return (
    <View style={[styles.itemCard, { borderColor: t.c.border }]}>
      <View style={styles.itemTop}>
        <TextInput
          value={item.title}
          onChangeText={(title) => onChange({ ...item, title })}
          placeholder="Item / service"
          placeholderTextColor={t.c.subtle}
          style={[styles.titleInput, inputReset, { color: t.c.textStrong, fontFamily: t.fonts.semibold }]}
        />
        <Pressable onPress={onRemove} hitSlop={10} accessibilityLabel="Remove item">
          <Ionicons name="trash-outline" size={18} color={t.c.danger} />
        </Pressable>
      </View>
      <View style={styles.itemBottom}>
        <View style={{ width: 70 }}>
          <Text size={11} color={t.c.muted}>
            Qty
          </Text>
          <TextInput value={String(item.qty)} onChangeText={(v) => onChange({ ...item, qty: num(v) })} keyboardType="number-pad" style={inputStyle} />
        </View>
        <View style={{ flex: 1 }}>
          <Text size={11} color={t.c.muted}>
            Rate (₹)
          </Text>
          <TextInput value={String(item.rate)} onChangeText={(v) => onChange({ ...item, rate: num(v) })} keyboardType="number-pad" style={inputStyle} />
        </View>
        <View style={{ alignItems: 'flex-end', justifyContent: 'flex-end' }}>
          <Text size={11} color={t.c.muted}>
            Amount
          </Text>
          <Text size={15} weight="bold" color={t.c.textStrong} style={{ paddingVertical: 8 }}>
            {formatINR(lineTotal(item))}
          </Text>
        </View>
      </View>
    </View>
  );
}

/**
 * Quotation builder for vendors and the platform team: line items, discount,
 * GST, notes, validity — with a live preview before sending.
 */
export function QuoteEditor({
  initial,
  onSave,
  saving,
}: {
  initial: Quotation;
  onSave: (quote: Quotation, send: boolean) => void;
  saving?: boolean;
}) {
  const t = useRoleTheme();
  const insets = useSafeAreaInsets();
  const [quote, setQuote] = useState<Quotation>(initial);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const totals = quoteTotals(quote);
  const locked = quote.status === 'accepted' || quote.status === 'declined';

  const patch = (p: Partial<Quotation>) => setQuote((q) => ({ ...q, ...p }));
  const setItem = (item: QuoteItem) => patch({ items: quote.items.map((i) => (i.id === item.id ? item : i)) });

  const loadTemplate = () => {
    const template = QUOTE_TEMPLATES[quote.category] ?? QUOTE_TEMPLATES.default;
    patch({ items: [...quote.items, ...template.map((i) => ({ ...i, id: uid('qi') }))] });
  };

  const submit = (send: boolean) => {
    const items = quote.items.filter((i) => i.title.trim());
    if (!items.length) return setError('Add at least one line item');
    if (send && totals.total <= 0) return setError('Quotation total must be more than ₹0');
    setError(null);
    onSave({ ...quote, items }, send);
  };

  if (preview) {
    return (
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          <QuoteDocument quote={quote} />
        </ScrollView>
        <View style={[styles.footer, { backgroundColor: t.c.surface, borderTopColor: t.c.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
          <KButton label="Edit" variant="secondary" icon="create-outline" onPress={() => setPreview(false)} style={{ flex: 1 }} />
          {!locked && <KButton label="Send to customer" icon="send" onPress={() => submit(true)} loading={saving} style={{ flex: 1.4 }} />}
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 130 }} keyboardShouldPersistTaps="handled">
        <Card style={{ gap: 4 }}>
          <Text size={12} weight="bold" color={t.c.primary} tracking={0.6}>
            {quote.number}
          </Text>
          <Text size={18} weight="bold" color={t.c.textStrong}>
            {quote.customerName}
          </Text>
          <Text size={13} color={t.c.muted}>
            {quote.city} · Event on {formatLongDate(quote.eventDate)}
          </Text>
        </Card>

        <View style={styles.rowBetween}>
          <Text size={16} weight="bold" color={t.c.textStrong}>
            Line items
          </Text>
          <Pressable onPress={loadTemplate} hitSlop={8} style={styles.inline}>
            <Ionicons name="flash-outline" size={15} color={t.c.primary} />
            <Text size={13} weight="semibold" color={t.c.primary}>
              Use template
            </Text>
          </Pressable>
        </View>

        {quote.items.map((i) => (
          <ItemEditor key={i.id} item={i} onChange={setItem} onRemove={() => patch({ items: quote.items.filter((x) => x.id !== i.id) })} />
        ))}
        <KButton
          label="Add line item"
          variant="secondary"
          icon="add"
          size="sm"
          onPress={() => patch({ items: [...quote.items, { id: uid('qi'), title: '', qty: 1, rate: 0 }] })}
        />

        <KField label="Discount (₹)" value={String(quote.discount)} onChangeText={(v) => patch({ discount: num(v) })} keyboardType="number-pad" prefix="₹" />
        <KField label="Notes for the customer" value={quote.notes} onChangeText={(notes) => patch({ notes })} multiline placeholder="Inclusions, highlights, special offers…" />
        <KField label="Terms & payment schedule" value={quote.terms} onChangeText={(terms) => patch({ terms })} multiline />

        <Card style={{ gap: 2 }}>
          <KeyValue label="Subtotal" value={formatINR(totals.subtotal)} />
          <KeyValue label="Discount" value={`− ${formatINR(totals.discount)}`} />
          <KeyValue label="GST 18%" value={formatINR(totals.tax)} />
          <Divider style={{ marginVertical: 6 }} />
          <KeyValue label="Total" value={formatINR(totals.total)} strong />
        </Card>
        {!!error && (
          <Text size={13} color={t.c.danger} align="center">
            {error}
          </Text>
        )}
      </ScrollView>
      <View style={[styles.footer, { backgroundColor: t.c.surface, borderTopColor: t.c.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <KButton label="Save draft" variant="secondary" onPress={() => submit(false)} style={{ flex: 1 }} disabled={locked} />
        <KButton label="Preview & send" icon="eye-outline" onPress={() => setPreview(true)} style={{ flex: 1.4 }} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  itemCard: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleInput: { flex: 1, fontSize: 15, paddingVertical: 4 },
  itemBottom: { flexDirection: 'row', gap: 10 },
  cellInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15, marginTop: 2 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, padding: 14, borderTopWidth: StyleSheet.hairlineWidth },
});
