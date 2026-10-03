import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { staffScreen } from '@/components/persona/StaffGate';
import { Card, ChoiceChips, KField, StackHeader, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { photos } from '@/constants/images';
import { PROVIDERS } from '@/data/providers';
import { SERVICES } from '@/data/services';
import { SegmentFilter } from '@/components/work/SegmentFilter';
import { useLayout } from '@/hooks/useLayout';
import { inSegment, providerFacts, type Segment } from '@/services/segments';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import { formatMoneyCompact } from '@/utils/format';

type Sort = 'Reliability' | 'Rating' | 'Bookings' | 'Cancellations';

/** Provider directory with internal marketplace signals (never shown publicly). */
function ProvidersDirectory() {
  const t = useRoleTheme();
  const { columns } = useLayout();
  const projects = useDb((s) => s.projects);
  const featured = useDb((s) => s.settings.featuredProviderIds);
  const [service, setService] = useState('All');
  const [city, setCity] = useState('All');
  const [sort, setSort] = useState<Sort>('Reliability');
  const [query, setQuery] = useState('');
  const [segment, setSegment] = useState<Segment>({});
  const bookingsBy = new Map<string, number>();
  projects.forEach((p) => p.bookings.filter((b) => b.status !== 'CANCELLED').forEach((b) => bookingsBy.set(b.providerId, (bookingsBy.get(b.providerId) ?? 0) + 1)));
  const q = query.trim().toLowerCase();
  const list = PROVIDERS.filter((p) => (service === 'All' || p.serviceId === SERVICES.find((s) => s.name === service)?.id) && (city === 'All' || p.city === city) && inSegment(segment, providerFacts(p)) && (!q || p.name.toLowerCase().includes(q)))
    .sort((a, b) =>
      sort === 'Reliability' ? b.internal.reliability - a.internal.reliability : sort === 'Rating' ? b.rating - a.rating : sort === 'Bookings' ? (bookingsBy.get(b.id) ?? 0) - (bookingsBy.get(a.id) ?? 0) : b.internal.cancellationRate - a.internal.cancellationRate,
    )
    .slice(0, 120);

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title="Providers" subtitle={`${PROVIDERS.length} venues & vendors`} />
      <View style={{ padding: 14, gap: 8 }}>
        <KField placeholder="Search providers" value={query} onChangeText={setQuery} />
        <SegmentFilter value={segment} onChange={setSegment} dims={['trade', 'city']} />
        <ChoiceChips options={['All', ...SERVICES.filter((s) => s.core).map((s) => s.name)]} selected={[service]} onToggle={setService} />
        <ChoiceChips options={['All', 'Kathmandu', 'Lalitpur', 'Bhaktapur', 'Pokhara', 'Chitwan']} selected={[city]} onToggle={setCity} />
        <ChoiceChips options={['Reliability', 'Rating', 'Bookings', 'Cancellations']} selected={[sort]} onToggle={(v) => setSort(v as Sort)} />
      </View>
      <FlatList
        key={columns}
        data={list}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? { gap: 10 } : undefined}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingHorizontal: 14, gap: 10, paddingBottom: 30 }}
        renderItem={({ item }) => (
          <Card onPress={() => router.push({ pathname: '/platform/provider/[id]', params: { id: item.id } })} style={[styles.row, { flex: 1 }]}>
            <Image source={photos[item.image]} style={styles.thumb} contentFit="cover" />
            <View style={{ flex: 1, gap: 2 }}>
              <Text size={14} weight="bold" color={t.c.textStrong} numberOfLines={1}>
                {item.name}{featured.includes(item.id) ? ' · Featured' : ''}
              </Text>
              <Text size={12} color={t.c.muted} numberOfLines={1}>
                {SERVICES.find((s) => s.id === item.serviceId)?.name} · {item.city} · {item.rating}★ · from {formatMoneyCompact(item.startingPrice)}
              </Text>
              <Text size={11} color={t.c.muted}>
                Reliability {item.internal.reliability} · replies ~{item.internal.responseMinutes}m · cancels {Math.round(item.internal.cancellationRate * 100)}% · {bookingsBy.get(item.id) ?? 0} bookings
              </Text>
            </View>
            <StatusPill status={item.verification} />
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  thumb: { width: 56, height: 56, borderRadius: 10 },
});

export default staffScreen('/platform/providers', ProvidersDirectory);
