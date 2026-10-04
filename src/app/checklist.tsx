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
import { CHECKLIST, CHECKLIST_TOTAL } from '@/data/checklist';
import { useCustomerWorkspace } from '@/hooks/useWorkspace';
import { useAppStore } from '@/store/useAppStore';
import { useAccount } from '@/store/useSession';
import { guideSections } from '@/services/customerPlanning';
import { daysUntil } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

type Filter = 'all' | 'pending' | 'done';

/**
 * Remaining-days guide, compressing earlier preparation into Do now while preserving personal ticks.
 */
function PlanningGuide({ hasProject, eventDate }: { hasProject: boolean; eventDate?: string | null }) {
  const completed = useAppStore((s) => s.completedTasks);
  const toggleTask = useAppStore((s) => s.toggleTask);
  const weddingDate = useAppStore((s) => s.weddingDate);
  const [filter, setFilter] = useState<Filter>('all');
  const date = eventDate ?? weddingDate;
  const days = date ? daysUntil(date) : null;
  const [open, setOpen] = useState<string[]>(['0']);

  const done = completed.filter((id) => CHECKLIST.some((t) => t.id === id)).length;
  const percent = Math.round((done / CHECKLIST_TOTAL) * 100);

  const sections = guideSections(CHECKLIST, days).map((group) => {
    const tasks = group.tasks.filter((t) => filter === 'all' || (filter === 'done' ? completed.includes(t.id) : !completed.includes(t.id)));
    return {
      title: group.id,
      label: group.label,
      total: group.tasks.length,
      doneCount: group.tasks.filter((t) => completed.includes(t.id)).length,
      isNow: group.id === '0',
      data: open.includes(group.id) ? tasks : [],
      hidden: tasks.length,
    };
  }).filter((section) => section.hidden > 0);

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
                  ? 'Your guide follows the days remaining. Start with Do now, then work through the upcoming days. Earlier preparation is included in Do now. It is only for you; tasks shared with your coordinator are in Our tasks.'
                  : 'Your guide follows the days remaining. Start with Do now, then work through the upcoming days. Earlier preparation is included in Do now.'}
              </Text>
            </View>
            <View style={styles.hero}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text size={15} weight="semibold" color={colors.heading}>
                  {done} of {CHECKLIST_TOTAL} done
                </Text>
                <Text size={13} color={colors.textMuted}>
                  {days === null ? 'Set your wedding date to see what to do now' : days >= 0 ? `${days} days to go` : 'Married. Congratulations!'}
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
                    {section.label}
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
                  {section.doneCount} of {section.total} done
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
                <Text size={12} color={colors.textMuted}>
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
              { id: 'guide', label: 'Remaining days guide' },
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
        <PlanningGuide hasProject={!!project} eventDate={project?.events.find((e) => e.type === project.eventType)?.date} />
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
