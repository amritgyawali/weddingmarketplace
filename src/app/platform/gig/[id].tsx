import { useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { EmptyBlock, SectionTitle, StackHeader } from '@/components/kit';
import { ApplicantsList } from '@/components/work/ApplicantsList';
import { GigCard } from '@/components/work/GigCard';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';

export default function PlatformGigDetail() {
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
      <StackHeader title="Gig staffing" subtitle={gig.title} />
      <ScrollView contentContainerStyle={{ padding: 14, gap: 16, paddingBottom: 40 }}>
        <GigCard gig={gig} showApplicants />
        <View>
          <SectionTitle title={`Applicants (${gig.applications.length})`} />
          <ApplicantsList gig={gig} />
        </View>
      </ScrollView>
    </View>
  );
}
