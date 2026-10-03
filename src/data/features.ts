/**
 * Feature switches a super admin flips from the console (Platform → More →
 * Super admin → Features), with no code change. Each switch hides a surface
 * for everyone: a tab, a home section, a marketplace category, a tool, a
 * sign-up path. State lives in `DbData.featureFlags`; a missing id is on.
 *
 * Tools are switched by `tool:<ToolId>` and marketplace services by
 * `service:<serviceId>`, so this list holds only the fixed surfaces.
 */
import type { UserRole } from '@/types/platform';

export interface FeatureDef {
  id: string;
  label: string;
  /** Which app it belongs to; `all` for shared surfaces. */
  role: UserRole | 'all';
  group: string;
  hint?: string;
}

export const FEATURES: FeatureDef[] = [
  // Couple app
  { id: 'tab.customer.venues', label: 'Venues tab', role: 'customer', group: 'Tabs' },
  { id: 'tab.customer.vendors', label: 'Vendors tab', role: 'customer', group: 'Tabs' },
  { id: 'tab.customer.ideas', label: 'Ideas tab', role: 'customer', group: 'Tabs' },
  { id: 'tab.customer.wedding', label: 'My wedding tab', role: 'customer', group: 'Tabs', hint: "The couple's plan, quotes and payments" },
  { id: 'tab.customer.genie', label: 'Planner packages', role: 'customer', group: 'Tabs', hint: 'Paid planner packages: the home banner and the menu entry' },
  { id: 'home.categories', label: 'Category shortcuts', role: 'customer', group: 'Home' },
  { id: 'home.planning', label: 'Your planning grid', role: 'customer', group: 'Home' },
  { id: 'home.venues', label: 'Venues carousel', role: 'customer', group: 'Home' },
  { id: 'home.collections', label: 'Venue collections', role: 'customer', group: 'Home' },
  { id: 'home.checklist', label: 'Checklist card', role: 'customer', group: 'Home' },
  { id: 'home.photographers', label: 'Photographers carousel', role: 'customer', group: 'Home' },
  { id: 'home.planner', label: 'Planner banner', role: 'customer', group: 'Home' },
  { id: 'home.makeup', label: 'Makeup carousel', role: 'customer', group: 'Home' },
  { id: 'home.real_weddings', label: 'Real weddings', role: 'customer', group: 'Home' },
  { id: 'couple.help', label: 'Quick help button', role: 'customer', group: 'Features' },
  { id: 'couple.search', label: 'Search', role: 'customer', group: 'Features' },
  { id: 'couple.messages', label: 'Messages', role: 'customer', group: 'Features' },
  { id: 'couple.tools', label: 'Planning tools hub', role: 'customer', group: 'Features' },
  { id: 'couple.celebrate', label: 'Plan another celebration', role: 'customer', group: 'Features' },
  { id: 'couple.tour', label: 'First-run app tour', role: 'customer', group: 'Features', hint: 'Small cards that explain search, the tabs, messages and the menu on first open' },
  // Business app
  { id: 'tab.vendor.leads', label: 'Leads tab', role: 'vendor', group: 'Tabs' },
  { id: 'tab.vendor.bookings', label: 'Bookings tab', role: 'vendor', group: 'Tabs' },
  { id: 'tab.vendor.calendar', label: 'Calendar tab', role: 'vendor', group: 'Tabs' },
  { id: 'tab.vendor.account', label: 'Business tab', role: 'vendor', group: 'Tabs' },
  { id: 'vendor.social', label: 'Social media hub', role: 'vendor', group: 'Features', hint: 'Facebook, Instagram, WhatsApp and TikTok inbox and publishing' },
  // Freelancer app
  { id: 'tab.freelancer.jobs', label: 'My jobs tab', role: 'freelancer', group: 'Tabs' },
  { id: 'tab.freelancer.calendar', label: 'Calendar tab', role: 'freelancer', group: 'Tabs' },
  { id: 'tab.freelancer.earnings', label: 'Earnings tab', role: 'freelancer', group: 'Tabs' },
  { id: 'tab.freelancer.profile', label: 'Profile tab', role: 'freelancer', group: 'Tabs' },
  // Staff console (More and the super admin console can't be switched off)
  { id: 'tab.platform.leads', label: 'Leads tab', role: 'platform', group: 'Tabs' },
  { id: 'tab.platform.weddings', label: 'Weddings tab', role: 'platform', group: 'Tabs' },
  { id: 'tab.platform.execution', label: 'Control tab', role: 'platform', group: 'Tabs' },
  // Everyone
  { id: 'signup.vendor', label: 'Business sign-up', role: 'all', group: 'Sign-up', hint: 'Hides the business card on "Who are you?"' },
  { id: 'signup.freelancer', label: 'Freelancer sign-up', role: 'all', group: 'Sign-up' },
  { id: 'signup.platform', label: 'Staff sign-up', role: 'all', group: 'Sign-up' },
  { id: 'login.demo', label: 'One-tap demo accounts', role: 'all', group: 'Sign-up', hint: 'The "Continue as …" buttons on the login screens' },
  { id: 'app.announcements', label: 'Announcements on home screens', role: 'all', group: 'Content' },
  { id: 'app.notifications', label: 'Pop-up confirmations', role: 'all', group: 'Content', hint: 'The short message after adding, deleting or finishing something' },
  { id: 'app.bug_report', label: 'Shake to report a bug', role: 'all', group: 'Content', hint: 'Everyone, on every screen: shaking the phone sends a screenshot and a description to Super admin → Bug reports' },
];

export const FEATURE_BY_ID: Record<string, FeatureDef> = Object.fromEntries(FEATURES.map((f) => [f.id, f]));

export const toolFeature = (toolId: string) => `tool:${toolId}`;
export const serviceFeature = (serviceId: string) => `service:${serviceId}`;
export const tabFeature = (role: UserRole, tab: string) => `tab.${role}.${tab}`;

/** Is the feature on? Missing ids are on. */
export const featureOn = (flags: Record<string, boolean> | undefined, id: string) => flags?.[id] !== false;
