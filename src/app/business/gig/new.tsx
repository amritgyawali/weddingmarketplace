import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { StackHeader } from '@/components/kit';
import { toast } from '@/components/ui/Toast';
import { GigForm } from '@/components/work/GigForm';
import { useVendorWorkspace } from '@/hooks/useWorkspace';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';

export default function VendorNewGig() {
  const t = useRoleTheme();
  const account = useAccount();
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const { projects } = useVendorWorkspace(account);
  const postGig = useDb((s) => s.postGig);

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title="Post a gig" subtitle="Hire verified freelancers" />
      <GigForm
        projects={projects.filter((p) => !['COMPLETED', 'CLOSED', 'CANCELLED'].includes(p.status))}
        defaultCity={account.city}
        initialProjectId={projectId}
        onSubmit={(draft) => {
          const gig = postGig({ ...draft, postedById: account.id, postedByName: account.businessName ?? account.name, postedByKind: 'vendor' });
          toast(draft.emergency ? 'Emergency gig sent to nearby crew' : 'Gig posted — freelancers are being notified', 'megaphone');
          router.replace({ pathname: '/business/gig/[id]', params: { id: gig.id } });
        }}
      />
    </View>
  );
}
