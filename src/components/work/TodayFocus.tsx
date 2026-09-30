/**
 * The top of the operations Today screen, shaped by the staff member's job
 * (master plan §4.4): coordinators see their weddings, support the helpdesk,
 * Vendor Success the verification queue, finance the money waiting, admins the
 * platform's health. The focus comes from permissions (`TODAY_FOCUS`), not
 * from the role name, so a custom role with the same rights sees the same.
 */
import { router, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Card, ListRow, SectionTitle, StatusPill, type IconName } from '@/components/kit';
import { toolHref } from '@/components/toolkit/hub';
import { TODAY_FOCUS } from '@/data/access';
import { useExperience } from '@/hooks/useExperience';
import { allows } from '@/services/experience';
import { milestoneStatus } from '@/services/pricing';
import { projectRisks } from '@/services/risk';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { daysUntil, formatMoneyCompact, toISODate, today } from '@/utils/format';

interface FocusRow {
  icon: IconName;
  title: string;
  subtitle: string;
  count: number;
  href: Href;
  /** Counts that need action are shown as a pill. */
  urgent?: boolean;
}

const TITLES = {
  coordinator: 'Your weddings',
  support: 'Helpdesk',
  vendor_success: 'Vendor success',
  finance: 'Money waiting',
  admin: 'Platform health',
} as const;

const CLOSED = ['COMPLETED', 'CLOSED', 'CANCELLED', 'QUOTE_REJECTED'];

export function TodayFocus() {
  const account = useAccount();
  const exp = useExperience();
  const projects = useDb((s) => s.projects);
  const quotes = useDb((s) => s.quotes);
  const gigs = useDb((s) => s.gigs);
  const payables = useDb((s) => s.payables);
  const refunds = useDb((s) => s.refunds);
  const disputes = useDb((s) => s.disputes);
  const verifications = useDb((s) => s.verifications);
  const reviews = useDb((s) => s.reviews);
  const entries = useDb((s) => s.toolEntries);
  const audit = useDb((s) => s.audit);

  const focus = TODAY_FOCUS.find((f) => allows(exp, f.when))?.id ?? 'coordinator';
  const now = today();
  const active = projects.filter((p) => !CLOSED.includes(p.status));
  const ops = (tool: string, open: (status?: string) => boolean) => entries.filter((e) => e.ownerId === 'platform' && e.tool === tool && open(e.status));
  const kyc = verifications.filter((v) => v.status === 'DOCUMENT_SUBMITTED' || v.status === 'UNDER_REVIEW');
  const flagged = reviews.filter((r) => r.status === 'flagged');
  const incidents = active.flatMap((p) => p.incidents.filter((i) => i.status === 'open'));

  let rows: FocusRow[] = [];
  if (focus === 'coordinator') {
    const mine = active.filter((p) => p.coordinatorId === account.id);
    const week = mine.filter((p) => p.events.some((e) => e.date && e.status !== 'cancelled' && daysUntil(e.date) >= 0 && daysUntil(e.date) <= 7));
    const breaches = mine.flatMap((p) => projectRisks(p, { gigs, quotes })).filter((r) => r.severity === 'high');
    const runSheets = mine.flatMap((p) => p.events.filter((e) => e.date === now && e.status !== 'cancelled'));
    const clarify = mine.filter((p) => p.status === 'NEEDS_CLARIFICATION');
    rows = [
      { icon: 'heart-outline', title: 'My weddings this week', subtitle: week.map((p) => p.code).join(', ') || 'Nothing in the next 7 days', count: week.length, href: '/platform/weddings' },
      { icon: 'warning-outline', title: 'SLA breaches and high risks', subtitle: 'On projects you own', count: breaches.length, href: '/platform/weddings', urgent: breaches.length > 0 },
      { icon: 'list-outline', title: 'Today’s run sheets', subtitle: runSheets.map((e) => e.name).join(', ') || 'No functions today', count: runSheets.length, href: '/platform/execution' },
      { icon: 'help-circle-outline', title: 'Clarifications waiting', subtitle: 'Couples to call back', count: clarify.length, href: '/platform/leads', urgent: clarify.length > 0 },
    ];
  } else if (focus === 'support') {
    const tickets = ops('platform.tickets', (s) => s !== 'resolved' && s !== 'closed');
    rows = [
      { icon: 'chatbox-ellipses-outline', title: 'Open helpdesk tickets', subtitle: 'Couples, vendors and crew waiting on us', count: tickets.length, href: toolHref('platform', 'platform.tickets'), urgent: tickets.length > 0 },
      { icon: 'alert-circle-outline', title: 'Open incidents', subtitle: 'Reported on the day', count: incidents.length, href: '/platform/execution', urgent: incidents.length > 0 },
      { icon: 'flag-outline', title: 'Flagged reviews', subtitle: 'Keep or remove', count: flagged.length, href: '/platform/approvals' },
      { icon: 'chatbubbles-outline', title: 'Reply macros', subtitle: 'Saved answers for common questions', count: ops('platform.macros', () => true).length, href: toolHref('platform', 'platform.macros') },
    ];
  } else if (focus === 'vendor_success') {
    const recruit = ops('platform.recruit', (s) => s !== 'live' && s !== 'lost');
    rows = [
      { icon: 'shield-checkmark-outline', title: 'Verification queue', subtitle: 'KYC cases to review', count: kyc.length, href: '/platform/approvals', urgent: kyc.length > 0 },
      { icon: 'person-add-outline', title: 'Recruitment pipeline', subtitle: 'Venues and vendors we are signing up', count: recruit.length, href: toolHref('platform', 'platform.recruit') },
      { icon: 'map-outline', title: 'City supply gaps', subtitle: 'Where couples ask for services we lack', count: 0, href: toolHref('platform', 'platform.cities') },
      { icon: 'ribbon-outline', title: 'Provider scorecards', subtitle: 'Reliability, response and reviews', count: 0, href: toolHref('platform', 'platform.scorecards') },
    ];
  } else if (focus === 'finance') {
    const ready = payables.filter((p) => p.status === 'READY');
    const overdue = projects.flatMap((p) => p.milestones.filter((m) => milestoneStatus(m) === 'OVERDUE'));
    const requested = refunds.filter((r) => r.status === 'REQUESTED');
    const open = disputes.filter((d) => d.status === 'OPEN' || d.status === 'INVESTIGATING');
    rows = [
      { icon: 'wallet-outline', title: 'Payouts ready', subtitle: `${formatMoneyCompact(ready.reduce((s, p) => s + p.amount, 0))} to providers and crew`, count: ready.length, href: '/platform/finance', urgent: ready.length > 0 },
      { icon: 'return-down-back-outline', title: 'Refund requests', subtitle: 'Approve or reject', count: requested.length, href: '/platform/finance?tab=refunds', urgent: requested.length > 0 },
      { icon: 'alert-circle-outline', title: 'Open disputes', subtitle: 'Payouts on hold until resolved', count: open.length, href: '/platform/finance?tab=disputes', urgent: open.length > 0 },
      { icon: 'card-outline', title: 'Overdue milestones', subtitle: 'Customer payments past due', count: overdue.length, href: '/platform/finance', urgent: overdue.length > 0 },
      { icon: 'trending-up-outline', title: 'Cash-flow forecast', subtitle: 'In and out for the next 8 weeks', count: 0, href: toolHref('platform', 'platform.cashflow') },
    ];
  } else {
    const high = new Set(active.flatMap((p) => projectRisks(p, { gigs, quotes })).filter((r) => r.severity === 'high').map((r) => r.projectId));
    rows = [
      { icon: 'pulse-outline', title: 'Active projects', subtitle: `${high.size} high-risk`, count: active.length, href: '/platform/weddings', urgent: high.size > 0 },
      { icon: 'shield-checkmark-outline', title: 'Approvals', subtitle: `${kyc.length} KYC cases · ${flagged.length} flagged reviews`, count: kyc.length + flagged.length, href: '/platform/approvals', urgent: kyc.length + flagged.length > 0 },
      { icon: 'options-outline', title: 'Rates and fees', subtitle: 'Commission, markup, service fee', count: 0, href: '/platform/marketplace' },
      { icon: 'list-outline', title: 'Audit log', subtitle: 'Changes made today', count: audit.filter((a) => toISODate(new Date(a.at)) === now).length, href: '/platform/audit' },
    ];
  }

  return (
    <View>
      <SectionTitle title={TITLES[focus]} />
      <Card padded={false} style={styles.card}>
        {rows.map((r) => (
          <ListRow
            key={r.title}
            icon={r.icon}
            title={r.title}
            subtitle={r.subtitle}
            trailing={r.count ? <StatusPill status={r.urgent ? 'pending' : 'draft'} label={String(r.count)} /> : undefined}
            onPress={() => router.push(r.href)}
          />
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
});
