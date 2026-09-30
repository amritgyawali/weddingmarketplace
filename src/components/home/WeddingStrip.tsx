import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, GUTTER } from '@/constants/theme';
import { bsMonthLabel } from '@/data/events';
import { useCustomerWorkspace } from '@/hooks/useWorkspace';
import { nextBestAction, planningProgress } from '@/services/planner';
import { useAccount } from '@/store/useSession';
import { daysUntil, formatLongDate } from '@/utils/format';

/**
 * Top of the couple's home: their names, the date in both calendars and the
 * one thing to do next. Without a plan it invites them to start one.
 */
export function WeddingStrip() {
  const account = useAccount();
  const { project, quotes } = useCustomerWorkspace(account.id);

  if (!project) {
    return (
      <View style={styles.wrap}>
        <Text serif size={24} weight="bold" color={colors.heading}>
          Planning a wedding?
        </Text>
        <Text size={15} color={colors.textBody} style={{ marginTop: 2 }}>
          Tell us the date, the city and what you need. A coordinator matches venues and vendors and sends one quotation.
        </Text>
        <Pressable onPress={() => router.push('/plan')} accessibilityRole="button" style={({ pressed }) => [styles.start, pressed && { opacity: 0.8 }]}>
          <Text size={15} weight="semibold" color={colors.white}>
            Start a plan
          </Text>
        </Pressable>
      </View>
    );
  }

  const days = daysUntil(project.weddingDate);
  const progress = planningProgress(project);
  const next = nextBestAction(project, quotes);

  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => router.push('/my-wedding')} accessibilityRole="button" accessibilityLabel={`${project.title}, ${days} days to go. Open your wedding`}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text size={13} color={colors.textMuted}>
              {formatLongDate(project.weddingDate)} · {bsMonthLabel(project.weddingDate)}
            </Text>
            <Text serif size={26} weight="bold" color={colors.heading} lineHeight={36} numberOfLines={1}>
              {project.title}
            </Text>
            <Text size={14} color={colors.textBody}>
              {progress.services.confirmed} of {progress.services.total} services booked · {project.city}
            </Text>
          </View>
          {days >= 0 && (
            <View style={styles.count}>
              <Text serif size={30} weight="bold" color={colors.primary} lineHeight={38}>
                {days}
              </Text>
              <Text size={12} color={colors.textMuted} lineHeight={14}>
                {days === 1 ? 'day to go' : 'days to go'}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
      <Pressable
        onPress={() => router.push(next.href as Href)}
        accessibilityRole="button"
        style={({ pressed }) => [styles.next, pressed && { backgroundColor: colors.bgSoft }]}>
        <View style={{ flex: 1 }}>
          <Text size={12} color={colors.textMuted}>
            Next up
          </Text>
          <Text size={15} weight="semibold" color={colors.heading} numberOfLines={1}>
            {next.title}
          </Text>
          <Text size={13} color={colors.textMuted} numberOfLines={1}>
            {next.body}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: GUTTER, paddingTop: 18, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  count: { alignItems: 'flex-end', paddingBottom: 2 },
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    borderRadius: 6,
  },
  start: {
    alignSelf: 'flex-start',
    marginTop: 14,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 18,
    height: 42,
    justifyContent: 'center',
  },
});
