import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyBlock, Segmented } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { GigCard } from '@/components/work/GigCard';
import { myApplication, useFreelancerWorkspace } from '@/hooks/useWorkspace';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import { daysUntil } from '@/utils/format';

type Filter = 'upcoming' | 'applied' | 'completed';

export default function MyJobs() {
  const t = useRoleTheme();
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const { applied } = useFreelancerWorkspace(account);
  const [filter, setFilter] = useState<Filter>('upcoming');

  const withApp = applied.map((g) => ({ gig: g, app: myApplication(g, account.id)! }));
  const groups: Record<Filter, typeof withApp> = {
    upcoming: withApp.filter((x) => x.app.status === 'hired' && daysUntil(x.gig.date) >= 0 && x.gig.status !== 'cancelled'),
    applied: withApp.filter((x) => x.app.status === 'applied' || x.app.status === 'shortlisted' || x.app.status === 'rejected'),
    completed: withApp.filter((x) => x.app.status === 'completed' || (x.app.status === 'hired' && daysUntil(x.gig.date) < 0)),
  };
  const list = [...groups[filter]].sort((a, b) => (filter === 'completed' ? b.gig.date.localeCompare(a.gig.date) : a.gig.date.localeCompare(b.gig.date)));

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg, paddingTop: insets.top + 12 }}>
      <View style={{ paddingHorizontal: 16, marginBottom: 14 }}>
        <Text size={28} weight="bold" color={t.c.textStrong}>
          My jobs
        </Text>
        <Text size={14} color={t.c.muted}>
          {groups.upcoming.length} upcoming · {groups.applied.length} in review
        </Text>
      </View>
      <Segmented
        options={[
          { id: 'upcoming', label: 'Upcoming' },
          { id: 'applied', label: 'Applied' },
          { id: 'completed', label: 'Completed' },
        ]}
        value={filter}
        onChange={setFilter}
        counts={{ upcoming: groups.upcoming.length, applied: groups.applied.length, completed: groups.completed.length }}
      />
      <FlatList
        data={list}
        keyExtractor={(x) => x.gig.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 130 }}
        ListEmptyComponent={
          <EmptyBlock
            icon="briefcase-outline"
            title={filter === 'upcoming' ? 'No confirmed jobs yet' : filter === 'applied' ? 'No applications pending' : 'No completed jobs'}
            message="Apply to gigs from Discover — you’ll be notified the moment you’re hired."
            action="Discover gigs"
            onAction={() => router.navigate('/freelancer')}
          />
        }
        renderItem={({ item }) => (
          <GigCard
            gig={item.gig}
            badge={item.app.status}
            onPress={() => router.push({ pathname: item.app.status === 'hired' || item.app.status === 'completed' ? '/freelancer/job/[id]' : '/freelancer/gig/[id]', params: { id: item.gig.id } })}
          />
        )}
      />
    </View>
  );
}
