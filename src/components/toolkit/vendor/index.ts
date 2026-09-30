import type { ToolDef } from '../hub';

import { BusinessHours, FollowUps, PolicyBuilder, ResponseTime, SavedReplies, SiteVisits } from './clients';
import { Benchmark, Expenses, Goals, PriceCalculator, ProfitLoss, Referrals, TaxSummary, Vouchers } from './money';
import { EventPrep, Halls, Inventory, StaffRoster, Suppliers, TeamTasks } from './ops';

/** The vendor's 20 extra business tools (`/business/tools`). */
export const VENDOR_TOOLS: ToolDef[] = [
  { id: 'vendor.replies', title: 'Saved replies', subtitle: 'Answer enquiries in seconds', icon: 'chatbox-outline', group: 'Couples and enquiries', Component: SavedReplies },
  { id: 'vendor.followups', title: 'Follow-ups', subtitle: 'Reminders so warm leads never go cold', icon: 'alarm-outline', group: 'Couples and enquiries', Component: FollowUps },
  { id: 'vendor.visits', title: 'Site visits', subtitle: 'Tours, tastings and walk-throughs', icon: 'walk-outline', group: 'Couples and enquiries', Component: SiteVisits },
  { id: 'vendor.response', title: 'Reply-time goal', subtitle: 'How fast couples hear back', icon: 'speedometer-outline', group: 'Couples and enquiries', Component: ResponseTime },
  { id: 'vendor.policy', title: 'Cancellation policy', subtitle: 'Refund tiers and date-change terms', icon: 'document-text-outline', group: 'Couples and enquiries', Component: PolicyBuilder },
  { id: 'vendor.hours', title: 'Hours and away message', subtitle: 'Opening hours and festival auto-reply', icon: 'time-outline', group: 'Couples and enquiries', Component: BusinessHours },
  { id: 'vendor.pricing', title: 'Price calculator', subtitle: 'Peak season, Saturday and last-minute pricing', icon: 'calculator-outline', group: 'Sales and pricing', Component: PriceCalculator },
  { id: 'vendor.benchmark', title: 'Market benchmark', subtitle: 'Your price, rating and reply time vs peers', icon: 'podium-outline', group: 'Sales and pricing', Component: Benchmark },
  { id: 'vendor.vouchers', title: 'Gift vouchers', subtitle: 'Sell vouchers families can gift', icon: 'ticket-outline', group: 'Sales and pricing', Component: Vouchers },
  { id: 'vendor.referrals', title: 'Referral partners', subtitle: 'Planners and hotels who send couples', icon: 'git-network-outline', group: 'Sales and pricing', Component: Referrals },
  { id: 'vendor.goals', title: 'Monthly goals', subtitle: 'Targets for payouts, bookings and leads', icon: 'flag-outline', group: 'Sales and pricing', Component: Goals },
  { id: 'vendor.expenses', title: 'Expenses', subtitle: 'Rent, wages, fuel and supplies', icon: 'receipt-outline', group: 'Money', Component: Expenses },
  { id: 'vendor.pnl', title: 'Profit and loss', subtitle: 'Six months of income against spend', icon: 'trending-up-outline', group: 'Money', Component: ProfitLoss },
  { id: 'vendor.tax', title: 'VAT and tax', subtitle: 'Output VAT, input credit, what you owe', icon: 'business-outline', group: 'Money', Component: TaxSummary },
  { id: 'vendor.roster', title: 'Staff roster', subtitle: 'Who works which event date', icon: 'people-outline', group: 'Operations', Component: StaffRoster },
  { id: 'vendor.prep', title: 'Event prep checklists', subtitle: 'A checklist for every booking', icon: 'checkbox-outline', group: 'Operations', Component: EventPrep },
  { id: 'vendor.tasks', title: 'Team tasks', subtitle: 'Internal to-dos with owners', icon: 'list-outline', group: 'Operations', Component: TeamTasks },
  { id: 'vendor.inventory', title: 'Inventory and equipment', subtitle: 'Stock, condition and servicing', icon: 'cube-outline', group: 'Operations', Component: Inventory },
  { id: 'vendor.suppliers', title: 'Suppliers', subtitle: 'Flowers, generators, tent houses and more', icon: 'storefront-outline', group: 'Operations', Component: Suppliers },
  { id: 'vendor.halls', title: 'Halls and capacity', subtitle: 'Seating capacity by layout', icon: 'grid-outline', group: 'Operations', Component: Halls },
];
