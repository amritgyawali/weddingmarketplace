import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { triggerHaptic } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { colors, gradients, GUTTER, radius, shadows } from '@/constants/theme';
import { CHECKLIST, CHECKLIST_TOTAL } from '@/data/checklist';
import { useAppStore } from '@/store/useAppStore';

export function ProgressRing({ percent, size = 58, stroke = 3.5 }: { percent: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[StyleSheet.absoluteFill, { transform: [{ rotate: '-90deg' }] }]}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.45)" strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.white}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - percent / 100)}
          strokeLinecap="round"
        />
      </Svg>
      </View>
      <Text size={17} weight="bold" color={colors.white}>
        {percent}%
      </Text>
    </View>
  );
}

/** Gradient progress card with the overlapping "Upcoming tasks" sheet. */
export function ChecklistCard() {
  const completed = useAppStore((s) => s.completedTasks);
  const toggleTask = useAppStore((s) => s.toggleTask);
  const done = completed.length;
  const percent = Math.round((done / CHECKLIST_TOTAL) * 100);
  const upcoming = CHECKLIST.filter((t) => !completed.includes(t.id)).slice(0, 2);

  return (
    <View style={styles.section}>
      <Text weight="semibold" size={19} color={colors.heading} style={{ marginBottom: 12 }}>
        Wedding checklist
      </Text>
      <Pressable onPress={() => router.push('/checklist')} accessibilityRole="button" accessibilityLabel="Open wedding checklist">
        <LinearGradient colors={gradients.checklist} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View>
            <Text size={34} weight="bold" color={colors.white} lineHeight={40}>
              {done}
              <Text size={22} color="rgba(255,255,255,0.92)">
                /{CHECKLIST_TOTAL}
              </Text>
            </Text>
            <Text size={18} color={colors.white}>
              tasks done
            </Text>
          </View>
          <ProgressRing percent={percent} />
        </LinearGradient>
      </Pressable>

      <View style={[styles.tasks, shadows.raised]}>
        <Text weight="semibold" size={18} color={colors.heading} style={{ marginBottom: 6 }}>
          Upcoming tasks
        </Text>
        {upcoming.length === 0 ? (
          <Text size={15} color={colors.textBody}>
            All tasks completed — you’re wedding ready! 🎉
          </Text>
        ) : (
          upcoming.map((task) => (
            <Animated.View key={task.id} entering={FadeIn} layout={LinearTransition}>
              <Pressable
                onPress={() => {
                  triggerHaptic('success');
                  toggleTask(task.id);
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: false }}
                style={styles.task}>
                <Ionicons name="ellipse-outline" size={22} color={colors.textBody} />
                <Text size={16} color={colors.text} style={{ flex: 1 }} numberOfLines={1}>
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
  section: { paddingHorizontal: GUTTER, marginTop: 34 },
  hero: {
    borderRadius: radius.lg,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 64,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tasks: {
    marginTop: -46,
    marginHorizontal: 20,
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 4,
  },
  task: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
});
