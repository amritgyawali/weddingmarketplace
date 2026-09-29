import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { Avatar, Card, KButton, ListRow, RoleHeader, SectionTitle } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { logout } from '@/services/auth';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import { confirm } from '@/utils/confirm';

export default function PlatformMore() {
  const t = useRoleTheme();
  const account = useAccount();
  const resetDemo = useDb((s) => s.resetDemo);
  const payouts = useDb((s) => s.payouts);
  const pendingPayouts = payouts.filter((p) => p.status === 'pending').length;

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <RoleHeader eyebrow="WORKSPACE" title="More" subtitle="Operations tools" />
      <ScrollView contentContainerStyle={{ padding: 14, gap: 16, paddingBottom: 30 }}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={account.name} size={48} />
          <View style={{ flex: 1 }}>
            <Text size={16} weight="bold" color={t.c.textStrong}>
              {account.name}
            </Text>
            <Text size={12} color={t.c.muted}>
              {account.team} · +91 {account.phone}
            </Text>
          </View>
        </Card>

        <View>
          <SectionTitle title="Commerce" />
          <Card padded={false} style={{ overflow: 'hidden' }}>
            <ListRow icon="document-text-outline" title="All quotations" subtitle="Vendor & Genie quotes across the marketplace" onPress={() => router.push('/platform/quotes')} />
            <ListRow icon="add-circle-outline" title="New Genie quotation" subtitle="Create a quote for a managed wedding" onPress={() => router.navigate('/platform/weddings')} />
            <ListRow icon="wallet-outline" title="Freelancer payouts" subtitle={`${pendingPayouts} pending release`} onPress={() => router.push('/platform/payouts')} />
          </Card>
        </View>

        <View>
          <SectionTitle title="Staffing & people" />
          <Card padded={false} style={{ overflow: 'hidden' }}>
            <ListRow icon="megaphone-outline" title="Crew gigs" subtitle="Post and staff gigs for executions" onPress={() => router.push('/platform/gigs')} />
            <ListRow icon="people-outline" title="Users directory" subtitle="Couples, vendors, freelancers & team" onPress={() => router.push('/platform/users')} />
            <ListRow icon="notifications-outline" title="Notifications" onPress={() => router.push('/notifications')} />
          </Card>
        </View>

        <View>
          <SectionTitle title="System" />
          <Card padded={false} style={{ overflow: 'hidden' }}>
            <ListRow
              icon="refresh-outline"
              title="Reset demo data"
              subtitle="Restore seeded weddings, quotes and gigs"
              onPress={() =>
                confirm('Reset demo data?', 'All projects, quotes, leads, gigs and notifications return to the seeded state.', 'Reset', () => {
                  resetDemo();
                  toast('Demo data restored');
                })
              }
            />
          </Card>
        </View>

        <KButton
          label="Log out"
          variant="danger"
          icon="log-out-outline"
          onPress={() =>
            confirm('Log out?', 'You can sign back in with your mobile number.', 'Log out', logout)
          }
        />
      </ScrollView>
    </View>
  );
}
