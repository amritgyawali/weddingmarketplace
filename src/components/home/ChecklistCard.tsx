import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { triggerHaptic } from '@/components/ui/PressableScale';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { colors, GUTTER } from '@/constants/theme';
import { CHECKLIST, CHECKLIST_TOTAL } from '@/data/checklist';
import { useAppStore } from '@/store/useAppStore';

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

/** Checklist progress plus the next two tasks, tickable in place. */
export function ChecklistCard() {
  const completed = useAppStore((s) => s.completedTasks);
  const toggleTask = useAppStore((s) => s.toggleTask);
  const done = completed.length;
  const share = done / CHECKLIST_TOTAL;
  const upcoming = CHECKLIST.filter((t) => !completed.includes(t.id)).slice(0, 3);

  return (
    <View style={styles.section}>
      <SectionHeader title="Checklist" actionLabel="See all" onAction={() => router.push('/checklist')} />
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
            <Animated.View key={task.id} entering={FadeIn} layout={LinearTransition}>
              <Pressable
                onPress={() => {
                  triggerHaptic('success');
                  toggleTask(task.id);
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: false }}
                accessibilityLabel={task.title}
                style={[styles.task, i > 0 && styles.taskBorder]}>
                <Ionicons name="square-outline" size={20} color={colors.textMuted} />
                <Text size={15} color={colors.text} style={{ flex: 1 }} numberOfLines={1}>
                  {task.title}
                </Text>
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
