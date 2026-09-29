import { router } from 'expo-router';
import { FlatList, View } from 'react-native';

import { EmptyBlock, Fab, StackHeader } from '@/components/kit';
import { GigCard } from '@/components/work/GigCard';
import { useVendorWorkspace } from '@/hooks/useWorkspace';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';

export default function VendorGigs() {
  const t = useRoleTheme();
  const account = useAccount();
  const { gigs } = useVendorWorkspace(account);

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title="Hire freelancers" subtitle="Gigs you have posted" />
      <FlatList
        data={[...gigs].sort((a, b) => a.date.localeCompare(b.date))}
        keyExtractor={(g) => g.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}
        ListEmptyComponent={
          <EmptyBlock icon="megaphone-outline" title="No gigs yet" message="Post a gig to find second shooters, makeup assistants, decor helpers and crew." action="Post a gig" onAction={() => router.push('/business/gig/new')} />
        }
        renderItem={({ item }) => <GigCard gig={item} showApplicants onPress={() => router.push({ pathname: '/business/gig/[id]', params: { id: item.id } })} />}
      />
      <Fab label="Post gig" onPress={() => router.push('/business/gig/new')} />
    </View>
  );
}
