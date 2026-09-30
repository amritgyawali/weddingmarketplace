import type { ToolDef } from '../hub';

import { CashFlow, CitySupply, DemandHeatmap, RiskWatch, Scorecards, SlaMonitor, SourceFunnel, Targets, Workload } from './insight';
import { Broadcasts, ExportCentre, Helpdesk, Holidays, Macros, OnCall, PayoutBatches, PromoCampaigns, QualityAudits, Recruitment, WinBack } from './ops';

/** The operations team's 20 extra tools (`/platform/tools`). */
export const PLATFORM_TOOLS: ToolDef[] = [
  { id: 'platform.sla', title: 'SLA monitor', subtitle: 'Work that has waited too long', icon: 'timer-outline', group: 'Operations', Component: SlaMonitor },
  { id: 'platform.workload', title: 'Coordinator workload', subtitle: 'Balance weddings across the team', icon: 'people-outline', group: 'Operations', Component: Workload },
  { id: 'platform.oncall', title: 'On-call roster', subtitle: 'Who picks up the emergency line', icon: 'call-outline', group: 'Operations', Component: OnCall },
  { id: 'platform.holidays', title: 'Holidays and closures', subtitle: 'Festivals, bandhs and wedding clashes', icon: 'calendar-outline', group: 'Operations', Component: Holidays },
  { id: 'platform.qa', title: 'Quality audits', subtitle: 'Score every wedding after the event', icon: 'clipboard-outline', group: 'Operations', Component: QualityAudits },
  { id: 'platform.tickets', title: 'Helpdesk', subtitle: 'Support tickets with owners and priority', icon: 'help-buoy-outline', group: 'Support', Component: Helpdesk },
  { id: 'platform.macros', title: 'Reply macros', subtitle: 'Approved answers for support', icon: 'chatbox-ellipses-outline', group: 'Support', Component: Macros },
  { id: 'platform.broadcasts', title: 'Broadcasts', subtitle: 'Announcements to couples, vendors or crew', icon: 'megaphone-outline', group: 'Support', Component: Broadcasts },
  { id: 'platform.winback', title: 'Win-back list', subtitle: 'Lost couples worth one more call', icon: 'heart-outline', group: 'Growth', Component: WinBack },
  { id: 'platform.promos', title: 'Promo campaigns', subtitle: 'Discount codes with budgets', icon: 'pricetags-outline', group: 'Growth', Component: PromoCampaigns },
  { id: 'platform.recruit', title: 'Vendor recruitment', subtitle: 'Pipeline of businesses to onboard', icon: 'person-add-outline', group: 'Growth', Component: Recruitment },
  { id: 'platform.cities', title: 'City supply', subtitle: 'Where we need more providers', icon: 'map-outline', group: 'Growth', Component: CitySupply },
  { id: 'platform.demand', title: 'Demand by season', subtitle: 'Functions by Nepali month and city', icon: 'grid-outline', group: 'Insights', Component: DemandHeatmap },
  { id: 'platform.funnel', title: 'Source funnel', subtitle: 'Where weddings come from', icon: 'funnel-outline', group: 'Insights', Component: SourceFunnel },
  { id: 'platform.scorecards', title: 'Provider scorecards', subtitle: 'Reliability from real bookings', icon: 'podium-outline', group: 'Insights', Component: Scorecards },
  { id: 'platform.targets', title: 'Monthly targets', subtitle: 'Revenue, GMV and wedding targets', icon: 'flag-outline', group: 'Insights', Component: Targets },
  { id: 'platform.cashflow', title: 'Cash-flow forecast', subtitle: 'Milestones in, payouts out, by week', icon: 'trending-up-outline', group: 'Money and trust', Component: CashFlow },
  { id: 'platform.batches', title: 'Payout batches', subtitle: 'Ready payouts by eSewa, Khalti, bank', icon: 'wallet-outline', group: 'Money and trust', Component: PayoutBatches },
  { id: 'platform.risk', title: 'Risk and fraud watch', subtitle: 'Patterns worth a second look', icon: 'warning-outline', group: 'Money and trust', Component: RiskWatch },
  { id: 'platform.exports', title: 'Export centre', subtitle: 'CSV downloads for finance', icon: 'download-outline', group: 'Money and trust', Component: ExportCentre },
];
