import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, Divider, KeyValue, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { diffVersions, lineTotal, quoteTotals } from '@/services/quotes';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Quotation, QuoteVersion } from '@/types/platform';
import { formatLongDate, formatMoney, formatShortDate } from '@/utils/format';

type Snapshot = Pick<QuoteVersion, 'items' | 'discount' | 'serviceFee' | 'taxRate' | 'notes' | 'terms' | 'validUntil' | 'schedule'> & { version: number; response?: QuoteVersion['response']; changeSummary?: string; sentAt?: string };

const current = (q: Quotation): Snapshot => ({ version: q.version, items: q.items, discount: q.discount, serviceFee: q.serviceFee, taxRate: q.taxRate, notes: q.notes, terms: q.terms, validUntil: q.validUntil, schedule: q.schedule });

/**
 * Printable quotation shared by every role. Sent versions are frozen, so the
 * version chips let anyone compare V1 → V2 → V3. Internal costs never render.
 */
export function QuoteDocument({ quote, showVersions = true }: { quote: Quotation; showVersions?: boolean }) {
  const t = useRoleTheme();
  const versions: Snapshot[] = quote.versions.length ? quote.versions : [current(quote)];
  // With no sent versions, `versions` already is the draft; only append it when it follows sent ones.
  const draftIsNew = quote.status === 'draft' && quote.versions.length > 0 && !quote.versions.some((v) => v.version === quote.version);
  const all = draftIsNew ? [...versions, current(quote)] : versions;
  const [selected, setSelected] = useState(all[all.length - 1].version);
  const v = all.find((x) => x.version === selected) ?? all[all.length - 1];
  const prev = all.find((x) => x.version === v.version - 1);
  const totals = quoteTotals(v);
  const changes = prev ? diffVersions({ ...prev, total: quoteTotals(prev).total }, { ...v, total: totals.total }) : [];

  return (
    <Card style={{ gap: 14 }}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text size={12} weight="medium" color={t.c.muted}>
            Quotation{quote.title ? ` · ${quote.title}` : ''}
          </Text>
          <Text size={20} weight="bold" color={t.c.textStrong}>
            {quote.number}
          </Text>
          <Text size={13} color={t.c.muted}>
            from {quote.fromName}
          </Text>
        </View>
        <StatusPill status={quote.status} />
      </View>

      {showVersions && all.length > 1 && (
        <View style={styles.versions}>
          {all.map((x) => {
            const on = x.version === selected;
            return (
              <Pressable key={x.version} onPress={() => setSelected(x.version)} style={[styles.version, { borderColor: on ? t.c.textStrong : t.c.border, backgroundColor: on ? t.c.textStrong : 'transparent' }]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
                <Text size={12} weight="semibold" color={on ? t.c.surface : t.c.text}>
                  V{x.version}
                  {x.version === quote.acceptedVersion ? ' ✓' : x.sentAt ? '' : ' (draft)'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {changes.length > 0 && (
        <View style={[styles.changes, { backgroundColor: t.c.surfaceAlt }]}>
          <Text size={11} weight="semibold" color={t.c.muted}>
            Changes from v{prev!.version}
          </Text>
          {changes.map((c) => (
            <Text key={c} size={12} color={t.c.text}>
              • {c}
            </Text>
          ))}
        </View>
      )}

      <View style={[styles.meta, { backgroundColor: t.c.surfaceAlt }]}>
        <View style={{ flex: 1 }}>
          <Text size={12} weight="medium" color={t.c.muted}>
            Prepared for
          </Text>
          <Text size={15} weight="semibold" color={t.c.textStrong}>
            {quote.customerName}
          </Text>
          <Text size={12} color={t.c.muted}>
            {quote.city}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text size={12} weight="medium" color={t.c.muted}>
            Event date
          </Text>
          <Text size={14} weight="semibold" color={t.c.textStrong}>
            {formatLongDate(quote.eventDate)}
          </Text>
          <Text size={12} color={t.c.muted}>
            Valid till {formatShortDate(v.validUntil)}
          </Text>
        </View>
      </View>

      <View>
        {v.items.map((i) => (
          <View key={i.id} style={[styles.item, { borderBottomColor: t.c.border }]}>
            <View style={{ flex: 1 }}>
              <Text size={14} weight="semibold" color={t.c.textStrong}>
                {i.title}
              </Text>
              {!!i.description && (
                <Text size={12} color={t.c.muted}>
                  {i.description}
                </Text>
              )}
              <Text size={12} color={t.c.muted}>
                {i.qty} {i.unit ?? '×'} {formatMoney(i.rate)}
              </Text>
            </View>
            <Text size={14} weight="semibold" color={t.c.textStrong} style={{ width: 110, textAlign: 'right' }}>
              {formatMoney(lineTotal(i))}
            </Text>
          </View>
        ))}
      </View>

      <View>
        <KeyValue label="Subtotal" value={formatMoney(totals.subtotal)} />
        {totals.discount > 0 && <KeyValue label="Package discount" value={`− ${formatMoney(totals.discount)}`} />}
        {totals.serviceFee > 0 && <KeyValue label="Coordination & service fee" value={formatMoney(totals.serviceFee)} />}
        {v.taxRate > 0 && <KeyValue label={`VAT (${Math.round(v.taxRate * 100)}%)`} value={formatMoney(totals.tax)} />}
        <Divider style={{ marginVertical: 6 }} />
        <KeyValue label="Total" value={formatMoney(totals.total)} strong />
      </View>

      {v.schedule.length > 0 && (
        <View style={{ gap: 6 }}>
          <Text size={12} weight="medium" color={t.c.muted}>
            Payment schedule
          </Text>
          {v.schedule.map((s) => (
            <View key={s.label} style={styles.scheduleRow}>
              <Text size={13} color={t.c.text} style={{ flex: 1 }}>
                {s.label}
              </Text>
              <Text size={12} color={t.c.muted}>
                {s.percent}%
              </Text>
              <Text size={13} weight="semibold" color={t.c.textStrong} style={{ width: 110, textAlign: 'right' }}>
                {formatMoney(Math.round((totals.total * s.percent) / 100))}
              </Text>
            </View>
          ))}
        </View>
      )}

      {!!v.notes && (
        <View style={{ gap: 4 }}>
          <Text size={12} weight="medium" color={t.c.muted}>
            Notes
          </Text>
          <Text size={13} color={t.c.text} lineHeight={19}>
            {v.notes}
          </Text>
        </View>
      )}
      <View style={{ gap: 4 }}>
        <Text size={12} weight="medium" color={t.c.muted}>
          Terms
        </Text>
        <Text size={12} color={t.c.muted} lineHeight={18}>
          {v.terms}
        </Text>
      </View>
      {v.response && (
        <View style={[styles.response, { borderColor: v.response.action === 'accept' ? t.c.success : v.response.action === 'decline' ? t.c.danger : t.c.warning }]}>
          <Text size={12} weight="bold" color={v.response.action === 'accept' ? t.c.success : v.response.action === 'decline' ? t.c.danger : t.c.warning}>
            {v.response.action === 'accept' ? 'ACCEPTED' : v.response.action === 'decline' ? 'DECLINED' : 'CHANGES REQUESTED'} · {formatShortDate(v.response.at)}
          </Text>
          {!!v.response.note && (
            <Text size={13} color={t.c.text}>
              “{v.response.note}”
            </Text>
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  versions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  version: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 5 },
  changes: { borderRadius: 10, padding: 10, gap: 3 },
  meta: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 10 },
  item: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  response: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 10, padding: 10, gap: 4 },
});
