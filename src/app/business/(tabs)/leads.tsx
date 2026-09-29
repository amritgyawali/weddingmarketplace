import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Avatar, Card, EmptyBlock, KField, RoleHeader, Segmented, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { useVendorWorkspace } from '@/hooks/useWorkspace';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { LeadStatus } from '@/types/platform';
import { daysUntil, formatINRCompact, formatShortDate } from '@/utils/format';

type Filter = 'all' | LeadStatus;
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'quoted', label: 'Quoted' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
];

export default function LeadsTab() {
  const t = useRoleTheme();
  const account = useAccount();
  const { leads } = useVendorWorkspace(account);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const counts = Object.fromEntries(FILTERS.map((f) => [f.id, f.id === 'all' ? leads.length : leads.filter((l) => l.status === f.id).length])) as Record<Filter, number>;
  const q = query.trim().toLowerCase();
  const list = leads
    .filter((l) => (filter === 'all' || l.status === filter) && (!q || l.customerName.toLowerCase().includes(q)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <RoleHeader eyebrow="ENQUIRIES" title="Leads" subtitle={`${counts.new} new · ${leads.length} total`} />
      <View style={{ paddingTop: 14, gap: 12 }}>
        <View style={{ paddingHorizontal: 16 }}>
          <KField placeholder="Search by couple name" value={query} onChangeText={setQuery} />
        </View>
        <Segmented options={FILTERS} value={filter} onChange={setFilter} counts={counts} />
      </View>
      <FlatList
        data={list}
        keyExtractor={(l) => l.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        ListEmptyComponent={<EmptyBlock icon="people-outline" title="No leads here" message="Enquiries from couples on the marketplace land here instantly." />}
        renderItem={({ item }) => {
          const days = daysUntil(item.eventDate);
          return (
            <Card onPress={() => router.push({ pathname: '/business/lead/[id]', params: { id: item.id } })} accessibilityLabel={`Lead from ${item.customerName}`} style={{ gap: 12 }}>
              <View style={styles.row}>
                <Avatar name={item.customerName} size={44} />
                <View style={{ flex: 1 }}>
                  <Text size={16} weight="bold" color={t.c.textStrong}>
                    {item.customerName}
                  </Text>
                  <Text size={12} color={t.c.muted}>
                    Received {formatShortDate(item.createdAt)}
                  </Text>
                </View>
                <StatusPill status={item.status} />
              </View>
              <View style={styles.tags}>
                <View style={[styles.tag, { backgroundColor: t.c.surfaceAlt }]}>
                  <Ionicons name="calendar-outline" size={13} color={t.c.muted} />
                  <Text size={12} color={t.c.text}>
                    {formatShortDate(item.eventDate)} · {days} days
                  </Text>
                </View>
                <View style={[styles.tag, { backgroundColor: t.c.surfaceAlt }]}>
                  <Ionicons name="people-outline" size={13} color={t.c.muted} />
                  <Text size={12} color={t.c.text}>
                    {item.guests ?? '—'} guests
                  </Text>
                </View>
                {!!item.budget && (
                  <View style={[styles.tag, { backgroundColor: t.c.surfaceAlt }]}>
                    <Ionicons name="wallet-outline" size={13} color={t.c.muted} />
                    <Text size={12} color={t.c.text}>
                      {formatINRCompact(item.budget)}
                    </Text>
                  </View>
                )}
              </View>
              <Text size={13} color={t.c.text} numberOfLines={2}>
                {item.functions.join(' · ')}
                {item.message ? ` — “${item.message}”` : ''}
              </Text>
            </Card>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
});
