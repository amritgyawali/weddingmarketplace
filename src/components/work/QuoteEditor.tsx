import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, ChoiceChips, Divider, KButton, KeyValue, KField } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { inputFont, inputReset } from '@/constants/theme';
import { serviceName } from '@/data/services';
import { quoteHtml } from '@/services/documents';
import { sharePdf } from '@/services/exporters';
import { PRICING_MODELS, SCHEDULE_TEMPLATES } from '@/services/pricing';
import { lineTotal, QUOTE_TEMPLATES, quoteTotals, TAX_RATE } from '@/services/quotes';
import { quoteLineForBooking } from '@/store/db/quotes';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { PricingModel, Project, QuoteItem, Quotation } from '@/types/platform';
import { addDays, formatLongDate, formatMoney, today, uid } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';
import { tr } from '@/i18n';

import { QuoteDocument } from './QuoteDocument';

const num = (s: string) => {
  const n = Number(s.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

function ItemEditor({ item, internal, onChange, onRemove }: { item: QuoteItem; internal: boolean; onChange: (i: QuoteItem) => void; onRemove: () => void }) {
  const t = useRoleTheme();
  const cell = [styles.cellInput, inputReset, { color: t.c.textStrong, fontFamily: t.fonts.semibold, borderColor: t.c.border, backgroundColor: t.dark ? t.c.surfaceAlt : t.c.bg }, inputFont('600')];
  const model = item.pricingModel ?? 'COMMISSION';
  const revenue = internal ? (model === 'MARKUP' ? lineTotal(item) - (item.cost ?? item.rate) * item.qty : model === 'LEAD_FEE' ? (item.modelRate ?? 2000) : Math.round(lineTotal(item) * (item.modelRate ?? 0.1))) : 0;
  return (
    <View style={[styles.itemCard, { borderColor: t.c.border }]}>
      <View style={styles.itemTop}>
        <TextInput value={item.title} onChangeText={(title) => onChange({ ...item, title })} placeholder={tr('Item / service')} placeholderTextColor={t.c.subtle} style={[styles.titleInput, inputReset, { color: t.c.textStrong, fontFamily: t.fonts.semibold }, inputFont('600')]} />
        <Pressable onPress={onRemove} hitSlop={10} accessibilityLabel="Remove item">
          <Ionicons name="trash-outline" size={18} color={t.c.danger} />
        </Pressable>
      </View>
      <TextInput value={item.description ?? ''} onChangeText={(description) => onChange({ ...item, description })} placeholder={tr("What's included (optional)")} placeholderTextColor={t.c.subtle} style={[{ color: t.c.text, fontFamily: t.fonts.regular, fontSize: 13 }, inputReset]} />
      {!!item.providerName && (
        <Text size={11} color={t.c.muted}>
          {serviceName(item.serviceId ?? '')} · {item.providerName}
        </Text>
      )}
      <View style={styles.itemBottom}>
        <View style={{ width: 64 }}>
          <Text size={11} color={t.c.muted}>
            Qty
          </Text>
          <TextInput value={String(item.qty)} onChangeText={(v) => onChange({ ...item, qty: num(v) })} keyboardType="number-pad" style={cell} />
        </View>
        <View style={{ width: 64 }}>
          <Text size={11} color={t.c.muted}>
            Unit
          </Text>
          <TextInput value={item.unit ?? ''} onChangeText={(unit) => onChange({ ...item, unit: unit || undefined })} placeholder="—" placeholderTextColor={t.c.subtle} style={cell} />
        </View>
        <View style={{ flex: 1 }}>
          <Text size={11} color={t.c.muted}>
            Rate (NPR)
          </Text>
          <TextInput value={String(item.rate)} onChangeText={(v) => onChange({ ...item, rate: num(v) })} keyboardType="number-pad" style={cell} />
        </View>
        <View style={{ alignItems: 'flex-end', justifyContent: 'flex-end' }}>
          <Text size={11} color={t.c.muted}>
            Amount
          </Text>
          <Text size={15} weight="bold" color={t.c.textStrong} style={{ paddingVertical: 8 }}>
            {formatMoney(lineTotal(item))}
          </Text>
        </View>
      </View>
      {internal && (
        <View style={[styles.internal, { backgroundColor: `${t.c.warning}14`, borderColor: `${t.c.warning}55` }]}>
          <Text size={12} weight="medium" color={t.c.warning}>
            Internal · not shown to the customer
          </Text>
          <ChoiceChips options={PRICING_MODELS.filter((m) => m.id !== 'FREELANCER_MARGIN').map((m) => m.label)} selected={[PRICING_MODELS.find((m) => m.id === model)!.label]} onToggle={(label) => onChange({ ...item, pricingModel: PRICING_MODELS.find((m) => m.label === label)!.id as PricingModel })} />
          <View style={styles.itemBottom}>
            <View style={{ flex: 1 }}>
              <Text size={11} color={t.c.muted}>
                Provider cost / unit
              </Text>
              <TextInput value={String(item.cost ?? item.rate)} onChangeText={(v) => onChange({ ...item, cost: num(v) })} keyboardType="number-pad" style={cell} />
            </View>
            <View style={{ flex: 1 }}>
              <Text size={11} color={t.c.muted}>
                {model === 'LEAD_FEE' ? 'Lead fee (NPR)' : model === 'MARKUP' ? 'Markup %' : 'Commission %'}
              </Text>
              <TextInput
                value={String(model === 'LEAD_FEE' ? (item.modelRate ?? 2000) : Math.round((item.modelRate ?? (model === 'MARKUP' ? 0.15 : 0.1)) * 100))}
                onChangeText={(v) => onChange({ ...item, modelRate: model === 'LEAD_FEE' ? num(v) : num(v) / 100 })}
                keyboardType="number-pad"
                style={cell}
              />
            </View>
            <View style={{ alignItems: 'flex-end', justifyContent: 'flex-end' }}>
              <Text size={11} color={t.c.muted}>
                Platform earns
              </Text>
              <Text size={14} weight="bold" color={revenue >= 0 ? t.c.success : t.c.danger} style={{ paddingVertical: 8 }}>
                {formatMoney(revenue)}
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

/**
 * Quotation builder for providers and the platform team: itemised lines,
 * package discount, service fee, VAT, payment schedule and — for the platform
 * — per-line provider cost, business model and margin. Sending freezes a new
 * version; older versions stay readable.
 */
export function QuoteEditor({
  initial,
  onSave,
  saving,
  project,
  internal = false,
}: {
  initial: Quotation;
  onSave: (quote: Quotation, send: boolean, changeSummary?: string) => void;
  saving?: boolean;
  project?: Project;
  internal?: boolean;
}) {
  const t = useRoleTheme();
  const insets = useSafeAreaInsets();
  const [quote, setQuote] = useState<Quotation>(initial);
  const [preview, setPreview] = useState(false);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState<string | null>(null);
  const totals = quoteTotals(quote);
  const locked = quote.status === 'accepted' || quote.status === 'declined';
  const isRevision = quote.versions.length > 0;
  const schedule = SCHEDULE_TEMPLATES.find((s) => JSON.stringify(s.steps) === JSON.stringify(quote.schedule));

  const patch = (p: Partial<Quotation>) => setQuote((q) => ({ ...q, ...p }));
  const setItem = (item: QuoteItem) => patch({ items: quote.items.map((i) => (i.id === item.id ? item : i)) });

  const loadTemplate = () => {
    const template = QUOTE_TEMPLATES[quote.category] ?? QUOTE_TEMPLATES.default;
    patch({ items: [...quote.items, ...template.map((i) => ({ ...i, id: uid('qi') }))] });
  };
  const missingBookings = project ? project.bookings.filter((b) => b.status !== 'CANCELLED' && !quote.items.some((i) => i.providerId === b.providerId && i.serviceId === b.serviceId)) : [];

  const submit = (send: boolean) => {
    const items = quote.items.filter((i) => i.title.trim());
    if (!items.length) return setError('Add at least one line item');
    if (send && totals.total <= 0) return setError('Quotation total must be more than NPR 0');
    setError(null);
    onSave({ ...quote, items }, send, summary.trim() || undefined);
  };

  if (preview) {
    return (
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140, gap: 12 }}>
          <QuoteDocument quote={quote} />
          {isRevision && <KField label={`What changed in v${quote.version}? (shown to the customer)`} value={summary} onChangeText={setSummary} placeholder="e.g. Reduced catering to 1,200/plate, added drone" multiline />}
          <KButton label="Download PDF" variant="ghost" icon="download-outline" onPress={() => sharePdf(quoteHtml(quote), quote.number)} />
        </ScrollView>
        <View style={[styles.footer, { backgroundColor: t.c.surface, borderTopColor: t.c.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
          <KButton label="Edit" variant="secondary" icon="create-outline" onPress={() => setPreview(false)} style={{ flex: 1 }} />
          {!locked && <KButton label={isRevision ? `Send v${quote.version}` : 'Send to customer'} icon="send" onPress={() => submit(true)} loading={saving} style={{ flex: 1.4 }} />}
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 130 }} keyboardShouldPersistTaps="handled">
        <Card style={{ gap: 4 }}>
          <Text size={12} weight="medium" color={t.c.muted}>
            {quote.number} · version {quote.version}
            {isRevision ? ` (revising v${quote.versions[quote.versions.length - 1].version})` : ''}
          </Text>
          <Text size={18} weight="bold" color={t.c.textStrong}>
            {quote.customerName}
          </Text>
          <Text size={13} color={t.c.muted}>
            {quote.city} · Event on {formatLongDate(quote.eventDate)}
          </Text>
          {!!quote.revisionNote && (
            <Text size={13} color={t.c.warning} style={{ marginTop: 6 }}>
              Customer asked: “{quote.revisionNote}”
            </Text>
          )}
        </Card>

        <KField label="Quote title" value={quote.title ?? ''} onChangeText={(title) => patch({ title })} placeholder="e.g. Complete wedding package" />

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
        {missingBookings.length > 0 && (
          <KButton
            label={`Add ${missingBookings.length} selected provider${missingBookings.length > 1 ? 's' : ''} from bookings`}
            icon="git-merge-outline"
            variant="secondary"
            size="sm"
            onPress={() => patch({ items: [...quote.items, ...missingBookings.map((b) => quoteLineForBooking(b, project!))] })}
          />
        )}

        {quote.items.map((i) => (
          <ItemEditor key={i.id} item={i} internal={internal} onChange={setItem} onRemove={() => patch({ items: quote.items.filter((x) => x.id !== i.id) })} />
        ))}
        <KButton label="Add line item" variant="secondary" icon="add" size="sm" onPress={() => patch({ items: [...quote.items, { id: uid('qi'), title: '', qty: 1, rate: 0 }] })} />

        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <KField label="Package discount" value={String(quote.discount)} onChangeText={(v) => patch({ discount: num(v) })} keyboardType="number-pad" prefix="NPR" />
          </View>
          {internal && (
            <View style={{ flex: 1 }}>
              <KField label="Service fee" value={String(quote.serviceFee)} onChangeText={(v) => patch({ serviceFee: num(v) })} keyboardType="number-pad" prefix="NPR" />
            </View>
          )}
        </View>
        <View style={{ gap: 6 }}>
          <Text size={13} weight="semibold" color={t.c.muted}>
            Tax
          </Text>
          <ChoiceChips options={['13% VAT', 'No VAT (not registered)']} selected={[quote.taxRate > 0 ? '13% VAT' : 'No VAT (not registered)']} onToggle={(v) => patch({ taxRate: v === '13% VAT' ? TAX_RATE : 0 })} />
        </View>
        <View style={{ gap: 6 }}>
          <Text size={13} weight="semibold" color={t.c.muted}>
            Payment schedule
          </Text>
          <ChoiceChips options={SCHEDULE_TEMPLATES.map((s) => s.label)} selected={schedule ? [schedule.label] : []} onToggle={(label) => patch({ schedule: SCHEDULE_TEMPLATES.find((s) => s.label === label)!.steps })} />
          {quote.schedule.map((s) => (
            <Text key={s.label} size={12} color={t.c.muted}>
              • {s.label}: {s.percent}% = {formatMoney(Math.round((totals.total * s.percent) / 100))}
            </Text>
          ))}
        </View>
        <View style={{ gap: 6 }}>
          <Text size={13} weight="semibold" color={t.c.muted}>
            Valid for
          </Text>
          <ChoiceChips options={['7 days', '10 days', '15 days', '30 days']} selected={[]} onToggle={(v) => patch({ validUntil: addDays(today(), Number(v.split(' ')[0])) })} />
          <Text size={12} color={t.c.muted}>
            Valid until {formatLongDate(quote.validUntil)}
          </Text>
        </View>
        <KField label="Notes for the customer" value={quote.notes} onChangeText={(notes) => patch({ notes })} multiline placeholder="Inclusions, highlights, special offers…" />
        <KField label="Terms" value={quote.terms} onChangeText={(terms) => patch({ terms })} multiline />

        <Card style={{ gap: 2 }}>
          <KeyValue label="Subtotal" value={formatMoney(totals.subtotal)} />
          <KeyValue label="Package discount" value={`− ${formatMoney(totals.discount)}`} />
          {totals.serviceFee > 0 && <KeyValue label="Service fee" value={formatMoney(totals.serviceFee)} />}
          <KeyValue label={`VAT ${Math.round(quote.taxRate * 100)}%`} value={formatMoney(totals.tax)} />
          <Divider style={{ marginVertical: 6 }} />
          <KeyValue label="Customer total" value={formatMoney(totals.total)} strong />
          {internal && (
            <>
              <Divider style={{ marginVertical: 6 }} />
              <KeyValue label="Provider costs" value={formatMoney(totals.cost)} />
              <KeyValue label="Platform margin (pre-VAT)" value={formatMoney(totals.margin)} />
              <KeyValue label="Take rate" value={`${totals.taxable ? Math.round((totals.margin / totals.taxable) * 1000) / 10 : 0}%`} />
            </>
          )}
        </Card>
        {!!error && (
          <Text size={13} color={t.c.danger} align="center">
            {error}
          </Text>
        )}
        {isRevision && (
          <Card style={{ gap: 6 }}>
            <Text size={13} weight="bold" color={t.c.textStrong}>
              Version history
            </Text>
            {quote.versions.map((v) => (
              <Text key={v.version} size={12} color={t.c.muted}>
                V{v.version} · {formatMoney(v.total)} · sent {formatLongDate(v.sentAt)}
                {v.response ? ` · ${v.response.action}${v.response.note ? `: “${v.response.note}”` : ''}` : ''}
              </Text>
            ))}
          </Card>
        )}
      </ScrollView>
      <View style={[styles.footer, { backgroundColor: t.c.surface, borderTopColor: t.c.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <KButton label="Save draft" variant="secondary" onPress={() => submit(false)} style={{ flex: 1 }} missing={locked && `This quote was ${quote.status}, so it can no longer be edited`} />
        <KButton label="Preview & send" icon="eye-outline" onPress={() => setPreview(true)} style={{ flex: 1.4 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  itemCard: { borderWidth: 1, borderRadius: 8, padding: 12, gap: 8 },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleInput: { flex: 1, fontSize: 15, paddingVertical: 4 },
  itemBottom: { flexDirection: 'row', gap: 8 },
  cellInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15, marginTop: 2 },
  internal: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 8 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, padding: 14, borderTopWidth: StyleSheet.hairlineWidth },
});
