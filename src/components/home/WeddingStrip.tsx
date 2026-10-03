import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Ornament } from '@/components/ui/Ornament';
import { Text } from '@/components/ui/Text';
import { colors, GUTTER } from '@/constants/theme';
import { useOpenMyWedding } from '@/hooks/useOpenMyWedding';
import { useCustomerWorkspace } from '@/hooks/useWorkspace';
import { nextBestAction, planningProgress } from '@/services/planner';
import { useAccount } from '@/store/useSession';
import { daysUntil, formatDateAlt, formatLongDate } from '@/utils/format';

/**
 * Top of the couple's home: a wine "luxury section" with their names, the
 * date in both calendars and the countdown in champagne, then the one thing
 * to do next. Without a plan it invites them to start one.
 */
export function WeddingStrip() {
  const account = useAccount();
  const { project, quotes } = useCustomerWorkspace(account.id);
  const openMyWedding = useOpenMyWedding();

  if (!project) {
    return (
      <View style={styles.wrap}>
        <View style={styles.band}>
          <Ornament width={64} style={styles.ornament} />
          <Text serif size={24} weight="bold" color={colors.white} lineHeight={34}>
            Planning a wedding?
          </Text>
          <Text size={15} color={ON_WINE_MUTED} style={{ marginTop: 2 }}>
            Tell us the date, the city and what you need. A coordinator matches venues and vendors and sends one quotation.
          </Text>
          <Pressable onPress={() => router.push('/plan')} accessibilityRole="button" style={({ pressed }) => [styles.start, pressed && { opacity: 0.85 }]}>
            <Text size={15} weight="semibold" color={colors.wine}>
              Start a plan
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const days = daysUntil(project.weddingDate);
  const progress = planningProgress(project);
  const next = nextBestAction(project, quotes);

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={openMyWedding}
        accessibilityRole="button"
        accessibilityLabel={`${project.title}, ${days} days to go. Open your wedding`}
        style={({ pressed }) => [styles.band, pressed && { opacity: 0.92 }]}>
        <Ornament width={64} style={styles.ornament} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text size={13} color={colors.gold}>
              {formatLongDate(project.weddingDate)} · {formatDateAlt(project.weddingDate)}
            </Text>
            <Text serif size={26} weight="bold" color={colors.white} lineHeight={36} numberOfLines={1}>
              {project.title}
            </Text>
            <Text size={14} color={ON_WINE_MUTED}>
              {progress.services.confirmed} of {progress.services.total} services booked · {project.city}
            </Text>
          </View>
          {days >= 0 && (
            <View style={styles.count}>
              <Text serif size={30} weight="bold" color={colors.gold} lineHeight={38} numeric>
                {days}
              </Text>
              <Text size={12} color={ON_WINE_MUTED} lineHeight={14}>
                {days === 1 ? 'day to go' : 'days to go'}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.track} accessibilityElementsHidden>
          <View style={[styles.fill, { width: `${Math.round((progress.services.total ? progress.services.confirmed / progress.services.total : 0) * 100)}%` }]} />
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

/** Secondary text on the wine band: soft white at reduced strength. */
const ON_WINE_MUTED = colors.onWineMuted;

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: GUTTER, paddingTop: 16, paddingBottom: 6 },
  band: {
    backgroundColor: colors.wine,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.goldLine,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
    overflow: 'hidden',
  },
  /** The gilt Dhaka divider, like the line on a printed wedding card. */
  ornament: { marginBottom: 12 },
  /** Services booked, as a fine champagne line along the foot of the band. */
  track: { height: 2, borderRadius: 1, backgroundColor: colors.goldTrack, marginTop: 16, overflow: 'hidden' },
  fill: { height: 2, borderRadius: 1, backgroundColor: colors.gold },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  count: { alignItems: 'flex-end', paddingBottom: 2 },
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
    borderRadius: 8,
  },
  start: {
    alignSelf: 'flex-start',
    marginTop: 16,
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingHorizontal: 18,
    height: 42,
    justifyContent: 'center',
  },
});
