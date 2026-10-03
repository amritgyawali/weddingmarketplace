import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, ChoiceChips, KButton, KField, Segmented, StatusPill } from '@/components/kit';
import { DatePopup } from '@/components/ui/DatePopup';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { guideSuggestions, suggestedTasks } from '@/services/planner';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Project, ProjectTask, TaskAssignee, TaskStatus } from '@/types/platform';
import { addDays, daysUntil, formatShortDate, today } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'IN_PROGRESS', label: 'In progress' },
  { status: 'WAITING', label: 'Waiting' },
  { status: 'TODO', label: 'To do' },
  { status: 'COMPLETED', label: 'Completed' },
];

const NEXT: Record<TaskStatus, TaskStatus> = { TODO: 'IN_PROGRESS', IN_PROGRESS: 'COMPLETED', WAITING: 'IN_PROGRESS', COMPLETED: 'TODO', CANCELLED: 'TODO' };

const STATUS_LABEL: Record<TaskStatus, string> = { TODO: 'To do', IN_PROGRESS: 'In progress', WAITING: 'Waiting', COMPLETED: 'Completed', CANCELLED: 'Cancelled' };

/** Statuses a person can pick in the task sheet, in the order a task moves through them. */
const PICKABLE: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'WAITING', 'COMPLETED'];

/** Says where the task went ("Task moved to In progress"), instead of a bare "Task updated". */
const statusToast = (status: TaskStatus) => {
  if (status === 'COMPLETED') toast('Task marked as completed', 'checkmark-circle');
  else if (status === 'IN_PROGRESS') toast('Task moved to In progress', 'time');
  else if (status === 'WAITING') toast('Task moved to Waiting', 'pause-circle');
  else toast('Task moved back to To do', 'ellipse-outline');
};

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
  const [status, setStatus] = useState<TaskStatus>(existing?.status ?? 'TODO');
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
    if (existing) {
      updateTask(project.id, existing.id, { ...patch, status, completedAt: status === 'COMPLETED' ? (existing.completedAt ?? new Date().toISOString()) : undefined });
      if (status !== existing.status) statusToast(status);
      else toast('Task saved');
    } else {
      addTask(project.id, { ...patch, status, category: 'Custom' });
      toast(`Task added to ${STATUS_LABEL[status]}`);
    }
    onClose();
  };

  return (
    <Sheet visible={!!task} onClose={onClose} title={existing ? 'Edit task' : 'New task'}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
        <KField placeholder="e.g. Confirm jagge flowers" value={title} onChangeText={setTitle} autoFocus={!existing} />
        <KField placeholder="Notes (optional)" value={notes} onChangeText={setNotes} multiline />
        <Pressable onPress={() => setPicking(true)} accessibilityRole="button" accessibilityLabel={`Due ${formatShortDate(due)}. Change date`} style={[styles.due, { borderColor: t.c.border }]}>
          <Ionicons name="calendar-outline" size={18} color={t.c.primary} />
          <Text size={15} color={t.c.textStrong} style={{ flex: 1 }}>
            Due {formatShortDate(due)}
          </Text>
          <Text size={13} weight="semibold" color={t.c.primary}>
            Change
          </Text>
        </Pressable>
        <Text size={13} weight="semibold" color={t.c.muted}>
          Status
        </Text>
        <ChoiceChips options={PICKABLE.map((x) => STATUS_LABEL[x])} selected={[STATUS_LABEL[status]]} onToggle={(v) => setStatus(PICKABLE.find((x) => STATUS_LABEL[x] === v) ?? 'TODO')} />
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
      <DatePopup visible={picking} title="Due date" value={due} onChange={setDue} onClose={() => setPicking(false)} />
    </Sheet>
  );
}

/**
 * "Suggest tasks": tasks not on the list yet, in two groups: the ones we
 * recommend for the date and the services asked for (ticked), and the
 * month-by-month guide's items from now on (unticked). The couple ticks what
 * they want and adds it in one go.
 */
function SuggestSheet({ project, visible, onClose }: { project: Project; visible: boolean; onClose: () => void }) {
  const t = useRoleTheme();
  const regenerate = useDb((s) => s.regenerateChecklist);
  const forServices = visible ? suggestedTasks(project) : [];
  const fromGuide = visible ? guideSuggestions(project) : [];
  const suggestions = [...forServices, ...fromGuide];
  // Titles whose tick differs from the default (services ticked, guide unticked).
  const [flipped, setFlipped] = useState<string[]>([]);
  const isOn = (task: ProjectTask) => forServices.includes(task) !== flipped.includes(task.title);
  const picked = suggestions.filter(isOn);

  const close = () => {
    setFlipped([]);
    onClose();
  };

  const row = (task: ProjectTask) => {
    const on = isOn(task);
    return (
      <Pressable
        key={task.title}
        onPress={() => setFlipped((s) => (s.includes(task.title) ? s.filter((x) => x !== task.title) : [...s, task.title]))}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on }}
        style={({ pressed }) => [styles.suggestRow, { borderBottomColor: t.c.border }, pressed && { opacity: 0.6 }]}>
        <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? t.c.primary : t.c.muted} />
        <View style={{ flex: 1 }}>
          <Text size={15} color={t.c.textStrong}>
            {task.title}
          </Text>
          <Text size={12} color={t.c.muted}>
            {task.assigneeName} · due {formatShortDate(task.due)}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <Sheet visible={visible} onClose={close} title="Suggested tasks">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 10, paddingBottom: 12 }}>
        <Text size={14} color={t.c.text}>
          {suggestions.length
            ? 'Tick the tasks you want on your list, then add them. Each one gets a due date before your wedding.'
            : 'Your list already has every task we suggest for your date and services. Add a service and its tasks will show up here.'}
        </Text>
        {forServices.length > 0 && (
          <Text size={13} weight="semibold" color={t.c.muted} style={{ marginTop: 6 }}>
            For your date and services
          </Text>
        )}
        {forServices.map(row)}
        {fromGuide.length > 0 && (
          <Text size={13} weight="semibold" color={t.c.muted} style={{ marginTop: 6 }}>
            From the month-by-month guide
          </Text>
        )}
        {fromGuide.map(row)}
        {suggestions.length > 0 ? (
          <KButton
            label={picked.length ? `Add ${picked.length} ${picked.length === 1 ? 'task' : 'tasks'}` : 'Tick a task to add it'}
            disabled={!picked.length}
            onPress={() => {
              const added = regenerate(project.id, picked.map((x) => x.title));
              triggerHaptic('success');
              toast(`${added} ${added === 1 ? 'task' : 'tasks'} added to To do`, 'checkbox');
              close();
            }}
          />
        ) : (
          <KButton label="Close" variant="secondary" onPress={close} />
        )}
      </ScrollView>
    </Sheet>
  );
}

/** Project task board shared by couple, coordinator and providers. `openTaskId` opens that task's sheet straight away. */
export function TaskBoard({ project, mode, openTaskId }: { project: Project; mode: Mode; openTaskId?: string }) {
  const t = useRoleTheme();
  const account = useAccount();
  const setTaskStatus = useDb((s) => s.setTaskStatus);
  const [filter, setFilter] = useState<'mine' | 'all' | 'overdue'>('all');
  const [editing, setEditing] = useState<ProjectTask | 'new' | null>(() => project.tasks.find((x) => x.id === openTaskId) ?? null);
  const [suggesting, setSuggesting] = useState(false);

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
            <Pressable onPress={() => setSuggesting(true)} hitSlop={8} accessibilityRole="button" style={styles.inline}>
              <Ionicons name="list-outline" size={16} color={t.c.primary} />
              <Text size={13} weight="semibold" color={t.c.primary}>
                Suggest tasks
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
                      statusToast(NEXT[task.status]);
                    }}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Move ${task.title} to ${STATUS_LABEL[NEXT[task.status]]}`}>
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
      {mode !== 'vendor' && <SuggestSheet project={project} visible={suggesting} onClose={() => setSuggesting(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  task: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  taskBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  due: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, borderRadius: 8, borderWidth: 1, paddingHorizontal: 14 },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});
