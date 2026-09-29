import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Card, EmptyBlock, RoleHeader, Segmented, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { useVendorWorkspace } from '@/hooks/useWorkspace';
import { quoteTotals } from '@/services/quotes';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import { formatINR, formatShortDate } from '@/utils/format';

type Filter = 'all' | 'draft' | 'open' | 'revision' | 'accepted' | 'declined';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Drafts' },
  { id: 'open', label: 'Awaiting' },
  { id: 'revision', label: 'Changes' },
  { id: 'accepted', label: 'Won' },
  { id: 'declined', label: 'Declined' },
];

const matches = (f: Filter, status: string) =>
  f === 'all' || (f === 'open' ? status === 'sent' || status === 'viewed' : status === f);

export default function QuotesTab() {
  const t = useRoleTheme();
  const account = useAccount();
  const { quotes } = useVendorWorkspace(account);
  const [filter, setFilter] = useState<Filter>('all');

  const list = quotes.filter((q) => matches(filter, q.status)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const counts = Object.fromEntries(FILTERS.map((f) => [f.id, quotes.filter((q) => matches(f.id, q.status)).length])) as Record<Filter, number>;
  const pipeline = quotes.filter((q) => q.status === 'sent' || q.status === 'viewed').reduce((s, q) => s + quoteTotals(q).total, 0);

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <RoleHeader eyebrow="QUOTATIONS" title="Quotes" subtitle={`${formatINR(pipeline)} in pipeline`} />
      <View style={{ paddingTop: 14 }}>
        <Segmented options={FILTERS} value={filter} onChange={setFilter} counts={counts} />
      </View>
      <FlatList
        data={list}
        keyExtractor={(q) => q.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        ListEmptyComponent={
          <EmptyBlock icon="document-text-outline" title="No quotations" message="Open a lead and tap “Create quotation” to send your first quote." action="Go to leads" onAction={() => router.navigate('/business/leads')} />
        }
        renderItem={({ item }) => {
          const total = quoteTotals(item).total;
          return (
            <Card onPress={() => router.push({ pathname: '/business/quote/[id]', params: { id: item.id } })} style={{ gap: 10 }} accessibilityLabel={`Quotation ${item.number}`}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text size={12} weight="bold" color={t.c.primary}>
                    {item.number}
                  </Text>
                  <Text size={16} weight="bold" color={t.c.textStrong}>
                    {item.customerName}
                  </Text>
                </View>
                <StatusPill status={item.status} />
              </View>
              <View style={styles.row}>
                <Text size={13} color={t.c.muted} style={{ flex: 1 }}>
                  {item.items.length} items · event {formatShortDate(item.eventDate)} · updated {formatShortDate(item.updatedAt)}
                </Text>
                <Text size={17} weight="extrabold" color={t.c.textStrong}>
                  {formatINR(total)}
                </Text>
              </View>
              {item.status === 'revision' && !!item.revisionNote && (
                <Text size={13} color={t.c.warning} numberOfLines={2}>
                  Couple asked: “{item.revisionNote}”
                </Text>
              )}
            </Card>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
