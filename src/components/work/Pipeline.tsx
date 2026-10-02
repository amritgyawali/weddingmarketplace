import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Project, ProjectStatus } from '@/types/platform';
import { formatShortDate } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

/** Happy-path order of the project pipeline. */
export const PIPELINE: ProjectStatus[] = [
  'NEW',
  'REVIEWING',
  'NEEDS_CLARIFICATION',
  'MATCHING_PROVIDERS',
  'QUOTE_PREPARED',
  'QUOTE_SENT',
  'CUSTOMER_NEGOTIATING',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CLOSED',
];

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  NEW: 'New',
  REVIEWING: 'Reviewing',
  NEEDS_CLARIFICATION: 'Needs clarification',
  MATCHING_PROVIDERS: 'Matching providers',
  QUOTE_PREPARED: 'Quote prepared',
  QUOTE_SENT: 'Quote sent',
  CUSTOMER_NEGOTIATING: 'Negotiating',
  CONFIRMED: 'Confirmed',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CLOSED: 'Closed',
  QUOTE_REJECTED: 'Quote rejected',
  CANCELLED: 'Cancelled',
};

/** What the couple sees for each internal status. */
export const CUSTOMER_STATUS: Record<ProjectStatus, { title: string; body: string; icon: string }> = {
  NEW: { title: 'Requirement received', body: 'A coordinator is being assigned to your wedding.', icon: 'paper-plane' },
  REVIEWING: { title: 'Your coordinator is reviewing', body: 'Expect a call to go through your requirements.', icon: 'reader' },
  NEEDS_CLARIFICATION: { title: 'A few questions for you', body: 'Check messages — your coordinator needs some details.', icon: 'help-circle' },
  MATCHING_PROVIDERS: { title: 'Matching the best providers', body: 'We’re checking availability and prices with vendors.', icon: 'git-compare' },
  QUOTE_PREPARED: { title: 'Preparing your quotation', body: 'Your complete wedding quote is almost ready.', icon: 'document-text' },
  QUOTE_SENT: { title: 'Your quotation is ready', body: 'Review it and accept, or ask for changes.', icon: 'document-text' },
  CUSTOMER_NEGOTIATING: { title: 'Revising your quotation', body: 'Your coordinator is updating the quote with your changes.', icon: 'swap-horizontal' },
  CONFIRMED: { title: 'Wedding confirmed', body: 'Your providers are booked. Track everything here.', icon: 'checkmark-circle' },
  IN_PROGRESS: { title: 'Celebrations underway', body: 'Your team is on the ground — follow the live run sheet.', icon: 'radio' },
  COMPLETED: { title: 'All events complete', body: 'Photos and films are on the way. Don’t forget to review!', icon: 'ribbon' },
  CLOSED: { title: 'Project closed', body: 'Thank you for celebrating with Vivah.', icon: 'heart' },
  QUOTE_REJECTED: { title: 'Quote declined', body: 'Tell your coordinator what to change for a new proposal.', icon: 'close-circle' },
  CANCELLED: { title: 'Cancelled', body: 'This project was cancelled.', icon: 'close-circle' },
};

/** Compact horizontal stepper for the project pipeline. */
export function PipelineStepper({ project, compact }: { project: Project; compact?: boolean }) {
  const t = useRoleTheme();
  const terminal = project.status === 'CANCELLED' || project.status === 'QUOTE_REJECTED';
  const steps: ProjectStatus[] = compact ? ['NEW', 'REVIEWING', 'MATCHING_PROVIDERS', 'QUOTE_SENT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] : PIPELINE;
  const reached = (s: ProjectStatus) => project.statusHistory.some((h) => h.status === s) || PIPELINE.indexOf(s) <= PIPELINE.indexOf(project.status);
  const skipped = (s: ProjectStatus) => (s === 'NEEDS_CLARIFICATION' || s === 'CUSTOMER_NEGOTIATING') && !project.statusHistory.some((h) => h.status === s) && project.status !== s;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {steps
        .filter((s) => !skipped(s))
        .map((s, i, arr) => {
          const current = project.status === s;
          const done = reached(s) && !current;
          const at = [...project.statusHistory].reverse().find((h) => h.status === s)?.at;
          const color = current ? (terminal ? t.c.danger : t.c.primary) : done ? t.c.textStrong : t.c.border;
          return (
            <View key={s} style={styles.step}>
              <View style={styles.nodeRow}>
                <View style={[styles.node, { borderColor: color, backgroundColor: done ? color : t.c.surface }, current && styles.nodeCurrent]} />
                {i < arr.length - 1 && <View style={[styles.bar, { backgroundColor: done ? t.c.textStrong : t.c.border }]} />}
              </View>
              <Text size={12} weight={current ? 'semibold' : 'regular'} color={current ? t.c.textStrong : done ? t.c.text : t.c.subtle} numberOfLines={2} lineHeight={15} style={{ width: 78 }}>
                {STATUS_LABEL[s]}
              </Text>
              {at && (
                <Text size={11} color={t.c.subtle}>
                  {formatShortDate(at).slice(4)}
                </Text>
              )}
            </View>
          );
        })}
      {terminal && (
        <View style={styles.step}>
          <View style={[styles.node, { borderColor: t.c.danger, backgroundColor: t.c.danger }]} />
          <Text size={12} weight="semibold" color={t.c.danger} style={{ width: 78 }}>
            {STATUS_LABEL[project.status]}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

/** Next statuses a coordinator can move a project to. */
export function nextStatuses(status: ProjectStatus): ProjectStatus[] {
  switch (status) {
    case 'NEW':
      return ['REVIEWING', 'NEEDS_CLARIFICATION', 'CANCELLED'];
    case 'REVIEWING':
      return ['MATCHING_PROVIDERS', 'NEEDS_CLARIFICATION', 'CANCELLED'];
    case 'NEEDS_CLARIFICATION':
      return ['REVIEWING', 'MATCHING_PROVIDERS', 'CANCELLED'];
    case 'MATCHING_PROVIDERS':
      return ['QUOTE_PREPARED', 'NEEDS_CLARIFICATION', 'CANCELLED'];
    case 'QUOTE_PREPARED':
      return ['QUOTE_SENT', 'MATCHING_PROVIDERS'];
    case 'QUOTE_SENT':
      return ['CUSTOMER_NEGOTIATING', 'CONFIRMED', 'QUOTE_REJECTED'];
    case 'CUSTOMER_NEGOTIATING':
      return ['QUOTE_SENT', 'CONFIRMED', 'QUOTE_REJECTED', 'CANCELLED'];
    case 'QUOTE_REJECTED':
      return ['MATCHING_PROVIDERS', 'CANCELLED', 'CLOSED'];
    case 'CONFIRMED':
      return ['IN_PROGRESS', 'CANCELLED'];
    case 'IN_PROGRESS':
      return ['COMPLETED'];
    case 'COMPLETED':
      return ['CLOSED'];
    default:
      return [];
  }
}

const styles = StyleSheet.create({
  row: { paddingVertical: 4, gap: 0 },
  step: { gap: 6, width: 86 },
  nodeRow: { flexDirection: 'row', alignItems: 'center', height: 14 },
  node: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5 },
  nodeCurrent: { width: 14, height: 14, borderRadius: 7, borderWidth: 3 },
  bar: { flex: 1, height: 1, marginHorizontal: 3 },
});
