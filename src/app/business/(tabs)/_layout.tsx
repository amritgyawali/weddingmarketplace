import { Tabs } from 'expo-router';

import { RoleTabBar, type RoleTab } from '@/components/navigation/RoleTabBar';
import { useVendorWorkspace } from '@/hooks/useWorkspace';
import { useAccount } from '@/store/useSession';
import { ROLE_THEMES } from '@/theme/roles';

export default function BusinessTabs() {
  const account = useAccount();
  const { leads, quotes } = useVendorWorkspace(account);

  const tabs: RoleTab[] = [
    { name: 'index', label: 'Home', icon: 'grid-outline', activeIcon: 'grid' },
    { name: 'leads', label: 'Leads', icon: 'people-outline', activeIcon: 'people', badge: leads.filter((l) => l.status === 'new').length },
    { name: 'quotes', label: 'Quotes', icon: 'document-text-outline', activeIcon: 'document-text', badge: quotes.filter((q) => q.status === 'revision').length },
    { name: 'projects', label: 'Projects', icon: 'calendar-outline', activeIcon: 'calendar' },
    { name: 'account', label: 'Business', icon: 'storefront-outline', activeIcon: 'storefront' },
  ];

  return (
    <Tabs
      tabBar={(props) => <RoleTabBar {...props} tabs={tabs} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: ROLE_THEMES.vendor.c.bg } }}>
      {tabs.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />
      ))}
    </Tabs>
  );
}
