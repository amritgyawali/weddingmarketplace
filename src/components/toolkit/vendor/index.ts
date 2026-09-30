import type { ToolDef } from '../hub';

import { BusinessHours, FollowUps, PolicyBuilder, ResponseTime, SavedReplies, SiteVisits } from './clients';
import { Benchmark, Expenses, Goals, PriceCalculator, ProfitLoss, Referrals, TaxSummary, Vouchers } from './money';
import { EventPrep, Halls, Inventory, StaffRoster, Suppliers, TeamTasks } from './ops';
import { CoupleShotLists, Fittings, Fleet, GalleryDelivery, MenuBuilder, MuhurtaPlanner, PowerPlanner, Rentals, SetupSheets, SongRequests, Tastings, Themes, TrialsAndLooks } from './trades';

/**
 * The vendor's business tools (`/business/tools`): 13 trade tools first, then
 * the 20 general ones. Each business sees only the tools its services allow
 * (`TOOL_RULES` in data/access.ts).
 */
export const VENDOR_TOOLS: ToolDef[] = [
  { id: 'vendor.menu', title: 'Menu', subtitle: 'Dishes, veg and non-veg sets, per-plate cost', icon: 'restaurant-outline', group: 'Catering', Component: MenuBuilder },
  { id: 'vendor.tastings', title: 'Tastings', subtitle: 'Tasting sessions linked to enquiries', icon: 'wine-outline', group: 'Catering', Component: Tastings },
  { id: 'vendor.themes', title: 'Themes', subtitle: 'Decor looks, price bands and inclusions', icon: 'color-palette-outline', group: 'Decor', Component: Themes },
  { id: 'vendor.rentals', title: 'Rentals', subtitle: 'Stock reserved per event, returns and damage', icon: 'cube-outline', group: 'Decor', Component: Rentals },
  { id: 'vendor.setup', title: 'Setup and teardown', subtitle: 'Crew, vehicle and access times per event', icon: 'construct-outline', group: 'Decor', Component: SetupSheets },
  { id: 'vendor.gallery', title: 'Gallery delivery', subtitle: 'Deliverables, proofing and revision rounds', icon: 'images-outline', group: 'Photo and film', Component: GalleryDelivery },
  { id: 'vendor.shotlists', title: 'Couples’ shot lists', subtitle: 'The must-have photos each couple asked for', icon: 'camera-outline', group: 'Photo and film', Component: CoupleShotLists },
  { id: 'vendor.trials', title: 'Trials and looks', subtitle: 'Trial bookings and your looks book', icon: 'brush-outline', group: 'Beauty', Component: TrialsAndLooks },
  { id: 'vendor.requests', title: 'Song requests', subtitle: 'Must-play and do-not-play lists per couple', icon: 'musical-notes-outline', group: 'Music', Component: SongRequests },
  { id: 'vendor.power', title: 'Power planner', subtitle: 'Connected load and the generator to hire', icon: 'flash-outline', group: 'Sound and power', Component: PowerPlanner },
  { id: 'vendor.fleet', title: 'Fleet', subtitle: 'Vehicles, drivers and papers', icon: 'car-outline', group: 'Transport', Component: Fleet },
  { id: 'vendor.fittings', title: 'Fittings', subtitle: 'Measurements, fittings and alterations', icon: 'shirt-outline', group: 'Fashion', Component: Fittings },
  { id: 'vendor.muhurta', title: 'Muhurta and samagri', subtitle: 'Auspicious times and samagri lists', icon: 'bonfire-outline', group: 'Rituals', Component: MuhurtaPlanner },
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
