import { useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { Card, EmptyBlock, KButton, SectionTitle, StackHeader } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { ApplicantsList } from '@/components/work/ApplicantsList';
import { GigCard } from '@/components/work/GigCard';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import { confirm } from '@/utils/confirm';

export default function VendorGigDetail() {
  const t = useRoleTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const gig = useDb((s) => s.gigs.find((g) => g.id === id));
  const cancelGig = useDb((s) => s.cancelGig);

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
      <StackHeader title="Gig applicants" subtitle={gig.title} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        <GigCard gig={gig} showApplicants />
        {(!!gig.description || gig.requirements.length > 0) && (
          <Card style={{ gap: 6 }}>
            {!!gig.description && (
              <Text size={14} color={t.c.text}>
                {gig.description}
              </Text>
            )}
            {gig.requirements.map((r) => (
              <Text key={r} size={13} color={t.c.muted}>
                • {r}
              </Text>
            ))}
          </Card>
        )}
        <View>
          <SectionTitle title={`Applicants (${gig.applications.length})`} />
          <ApplicantsList gig={gig} />
        </View>
        {gig.status === 'open' && (
          <KButton
            label="Cancel gig"
            variant="danger"
            size="sm"
            onPress={() =>
              confirm('Cancel this gig?', 'Applicants will be notified.', 'Cancel gig', () => cancelGig(gig.id))
            }
          />
        )}
      </ScrollView>
    </View>
  );
}
