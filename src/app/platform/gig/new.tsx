import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { StackHeader } from '@/components/kit';
import { toast } from '@/components/ui/Toast';
import { GigForm } from '@/components/work/GigForm';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';

export default function PlatformNewGig() {
  const t = useRoleTheme();
  const account = useAccount();
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const projects = useDb((s) => s.projects);
  const postGig = useDb((s) => s.postGig);

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title="Post a crew gig" subtitle="Vivah Operations" />
      <GigForm
        projects={projects.filter((p) => !['COMPLETED', 'CLOSED', 'CANCELLED'].includes(p.status))}
        defaultCity={account.city}
        initialProjectId={projectId}
        onSubmit={(draft) => {
          const gig = postGig({ ...draft, postedById: 'platform', postedByName: 'Vivah Operations', postedByKind: 'platform' });
          toast(draft.emergency ? 'Emergency gig sent to nearby crew' : 'Gig posted', 'megaphone');
          router.replace({ pathname: '/platform/gig/[id]', params: { id: gig.id } });
        }}
      />
    </View>
  );
}
