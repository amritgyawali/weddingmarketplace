import { Tabs } from 'expo-router';

import { RoleTabBar, type RoleTab } from '@/components/navigation/RoleTabBar';
import { myApplication, useFreelancerWorkspace } from '@/hooks/useWorkspace';
import { useAccount } from '@/store/useSession';
import { ROLE_THEMES } from '@/theme/roles';
import { daysUntil } from '@/utils/format';

export default function FreelancerTabs() {
  const account = useAccount();
  const { applied } = useFreelancerWorkspace(account);
  const upcoming = applied.filter((g) => myApplication(g, account.id)?.status === 'hired' && daysUntil(g.date) >= 0).length;

  const tabs: RoleTab[] = [
    { name: 'index', label: 'Discover', icon: 'compass-outline', activeIcon: 'compass' },
    { name: 'jobs', label: 'My Jobs', icon: 'briefcase-outline', activeIcon: 'briefcase', badge: upcoming },
    { name: 'earnings', label: 'Earnings', icon: 'wallet-outline', activeIcon: 'wallet' },
    { name: 'profile', label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
  ];

  return (
    <Tabs
      tabBar={(props) => <RoleTabBar {...props} tabs={tabs} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: ROLE_THEMES.freelancer.c.bg } }}>
      {tabs.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />
      ))}
    </Tabs>
  );
}
