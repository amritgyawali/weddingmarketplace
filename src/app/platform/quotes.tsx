import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Card, EmptyBlock, Segmented, StackHeader, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { quoteTotals } from '@/services/quotes';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import { formatMoney, formatShortDate } from '@/utils/format';

type Filter = 'all' | 'open' | 'revision' | 'accepted' | 'genie';

export default function AllQuotes() {
  const t = useRoleTheme();
  const quotes = useDb((s) => s.quotes);
  const [filter, setFilter] = useState<Filter>('all');

  const visible = quotes.filter((q) => q.status !== 'draft' || q.fromKind === 'platform');
  const test = (f: Filter, q: (typeof quotes)[number]) =>
    f === 'all' || (f === 'open' ? q.status === 'sent' || q.status === 'viewed' : f === 'genie' ? q.fromKind === 'platform' : q.status === f);
  const list = visible.filter((q) => test(filter, q)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const counts = Object.fromEntries((['all', 'open', 'revision', 'accepted', 'genie'] as Filter[]).map((f) => [f, visible.filter((q) => test(f, q)).length])) as Record<Filter, number>;

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title="Quotations" subtitle="Marketplace-wide" />
      <View style={{ paddingTop: 12 }}>
        <Segmented
          options={[
            { id: 'all', label: 'All' },
            { id: 'open', label: 'Awaiting couple' },
            { id: 'revision', label: 'Changes' },
            { id: 'accepted', label: 'Accepted' },
            { id: 'genie', label: 'Genie' },
          ]}
          value={filter}
          onChange={setFilter}
          counts={counts}
        />
      </View>
      <FlatList
        data={list}
        keyExtractor={(q) => q.id}
        contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 30 }}
        ListEmptyComponent={<EmptyBlock icon="document-text-outline" title="No quotations" />}
        renderItem={({ item }) => (
          <Card onPress={() => router.push({ pathname: '/platform/quote/[id]', params: { id: item.id } })} style={{ gap: 6 }}>
            <View style={styles.row}>
              <Text size={12} weight="medium" color={t.c.muted} style={{ flex: 1 }}>
                {item.number} · {item.fromKind === 'platform' ? 'GENIE' : 'VENDOR'}
              </Text>
              <StatusPill status={item.status} />
            </View>
            <Text size={15} weight="bold" color={t.c.textStrong}>
              {item.fromName} → {item.customerName}
            </Text>
            <View style={styles.row}>
              <Text size={12} color={t.c.muted} style={{ flex: 1 }}>
                {item.city} · event {formatShortDate(item.eventDate)}
              </Text>
              <Text size={15} weight="bold" color={t.c.textStrong}>
                {formatMoney(quoteTotals(item).total)}
              </Text>
            </View>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
