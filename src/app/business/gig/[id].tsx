import { useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { EmptyBlock, StackHeader } from '@/components/kit';
import { GigManage } from '@/components/work/ApplicantsList';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';

export default function VendorGigDetail() {
  const t = useRoleTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const gig = useDb((s) => s.gigs.find((g) => g.id === id));

  if (!gig) {
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg }}>
        <StackHeader title="Gig" />
        <EmptyBlock title="Gig not found" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title={gig.emergency ? 'Emergency staffing' : 'Gig applicants'} subtitle={gig.title} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <GigManage gig={gig} />
      </ScrollView>
    </View>
  );
}
