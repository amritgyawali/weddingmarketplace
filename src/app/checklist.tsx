import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, SectionList, StyleSheet, View } from 'react-native';

import { ProgressRing } from '@/components/home/ChecklistCard';
import { KButton, Segmented } from '@/components/kit';
import { Chip } from '@/components/ui/Chip';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { TaskBoard } from '@/components/work/TaskBoard';
import { colors, GUTTER, radius } from '@/constants/theme';
import { CHECKLIST, CHECKLIST_PHASES, CHECKLIST_TOTAL } from '@/data/checklist';
import { useCustomerWorkspace } from '@/hooks/useWorkspace';
import { useAppStore } from '@/store/useAppStore';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { confirm } from '@/utils/confirm';
import { daysUntil } from '@/utils/format';

type Filter = 'all' | 'pending' | 'done';

/** Generic month-by-month planning guide (works before a project exists). */
function PlanningGuide() {
  const completed = useAppStore((s) => s.completedTasks);
  const toggleTask = useAppStore((s) => s.toggleTask);
  const weddingDate = useAppStore((s) => s.weddingDate);
  const [filter, setFilter] = useState<Filter>('all');
  const [collapsed, setCollapsed] = useState<string[]>([]);

  const done = completed.length;
  const percent = Math.round((done / CHECKLIST_TOTAL) * 100);
  const days = weddingDate ? daysUntil(weddingDate) : null;

  const sections = CHECKLIST_PHASES.map((phase) => {
    const all = CHECKLIST.filter((t) => t.phase === phase);
    const tasks = all.filter((t) =>
      filter === 'all' ? true : filter === 'done' ? completed.includes(t.id) : !completed.includes(t.id),
    );
    return {
      title: phase,
      total: all.length,
      doneCount: all.filter((t) => completed.includes(t.id)).length,
      data: collapsed.includes(phase) ? [] : tasks,
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
            <View style={styles.hero}>
              <View style={{ flex: 1 }}>
                <Text serif size={28} weight="bold" color={colors.heading} lineHeight={36}>
                  {done}
                  <Text size={18} color={colors.textMuted}>
                    {' '}of {CHECKLIST_TOTAL}
                  </Text>
                </Text>
                <Text size={15} color={colors.textBody}>
                  tasks done
                </Text>
                {days !== null && (
                  <Text size={13} color={colors.textMuted} style={{ marginTop: 6 }}>
                    {days >= 0 ? `${days} days to your wedding` : 'Married. Congratulations!'}
                  </Text>
                )}
              </View>
              <ProgressRing percent={percent} size={64} stroke={4} />
            </View>
            <View style={styles.filters}>
              {(['all', 'pending', 'done'] as Filter[]).map((f) => (
                <Chip key={f} label={f === 'all' ? 'All tasks' : f === 'pending' ? 'Pending' : 'Completed'} selected={filter === f} onPress={() => setFilter(f)} />
              ))}
            </View>
          </View>
        }
        renderSectionHeader={({ section }) => {
          const isCollapsed = collapsed.includes(section.title);
          return (
            <Pressable
              onPress={() => setCollapsed((c) => (isCollapsed ? c.filter((x) => x !== section.title) : [...c, section.title]))}
              style={styles.sectionHead}
              accessibilityRole="button"
              accessibilityState={{ expanded: !isCollapsed }}>
              <View style={{ flex: 1 }}>
                <Text size={16} weight="bold" color={colors.heading}>
                  {section.title}
                </Text>
                <Text size={12} color={colors.textMuted}>
                  {section.doneCount} of {section.total} done
                </Text>
              </View>
              <View style={styles.miniTrack}>
                <View style={[styles.miniFill, { width: `${(section.doneCount / section.total) * 100}%` }]} />
              </View>
              <Ionicons name={isCollapsed ? 'chevron-down' : 'chevron-up'} size={18} color={colors.textMuted} />
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
                <Text
                  size={15}
                  color={checked ? colors.textMuted : colors.text}
                  style={checked ? { textDecorationLine: 'line-through' } : undefined}>
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
  const regenerate = useDb((s) => s.regenerateChecklist);
  const [tab, setTab] = useState<'tasks' | 'guide'>(project ? 'tasks' : 'guide');
  const open = project?.tasks.filter((x) => x.visibility === 'shared' && x.status !== 'COMPLETED' && x.status !== 'CANCELLED').length ?? 0;

  return (
    <View style={styles.root}>
      <ScreenHeader title="Checklist" subtitle={project ? `${project.title} · ${open} open` : undefined} />
      {project && (
        <View style={{ paddingVertical: 10 }}>
          <Segmented
            options={[
              { id: 'tasks', label: 'Our tasks' },
              { id: 'guide', label: 'Planning guide' },
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
          <KButton
            label="Refresh suggested tasks"
            icon="refresh-outline"
            variant="ghost"
            size="sm"
            onPress={() =>
              confirm('Refresh suggested tasks?', 'Adds tasks for newly requested services and dates. Your own tasks and progress are kept.', 'Refresh', () => {
                regenerate(project.id);
                toast('Checklist updated', 'checkbox');
              })
            }
          />
        </ScrollView>
      ) : (
        <PlanningGuide />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  hero: {
    margin: GUTTER,
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
  miniTrack: { width: 56, height: 3, borderRadius: 2, backgroundColor: colors.hairline, overflow: 'hidden' },
  miniFill: { height: 3, backgroundColor: colors.primary },
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
