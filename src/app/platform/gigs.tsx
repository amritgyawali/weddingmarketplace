import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, View } from 'react-native';

import { EmptyBlock, Fab, Segmented, StackHeader } from '@/components/kit';
import { GigCard } from '@/components/work/GigCard';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';

type Filter = 'mine' | 'open' | 'all';

export default function PlatformGigs() {
  const t = useRoleTheme();
  const gigs = useDb((s) => s.gigs);
  const [filter, setFilter] = useState<Filter>('mine');

  const list = gigs
    .filter((g) => (filter === 'mine' ? g.postedByKind === 'platform' : filter === 'open' ? g.status === 'open' : true))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title="Crew gigs" subtitle="Staffing across all weddings" />
      <View style={{ paddingTop: 12 }}>
        <Segmented
          options={[
            { id: 'mine', label: 'Posted by Vivah' },
            { id: 'open', label: 'All open' },
            { id: 'all', label: 'Everything' },
          ]}
          value={filter}
          onChange={setFilter}
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
