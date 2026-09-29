import { StyleSheet, View } from 'react-native';

import { Card, Divider, KeyValue, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { lineTotal, quoteTotals } from '@/services/quotes';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Quotation } from '@/types/platform';
import { formatINR, formatLongDate } from '@/utils/format';

/** Printable quotation layout shared by every role. */
export function QuoteDocument({ quote }: { quote: Quotation }) {
  const t = useRoleTheme();
  const totals = quoteTotals(quote);

  return (
    <Card style={{ gap: 14 }}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text size={12} weight="bold" color={t.c.primary} tracking={0.8}>
            QUOTATION
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

      <View style={[styles.meta, { backgroundColor: t.c.surfaceAlt }]}>
        <View style={{ flex: 1 }}>
          <Text size={11} weight="bold" color={t.c.muted}>
            BILL TO
          </Text>
          <Text size={15} weight="semibold" color={t.c.textStrong}>
            {quote.customerName}
          </Text>
          <Text size={12} color={t.c.muted}>
            {quote.city}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text size={11} weight="bold" color={t.c.muted}>
            EVENT DATE
          </Text>
          <Text size={14} weight="semibold" color={t.c.textStrong}>
            {formatLongDate(quote.eventDate)}
          </Text>
          <Text size={12} color={t.c.muted}>
            Valid till {formatLongDate(quote.validUntil)}
          </Text>
        </View>
      </View>

      <View>
        <View style={styles.tableHead}>
          <Text size={11} weight="bold" color={t.c.muted} style={{ flex: 1 }}>
            ITEM
          </Text>
          <Text size={11} weight="bold" color={t.c.muted} style={{ width: 90, textAlign: 'right' }}>
            AMOUNT
          </Text>
        </View>
        {quote.items.map((i) => (
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
                {i.qty} × {formatINR(i.rate)}
              </Text>
            </View>
            <Text size={14} weight="semibold" color={t.c.textStrong} style={{ width: 100, textAlign: 'right' }}>
              {formatINR(lineTotal(i))}
            </Text>
          </View>
        ))}
      </View>

      <View>
        <KeyValue label="Subtotal" value={formatINR(totals.subtotal)} />
        {totals.discount > 0 && <KeyValue label="Discount" value={`− ${formatINR(totals.discount)}`} />}
        <KeyValue label={`GST (${Math.round(quote.taxRate * 100)}%)`} value={formatINR(totals.tax)} />
        <Divider style={{ marginVertical: 6 }} />
        <KeyValue label="Total" value={formatINR(totals.total)} strong />
      </View>

      {!!quote.notes && (
        <View style={{ gap: 4 }}>
          <Text size={12} weight="bold" color={t.c.muted}>
            NOTES
          </Text>
          <Text size={13} color={t.c.text} lineHeight={19}>
            {quote.notes}
          </Text>
        </View>
      )}
      <View style={{ gap: 4 }}>
        <Text size={12} weight="bold" color={t.c.muted}>
          TERMS
        </Text>
        <Text size={12} color={t.c.muted} lineHeight={18}>
          {quote.terms}
        </Text>
      </View>
      {quote.status === 'revision' && !!quote.revisionNote && (
        <View style={[styles.revision, { borderColor: t.c.warning }]}>
          <Text size={12} weight="bold" color={t.c.warning}>
            CHANGES REQUESTED
          </Text>
          <Text size={13} color={t.c.text}>
            “{quote.revisionNote}”
          </Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  meta: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 10 },
  tableHead: { flexDirection: 'row', paddingBottom: 6 },
  item: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  revision: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 10, padding: 10, gap: 4 },
});
