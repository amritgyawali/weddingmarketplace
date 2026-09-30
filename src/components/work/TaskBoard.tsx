import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Card, ChoiceChips, KButton, KField, Segmented, StatusPill } from '@/components/kit';
import { Calendar } from '@/components/ui/Calendar';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Project, ProjectTask, TaskAssignee, TaskStatus } from '@/types/platform';
import { addDays, daysUntil, formatShortDate, today } from '@/utils/format';

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'IN_PROGRESS', label: 'In progress' },
  { status: 'WAITING', label: 'Waiting' },
  { status: 'TODO', label: 'To do' },
  { status: 'COMPLETED', label: 'Completed' },
];

const NEXT: Record<TaskStatus, TaskStatus> = { TODO: 'IN_PROGRESS', IN_PROGRESS: 'COMPLETED', WAITING: 'IN_PROGRESS', COMPLETED: 'TODO', CANCELLED: 'TODO' };

const ASSIGNEES: { id: TaskAssignee; label: string }[] = [
  { id: 'customer', label: 'Me / couple' },
  { id: 'partner', label: 'Partner' },
  { id: 'family', label: 'Family' },
  { id: 'coordinator', label: 'Coordinator' },
  { id: 'provider', label: 'Provider' },
  { id: 'freelancer', label: 'Crew' },
];

type Mode = 'customer' | 'platform' | 'vendor';

function TaskSheet({ project, mode, task, onClose }: { project: Project; mode: Mode; task: ProjectTask | 'new' | null; onClose: () => void }) {
  const t = useRoleTheme();
  const account = useAccount();
  const addTask = useDb((s) => s.addTask);
  const updateTask = useDb((s) => s.updateTask);
  const removeTask = useDb((s) => s.removeTask);
  const existing = task && task !== 'new' ? task : null;
  const [title, setTitle] = useState(existing?.title ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [assignee, setAssignee] = useState<TaskAssignee>(existing?.assigneeKind ?? (mode === 'platform' ? 'coordinator' : mode === 'vendor' ? 'provider' : 'customer'));
  const [priority, setPriority] = useState<ProjectTask['priority']>(existing?.priority ?? 'medium');
  const [due, setDue] = useState(existing?.due ?? addDays(today(), 7));
  const [eventId, setEventId] = useState<string | undefined>(existing?.eventId);
  const [internal, setInternal] = useState(existing?.visibility === 'internal');
  const [picking, setPicking] = useState(false);

  const assigneeName = (kind: TaskAssignee) =>
    kind === 'customer' ? project.customerName : kind === 'partner' ? (project.partnerName ?? 'Partner') : kind === 'coordinator' ? (project.coordinatorName ?? 'Coordinator') : kind === 'provider' ? (mode === 'vendor' ? (account.businessName ?? account.name) : 'Provider') : kind === 'family' ? 'Family' : 'Crew';

  const save = () => {
    if (!title.trim()) return;
    const patch = {
      title: title.trim(),
      notes: notes.trim() || undefined,
      assigneeKind: assignee,
      assigneeName: assigneeName(assignee),
      assigneeId: assignee === 'coordinator' ? project.coordinatorId : assignee === 'customer' ? project.customerId : undefined,
      priority,
      due,
      eventId,
      visibility: internal ? ('internal' as const) : ('shared' as const),
    };
    if (existing) updateTask(project.id, existing.id, patch);
    else addTask(project.id, { ...patch, status: 'TODO', category: 'Custom' });
    toast(existing ? 'Task updated' : 'Task added');
    onClose();
  };

  return (
    <Sheet visible={!!task} onClose={onClose} title={existing ? 'Edit task' : 'New task'}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
        <KField placeholder="e.g. Confirm jagge flowers" value={title} onChangeText={setTitle} autoFocus={!existing} />
        <KField placeholder="Notes (optional)" value={notes} onChangeText={setNotes} multiline />
        <Text size={13} weight="semibold" color={t.c.muted}>
          Assign to
        </Text>
        <ChoiceChips options={ASSIGNEES.filter((a) => mode !== 'customer' || a.id !== 'freelancer').map((a) => a.label)} selected={[ASSIGNEES.find((a) => a.id === assignee)!.label]} onToggle={(v) => setAssignee(ASSIGNEES.find((a) => a.label === v)!.id)} />
        <Text size={13} weight="semibold" color={t.c.muted}>
          Priority
        </Text>
        <ChoiceChips options={['low', 'medium', 'high', 'urgent']} selected={[priority]} onToggle={(v) => setPriority(v as ProjectTask['priority'])} />
        <Text size={13} weight="semibold" color={t.c.muted}>
          Linked function
        </Text>
        <ChoiceChips options={['None', ...project.events.map((e) => e.name)]} selected={[project.events.find((e) => e.id === eventId)?.name ?? 'None']} onToggle={(v) => setEventId(project.events.find((e) => e.name === v)?.id)} />
        <Pressable onPress={() => setPicking((p) => !p)} style={[styles.due, { borderColor: t.c.border }]}>
          <Ionicons name="calendar-outline" size={18} color={t.c.primary} />
          <Text size={15} color={t.c.textStrong}>
            Due {formatShortDate(due)}
          </Text>
        </Pressable>
        {picking && (
          <Calendar
            value={due}
            onChange={(d) => {
              setDue(d);
              setPicking(false);
            }}
          />
        )}
        {mode === 'platform' && (
          <Pressable onPress={() => setInternal((v) => !v)} style={styles.inline} accessibilityRole="checkbox" accessibilityState={{ checked: internal }}>
            <Ionicons name={internal ? 'eye-off' : 'eye-outline'} size={18} color={internal ? t.c.warning : t.c.muted} />
            <Text size={14} color={t.c.text}>
              {internal ? 'Internal — hidden from the customer' : 'Visible to the customer'}
            </Text>
          </Pressable>
        )}
        <KButton label={existing ? 'Save task' : 'Add task'} disabled={!title.trim()} onPress={save} />
        {existing && (
          <KButton
            label="Delete task"
            variant="ghost"
            size="sm"
            onPress={() => {
              removeTask(project.id, existing.id);
              onClose();
            }}
          />
        )}
      </ScrollView>
    </Sheet>
  );
}

/** Project task board shared by couple, coordinator and providers. */
export function TaskBoard({ project, mode }: { project: Project; mode: Mode }) {
  const t = useRoleTheme();
  const account = useAccount();
  const setTaskStatus = useDb((s) => s.setTaskStatus);
  const regenerate = useDb((s) => s.regenerateChecklist);
  const [filter, setFilter] = useState<'mine' | 'all' | 'overdue'>(mode === 'customer' ? 'all' : 'all');
  const [editing, setEditing] = useState<ProjectTask | 'new' | null>(null);

  const visible = project.tasks.filter((x) => mode === 'platform' || x.visibility === 'shared');
  const mine = (x: ProjectTask) =>
    mode === 'customer' ? x.assigneeKind === 'customer' || x.assigneeKind === 'partner' || x.assigneeKind === 'family' : mode === 'vendor' ? x.assigneeKind === 'provider' : x.assigneeKind === 'coordinator' || x.assigneeId === account.id;
  const overdue = (x: ProjectTask) => x.status !== 'COMPLETED' && x.status !== 'CANCELLED' && daysUntil(x.due) < 0;
  const list = visible.filter((x) => (filter === 'mine' ? mine(x) : filter === 'overdue' ? overdue(x) : true));
  const done = visible.filter((x) => x.status === 'COMPLETED').length;

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.rowBetween}>
        <Text size={14} weight="bold" color={t.c.textStrong}>
          {done}/{visible.length} done
        </Text>
        <View style={styles.inline}>
          {mode !== 'vendor' && (
            <Pressable
              onPress={() => {
                regenerate(project.id);
                toast('Checklist refreshed for your services', 'sparkles');
              }}
              hitSlop={8}
              style={styles.inline}>
              <Ionicons name="sparkles-outline" size={15} color={t.c.primary} />
              <Text size={13} weight="semibold" color={t.c.primary}>
                Smart checklist
              </Text>
            </Pressable>
          )}
        </View>
      </View>
      <Segmented
        options={[
          { id: 'all', label: 'All' },
          { id: 'mine', label: mode === 'customer' ? 'Ours' : 'Mine' },
          { id: 'overdue', label: 'Overdue' },
        ]}
        value={filter}
        onChange={setFilter}
        counts={{ all: visible.length, mine: visible.filter(mine).length, overdue: visible.filter(overdue).length || undefined }}
      />
      <KButton label="Add task" icon="add" variant="secondary" size="sm" onPress={() => setEditing('new')} />
      {COLUMNS.map((col) => {
        const tasks = list.filter((x) => x.status === col.status).sort((a, b) => a.due.localeCompare(b.due));
        if (!tasks.length) return null;
        return (
          <View key={col.status} style={{ gap: 8 }}>
            <Text size={12} weight="medium" color={t.c.muted}>
              {col.label} · {tasks.length}
            </Text>
            {tasks.map((task) => {
              const late = overdue(task);
              return (
                <Card key={task.id} style={styles.task}>
                  <Pressable
                    onPress={() => {
                      triggerHaptic(task.status === 'IN_PROGRESS' ? 'success' : 'selection');
                      setTaskStatus(project.id, task.id, NEXT[task.status]);
                    }}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Move ${task.title} to ${NEXT[task.status]}`}>
                    <Ionicons
                      name={task.status === 'COMPLETED' ? 'checkmark-circle' : task.status === 'IN_PROGRESS' ? 'time' : task.status === 'WAITING' ? 'pause-circle' : 'ellipse-outline'}
                      size={24}
                      color={task.status === 'COMPLETED' ? t.c.success : task.status === 'IN_PROGRESS' ? t.c.warning : task.status === 'WAITING' ? t.c.info : t.c.muted}
                    />
                  </Pressable>
                  <Pressable onPress={() => setEditing(task)} accessibilityRole="button" accessibilityLabel={`Edit ${task.title}`} style={styles.taskBody}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text size={14} weight="semibold" color={t.c.textStrong} style={task.status === 'COMPLETED' ? { textDecorationLine: 'line-through', opacity: 0.6 } : undefined}>
                      {task.title}
                    </Text>
                    <Text size={12} color={late ? t.c.danger : t.c.muted}>
                      {task.assigneeName} · {late ? 'overdue · ' : ''}due {formatShortDate(task.due)}
                      {task.visibility === 'internal' ? ' · internal' : ''}
                    </Text>
                  </View>
                  {(task.priority === 'high' || task.priority === 'urgent') && task.status !== 'COMPLETED' && <StatusPill status={task.priority} />}
                  </Pressable>
                </Card>
              );
            })}
          </View>
        );
      })}
      {!list.length && (
        <Text size={13} color={t.c.muted} align="center" style={{ paddingVertical: 20 }}>
          Nothing due here.
        </Text>
      )}
      <TaskSheet key={editing === 'new' ? 'new' : (editing?.id ?? 'none')} project={project} mode={mode} task={editing} onClose={() => setEditing(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  task: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  taskBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  due: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, borderRadius: 8, borderWidth: 1, paddingHorizontal: 14 },
});
