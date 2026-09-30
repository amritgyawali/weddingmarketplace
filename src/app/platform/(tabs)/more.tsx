import { router, type Href } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { Avatar, Card, KButton, ListRow, RoleHeader, SectionTitle, StatusPill, type IconName } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { logout } from '@/services/auth';
import { useDb, useUnreadMessageCount } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import { confirm } from '@/utils/confirm';
import { formatMoney, formatPhone } from '@/utils/format';

export default function PlatformMore() {
  const t = useRoleTheme();
  const account = useAccount();
  const resetDemo = useDb((s) => s.resetDemo);
  const payables = useDb((s) => s.payables);
  const verifications = useDb((s) => s.verifications);
  const reviews = useDb((s) => s.reviews);
  const disputes = useDb((s) => s.disputes);
  const refunds = useDb((s) => s.refunds);
  const unread = useUnreadMessageCount(account);
  const ready = payables.filter((p) => p.status === 'READY');
  const pendingKyc = verifications.filter((v) => v.status === 'DOCUMENT_SUBMITTED' || v.status === 'UNDER_REVIEW').length;
  const flagged = reviews.filter((r) => r.status === 'flagged').length;
  const openDisputes = disputes.filter((d) => d.status === 'OPEN' || d.status === 'INVESTIGATING').length;

  const sections: { title: string; rows: { icon: IconName; title: string; subtitle: string; href: Href; badge?: number }[] }[] = [
    {
      title: 'Operations',
      rows: [
        { icon: 'chatbubbles-outline', title: 'Messages', subtitle: 'Customer, provider and crew threads', href: '/platform/inbox', badge: unread },
        { icon: 'calendar-outline', title: 'Operations calendar', subtitle: 'Every function by date with service status', href: '/platform/calendar' },
        { icon: 'megaphone-outline', title: 'Crew gigs', subtitle: 'Staffing and emergency replacements', href: '/platform/gigs' },
        { icon: 'document-text-outline', title: 'Quotations', subtitle: 'Package and vendor quotes', href: '/platform/quotes' },
      ],
    },
    {
      title: 'Money',
      rows: [
        { icon: 'wallet-outline', title: 'Finance', subtitle: `${ready.length} payouts ready · ${formatMoney(ready.reduce((s, p) => s + p.amount, 0))}`, href: '/platform/finance', badge: ready.length },
        { icon: 'alert-circle-outline', title: 'Disputes & refunds', subtitle: `${openDisputes} open disputes · ${refunds.filter((r) => r.status === 'REQUESTED').length} refund requests`, href: '/platform/finance?tab=disputes', badge: openDisputes },
      ],
    },
    {
      title: 'Trust & marketplace',
      rows: [
        { icon: 'shield-checkmark-outline', title: 'Verification & moderation', subtitle: `${pendingKyc} KYC cases · ${flagged} flagged reviews`, href: '/platform/approvals', badge: pendingKyc + flagged },
        { icon: 'storefront-outline', title: 'Providers', subtitle: 'Venues & vendors with internal reliability', href: '/platform/providers' },
        { icon: 'people-outline', title: 'Freelancers', subtitle: 'Crew directory, equipment and scores', href: '/platform/freelancers' },
        { icon: 'person-circle-outline', title: 'Users', subtitle: 'Couples, businesses, crew and staff', href: '/platform/users' },
        { icon: 'options-outline', title: 'Marketplace settings', subtitle: 'Commission, fees, featured, deals & banners', href: '/platform/marketplace' },
      ],
    },
    {
      title: 'Insights',
      rows: [
        { icon: 'stats-chart-outline', title: 'Analytics', subtitle: 'Funnel, GMV, revenue by model, cities', href: '/platform/analytics' },
        { icon: 'list-outline', title: 'Audit log', subtitle: 'Who changed what, when', href: '/platform/audit' },
      ],
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <RoleHeader title="More" subtitle="Operations tools" />
      <ScrollView contentContainerStyle={{ padding: 14, gap: 16, paddingBottom: 30 }}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={account.name} size={48} />
          <View style={{ flex: 1 }}>
            <Text size={16} weight="bold" color={t.c.textStrong}>
              {account.name}
            </Text>
            <Text size={12} color={t.c.muted}>
              {account.team} · {formatPhone(account.phone)}
            </Text>
          </View>
          <StatusPill status="verified" label={(account.staffRole ?? 'staff').replace('_', ' ')} />
        </Card>
        {sections.map((section) => (
          <View key={section.title}>
            <SectionTitle title={section.title} />
            <Card padded={false} style={{ overflow: 'hidden' }}>
              {section.rows.map((r) => (
                <ListRow key={r.title} icon={r.icon} title={r.title} subtitle={r.subtitle} trailing={r.badge ? <StatusPill status="pending" label={String(r.badge)} /> : undefined} onPress={() => router.push(r.href)} />
              ))}
            </Card>
          </View>
        ))}
        <View>
          <SectionTitle title="System" />
          <Card padded={false} style={{ overflow: 'hidden' }}>
            <ListRow icon="notifications-outline" title="Notifications" onPress={() => router.push('/notifications')} />
            <ListRow icon="settings-outline" title="Settings" onPress={() => router.push('/platform/settings')} />
            <ListRow
              icon="refresh-outline"
              title="Reset demo data"
              subtitle="Restore seeded projects, quotes, gigs and payments"
              onPress={() =>
                confirm('Reset demo data?', 'Everything returns to the seeded state.', 'Reset', () => {
                  resetDemo();
                  toast('Demo data restored');
                })
              }
            />
          </Card>
        </View>
        <KButton label="Log out" variant="danger" icon="log-out-outline" onPress={() => confirm('Log out?', 'You can sign back in with your mobile number.', 'Log out', logout)} />
      </ScrollView>
    </View>
  );
}
