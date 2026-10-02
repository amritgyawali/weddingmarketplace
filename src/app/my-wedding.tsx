import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollView as RNScrollView } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Card, ChoiceChips, KButton, KField, Segmented, StatusPill } from '@/components/kit';
import { BackButton, IconButton } from '@/components/ui/IconButton';
import { triggerHaptic } from '@/components/ui/PressableScale';
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
import { CelebrationSwitcher } from '@/components/wedding/CelebrationSwitcher';
import { CountdownCard, FunctionsStrip, MoneyCard, PeopleRow, Section, ServicesSummary, WeddingHero } from '@/components/wedding/WeddingParts';
import { photos } from '@/constants/images';
import { colors } from '@/constants/theme';
import { type PlannerModule, planCap } from '@/data/capabilities';
import { SERVICES, findService, serviceName } from '@/data/services';
import { useExperience } from '@/hooks/useExperience';
import { useLayout } from '@/hooks/useLayout';
import { useCustomerWorkspace } from '@/hooks/useWorkspace';
import { missingServices, nextBestAction } from '@/services/planner';
import { projectRisks } from '@/services/risk';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import type { Project } from '@/types/platform';
import { formatMoneyCompact, formatShortDate } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

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

/** Planner shortcuts; the ones tied to a module show only when the occasion has it. */
const TOOLS: { icon: string; label: string; href: Href; module?: PlannerModule }[] = [
  { icon: 'people', label: 'Guests & RSVP', href: '/guests', module: 'guests' },
  { icon: 'wallet', label: 'Budget', href: '/budget' },
  { icon: 'grid', label: 'Seating', href: '/seating', module: 'seating' },
  { icon: 'globe', label: 'Website', href: '/website', module: 'website' },
  { icon: 'mail', label: 'Invitations', href: '/invitations', module: 'invitations' },
  { icon: 'gift', label: 'Registry', href: '/registry', module: 'registry' },
  { icon: 'calendar', label: 'Calendar', href: '/calendar' },
  { icon: 'checkbox', label: 'Checklist', href: '/checklist' },
  { icon: 'document-lock', label: 'Contracts', href: '/contracts' },
  { icon: 'images', label: 'Mood boards', href: '/boards' },
  { icon: 'git-compare', label: 'Compare', href: '/compare' },
  { icon: 'pricetags', label: 'Deals', href: '/deals' },
  { icon: 'construct', label: 'More tools', href: '/tools' },
];

function CoordinatorCard({ project }: { project: Project }) {
  const threads = useDb((s) => s.threads);
  const thread = threads.find((t) => t.projectId === project.id && t.kind === 'project');
  const activeBookings = project.bookings.filter((b) => b.status !== 'CANCELLED').length;
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
          {activeBookings ? `One contact for all ${activeBookings} providers` : 'One contact for every provider'}
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

function Overview({ project, setTab, wide }: { project: Project; setTab: (t: Tab) => void; wide: boolean }) {
  const quotes = useDb((s) => s.quotes);
  const exp = useExperience();
  const tools = TOOLS.filter((x) => !x.module || exp.caps.has(planCap(x.module))).map((x) => (x.module === 'website' && exp.occasion?.id !== 'wedding' ? { ...x, label: 'Event page' } : x));
  const status = CUSTOMER_STATUS[project.status];
  const action = nextBestAction(project, quotes);
  const risks = projectRisks(project).filter((r) => ['PAYMENT_OVERDUE', 'EVENT_WITHIN_48H', 'DELIVERABLE_OVERDUE'].includes(r.kind));
  const reviews = project.bookings.flatMap((b) => b.deliverables.filter((d) => d.status === 'READY_FOR_REVIEW'));
  const nextTask = project.tasks.filter((t) => t.visibility === 'shared' && t.status !== 'COMPLETED' && t.status !== 'CANCELLED').sort((a, b) => a.due.localeCompare(b.due))[0];

  const main = (
    <>
      <Pressable onPress={() => router.push(action.href as Href)} accessibilityRole="button" style={({ pressed }) => [styles.nextUp, pressed && { backgroundColor: colors.bgSoft }]}>
        <View style={styles.nextIcon}>
          <Ionicons name={`${action.icon}-outline` as never} size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text size={12} color={colors.textMuted}>
            Next up
          </Text>
          <Text size={16} weight="semibold" color={colors.heading}>
            {action.title}
          </Text>
          <Text size={13} color={colors.textMuted}>
            {action.body}
          </Text>
        </View>
        <Ionicons name="arrow-forward" size={18} color={colors.heading} />
      </Pressable>

      {(risks.length > 0 || reviews.length > 0) && (
        <View style={styles.alerts}>
          {risks.map((r) => (
            <View key={r.id} style={styles.row}>
              <Ionicons name="alert-circle-outline" size={17} color={colors.danger} />
              <Text size={13} color={colors.danger} style={{ flex: 1 }}>
                {r.message}
              </Text>
            </View>
          ))}
          {reviews.map((d) => (
            <Pressable key={d.id} onPress={() => setTab('services')} style={styles.row} accessibilityRole="button">
              <Ionicons name="eye-outline" size={17} color={colors.warning} />
              <Text size={13} color={colors.text} style={{ flex: 1 }}>
                {d.title} is ready for your review
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.statusCard}>
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
      </View>

      <Section title="Your functions" action="Details" onAction={() => setTab('functions')}>
        <FunctionsStrip project={project} onOpen={() => setTab('functions')} />
      </Section>

      <Section title="Services" action="Manage" onAction={() => setTab('services')}>
        <ServicesSummary project={project} onOpen={() => setTab('services')} />
      </Section>
    </>
  );

  const side = (
    <>
      <Section title="Money" action="Payments" onAction={() => setTab('payments')}>
        <MoneyCard project={project} onOpen={() => setTab('payments')} />
      </Section>

      {nextTask && (
        <Section title="On your list" action="All tasks" onAction={() => setTab('tasks')}>
          <Pressable onPress={() => setTab('tasks')} accessibilityRole="button" style={({ pressed }) => [styles.panel, styles.row, pressed && { backgroundColor: colors.bgSoft }]}>
            <Ionicons name="ellipse-outline" size={20} color={colors.textSubtle} />
            <View style={{ flex: 1 }}>
              <Text size={15} weight="semibold" color={colors.heading} numberOfLines={2}>
                {nextTask.title}
              </Text>
              <Text size={12} color={colors.textMuted}>
                {nextTask.assigneeName} · due {formatShortDate(nextTask.due)}
              </Text>
            </View>
          </Pressable>
        </Section>
      )}

      <Section title="Your team">
        <CoordinatorCard project={project} />
        <PeopleRow project={project} onOpen={() => setTab('team')} />
      </Section>

      <Section title="Planning tools">
        <View style={styles.tools}>
          {tools.map((tool) => (
            <Pressable key={tool.label} onPress={() => router.push(tool.href)} style={({ pressed }) => [styles.tool, pressed && { backgroundColor: colors.bgSoft }]} accessibilityRole="button">
              <Ionicons name={`${tool.icon}-outline` as never} size={22} color={colors.textBody} />
              <Text size={12} color={colors.text} align="center" numberOfLines={1}>
                {tool.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Section>
    </>
  );

  if (wide) {
    return (
      <View style={styles.wideRow}>
        <View style={[styles.col, { flex: 3 }]}>{main}</View>
        <View style={[styles.col, { flex: 2 }]}>{side}</View>
      </View>
    );
  }
  return (
    <View style={styles.col}>
      {main}
      {side}
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

const EMPTY_STEPS = [
  { title: 'Tell us the basics', body: 'Date, city, guests, budget and the services you need.' },
  { title: 'Meet your coordinator', body: 'One person who matches providers and calls you within 2 hours.' },
  { title: 'Accept one quotation', body: 'Every booking, payment and the day itself, handled in one place.' },
];

function EmptyWedding() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { backgroundColor: colors.white }]}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}>
        <View style={[styles.emptyHero, { paddingTop: insets.top + 6 }]}>
          <Image source={photos.ideaBrideParasol} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={{ left: '50%', top: '40%' }} />
          <LinearGradient colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.8)']} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
          <View style={{ paddingHorizontal: 12 }}>
            <IconButton icon="chevron-back" color={colors.white} background="rgba(20,16,12,0.34)" accessibilityLabel="Go back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          </View>
          <View style={{ paddingHorizontal: 20, paddingBottom: 24, gap: 6 }}>
            <Text serif size={30} weight="bold" lineHeight={40} color={colors.white}>
              Tell us once. We handle the rest.
            </Text>
            <Text size={15} color="rgba(255,255,255,0.86)">
              A coordinator builds one quotation and books every provider for you.
            </Text>
          </View>
        </View>
        <View style={{ padding: 20, gap: 4 }}>
          {EMPTY_STEPS.map((s, i) => (
            <View key={s.title} style={styles.emptyStep}>
              <Text serif size={22} weight="bold" color={colors.primary} style={{ width: 28 }}>
                {i + 1}
              </Text>
              <View style={{ flex: 1 }}>
                <Text size={16} weight="semibold" color={colors.heading}>
                  {s.title}
                </Text>
                <Text size={14} color={colors.textMuted}>
                  {s.body}
                </Text>
              </View>
            </View>
          ))}
          <KButton label="Start planning" size="lg" onPress={() => router.push('/plan')} style={{ marginTop: 16 }} />
          <KButton label="I have an invite code" variant="ghost" icon="key-outline" onPress={() => router.push('/join-wedding')} />
        </View>
      </ScrollView>
    </View>
  );
}

const BAR_HEIGHT = 52;

/** The couple's single workspace for the whole wedding project. */
export default function MyWedding() {
  const account = useAccount();
  const insets = useSafeAreaInsets();
  const { wide, contentWidth } = useLayout();
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const { project, projects, isCollaborator } = useCustomerWorkspace(account.id);
  const exp = useExperience();
  const [tab, setTab] = useState<Tab>(params.tab ?? 'overview');
  const [tabsY, setTabsY] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef<RNScrollView>(null);

  if (!project) return <EmptyWedding />;

  const openTasks = project.tasks.filter((x) => x.visibility === 'shared' && x.status !== 'COMPLETED' && x.status !== 'CANCELLED').length;
  const due = project.milestones.filter((m) => m.status === 'DUE' || m.status === 'OVERDUE' || m.status === 'PARTIALLY_PAID').length;
  const counts = { tasks: openTasks || undefined, payments: due || undefined };
  // Once the in-page tabs scroll under the top bar, a compact bar with the tabs takes over.
  const threshold = Math.max(1, tabsY - (insets.top + BAR_HEIGHT));
  const page = { width: '100%' as const, maxWidth: contentWidth, alignSelf: 'center' as const };
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = e.nativeEvent.contentOffset.y >= threshold;
    if (next !== collapsed) setCollapsed(next);
  };
  const changeTab = (next: Tab) => {
    setTab(next);
    if (collapsed) requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: threshold, animated: false }));
  };

  return (
    <View style={styles.root}>
      <StatusBar style={collapsed ? 'dark' : 'light'} />
      <ScrollView ref={scrollRef} onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}>
        <WeddingHero
          project={project}
          shared={isCollaborator}
          onBack={back}
          actions={[
            ...(exp.caps.has('plan.website') ? [{ icon: 'globe-outline' as const, label: exp.occasion?.id === 'wedding' ? 'Wedding website' : 'Event page', onPress: () => router.push('/website') }] : []),
            { icon: 'calendar-outline', label: 'Calendar', onPress: () => router.push('/calendar') },
          ]}
        />
        <View style={[styles.pad, page, { gap: 14 }]}>
          <CountdownCard project={project} onSetDate={() => changeTab('functions')} />
          {!isCollaborator && (projects.length > 1 || exp.occasion?.id !== 'wedding') && <CelebrationSwitcher />}
        </View>
        <View style={styles.tabs} onLayout={(e) => setTabsY(e.nativeEvent.layout.y)}>
          <View style={page}>
            <Segmented options={TABS} value={tab} onChange={changeTab} counts={counts} />
          </View>
        </View>
        <View style={[styles.pad, page, { paddingTop: 18 }]}>
          {tab === 'overview' && <Overview project={project} setTab={changeTab} wide={wide} />}
          {tab === 'services' && <Services project={project} />}
          {tab === 'timeline' && <TimelineView project={project} mode="customer" />}
          {tab === 'functions' && <EventsPanel project={project} mode="customer" />}
          {tab === 'tasks' && <TaskBoard project={project} mode="customer" />}
          {tab === 'payments' && <PaymentsPanel project={project} mode="customer" />}
          {tab === 'files' && <FilesPanel project={project} mode="customer" />}
          {tab === 'team' && <Team project={project} />}
        </View>
      </ScrollView>

      {collapsed && (
        <Animated.View entering={FadeIn.duration(160)} style={[styles.bar, { paddingTop: insets.top }]}>
          <View style={[styles.barRow, page]}>
            <BackButton onPress={back} />
            <View style={{ flex: 1 }}>
              <Text serif size={17} weight="bold" color={colors.heading} numberOfLines={1} lineHeight={24}>
                {project.title}
              </Text>
            </View>
            <IconButton icon="calendar-outline" accessibilityLabel="Calendar" onPress={() => router.push('/calendar')} />
          </View>
          <View style={page}>
            <Segmented options={TABS} value={tab} onChange={changeTab} counts={counts} />
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgSoft },
  pad: { paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  tabs: { marginTop: 18, backgroundColor: colors.white, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  bar: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: colors.white },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 6, height: BAR_HEIGHT, paddingHorizontal: 8 },
  wideRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  col: { gap: 24 },
  panel: { backgroundColor: colors.white, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 16 },
  nextUp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    padding: 16,
  },
  nextIcon: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  alerts: { gap: 10, backgroundColor: colors.white, borderRadius: 10, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 3, borderLeftColor: colors.danger, padding: 14 },
  statusCard: { gap: 12, backgroundColor: colors.white, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 16 },
  coord: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  circleBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  tools: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: colors.white, borderRadius: 10, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  tool: { width: '25%', alignItems: 'center', gap: 6, paddingVertical: 16 },
  serviceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  emptyHero: { height: 380, justifyContent: 'space-between', backgroundColor: colors.heading },
  emptyStep: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
});
