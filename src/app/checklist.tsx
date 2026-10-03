import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';

import { ProgressRing } from '@/components/home/ChecklistCard';
import { Segmented } from '@/components/kit';
import { Chip } from '@/components/ui/Chip';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { TaskBoard } from '@/components/work/TaskBoard';
import { colors, GUTTER, radius } from '@/constants/theme';
import { CHECKLIST, CHECKLIST_PHASES, CHECKLIST_TOTAL, currentPhase, PHASE_LABEL } from '@/data/checklist';
import { useCustomerWorkspace } from '@/hooks/useWorkspace';
import { useAppStore } from '@/store/useAppStore';
import { useAccount } from '@/store/useSession';
import { daysUntil } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

type Filter = 'all' | 'pending' | 'done';

/**
 * Month-by-month planning guide: what most couples do before a wedding, as a
 * personal tick list (works before a project exists). Only the phase the
 * couple is in now starts open, so the screen reads as "what to do now".
 */
function PlanningGuide({ hasProject }: { hasProject: boolean }) {
  const completed = useAppStore((s) => s.completedTasks);
  const toggleTask = useAppStore((s) => s.toggleTask);
  const weddingDate = useAppStore((s) => s.weddingDate);
  const [filter, setFilter] = useState<Filter>('all');
  const days = weddingDate ? daysUntil(weddingDate) : null;
  const now = currentPhase(days);
  const nowIndex = CHECKLIST_PHASES.indexOf(now);
  const [open, setOpen] = useState<string[]>([now]);

  const done = completed.length;
  const percent = Math.round((done / CHECKLIST_TOTAL) * 100);

  const sections = CHECKLIST_PHASES.map((phase, index) => {
    const all = CHECKLIST.filter((t) => t.phase === phase);
    const tasks = all.filter((t) => (filter === 'all' ? true : filter === 'done' ? completed.includes(t.id) : !completed.includes(t.id)));
    const doneCount = all.filter((t) => completed.includes(t.id)).length;
    return {
      title: phase,
      total: all.length,
      doneCount,
      isNow: phase === now,
      // An earlier phase with open items: things to catch up on.
      behind: index < nowIndex && doneCount < all.length,
      data: open.includes(phase) ? tasks : [],
      hidden: tasks.length,
    };
  }).filter((s) => s.hidden > 0);

  return (
    <View style={styles.root}>
      <SectionList
        sections={sections}
        keyExtractor={(t) => t.id}
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={
          <View>
            <View style={styles.intro}>
              <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
              <Text size={14} color={colors.textBody} style={{ flex: 1 }}>
                {hasProject
                  ? 'A simple list of what most couples do before the wedding, month by month. Tick things off as you finish them. It is only for you; tasks shared with your coordinator are in Our tasks.'
                  : 'A simple list of what most couples do before the wedding, month by month. Tick things off as you finish them.'}
              </Text>
            </View>
            <View style={styles.hero}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text size={15} weight="semibold" color={colors.heading}>
                  {done} of {CHECKLIST_TOTAL} done
                </Text>
                <Text size={13} color={colors.textMuted}>
                  {days === null ? 'Set your wedding date to see what to do now' : days >= 0 ? `${days} days to go · now: ${PHASE_LABEL[now].toLowerCase()}` : 'Married. Congratulations!'}
                </Text>
              </View>
              <ProgressRing percent={percent} size={56} stroke={3} />
            </View>
            <View style={styles.filters}>
              {(['all', 'pending', 'done'] as Filter[]).map((f) => (
                <Chip key={f} label={f === 'all' ? 'All' : f === 'pending' ? 'To do' : 'Done'} selected={filter === f} onPress={() => setFilter(f)} />
              ))}
            </View>
          </View>
        }
        renderSectionHeader={({ section }) => {
          const isOpen = open.includes(section.title);
          return (
            <Pressable
              onPress={() => setOpen((o) => (isOpen ? o.filter((x) => x !== section.title) : [...o, section.title]))}
              style={[styles.sectionHead, section.isNow && styles.sectionNow]}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}>
              <View style={{ flex: 1 }}>
                <View style={styles.inline}>
                  <Text size={16} weight="bold" color={colors.heading}>
                    {PHASE_LABEL[section.title]}
                  </Text>
                  {section.isNow && (
                    <View style={styles.nowTag}>
                      <Text size={11} weight="semibold" color={colors.white}>
                        Now
                      </Text>
                    </View>
                  )}
                </View>
                <Text size={12} color={colors.textMuted}>
                  {section.doneCount} of {section.total} done{section.behind ? ' · catch up' : ''}
                </Text>
              </View>
              <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
            </Pressable>
          );
        }}
        renderItem={({ item }) => {
          const checked = completed.includes(item.id);
          return (
            <Pressable
              onPress={() => {
                triggerHaptic(checked ? 'light' : 'success');
                toggleTask(item.id);
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              style={styles.task}>
              <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={22} color={checked ? colors.success : colors.textSubtle} />
              <View style={{ flex: 1 }}>
                <Text size={15} color={checked ? colors.textMuted : colors.text} style={checked ? { textDecorationLine: 'line-through' } : undefined}>
                  {item.title}
                </Text>
                <Text size={12} color={colors.textSubtle}>
                  {item.category}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

/** Our wedding's shared task list (from the project) plus the general planning guide. */
export default function ChecklistScreen() {
  const account = useAccount();
  const { project } = useCustomerWorkspace(account.id);
  const params = useLocalSearchParams<{ tab?: 'tasks' | 'guide' }>();
  const [tab, setTab] = useState<'tasks' | 'guide'>(project && params.tab !== 'guide' ? 'tasks' : 'guide');
  const open = project?.tasks.filter((x) => x.visibility === 'shared' && x.status !== 'COMPLETED' && x.status !== 'CANCELLED').length ?? 0;

  return (
    <View style={styles.root}>
      <ScreenHeader title="Checklist" subtitle={project ? `${project.title} · ${open} open` : undefined} />
      {project && (
        <View style={{ paddingVertical: 10 }}>
          <Segmented
            options={[
              { id: 'tasks', label: 'Our tasks' },
              { id: 'guide', label: 'Month-by-month guide' },
            ]}
            value={tab}
            onChange={setTab}
            counts={{ tasks: open || undefined }}
          />
        </View>
      )}
      {tab === 'tasks' && project ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 60 }}>
          <TaskBoard project={project} mode="customer" />
        </ScrollView>
      ) : (
        <PlanningGuide hasProject={!!project} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  intro: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: GUTTER,
    marginTop: GUTTER,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.bgSoft,
  },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nowTag: { backgroundColor: colors.primary, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  hero: {
    margin: GUTTER,
    marginTop: 12,
    marginBottom: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: GUTTER, paddingBottom: 10 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: GUTTER,
    paddingVertical: 12,
    backgroundColor: colors.bgSoft,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  sectionNow: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  task: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: GUTTER,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
});
