import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar, Card, ChoiceChips, KButton, KField, Segmented, StatusPill } from '@/components/kit';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { BookingCard, DeliverablesPanel } from '@/components/work/Bookings';
import { FilesPanel } from '@/components/work/Collab';
import { EventsPanel } from '@/components/work/EventsPanel';
import { PaymentsPanel } from '@/components/work/Payments';
import { CUSTOMER_STATUS, PipelineStepper } from '@/components/work/Pipeline';
import { TaskBoard } from '@/components/work/TaskBoard';
import { TimelineView } from '@/components/work/Timeline';
import { colors } from '@/constants/theme';
import { bsMonthLabel } from '@/data/events';
import { SERVICES, findService, serviceName } from '@/data/services';
import { useCustomerWorkspace } from '@/hooks/useWorkspace';
import { missingServices, nextBestAction, planningProgress } from '@/services/planner';
import { paymentSummary } from '@/services/pricing';
import { projectRisks } from '@/services/risk';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import type { Project } from '@/types/platform';
import { daysUntil, formatLongDate, formatMoney, formatMoneyCompact, formatShortDate } from '@/utils/format';

type Tab = 'overview' | 'timeline' | 'services' | 'functions' | 'tasks' | 'payments' | 'files' | 'team';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'services', label: 'Services' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'functions', label: 'Functions' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'payments', label: 'Payments' },
  { id: 'files', label: 'Files' },
  { id: 'team', label: 'Team' },
];

const TOOLS: { icon: string; label: string; href: Href }[] = [
  { icon: 'people', label: 'Guests & RSVP', href: '/guests' },
  { icon: 'wallet', label: 'Budget', href: '/budget' },
  { icon: 'grid', label: 'Seating', href: '/seating' },
  { icon: 'globe', label: 'Website', href: '/website' },
  { icon: 'mail', label: 'Invitations', href: '/invitations' },
  { icon: 'gift', label: 'Registry', href: '/registry' },
  { icon: 'calendar', label: 'Calendar', href: '/calendar' },
  { icon: 'checkbox', label: 'Checklist', href: '/checklist' },
  { icon: 'document-lock', label: 'Contracts', href: '/contracts' },
  { icon: 'images', label: 'Mood boards', href: '/boards' },
  { icon: 'git-compare', label: 'Compare', href: '/compare' },
  { icon: 'pricetags', label: 'Deals', href: '/deals' },
];

function Hero({ project }: { project: Project }) {
  const progress = planningProgress(project);
  const days = daysUntil(project.weddingDate);
  return (
    <View style={styles.hero}>
      <View style={styles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text size={13} color={colors.textMuted}>
            {formatLongDate(project.weddingDate)} · {bsMonthLabel(project.weddingDate)}
          </Text>
          <Text serif size={26} weight="bold" color={colors.heading} lineHeight={36}>
            {project.title}
          </Text>
          <Text size={13} color={colors.textMuted}>
            {project.city} · {project.code}
          </Text>
        </View>
        <View style={styles.countdown}>
          <Text serif size={30} weight="bold" color={colors.primary} lineHeight={38}>
            {Math.abs(days)}
          </Text>
          <Text size={12} color={colors.textMuted} lineHeight={14}>
            {days >= 0 ? 'days to go' : 'days ago'}
          </Text>
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <View style={styles.rowBetween}>
          <Text size={13} color={colors.textBody}>
            Planning progress
          </Text>
          <Text size={13} weight="semibold" color={colors.heading}>
            {Math.round(progress.overall * 100)}%
          </Text>
        </View>
        <View style={styles.heroBar}>
          <View style={[styles.heroFill, { width: `${Math.round(progress.overall * 100)}%` }]} />
        </View>
      </View>
      <View style={styles.heroStats}>
        <HeroStat label="Services booked" value={`${progress.services.confirmed} of ${progress.services.total}`} />
        <HeroStat label={`Paid of ${formatMoneyCompact(progress.pay.total).replace('NPR ', '')}`} value={formatMoneyCompact(progress.pay.paid).replace('NPR ', '')} />
        <HeroStat label="Tasks done" value={`${progress.tasks.done} of ${progress.tasks.total}`} />
        <HeroStat label="Guests" value={String(project.guests)} last />
      </View>
    </View>
  );
}

function HeroStat({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.heroStat, !last && styles.heroStatBorder]}>
      <Text size={15} weight="semibold" color={colors.heading} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text size={11} color={colors.textMuted} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function CoordinatorCard({ project }: { project: Project }) {
  const threads = useDb((s) => s.threads);
  const thread = threads.find((t) => t.projectId === project.id && t.kind === 'project');
  if (!project.coordinatorName) {
    return (
      <Card style={styles.coord}>
        <Ionicons name="hourglass-outline" size={22} color={colors.textMuted} />
        <View style={{ flex: 1 }}>
          <Text size={15} weight="semibold" color={colors.heading}>
            Assigning your coordinator
          </Text>
          <Text size={13} color={colors.textMuted}>
            Usually within an hour during working hours.
          </Text>
        </View>
      </Card>
    );
  }
  return (
    <Card style={styles.coord}>
      <Avatar name={project.coordinatorName} size={48} />
      <View style={{ flex: 1 }}>
        <Text size={12} color={colors.textMuted}>
          Your coordinator
        </Text>
        <Text size={16} weight="semibold" color={colors.heading}>
          {project.coordinatorName}
        </Text>
        <Text size={12} color={colors.textMuted}>
          One contact for all {project.bookings.filter((b) => b.status !== 'CANCELLED').length || ''} providers
        </Text>
      </View>
      <Pressable onPress={() => thread && router.push({ pathname: '/inbox/[id]', params: { id: thread.id } })} style={styles.circleBtn} accessibilityLabel="Chat with coordinator">
        <Ionicons name="chatbubble-outline" size={19} color={colors.heading} />
      </Pressable>
      <Pressable onPress={() => Linking.openURL('tel:+9779800000004')} style={styles.circleBtn} accessibilityLabel="Call coordinator">
        <Ionicons name="call-outline" size={19} color={colors.heading} />
      </Pressable>
    </Card>
  );
}

function Overview({ project, setTab }: { project: Project; setTab: (t: Tab) => void }) {
  const quotes = useDb((s) => s.quotes);
  const status = CUSTOMER_STATUS[project.status];
  const action = nextBestAction(project, quotes);
  const pay = paymentSummary(project);
  const risks = projectRisks(project).filter((r) => ['PAYMENT_OVERDUE', 'EVENT_WITHIN_48H', 'DELIVERABLE_OVERDUE'].includes(r.kind));
  const reviews = project.bookings.flatMap((b) => b.deliverables.filter((d) => d.status === 'READY_FOR_REVIEW'));
  const nextTask = project.tasks.filter((t) => t.visibility === 'shared' && t.status !== 'COMPLETED' && t.status !== 'CANCELLED').sort((a, b) => a.due.localeCompare(b.due))[0];

  return (
    <View style={{ gap: 14 }}>
      <Hero project={project} />
      <CoordinatorCard project={project} />
      <Card style={{ gap: 10 }}>
        <View style={styles.row}>
          <Ionicons name={status.icon as never} size={21} color={colors.success} />
          <View style={{ flex: 1 }}>
            <Text size={15} weight="semibold" color={colors.heading}>
              {status.title}
            </Text>
            <Text size={13} color={colors.textMuted}>
              {status.body}
            </Text>
          </View>
        </View>
        <PipelineStepper project={project} compact />
      </Card>

      <Pressable onPress={() => router.push(action.href as Href)} accessibilityRole="button">
        <Card style={[styles.row, { borderLeftColor: colors.primary, borderLeftWidth: 3 }]}>
          <View style={{ flex: 1 }}>
            <Text size={12} color={colors.textMuted}>
              Next up
            </Text>
            <Text size={15} weight="semibold" color={colors.heading}>
              {action.title}
            </Text>
            <Text size={13} color={colors.textMuted}>
              {action.body}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Card>
      </Pressable>

      {(risks.length > 0 || reviews.length > 0) && (
        <Card style={{ gap: 8, borderLeftColor: colors.warning, borderLeftWidth: 3 }}>
          {risks.map((r) => (
            <View key={r.id} style={styles.row}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
              <Text size={13} color={colors.danger} style={{ flex: 1 }}>
                {r.message}
              </Text>
            </View>
          ))}
          {reviews.map((d) => (
            <Pressable key={d.id} onPress={() => setTab('services')}>
              <Text size={13} color={colors.text}>
                {d.title} is ready for your review
              </Text>
            </Pressable>
          ))}
        </Card>
      )}

      <View style={styles.grid2}>
        <Card style={styles.miniCard} onPress={() => setTab('payments')}>
          <Text size={12} color={colors.textMuted}>
            Next payment
          </Text>
          <Text size={16} weight="semibold" color={colors.heading}>
            {pay.next ? formatMoney(pay.next.amount - pay.next.paidAmount) : 'All paid'}
          </Text>
          <Text size={12} color={pay.overdue.length ? colors.danger : colors.textMuted}>
            {pay.next ? `${formatShortDate(pay.next.due)}` : '—'}
          </Text>
        </Card>
        <Card style={styles.miniCard} onPress={() => setTab('tasks')}>
          <Text size={12} color={colors.textMuted}>
            Next task
          </Text>
          <Text size={14} weight="semibold" color={colors.heading} numberOfLines={2}>
            {nextTask?.title ?? 'Nothing pending'}
          </Text>
          <Text size={12} color={colors.textMuted}>
            {nextTask ? `Due ${formatShortDate(nextTask.due)}` : ''}
          </Text>
        </Card>
      </View>

      <View style={{ gap: 10 }}>
        <Text size={16} weight="bold" color={colors.heading}>
          Planning tools
        </Text>
        <View style={styles.tools}>
          {TOOLS.map((tool) => (
            <Pressable key={tool.label} onPress={() => router.push(tool.href)} style={({ pressed }) => [styles.tool, pressed && { backgroundColor: colors.bgSoft }]} accessibilityRole="button">
              <Ionicons name={`${tool.icon}-outline` as never} size={21} color={colors.textBody} />
              <Text size={12} color={colors.text} align="center" numberOfLines={1}>
                {tool.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

function AddServiceSheet({ project, visible, onClose }: { project: Project; visible: boolean; onClose: () => void }) {
  const addRequirement = useDb((s) => s.addRequirement);
  const suggested = missingServices(project);
  const requested = new Set(project.requirements.filter((r) => r.status !== 'CANCELLED').map((r) => r.serviceId));
  const [all, setAll] = useState(false);
  const list = (all ? SERVICES.map((s) => s.id) : suggested).filter((id) => !requested.has(id));
  return (
    <Sheet visible={visible} onClose={onClose} title="Add a service">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 12 }}>
        <Text size={13} color={colors.textMuted}>
          {all ? 'Every service we coordinate.' : 'Suggested for your functions.'} Your coordinator will match providers and add them to your quotation.
        </Text>
        {list.map((id) => {
          const def = findService(id)!;
          return (
            <Pressable
              key={id}
              onPress={() => {
                addRequirement(project.id, id);
                triggerHaptic('success');
                toast(`${def.name} added. Your coordinator will find providers.`, 'checkmark-circle');
                onClose();
              }}
              style={({ pressed }) => [styles.serviceRow, { opacity: pressed ? 0.7 : 1 }]}>
              <Ionicons name={def.icon as never} size={20} color={colors.textBody} />
              <View style={{ flex: 1 }}>
                <Text size={15} weight="semibold" color={colors.heading}>
                  {def.name}
                </Text>
                <Text size={12} color={colors.textMuted}>
                  Typically {formatMoneyCompact(def.priceRange[0])}–{formatMoneyCompact(def.priceRange[1]).replace('NPR ', '')} {def.unit}
                </Text>
              </View>
              <Ionicons name="add" size={22} color={colors.primary} />
            </Pressable>
          );
        })}
        {!list.length && (
          <Text size={13} color={colors.textMuted}>
            You have all the suggested services.
          </Text>
        )}
        <KButton label={all ? 'Show suggestions' : 'Show all services'} variant="ghost" size="sm" onPress={() => setAll((v) => !v)} />
      </ScrollView>
    </Sheet>
  );
}

function Services({ project }: { project: Project }) {
  const account = useAccount();
  const reviews = useDb((s) => s.reviews);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const reqs = project.requirements.filter((r) => r.status !== 'CANCELLED');
  return (
    <View style={{ gap: 12 }}>
      <KButton label="Add a service" icon="add" variant="secondary" size="sm" onPress={() => setAdding(true)} />
      {reqs.map((r) => {
        const def = findService(r.serviceId);
        const bookings = project.bookings.filter((b) => b.requirementId === r.id && b.status !== 'CANCELLED');
        return (
          <View key={r.id} style={{ gap: 8 }}>
            <View style={styles.rowBetween}>
              <View style={styles.row}>
                <Ionicons name={(def?.icon ?? 'briefcase-outline') as never} size={18} color={colors.textBody} />
                <Text size={15} weight="semibold" color={colors.heading}>
                  {serviceName(r.serviceId)}
                </Text>
              </View>
              <StatusPill status={r.status} label={r.status === 'OPEN' || r.status === 'MATCHING' ? 'Finding providers' : r.status === 'SHORTLISTED' ? 'Shortlisted' : undefined} />
            </View>
            {!bookings.length && (
              <Card style={{ gap: 4 }}>
                <Text size={13} color={colors.textMuted}>
                  {r.candidates.length ? `${r.candidates.length} providers matched — your coordinator is checking availability.` : 'Your coordinator is matching the best providers for your date and budget.'}
                </Text>
                {r.styles.length > 0 && (
                  <Text size={12} color={colors.textSubtle}>
                    Style: {r.styles.join(', ')}
                  </Text>
                )}
              </Card>
            )}
            {bookings.map((b) => {
              const reviewed = reviews.some((x) => x.bookingId === b.id && x.authorId === account.id);
              return (
                <View key={b.id} style={{ gap: 8 }}>
                  <BookingCard project={project} booking={b} mode="customer" onPress={() => setOpen(open === b.id ? null : b.id)} />
                  {(open === b.id || b.deliverables.some((d) => d.status === 'READY_FOR_REVIEW')) && <DeliverablesPanel project={project} booking={b} mode="customer" />}
                  {b.status === 'COMPLETED' && !reviewed && (
                    <KButton label={`Review ${b.providerName}`} icon="star-outline" size="sm" variant="secondary" onPress={() => router.push({ pathname: '/write-review', params: { bookingId: b.id, projectId: project.id } })} />
                  )}
                </View>
              );
            })}
          </View>
        );
      })}
      <AddServiceSheet project={project} visible={adding} onClose={() => setAdding(false)} />
    </View>
  );
}

function Team({ project }: { project: Project }) {
  const invite = useDb((s) => s.inviteCollaborator);
  const remove = useDb((s) => s.removeCollaborator);
  const threads = useDb((s) => s.threads);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relation, setRelation] = useState('Partner');
  const [permission, setPermission] = useState<'editor' | 'viewer'>('editor');
  const serviceThreads = threads.filter((t) => t.projectId === project.id && t.kind === 'service');

  return (
    <View style={{ gap: 12 }}>
      <Text size={16} weight="bold" color={colors.heading}>
        Family & collaborators
      </Text>
      {project.collaborators.map((c) => (
        <Card key={c.id} style={styles.row}>
          <Avatar name={c.name} />
          <View style={{ flex: 1 }}>
            <Text size={15} weight="semibold" color={colors.heading}>
              {c.name}
            </Text>
            <Text size={12} color={colors.textMuted}>
              {c.relation} · {c.permission === 'editor' ? 'Can edit' : 'View only'} · {c.joinedAt ? 'joined' : `invite code ${c.inviteCode}`}
            </Text>
          </View>
          <Pressable onPress={() => remove(project.id, c.id)} hitSlop={8} accessibilityLabel={`Remove ${c.name}`}>
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </Pressable>
        </Card>
      ))}
      <KButton label="Invite partner or family" icon="person-add-outline" variant="secondary" size="sm" onPress={() => setOpen(true)} />
      <Text size={16} weight="bold" color={colors.heading}>
        Provider chats
      </Text>
      {serviceThreads.map((t) => (
        <Card key={t.id} onPress={() => router.push({ pathname: '/inbox/[id]', params: { id: t.id } })} style={styles.row}>
          <Ionicons name="chatbubbles-outline" size={20} color={colors.textBody} />
          <Text size={14} weight="semibold" color={colors.heading} style={{ flex: 1 }}>
            {t.title}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Card>
      ))}
      {!serviceThreads.length && (
        <Text size={13} color={colors.textMuted}>
          Service chats open once providers are booked. Your coordinator is always reachable in the main chat.
        </Text>
      )}
      <Sheet visible={open} onClose={() => setOpen(false)} title="Invite to your wedding">
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          <KField placeholder="Name" value={name} onChangeText={setName} />
          <KField placeholder="Mobile (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <ChoiceChips options={['Partner', 'Mother', 'Father', 'Sibling', 'Friend', 'Relative']} selected={[relation]} onToggle={setRelation} />
          <ChoiceChips options={['Can edit', 'View only']} selected={[permission === 'editor' ? 'Can edit' : 'View only']} onToggle={(v) => setPermission(v === 'Can edit' ? 'editor' : 'viewer')} />
          <KButton
            label="Create invite"
            disabled={!name.trim()}
            onPress={() => {
              const c = invite(project.id, { name: name.trim(), phone: phone.trim() || undefined, relation, permission });
              setOpen(false);
              setName('');
              setPhone('');
              toast(`Share code ${c.inviteCode} with ${c.name}`, 'key');
              Linking.openURL(`https://wa.me/?text=${encodeURIComponent(`Join our wedding planning on Vivah! Open the app → Join a wedding → code ${c.inviteCode}`)}`).catch(() => {});
            }}
          />
        </View>
      </Sheet>
    </View>
  );
}

/** The couple's single workspace for the whole wedding project. */
export default function MyWedding() {
  const account = useAccount();
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const { project, isCollaborator } = useCustomerWorkspace(account.id);
  const [tab, setTab] = useState<Tab>(params.tab ?? 'overview');

  if (!project) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="My Wedding" />
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <View style={styles.hero}>
            <Text serif size={24} weight="bold" color={colors.heading} lineHeight={34}>
              Tell us once. We handle the rest.
            </Text>
            <Text size={15} color={colors.textBody}>
              Share your dates, guest count, the services you need and your budget. A coordinator builds one quotation and books every provider for you.
            </Text>
            <KButton label="Start planning" onPress={() => router.push('/plan')} />
          </View>
          <KButton label="I have an invite code" variant="secondary" icon="key-outline" onPress={() => router.push('/join-wedding')} />
        </ScrollView>
      </View>
    );
  }

  const openTasks = project.tasks.filter((x) => x.visibility === 'shared' && x.status !== 'COMPLETED' && x.status !== 'CANCELLED').length;
  const due = project.milestones.filter((m) => m.status === 'DUE' || m.status === 'OVERDUE' || m.status === 'PARTIALLY_PAID').length;

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="My Wedding"
        subtitle={`${project.code}${isCollaborator ? ' · shared with you' : ''}`}
        right={
          <Pressable onPress={() => router.push('/calendar')} hitSlop={10} accessibilityLabel="Calendar" style={{ padding: 6 }}>
            <Ionicons name="calendar-outline" size={22} color={colors.heading} />
          </Pressable>
        }
      />
      <View style={{ backgroundColor: colors.white }}>
        <Segmented options={TABS} value={tab} onChange={setTab} counts={{ tasks: openTasks || undefined, payments: due || undefined }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        {tab === 'overview' && <Overview project={project} setTab={setTab} />}
        {tab === 'services' && <Services project={project} />}
        {tab === 'timeline' && <TimelineView project={project} mode="customer" />}
        {tab === 'functions' && <EventsPanel project={project} mode="customer" />}
        {tab === 'tasks' && <TaskBoard project={project} mode="customer" />}
        {tab === 'payments' && <PaymentsPanel project={project} mode="customer" />}
        {tab === 'files' && <FilesPanel project={project} mode="customer" />}
        {tab === 'team' && <Team project={project} />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgSoft },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  hero: { backgroundColor: colors.white, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 14 },
  countdown: { alignItems: 'flex-end' },
  heroBar: { height: 4, borderRadius: 2, backgroundColor: colors.divider, overflow: 'hidden' },
  heroFill: { height: 4, backgroundColor: colors.primary },
  heroStats: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 12 },
  heroStat: { flex: 1, paddingHorizontal: 6 },
  heroStatBorder: { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.border },
  coord: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  circleBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  grid2: { flexDirection: 'row', gap: 10 },
  miniCard: { flex: 1, gap: 3 },
  tools: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: colors.white, borderRadius: 10, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  tool: { width: '25%', alignItems: 'center', gap: 4, paddingVertical: 14 },
  serviceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
});
