import { useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';

import { staffScreen } from '@/components/persona/StaffGate';
import { Avatar, Card, ChoiceChips, KeyValue, KField, StackHeader, StatusPill } from '@/components/kit';
import { SegmentFilter } from '@/components/work/SegmentFilter';
import { freelancerFacts, inSegment, type Segment } from '@/services/segments';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { AvailabilityCalendar } from '@/components/work/AvailabilityCalendar';
import { CREW_ROLES } from '@/data/services';
import { useLayout } from '@/hooks/useLayout';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { FreelancerProfile } from '@/types/platform';
import { formatMoney } from '@/utils/format';

/** Crew directory with equipment, travel radius, rates and reliability. */
function FreelancerDirectory() {
  const t = useRoleTheme();
  const { columns } = useLayout();
  const pool = useDb((s) => s.freelancerPool)();
  const [role, setRole] = useState('All');
  const [city, setCity] = useState('All');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<FreelancerProfile | null>(null);
  const [segment, setSegment] = useState<Segment>({});
  const q = query.trim().toLowerCase();
  const list = pool
    .filter((f) => (role === 'All' || f.skills.includes(role)) && (city === 'All' || f.city === city) && inSegment(segment, freelancerFacts(f)) && (!q || `${f.name} ${f.skills.join(' ')}`.toLowerCase().includes(q)))
    .sort((a, b) => b.reliability - a.reliability);

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title="Freelancers" subtitle={`${pool.length} crew across Nepal`} />
      <View style={{ padding: 14, gap: 8 }}>
        <KField placeholder="Search name or skill" value={query} onChangeText={setQuery} />
        <SegmentFilter value={segment} onChange={setSegment} dims={['trade', 'city']} />
        <ChoiceChips options={['All', ...CREW_ROLES.slice(0, 14)]} selected={[role]} onToggle={setRole} />
        <ChoiceChips options={['All', 'Kathmandu', 'Lalitpur', 'Bhaktapur', 'Pokhara', 'Chitwan']} selected={[city]} onToggle={setCity} />
      </View>
      <FlatList
        key={columns}
        data={list}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? { gap: 10 } : undefined}
        keyExtractor={(f) => f.id}
        contentContainerStyle={{ paddingHorizontal: 14, gap: 10, paddingBottom: 30 }}
        renderItem={({ item }) => (
          <Card onPress={() => setOpen(item)} style={[styles.row, { flex: 1 }]}>
            <Avatar name={item.name} size={44} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text size={14} weight="bold" color={t.c.textStrong}>
                {item.name}
              </Text>
              <Text size={12} color={t.c.muted} numberOfLines={1}>
                {item.skills.join(' · ')} · {item.city} ({item.travelRadiusKm} km)
              </Text>
              <Text size={11} color={t.c.subtle} numberOfLines={1}>
                {item.rating}★ · {item.completedGigs} gigs · reliability {item.reliability} · {formatMoney(item.dayRate)}/day
              </Text>
            </View>
            <StatusPill status={item.available ? item.verification : 'unavailable'} />
          </Card>
        )}
      />
      <Sheet visible={!!open} onClose={() => setOpen(null)} title={open?.name}>
        {open && (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 12 }}>
            <Text size={13} color={t.c.muted}>
              {open.headline}
            </Text>
            <Text size={14} color={t.c.text}>
              {open.bio}
            </Text>
            <Card style={{ gap: 2 }}>
              <KeyValue label="Rates" value={`${formatMoney(open.hourlyRate)}/hr · ${formatMoney(open.dayRate)}/day · ${formatMoney(open.eventRate)}/event`} />
              <KeyValue label="Travel radius" value={`${open.travelRadiusKm} km${open.ownVehicle ? ' · own vehicle' : ''}`} />
              <KeyValue label="Languages" value={open.languages.join(', ')} />
              <KeyValue label="Equipment" value={open.equipment.map((e) => e.name).join(', ') || '—'} />
              <KeyValue label="Completed / cancel rate" value={`${open.completedGigs} · ${Math.round(open.cancellationRate * 100)}%`} />
              <KeyValue label="Late arrivals / no-shows" value={`${open.lateArrivals} / ${open.noShows}`} />
              <KeyValue label="Response rate" value={`${Math.round(open.responseRate * 100)}%`} />
              <KeyValue label="Reliability (internal)" value={String(open.reliability)} strong />
            </Card>
            <AvailabilityCalendar ownerKind="freelancer" ownerId={open.id} />
          </ScrollView>
        )}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
});

export default staffScreen('/platform/freelancers', FreelancerDirectory);
