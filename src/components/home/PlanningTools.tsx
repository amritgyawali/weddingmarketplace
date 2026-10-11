import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { colors, GUTTER, themed } from '@/constants/theme';
import { CHECKLIST_TOTAL } from '@/data/checklist';
import { useExperience } from '@/hooks/useExperience';
import { useCustomerWorkspace } from '@/hooks/useWorkspace';
import { selectShortlistCount, useAppStore } from '@/store/useAppStore';
import { useAccount } from '@/store/useSession';

type IconName = ComponentProps<typeof Ionicons>['name'];

function Tool({ icon, label, meta, alert, href, onPress }: { icon: IconName; label: string; meta: string; alert?: boolean; href?: Href; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress ?? (() => href && router.push(href))} accessibilityRole="button" accessibilityLabel={`${label}, ${meta}`} style={({ pressed }) => [styles.tool, pressed && { backgroundColor: colors.bgSoft }]}>
      <Ionicons name={icon} size={20} color={colors.textBody} />
      <View style={{ flex: 1 }}>
        <Text size={15} weight="medium" color={colors.heading} numberOfLines={1}>
          {label}
        </Text>
        <Text size={13} color={alert ? colors.primary : colors.textMuted} weight={alert ? 'medium' : 'regular'} numberOfLines={1}>
          {meta}
        </Text>
      </View>
    </Pressable>
  );
}

/** Two-column grid of the couple's planning tools, each with a live count. */
export function PlanningTools() {
  const shortlistCount = useAppStore(selectShortlistCount);
  const done = useAppStore((s) => s.completedTasks.length);
  const bookings = useAppStore((s) => s.bookings.length);
  const account = useAccount();
  const exp = useExperience();
  const { project, quotes } = useCustomerWorkspace(account.id);
  const awaitingQuotes = quotes.filter((q) => q.status === 'sent' || q.status === 'viewed').length;
  const wedding = !exp.occasion || exp.occasion.id === 'wedding' || exp.occasion.id === 'engagement';
  const tasks = project?.tasks.filter((t) => t.visibility !== 'internal') ?? [];
  const tasksDone = tasks.filter((t) => t.status === 'COMPLETED').length;

  return (
    <View style={styles.section}>
      <SectionHeader title="Your planning" />
      <View style={styles.grid}>
        <Tool
          icon="document-text-outline"
          label={wedding ? 'Wedding plan' : exp.vocab.planTitle}
          meta={awaitingQuotes ? `${awaitingQuotes} quote${awaitingQuotes > 1 ? 's' : ''} to review` : 'Quotes, payments, run sheet'}
          alert={!!awaitingQuotes}
          href="/my-wedding?tab=services&section=plan"
        />
        <Tool icon="bookmark-outline" label="Shortlist" meta={shortlistCount ? `${shortlistCount} saved` : 'Nothing saved yet'} href="/shortlist" />
        {wedding || !project ? (
          <Tool icon="checkbox-outline" label="Checklist" meta={`${done} of ${CHECKLIST_TOTAL} done`} href="/checklist" />
        ) : (
          <Tool icon="checkbox-outline" label="Checklist" meta={`${tasksDone} of ${tasks.length} done`} href="/my-wedding?tab=tasks" />
        )}
        <Tool icon="receipt-outline" label="Enquiries" meta={bookings ? `${bookings} active` : 'None yet'} href="/bookings" />
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  section: { paddingTop: 26 },
  grid: {
    marginHorizontal: GUTTER,
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tool: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
}));
