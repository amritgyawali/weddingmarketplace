import { Tabs } from 'expo-router';

import { RoleTabBar, type RoleTab, type SidebarLink } from '@/components/navigation/RoleTabBar';
import { useLayout } from '@/hooks/useLayout';
import { useFreelancerWorkspace } from '@/hooks/useWorkspace';
import { useUnreadMessageCount } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { ROLE_THEMES } from '@/theme/roles';

export default function FreelancerTabs() {
  const { wide } = useLayout();
  const account = useAccount();
  const { upcoming, invited, payables } = useFreelancerWorkspace(account);
  const unread = useUnreadMessageCount(account);

  const tabs: RoleTab[] = [
    { name: 'index', label: 'Gigs', icon: 'compass-outline', activeIcon: 'compass', badge: invited.length },
    { name: 'jobs', label: 'My Jobs', icon: 'briefcase-outline', activeIcon: 'briefcase', badge: upcoming.length },
    { name: 'calendar', label: 'Calendar', icon: 'calendar-outline', activeIcon: 'calendar' },
    { name: 'earnings', label: 'Earnings', icon: 'wallet-outline', activeIcon: 'wallet', badge: payables.filter((p) => p.status === 'READY').length },
    { name: 'profile', label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
  ];
  const links: SidebarLink[] = [
    { label: 'Messages', icon: 'chatbubbles-outline', href: '/freelancer/inbox', badge: unread || undefined },
    { label: 'Verification', icon: 'shield-checkmark-outline', href: '/freelancer/verification' },
    { label: 'Notifications', icon: 'notifications-outline', href: '/notifications' },
  ];

  return (
    <Tabs
      tabBar={(props) => <RoleTabBar {...props} tabs={tabs} links={links} />}
      screenOptions={{ headerShown: false, tabBarPosition: wide ? 'left' : 'bottom', sceneStyle: { backgroundColor: ROLE_THEMES.freelancer.c.bg } }}>
      {tabs.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />
      ))}
    </Tabs>
  );
}
