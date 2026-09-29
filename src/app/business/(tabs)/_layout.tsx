import { Tabs } from 'expo-router';

import { RoleTabBar, type RoleTab, type SidebarLink } from '@/components/navigation/RoleTabBar';
import { useLayout } from '@/hooks/useLayout';
import { useVendorWorkspace } from '@/hooks/useWorkspace';
import { useUnreadMessageCount } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { ROLE_THEMES } from '@/theme/roles';

export default function BusinessTabs() {
  const { wide } = useLayout();
  const account = useAccount();
  const { leads, requests, payables } = useVendorWorkspace(account);
  const unread = useUnreadMessageCount(account);

  const tabs: RoleTab[] = [
    { name: 'index', label: 'Home', icon: 'grid-outline', activeIcon: 'grid' },
    { name: 'leads', label: 'Leads', icon: 'flash-outline', activeIcon: 'flash', badge: leads.filter((l) => l.status === 'new').length + requests.length },
    { name: 'bookings', label: 'Bookings', icon: 'briefcase-outline', activeIcon: 'briefcase' },
    { name: 'calendar', label: 'Calendar', icon: 'calendar-outline', activeIcon: 'calendar' },
    { name: 'account', label: 'Business', icon: 'storefront-outline', activeIcon: 'storefront' },
  ];
  const links: SidebarLink[] = [
    { label: 'Messages', icon: 'chatbubbles-outline', href: '/business/inbox', badge: unread || undefined },
    { label: 'Quotations', icon: 'document-text-outline', href: '/business/quotes' },
    { label: 'Hire crew (gigs)', icon: 'megaphone-outline', href: '/business/gigs' },
    { label: 'Packages & services', icon: 'pricetags-outline', href: '/business/packages' },
    { label: 'Portfolio', icon: 'images-outline', href: '/business/portfolio' },
    { label: 'Finance', icon: 'wallet-outline', href: '/business/finance', badge: payables.filter((p) => p.status === 'READY').length || undefined },
    { label: 'Analytics', icon: 'stats-chart-outline', href: '/business/analytics' },
    { label: 'Promotions', icon: 'megaphone-outline', href: '/business/promotions' },
    { label: 'Reviews', icon: 'star-outline', href: '/business/reviews' },
    { label: 'Team', icon: 'people-outline', href: '/business/team' },
    { label: 'Customers', icon: 'person-circle-outline', href: '/business/customers' },
  ];

  return (
    <Tabs
      tabBar={(props) => <RoleTabBar {...props} tabs={tabs} links={links} />}
      screenOptions={{ headerShown: false, tabBarPosition: wide ? 'left' : 'bottom', sceneStyle: { backgroundColor: ROLE_THEMES.vendor.c.bg } }}>
      {tabs.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />
      ))}
    </Tabs>
  );
}
