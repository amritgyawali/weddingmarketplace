import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, View } from 'react-native';

import { EmptyBlock, Fab, Segmented, StackHeader } from '@/components/kit';
import { GigCard } from '@/components/work/GigCard';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import { daysUntil } from '@/utils/format';

type Filter = 'emergency' | 'open' | 'mine' | 'all';

export default function PlatformGigs() {
  const t = useRoleTheme();
  const gigs = useDb((s) => s.gigs);
  const [filter, setFilter] = useState<Filter>(gigs.some((g) => g.emergency && g.status === 'open') ? 'emergency' : 'open');
  const test = (f: Filter, g: (typeof gigs)[number]) =>
    f === 'emergency' ? !!g.emergency && g.status === 'open' : f === 'open' ? g.status === 'open' && daysUntil(g.date) >= 0 : f === 'mine' ? g.postedByKind === 'platform' : true;
  const list = gigs.filter((g) => test(filter, g)).sort((a, b) => Number(!!b.emergency) - Number(!!a.emergency) || a.date.localeCompare(b.date));
  const counts = Object.fromEntries((['emergency', 'open', 'mine', 'all'] as Filter[]).map((f) => [f, gigs.filter((g) => test(f, g)).length])) as Record<Filter, number>;

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title="Crew gigs" subtitle="Staffing across all weddings" />
      <View style={{ paddingTop: 12 }}>
        <Segmented
          options={[
            { id: 'emergency', label: '🚨 Emergency' },
            { id: 'open', label: 'Open' },
            { id: 'mine', label: 'Posted by Vivah' },
            { id: 'all', label: 'Everything' },
          ]}
          value={filter}
          onChange={setFilter}
          counts={counts}
        />
      </View>
      <FlatList
        data={list}
        keyExtractor={(g) => g.id}
        contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 100 }}
        ListEmptyComponent={<EmptyBlock icon="megaphone-outline" title="No gigs" />}
        renderItem={({ item }) => <GigCard gig={item} showApplicants onPress={() => router.push({ pathname: '/platform/gig/[id]', params: { id: item.id } })} />}
      />
      <Fab label="Post gig" onPress={() => router.push('/platform/gig/new')} />
    </View>
  );
}
