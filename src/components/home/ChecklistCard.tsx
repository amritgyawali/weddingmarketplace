import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { triggerHaptic } from '@/components/ui/PressableScale';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { colors, GUTTER } from '@/constants/theme';
import { CHECKLIST_TOTAL, nextChecklistItems, PHASE_LABEL } from '@/data/checklist';
import { useExperience } from '@/hooks/useExperience';
import { useCustomerWorkspace } from '@/hooks/useWorkspace';
import { useAppStore } from '@/store/useAppStore';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { daysUntil, formatShortDate } from '@/utils/format';

/** How many open tasks the home card lists. */
const SHOWN = 5;

/** Thin progress ring. Defaults to crimson on a light track; pass `light` over dark photos. */
export function ProgressRing({ percent, size = 58, stroke = 3, light }: { percent: number; size?: number; stroke?: number; light?: boolean }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const fg = light ? colors.white : colors.primary;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[StyleSheet.absoluteFill, { transform: [{ rotate: '-90deg' }] }]}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={light ? 'rgba(255,255,255,0.35)' : colors.divider} strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={fg}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={c * (1 - percent / 100)}
          />
        </Svg>
      </View>
      <Text size={size > 50 ? 15 : 12} weight="semibold" color={light ? colors.white : colors.heading}>
        {percent}%
      </Text>
    </View>
  );
}

/**
 * The next tasks of a celebration that isn't a wedding (a pasni, a birthday),
 * from its own checklist on the plan, tickable in place.
 */
function CelebrationTasks() {
  const account = useAccount();
  const exp = useExperience();
  const { project } = useCustomerWorkspace(account.id);
  const setTaskStatus = useDb((s) => s.setTaskStatus);
  if (!project) return null;
  const tasks = project.tasks.filter((t) => t.visibility !== 'internal');
  const done = tasks.filter((t) => t.status === 'COMPLETED').length;
  const share = tasks.length ? done / tasks.length : 0;
  const upcoming = tasks
    .filter((t) => t.status !== 'COMPLETED')
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, SHOWN);

  return (
    <View style={styles.section}>
      <SectionHeader title={`${exp.vocab.planTitle}: to do`} actionLabel="See all" onAction={() => router.push('/my-wedding?tab=tasks')} />
      <View style={styles.card}>
        <View style={styles.summary}>
          <Text size={14} color={colors.textBody}>
            {done} of {tasks.length} tasks done
          </Text>
          <Text size={13} color={colors.textMuted}>
            {Math.round(share * 100)}%
          </Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(share * 100)}%` }]} />
        </View>
        {upcoming.length === 0 ? (
          <Text size={15} color={colors.textBody} style={{ paddingVertical: 10 }}>
            Every task is ticked off.
          </Text>
        ) : (
          upcoming.map((task, i) => (
            // Fade in only: a Reanimated `layout` transition here left rows at stale positions
            // on iOS, so they drew over the progress bar and each other.
            <Animated.View key={task.id} entering={FadeIn.duration(200)}>
              <Pressable
                onPress={() => {
                  triggerHaptic('success');
                  setTaskStatus(project.id, task.id, 'COMPLETED');
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: false }}
                accessibilityLabel={task.title}
                style={({ pressed }) => [styles.task, i > 0 && styles.taskBorder, pressed && { opacity: 0.6 }]}>
                <Ionicons name="square-outline" size={20} color={colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text size={15} color={colors.text} numberOfLines={2}>
                    {task.title}
                  </Text>
                  <Text size={12} color={colors.textMuted}>
                    Due {formatShortDate(task.due)}
                  </Text>
                </View>
              </Pressable>
            </Animated.View>
          ))
        )}
      </View>
    </View>
  );
}

/** Checklist progress plus the next tasks, tickable in place. Weddings use the wedding checklist; other celebrations their own. */
export function ChecklistCard() {
  const exp = useExperience();
  const occasion = exp.occasion?.id ?? 'wedding';
  if (occasion !== 'wedding' && occasion !== 'engagement') return <CelebrationTasks />;
  return <WeddingChecklist />;
}

function WeddingChecklist() {
  const completed = useAppStore((s) => s.completedTasks);
  const toggleTask = useAppStore((s) => s.toggleTask);
  const weddingDate = useAppStore((s) => s.weddingDate);
  const done = completed.length;
  const share = done / CHECKLIST_TOTAL;
  const upcoming = nextChecklistItems(completed, weddingDate ? daysUntil(weddingDate) : null, SHOWN);

  return (
    <View style={styles.section}>
      <SectionHeader title="Checklist" actionLabel="See all" onAction={() => router.push('/checklist?tab=guide')} />
      <View style={styles.card}>
        <View style={styles.summary}>
          <Text size={14} color={colors.textBody}>
            <Text size={14} weight="semibold" color={colors.heading}>
              {done} of {CHECKLIST_TOTAL}
            </Text>{' '}
            tasks done
          </Text>
          <Text size={13} color={colors.textMuted}>
            {Math.round(share * 100)}%
          </Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(share * 100)}%` }]} />
        </View>
        {upcoming.length === 0 ? (
          <Text size={15} color={colors.textBody} style={{ paddingVertical: 10 }}>
            Every task is ticked off.
          </Text>
        ) : (
          upcoming.map((task, i) => (
            // Fade in only: a Reanimated `layout` transition here left rows at stale positions
            // on iOS, so they drew over the progress bar and each other.
            <Animated.View key={task.id} entering={FadeIn.duration(200)}>
              <Pressable
                onPress={() => {
                  triggerHaptic('success');
                  toggleTask(task.id);
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: false }}
                accessibilityLabel={task.title}
                style={({ pressed }) => [styles.task, i > 0 && styles.taskBorder, pressed && { opacity: 0.6 }]}>
                <Ionicons name="square-outline" size={20} color={colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text size={15} color={colors.text} numberOfLines={2}>
                    {task.title}
                  </Text>
                  <Text size={12} color={colors.textMuted}>
                    {PHASE_LABEL[task.phase]}
                  </Text>
                </View>
              </Pressable>
            </Animated.View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 30 },
  card: { marginHorizontal: GUTTER, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  track: { height: 3, borderRadius: 2, backgroundColor: colors.divider, marginTop: 8, marginBottom: 6, overflow: 'hidden' },
  fill: { height: 3, backgroundColor: colors.primary },
  task: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  taskBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
});
