import { Tabs } from 'expo-router';

import { RoleTabBar, type RoleTab, type SidebarLink } from '@/components/navigation/RoleTabBar';
import { PLATFORM_ROUTE_RULES } from '@/data/access';
import { useExperience } from '@/hooks/useExperience';
import { useLayout } from '@/hooks/useLayout';
import { allows } from '@/services/experience';
import { useDb, useUnreadMessageCount } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { ROLE_THEMES } from '@/theme/roles';

const ALL_TABS = ['index', 'leads', 'weddings', 'execution', 'more'];

export default function PlatformTabs() {
  const { wide } = useLayout();
  const account = useAccount();
  const exp = useExperience();
  const allowed = (route: string) => allows(exp, PLATFORM_ROUTE_RULES[route]);
  const verifications = useDb((s) => s.verifications);
  const reviews = useDb((s) => s.reviews);
  const projects = useDb((s) => s.projects);
  const disputes = useDb((s) => s.disputes);
  const unread = useUnreadMessageCount(account);
  const pending = verifications.filter((v) => v.status === 'DOCUMENT_SUBMITTED' || v.status === 'UNDER_REVIEW').length + reviews.filter((r) => r.status === 'flagged').length;
  const live = projects.flatMap((p) => p.events).filter((e) => e.status === 'live').length;
  const fresh = projects.filter((p) => p.status === 'NEW' || p.status === 'REVIEWING' || p.status === 'NEEDS_CLARIFICATION').length;

  const tabs: RoleTab[] = [
    { name: 'index', label: 'Today', icon: 'pulse-outline', activeIcon: 'pulse' },
    { name: 'leads', label: 'Leads', icon: 'flash-outline', activeIcon: 'flash', badge: fresh },
    { name: 'weddings', label: 'Weddings', icon: 'heart-outline', activeIcon: 'heart' },
    { name: 'execution', label: 'Control', icon: 'radio-outline', activeIcon: 'radio', badge: live },
    { name: 'more', label: 'More', icon: 'apps-outline', activeIcon: 'apps', badge: pending || undefined },
  ].filter((tab) => allowed(`/platform/${tab.name}`)) as RoleTab[];
  const links: SidebarLink[] = [
    { label: 'Messages', icon: 'chatbubbles-outline', href: '/platform/inbox', badge: unread || undefined },
    { label: 'Approvals', icon: 'shield-checkmark-outline', href: '/platform/approvals', badge: pending || undefined },
    { label: 'Finance', icon: 'wallet-outline', href: '/platform/finance', badge: disputes.filter((d) => d.status === 'OPEN' || d.status === 'INVESTIGATING').length || undefined },
    { label: 'Crew gigs', icon: 'megaphone-outline', href: '/platform/gigs' },
    { label: 'Quotations', icon: 'document-text-outline', href: '/platform/quotes' },
    { label: 'Calendar', icon: 'calendar-outline', href: '/platform/calendar' },
    { label: 'Providers', icon: 'storefront-outline', href: '/platform/providers' },
    { label: 'Freelancers', icon: 'people-outline', href: '/platform/freelancers' },
    { label: 'Users', icon: 'person-circle-outline', href: '/platform/users' },
    { label: 'Analytics', icon: 'stats-chart-outline', href: '/platform/analytics' },
    { label: 'Marketplace', icon: 'options-outline', href: '/platform/marketplace' },
    { label: 'Audit log', icon: 'list-outline', href: '/platform/audit' },
  ].filter((l) => allowed(String(l.href).split('?')[0])) as SidebarLink[];

  return (
    <Tabs
      tabBar={(props) => <RoleTabBar {...props} tabs={tabs} links={links} />}
      screenOptions={{ headerShown: false, tabBarPosition: wide ? 'left' : 'bottom', sceneStyle: { backgroundColor: ROLE_THEMES.platform.c.bg } }}>
      {ALL_TABS.map((name) => (
        <Tabs.Screen key={name} name={name} options={{ title: tabs.find((x) => x.name === name)?.label ?? name, href: tabs.some((x) => x.name === name) ? undefined : null }} />
      ))}
    </Tabs>
  );
}
