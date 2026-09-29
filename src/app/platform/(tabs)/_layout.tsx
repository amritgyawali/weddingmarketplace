import { Tabs } from 'expo-router';

import { RoleTabBar, type RoleTab } from '@/components/navigation/RoleTabBar';
import { useDb } from '@/store/useDb';
import { ROLE_THEMES } from '@/theme/roles';

export default function PlatformTabs() {
  const approvals = useDb((s) => s.approvals);
  const projects = useDb((s) => s.projects);
  const pending = approvals.filter((a) => a.status === 'pending').length;
  const live = projects.flatMap((p) => p.events).filter((e) => e.status === 'live').length;

  const tabs: RoleTab[] = [
    { name: 'index', label: 'Overview', icon: 'pulse-outline', activeIcon: 'pulse' },
    { name: 'weddings', label: 'Weddings', icon: 'heart-outline', activeIcon: 'heart' },
    { name: 'execution', label: 'Control', icon: 'radio-outline', activeIcon: 'radio', badge: live },
    { name: 'approvals', label: 'Approvals', icon: 'shield-checkmark-outline', activeIcon: 'shield-checkmark', badge: pending },
    { name: 'more', label: 'More', icon: 'apps-outline', activeIcon: 'apps' },
  ];

  return (
    <Tabs
      tabBar={(props) => <RoleTabBar {...props} tabs={tabs} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: ROLE_THEMES.platform.c.bg } }}>
      {tabs.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />
      ))}
    </Tabs>
  );
}
