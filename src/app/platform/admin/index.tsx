import { router, type Href } from 'expo-router';
import { View } from 'react-native';

import { hiddenFeatureCount } from '@/components/admin/featureCatalogue';
import { Card, ListRow, SectionTitle, type IconName } from '@/components/kit';
import { staffScreen } from '@/components/persona/StaffGate';
import { Hint, StatRow, ToolPage } from '@/components/toolkit/core';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { useDb } from '@/store/useDb';
import { useSession } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import { confirm } from '@/utils/confirm';

/**
 * Super admin console: everything in the app can be changed here without a
 * developer. Every change is checked by the store (`admin.full`) and written
 * to the audit log.
 */
function AdminHome() {
  const t = useRoleTheme();
  const accounts = useSession((s) => s.accounts);
  const flags = useDb((s) => s.featureFlags);
  const overrides = useDb((s) => s.textOverrides);
  const announcements = useDb((s) => s.announcements);
  const projects = useDb((s) => s.projects);
  const resetDemo = useDb((s) => s.resetDemo);
  const off = hiddenFeatureCount(flags);
  const count = (role: string) => accounts.filter((a) => a.role === role).length;

  const sections: { title: string; rows: { icon: IconName; title: string; subtitle: string; href: Href }[] }[] = [
    {
      title: 'People',
      rows: [
        { icon: 'people-circle-outline', title: 'All accounts', subtitle: `${count('customer')} couples · ${count('vendor')} businesses · ${count('freelancer')} freelancers · ${count('platform')} staff`, href: '/platform/admin/users' },
        { icon: 'person-add-outline', title: 'Create an account', subtitle: 'Any role, signs in with its phone number', href: { pathname: '/platform/admin/user/[id]', params: { id: 'new' } } },
      ],
    },
    {
      title: 'What people see',
      rows: [
        { icon: 'toggle-outline', title: 'Features', subtitle: off ? `${off} hidden · each app shows its top 20, extras are off until you switch them on` : 'Everything is on · tabs, tools, services, home sections', href: '/platform/admin/features' },
        { icon: 'language-outline', title: 'Text and translations', subtitle: `${Object.keys(overrides).length} changed · rewrite any English or Nepali text`, href: '/platform/admin/texts' },
        { icon: 'megaphone-outline', title: 'Announcements', subtitle: `${announcements.filter((a) => a.active).length} live · pin a notice on any role's home`, href: '/platform/admin/announcements' },
        { icon: 'calendar-number-outline', title: 'Occasions', subtitle: 'What families can plan and the services each one shows', href: '/platform/occasions' },
        { icon: 'options-outline', title: 'Rates, fees and banners', subtitle: 'Commission, markup, lead fee, featured providers', href: '/platform/marketplace' },
      ],
    },
    {
      title: 'Data',
      rows: [
        { icon: 'server-outline', title: 'All data', subtitle: `Every collection: ${projects.length} projects, quotes, payments, gigs, reviews… view, edit, add or delete any record`, href: '/platform/admin/data' },
        { icon: 'list-outline', title: 'Audit log', subtitle: 'Every change, who made it and when', href: '/platform/audit' },
      ],
    },
  ];

  return (
    <ToolPage title="Super admin" subtitle="Change anything in the app, no code needed">
      <Hint>Changes apply at once for everyone using this app. Each one is recorded in the audit log with your name.</Hint>
      <StatRow
        items={[
          { label: 'Accounts', value: String(accounts.length) },
          { label: 'Projects', value: String(projects.length) },
          { label: 'Features hidden', value: String(off) },
        ]}
      />
      {sections.map((section) => (
        <View key={section.title}>
          <SectionTitle title={section.title} />
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {section.rows.map((r) => (
              <ListRow key={r.title} icon={r.icon} title={r.title} subtitle={r.subtitle} onPress={() => router.push(r.href)} />
            ))}
          </Card>
        </View>
      ))}
      <View>
        <SectionTitle title="Start over" />
        <Card padded={false} style={{ overflow: 'hidden' }}>
          <ListRow
            icon="refresh-outline"
            title="Reset all demo data"
            subtitle="Projects, quotes, payments, gigs and settings return to the seed. Accounts stay."
            onPress={() =>
              confirm('Reset all demo data?', 'Everything except accounts returns to the seeded state, including feature switches and text changes.', 'Reset', () => {
                const err = resetDemo();
                toast(err ?? 'Demo data restored');
              })
            }
          />
        </Card>
        <Text size={12} color={t.c.muted} style={{ marginTop: 8 }}>
          Only super admins see this console.
        </Text>
      </View>
    </ToolPage>
  );
}

export default staffScreen('/platform/admin', AdminHome);
