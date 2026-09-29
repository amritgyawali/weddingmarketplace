import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Avatar, Card, ChoiceChips, EmptyBlock, KField, RoleHeader, Segmented, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { BookingCard } from '@/components/work/Bookings';
import { useVendorWorkspace } from '@/hooks/useWorkspace';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { LeadStatus } from '@/types/platform';
import { daysUntil, formatMoneyCompact, formatShortDate, timeAgo } from '@/utils/format';

type Tab = 'requests' | 'leads';
type Filter = 'all' | 'open' | LeadStatus;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'quoted', label: 'Quoted' },
  { id: 'negotiating', label: 'Negotiating' },
  { id: 'meeting', label: 'Meeting' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
  { id: 'archived', label: 'Archived' },
  { id: 'all', label: 'All' },
];

const OPEN: LeadStatus[] = ['new', 'contacted', 'responded', 'quoted', 'negotiating', 'meeting'];

/** Lead CRM: marketplace enquiries plus booking requests routed by Vivah coordinators. */
export default function LeadsTab() {
  const t = useRoleTheme();
  const account = useAccount();
  const { leads, requests } = useVendorWorkspace(account);
  const [tab, setTab] = useState<Tab>(requests.length ? 'requests' : 'leads');
  const [filter, setFilter] = useState<Filter>('open');
  const [priority, setPriority] = useState('Any');
  const [query, setQuery] = useState('');

  const test = (f: Filter, s: LeadStatus) => f === 'all' || (f === 'open' ? OPEN.includes(s) : s === f);
  const counts = Object.fromEntries(FILTERS.map((f) => [f.id, leads.filter((l) => test(f.id, l.status)).length])) as Record<Filter, number>;
  const q = query.trim().toLowerCase();
  const list = leads
    .filter((l) => test(filter, l.status) && (priority === 'Any' || l.priority === priority.toLowerCase()) && (!q || `${l.customerName} ${l.message ?? ''}`.toLowerCase().includes(q)))
    .sort((a, b) => Number(b.priority === 'high') - Number(a.priority === 'high') || b.createdAt.localeCompare(a.createdAt));
  const pipelineValue = leads.filter((l) => OPEN.includes(l.status)).reduce((s, l) => s + (l.budget ?? 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <RoleHeader eyebrow="LEAD CRM" title="Leads" subtitle={`${counts.new} new · ${formatMoneyCompact(pipelineValue)} open pipeline`} />
      <View style={{ paddingTop: 14, gap: 10 }}>
        <Segmented
          options={[
            { id: 'requests', label: 'Vivah requests' },
            { id: 'leads', label: 'Marketplace leads' },
          ]}
          value={tab}
          onChange={setTab}
          counts={{ requests: requests.length, leads: counts.open }}
        />
        {tab === 'leads' && (
          <>
            <View style={{ paddingHorizontal: 16, gap: 8 }}>
              <KField placeholder="Search by couple or message" value={query} onChangeText={setQuery} />
              <ChoiceChips options={['Any', 'High', 'Medium', 'Low']} selected={[priority]} onToggle={setPriority} />
            </View>
            <Segmented options={FILTERS} value={filter} onChange={setFilter} counts={counts} />
          </>
        )}
      </View>
      {tab === 'requests' ? (
        <FlatList
          data={requests}
          keyExtractor={(r) => r.booking.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
          ListEmptyComponent={<EmptyBlock icon="paper-plane-outline" title="No pending requests" message="When a Vivah coordinator picks you for a wedding, the request lands here for you to confirm availability." />}
          renderItem={({ item }) => <BookingCard project={item.project} booking={item.booking} mode="vendor" onPress={() => router.push({ pathname: '/business/booking/[id]', params: { id: item.booking.id } })} />}
        />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(l) => l.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
          ListEmptyComponent={<EmptyBlock icon="people-outline" title="No leads here" message="Enquiries from couples on the marketplace land here instantly." />}
          renderItem={({ item }) => {
            const days = daysUntil(item.eventDate);
            const followDue = item.followUp && daysUntil(item.followUp) <= 0 && OPEN.includes(item.status);
            return (
              <Card onPress={() => router.push({ pathname: '/business/lead/[id]', params: { id: item.id } })} accessibilityLabel={`Lead from ${item.customerName}`} style={{ gap: 10 }}>
                <View style={styles.row}>
                  <Avatar name={item.customerName} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text size={16} weight="bold" color={t.c.textStrong}>
                      {item.customerName} {item.priority === 'high' ? '🔥' : ''}
                    </Text>
                    <Text size={12} color={t.c.muted}>
                      {timeAgo(item.createdAt)} · {item.source ?? 'marketplace'}
                      {item.labels?.length ? ` · ${item.labels.join(', ')}` : ''}
                    </Text>
                  </View>
                  <StatusPill status={item.status} />
                </View>
                <View style={styles.tags}>
                  <View style={[styles.tag, { backgroundColor: t.c.surfaceAlt }]}>
                    <Ionicons name="calendar-outline" size={13} color={t.c.muted} />
                    <Text size={12} color={t.c.text}>
                      {formatShortDate(item.eventDate)} · {days}d
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
                        {formatMoneyCompact(item.budget)}
                      </Text>
                    </View>
                  )}
                  {followDue && (
                    <View style={[styles.tag, { backgroundColor: `${t.c.warning}22` }]}>
                      <Ionicons name="alarm-outline" size={13} color={t.c.warning} />
                      <Text size={12} weight="semibold" color={t.c.warning}>
                        Follow up today
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
});
