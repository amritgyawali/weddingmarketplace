import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar, Card, ChoiceChips, EmptyBlock, KButton, KeyValue, KField, ProgressBar, Segmented, StatusPill } from '@/components/kit';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { day } from '@/data/seed';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Project, ProjectTask, TaskStatus } from '@/types/platform';
import { daysUntil, formatINR, formatINRCompact, formatLongDate, formatShortDate } from '@/utils/format';

import { EventCard, SeverityPicker } from './RunSheet';

export type WorkspaceMode = 'platform' | 'vendor' | 'customer';
type Section = 'overview' | 'events' | 'tasks' | 'vendors' | 'payments' | 'issues';

const NEXT_TASK_STATUS: Record<TaskStatus, TaskStatus> = { todo: 'doing', doing: 'done', done: 'todo' };

function Overview({ project, mode }: { project: Project; mode: WorkspaceMode }) {
  const t = useRoleTheme();
  const booked = project.vendors.filter((v) => v.status === 'booked').reduce((s, v) => s + v.amount, 0);
  const paid = project.payments.filter((m) => m.status === 'paid').reduce((s, m) => s + m.amount, 0);
  const due = project.payments.filter((m) => m.status !== 'paid').reduce((s, m) => s + m.amount, 0);
  const tasksDone = project.tasks.filter((x) => x.status === 'done').length;
  const days = daysUntil(project.weddingDate);
  const openIssues = project.incidents.filter((i) => i.status === 'open').length;

  return (
    <View style={{ gap: 12 }}>
      <Card style={{ gap: 12 }}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text size={12} weight="bold" color={t.c.primary} tracking={0.6}>
              {project.code} · {project.managedBy === 'platform' ? 'GENIE MANAGED' : 'SELF MANAGED'}
            </Text>
            <Text size={20} weight="bold" color={t.c.textStrong}>
              {project.title}
            </Text>
            <Text size={13} color={t.c.muted}>
              {project.city} · {formatLongDate(project.weddingDate)} · {project.guests} guests
            </Text>
          </View>
          <View style={[styles.countdown, { backgroundColor: t.c.soft }]}>
            <Text size={20} weight="bold" color={t.c.primary}>
              {Math.abs(days)}
            </Text>
            <Text size={10} weight="semibold" color={t.c.primary}>
              {days >= 0 ? 'DAYS TO GO' : 'DAYS AGO'}
            </Text>
          </View>
        </View>
        <View style={styles.rowBetween}>
          <StatusPill status={project.stage} />
          {project.plannerName && (
            <View style={styles.inline}>
              <Avatar name={project.plannerName} size={24} />
              <Text size={12} color={t.c.muted}>
                Planner: {project.plannerName}
              </Text>
            </View>
          )}
        </View>
      </Card>

      <Card style={{ gap: 8 }}>
        <View style={styles.rowBetween}>
          <Text size={15} weight="bold" color={t.c.textStrong}>
            Budget
          </Text>
          <Text size={13} color={t.c.muted}>
            {formatINRCompact(booked)} of {formatINRCompact(project.budget)} booked
          </Text>
        </View>
        <ProgressBar value={booked / Math.max(1, project.budget)} color={booked > project.budget ? t.c.danger : t.c.primary} height={8} />
        <KeyValue label="Paid so far" value={formatINR(paid)} />
        <KeyValue label="Outstanding" value={formatINR(due)} />
      </Card>

      <View style={styles.statRow}>
        <Card style={styles.stat}>
          <Text size={20} weight="bold" color={t.c.textStrong}>
            {project.vendors.filter((v) => v.status === 'booked').length}/{project.vendors.length}
          </Text>
          <Text size={12} color={t.c.muted}>
            Vendors booked
          </Text>
        </Card>
        <Card style={styles.stat}>
          <Text size={20} weight="bold" color={t.c.textStrong}>
            {tasksDone}/{project.tasks.length}
          </Text>
          <Text size={12} color={t.c.muted}>
            Tasks done
          </Text>
        </Card>
        <Card style={styles.stat}>
          <Text size={20} weight="bold" color={openIssues ? t.c.danger : t.c.textStrong}>
            {openIssues}
          </Text>
          <Text size={12} color={t.c.muted}>
            Open issues
          </Text>
        </Card>
      </View>

      {mode !== 'customer' && (
        <Card style={{ gap: 6 }}>
          <Text size={15} weight="bold" color={t.c.textStrong}>
            Customer
          </Text>
          <View style={styles.inline}>
            <Avatar name={project.customerName} />
            <View style={{ flex: 1 }}>
              <Text size={15} weight="semibold" color={t.c.textStrong}>
                {project.customerName}
              </Text>
              <Text size={13} color={t.c.muted}>
                +91 {project.customerPhone}
              </Text>
            </View>
          </View>
        </Card>
      )}
    </View>
  );
}

function Tasks({ project, mode }: { project: Project; mode: WorkspaceMode }) {
  const t = useRoleTheme();
  const setTaskStatus = useDb((s) => s.setTaskStatus);
  const addTask = useDb((s) => s.addTask);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [who, setWho] = useState<ProjectTask['assigneeRole']>(mode === 'customer' ? 'customer' : mode);
  const [priority, setPriority] = useState<ProjectTask['priority']>('medium');

  const canEdit = (task: ProjectTask) => mode === 'platform' || task.assigneeRole === mode;
  const ASSIGNEE_NAMES: Record<ProjectTask['assigneeRole'], string> = {
    customer: project.customerName,
    platform: project.plannerName ?? 'Vivah planner',
    vendor: 'Vendor team',
    freelancer: 'Crew',
  };

  const groups: { status: TaskStatus; title: string }[] = [
    { status: 'doing', title: 'In progress' },
    { status: 'todo', title: 'To do' },
    { status: 'done', title: 'Done' },
  ];

  return (
    <View style={{ gap: 14 }}>
      <KButton label="Add task" icon="add" variant="secondary" size="sm" onPress={() => setOpen(true)} />
      {groups.map((g) => {
        const tasks = project.tasks.filter((x) => x.status === g.status);
        if (!tasks.length) return null;
        return (
          <View key={g.status} style={{ gap: 8 }}>
            <Text size={13} weight="bold" color={t.c.muted}>
              {g.title.toUpperCase()} · {tasks.length}
            </Text>
            {tasks.map((task) => (
              <Card key={task.id} style={styles.task}>
                <Pressable
                  disabled={!canEdit(task)}
                  onPress={() => {
                    triggerHaptic(task.status === 'doing' ? 'success' : 'selection');
                    setTaskStatus(project.id, task.id, NEXT_TASK_STATUS[task.status]);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Move ${task.title} to ${NEXT_TASK_STATUS[task.status]}`}
                  hitSlop={8}>
                  <Ionicons
                    name={task.status === 'done' ? 'checkmark-circle' : task.status === 'doing' ? 'time' : 'ellipse-outline'}
                    size={24}
                    color={task.status === 'done' ? t.c.success : task.status === 'doing' ? t.c.warning : canEdit(task) ? t.c.muted : t.c.border}
                  />
                </Pressable>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text size={14} weight="semibold" color={t.c.textStrong} style={task.status === 'done' ? { textDecorationLine: 'line-through', opacity: 0.6 } : undefined}>
                    {task.title}
                  </Text>
                  <Text size={12} color={t.c.muted}>
                    {task.assignee} · due {formatShortDate(task.due)}
                  </Text>
                </View>
                <StatusPill status={task.priority} />
              </Card>
            ))}
          </View>
        );
      })}

      <Sheet visible={open} onClose={() => setOpen(false)} title="New task">
        <View style={{ paddingHorizontal: 20, gap: 14 }}>
          <KField placeholder="e.g. Confirm mandap flowers" value={title} onChangeText={setTitle} autoFocus />
          {mode === 'platform' && (
            <View style={{ gap: 6 }}>
              <Text size={13} weight="semibold" color={t.c.muted}>
                Assign to
              </Text>
              <ChoiceChips options={['platform', 'customer', 'vendor', 'freelancer']} selected={[who]} onToggle={(v) => setWho(v as ProjectTask['assigneeRole'])} />
            </View>
          )}
          <View style={{ gap: 6 }}>
            <Text size={13} weight="semibold" color={t.c.muted}>
              Priority
            </Text>
            <ChoiceChips options={['low', 'medium', 'high']} selected={[priority]} onToggle={(v) => setPriority(v as ProjectTask['priority'])} />
          </View>
          <KButton
            label="Add task"
            disabled={!title.trim()}
            onPress={() => {
              addTask(project.id, { title: title.trim(), assignee: ASSIGNEE_NAMES[who], assigneeRole: who, due: day(7), status: 'todo', priority });
              setTitle('');
              setOpen(false);
              toast('Task added');
            }}
          />
        </View>
      </Sheet>
    </View>
  );
}

function Vendors({ project, mode }: { project: Project; mode: WorkspaceMode }) {
  const t = useRoleTheme();
  return (
    <View style={{ gap: 10 }}>
      {mode === 'platform' && (
        <KButton
          label="Create quotation for couple"
          icon="document-text-outline"
          variant="secondary"
          size="sm"
          onPress={() => router.push({ pathname: '/platform/quote/[id]', params: { id: 'new', projectId: project.id } })}
        />
      )}
      {mode === 'customer' && (
        <KButton label="Find more vendors" icon="search" variant="secondary" size="sm" onPress={() => router.navigate('/vendors')} />
      )}
      {project.vendors.length === 0 && <EmptyBlock icon="people-outline" title="No vendors yet" message="Accepted quotations appear here as bookings." />}
      {project.vendors.map((v) => (
        <Card key={v.id} style={styles.task}>
          <Avatar name={v.name} />
          <View style={{ flex: 1 }}>
            <Text size={15} weight="semibold" color={t.c.textStrong} numberOfLines={1}>
              {v.name}
            </Text>
            <Text size={12} color={t.c.muted}>
              {v.category} · {formatINR(v.amount)}
            </Text>
          </View>
          <StatusPill status={v.status} />
        </Card>
      ))}
    </View>
  );
}

function Payments({ project, mode }: { project: Project; mode: WorkspaceMode }) {
  const t = useRoleTheme();
  const payMilestone = useDb((s) => s.payMilestone);
  const [paying, setPaying] = useState<string | null>(null);

  const pay = async (id: string) => {
    setPaying(id);
    await new Promise((r) => setTimeout(r, 900)); // simulated gateway
    payMilestone(project.id, id);
    setPaying(null);
    triggerHaptic('success');
    toast(mode === 'customer' ? 'Payment successful' : 'Marked as paid');
  };

  if (!project.payments.length) return <EmptyBlock icon="wallet-outline" title="No payments scheduled" message="Payment milestones are created when a quotation is accepted." />;

  return (
    <View style={{ gap: 10 }}>
      {project.payments.map((m) => (
        <Card key={m.id} style={{ gap: 8 }}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text size={15} weight="semibold" color={t.c.textStrong}>
                {m.title}
              </Text>
              <Text size={12} color={t.c.muted}>
                To {m.payee} · {m.status === 'paid' && m.paidAt ? `paid ${formatShortDate(m.paidAt)}` : `due ${formatShortDate(m.due)}`}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text size={16} weight="bold" color={t.c.textStrong}>
                {formatINR(m.amount)}
              </Text>
              <StatusPill status={m.status} />
            </View>
          </View>
          {m.status !== 'paid' && mode !== 'vendor' && (
            <KButton
              label={mode === 'customer' ? `Pay ${formatINR(m.amount)}` : 'Mark as paid'}
              size="sm"
              variant={mode === 'customer' ? 'primary' : 'secondary'}
              loading={paying === m.id}
              onPress={() => pay(m.id)}
            />
          )}
        </Card>
      ))}
    </View>
  );
}

function Issues({ project, mode }: { project: Project; mode: WorkspaceMode }) {
  const t = useRoleTheme();
  const reportIncident = useDb((s) => s.reportIncident);
  const resolveIncident = useDb((s) => s.resolveIncident);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const liveEvent = project.events.find((e) => e.status === 'live') ?? project.events[0];

  return (
    <View style={{ gap: 10 }}>
      {mode !== 'customer' && <KButton label="Report an issue" icon="warning-outline" variant="danger" size="sm" onPress={() => setOpen(true)} />}
      {project.incidents.length === 0 && <EmptyBlock icon="shield-checkmark-outline" title="No issues reported" message="Everything is running smoothly." />}
      {project.incidents.map((i) => (
        <Card key={i.id} style={{ gap: 8, borderColor: i.status === 'open' ? t.c.danger : t.c.border }}>
          <View style={styles.rowBetween}>
            <StatusPill status={i.severity} label={`${i.severity.toUpperCase()} SEVERITY`} />
            <StatusPill status={i.status} />
          </View>
          <Text size={15} weight="semibold" color={t.c.textStrong}>
            {i.title}
          </Text>
          <Text size={12} color={t.c.muted}>
            {project.events.find((e) => e.id === i.eventId)?.name ?? 'Event'} · reported by {i.reportedBy}
          </Text>
          {i.status === 'open' && mode === 'platform' && (
            <KButton label="Mark resolved" icon="checkmark" size="sm" variant="success" onPress={() => resolveIncident(project.id, i.id)} />
          )}
        </Card>
      ))}
      <Sheet visible={open} onClose={() => setOpen(false)} title="Report an issue">
        <View style={{ paddingHorizontal: 20, gap: 14 }}>
          <KField placeholder="What happened?" value={title} onChangeText={setTitle} multiline />
          <SeverityPicker value={severity} onChange={setSeverity} />
          <KButton
            label="Report to control room"
            variant="danger"
            disabled={!title.trim() || !liveEvent}
            onPress={() => {
              reportIncident(project.id, { eventId: liveEvent!.id, title: title.trim(), severity, reportedBy: mode === 'vendor' ? 'Vendor' : 'Ops team' });
              setTitle('');
              setOpen(false);
              toast('Issue reported', 'warning');
            }}
          />
        </View>
      </Sheet>
    </View>
  );
}

/**
 * Full wedding project management, shared by the platform console (all
 * permissions), vendor app (their tasks, run sheet, issues) and the couple's
 * "My Wedding" (payments, their tasks, live run sheet).
 */
export function ProjectWorkspace({ project, mode, initialSection = 'overview' }: { project: Project; mode: WorkspaceMode; initialSection?: Section }) {
  const [section, setSection] = useState<Section>(initialSection);
  const liveCount = project.events.filter((e) => e.status === 'live').length;
  const openIssues = project.incidents.filter((i) => i.status === 'open').length;

  const sections: { id: Section; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'events', label: liveCount ? 'Events ● Live' : 'Events' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'vendors', label: 'Vendors' },
    { id: 'payments', label: 'Payments' },
    ...(mode !== 'customer' || openIssues ? [{ id: 'issues' as Section, label: 'Issues' }] : []),
  ];

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingVertical: 12 }}>
        <Segmented options={sections} value={section} onChange={setSection} counts={{ tasks: project.tasks.filter((x) => x.status !== 'done').length, issues: openIssues || undefined }} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60, gap: 12 }}>
        {section === 'overview' && <Overview project={project} mode={mode} />}
        {section === 'events' &&
          project.events.map((e) => (
            <EventCard
              key={e.id}
              project={project}
              event={e}
              // Genie-managed weddings are run by the platform; self-managed ones by the booked vendor.
              canControl={mode === 'platform' || (mode === 'vendor' && project.managedBy === 'self')}
              canEditRun={mode !== 'customer'}
            />
          ))}
        {section === 'tasks' && <Tasks project={project} mode={mode} />}
        {section === 'vendors' && <Vendors project={project} mode={mode} />}
        {section === 'payments' && <Payments project={project} mode={mode} />}
        {section === 'issues' && <Issues project={project} mode={mode} />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countdown: { alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, minWidth: 74 },
  statRow: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, gap: 2, padding: 12 },
  task: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
});
