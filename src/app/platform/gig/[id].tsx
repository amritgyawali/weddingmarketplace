import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { EmptyBlock, StackHeader } from '@/components/kit';
import { GigManage } from '@/components/work/ApplicantsList';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

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
      <StackHeader title={gig.emergency ? 'Emergency staffing' : 'Gig staffing'} subtitle={gig.title} />
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
        <GigManage gig={gig} />
      </ScrollView>
    </View>
  );
}
