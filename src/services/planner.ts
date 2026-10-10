/**
 * Rule-based wedding planner ("AI" without paid AI): turns the requirement
 * wizard into a project, allocates budgets, generates checklists and a
 * timeline, and suggests the next best action. Swap any function for an LLM
 * call behind your own server later without touching screens.
 */
import type { PhotoRef } from '@/constants/images';
import { CHECKLIST, PHASE_DUE } from '@/data/checklist';
import { EVENT_TYPE_BY_ID, bandFor, isPeakSeason } from '@/data/events';
import type { OccasionId } from '@/data/occasions';
import { SERVICE_BY_ID, defaultDetails, findService, serviceName } from '@/data/services';
import { milestoneStatus, paymentSummary } from '@/services/pricing';
import type {
  EventType,
  Project,
  ProjectEvent,
  ProjectTask,
  Quotation,
  Requirement,
  RunItem,
  TaskAssignee,
  TimelineEntry,
} from '@/types/platform';
import { daysUntil, formatMoney, formatMoneyCompact, formatShortDate, fromISODate, toISODate, uid } from '@/utils/format';

export interface PlanInput {
  eventTypes: EventType[];
  city: string;
  area?: string;
  venueSelected?: string;
  /** Per-function date; null = not confirmed yet. */
  dates: Partial<Record<EventType, string | null>>;
  /** Optional city override for each additional function. */
  eventCities?: Partial<Record<EventType, string>>;
  /** Optional display name for a related party or family gathering. */
  eventNames?: Partial<Record<EventType, string>>;
  guests: number;
  services: string[];
  budgetMode: 'overall' | 'per_service' | 'undecided';
  budgetTotal?: number;
  /** Per-service budget in the service's own unit (e.g. per plate for catering). */
  serviceBudgets: Record<string, [number, number]>;
  styles: Record<string, string[]>;
  notes: string;
  inspiration: PhotoRef[];
  partnerName?: string;
  /** What is being celebrated (weddings when missing) and who it is for. */
  occasion?: OccasionId;
  honourees?: Project['honourees'];
  /** Shown instead of the names-based title ("Aarav’s pasni"). */
  title?: string;
}

const shift = (iso: string, days: number) => {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + Math.round(days));
  return toISODate(d);
};
const today = () => toISODate(new Date());

// Estimates & budget
/** Typical total cost range for a service in NPR. */
export function estimateRange(serviceId: string, guests: number, events = 1): [number, number] {
  const def = findService(serviceId);
  if (!def) return [0, 0];
  const [lo, hi] = def.priceRange;
  const mult =
    def.unit === 'per plate' || def.unit === 'per person'
      ? serviceId === 'accommodation'
        ? Math.max(4, Math.round(guests * 0.08))
        : serviceId === 'security'
          ? Math.max(2, Math.round(guests / 150))
          : guests
      : def.unit === 'per card'
        ? Math.round(guests * 0.6)
        : def.unit === 'per car'
          ? 3
          : def.unit === 'per event' || def.unit === 'per day'
            ? events
            : 1;
  // Typical bookings sit in the lower-middle of the market band.
  return [Math.round(lo * mult), Math.round((lo + (hi - lo) * 0.45) * mult)];
}

export function estimateTotal(serviceIds: string[], guests: number, events = 1): [number, number] {
  return serviceIds.reduce<[number, number]>(
    (acc, id) => {
      const [lo, hi] = estimateRange(id, guests, events);
      return [acc[0] + lo, acc[1] + hi];
    },
    [0, 0],
  );
}

/**
 * Split an overall budget across services by typical share, making sure
 * per-guest services (catering) never fall below their minimum feasible cost.
 */
export function allocateBudget(total: number, serviceIds: string[], guests: number, events = 1): Record<string, number> {
  const shares = serviceIds.map((id) => ({ id, share: SERVICE_BY_ID[id]?.budgetShare ?? 0.01 }));
  const sum = shares.reduce((s, x) => s + x.share, 0) || 1;
  const out: Record<string, number> = {};
  let fixed = 0;
  // First pass: protect minimums.
  for (const { id } of shares) {
    const [min] = estimateRange(id, guests, events);
    out[id] = min;
    fixed += min;
  }
  const spare = Math.max(0, total - fixed);
  for (const { id, share } of shares) out[id] = Math.round((out[id] + (spare * share) / sum) / 1000) * 1000;
  return out;
}

/** Convert a total allocation into the service's own unit (per plate etc.). */
export function perUnitBudget(serviceId: string, total: number, guests: number, events = 1): [number, number] {
  const def = findService(serviceId);
  if (!def) return [0, total];
  const divisor =
    def.unit === 'per plate' || def.unit === 'per person' ? guests : def.unit === 'per card' ? Math.round(guests * 0.6) : def.unit === 'per event' || def.unit === 'per day' ? events : 1;
  const unit = Math.round(total / Math.max(1, divisor));
  return [Math.round(unit * 0.75), unit];
}

// Project generation
export function runSheetFor(type: EventType): RunItem[] {
  return (EVENT_TYPE_BY_ID[type]?.runSheet ?? []).map(([time, title, owner], i) => ({ id: uid(`ri${i}`), time, title, owner, status: 'pending' }));
}

export function buildEvents(input: PlanInput): ProjectEvent[] {
  const main = input.eventTypes[0] ?? 'WEDDING';
  const mainDate = input.dates[main] ?? null;
  return input.eventTypes.map((type, i) => {
    const def = EVENT_TYPE_BY_ID[type];
    // Unconfirmed functions get a provisional date around the main event.
    const provisional = mainDate ? shift(mainDate, type === 'RECEPTION' ? 1 : type === main ? 0 : -Math.max(1, input.eventTypes.length - i)) : null;
    const date = input.dates[type] ?? provisional;
    return {
      id: uid('ev'),
      type,
      name: input.eventNames?.[type]?.trim() || def?.label.replace(/ \(.*\)$/, '') || type,
      date,
      dateConfirmed: !!input.dates[type],
      startTime: def?.start ?? '11:00',
      venue: type === main && input.venueSelected ? input.venueSelected : 'To be decided',
      city: input.eventCities?.[type]?.trim() || input.city,
      guests: Math.max(0, Math.round(input.guests * (def?.guestShare ?? 1))),
      status: 'planned',
      private: false,
      runSheet: runSheetFor(type),
    };
  });
}

export function buildRequirements(input: PlanInput, events: ProjectEvent[]): Requirement[] {
  const eventsFor = (serviceId: string) => {
    const matching = events.filter((e) => EVENT_TYPE_BY_ID[e.type]?.suggestedServices.includes(serviceId));
    return (matching.length ? matching : events.slice(0, 1)).map((e) => e.id);
  };
  const allocation =
    input.budgetMode === 'overall' && input.budgetTotal ? allocateBudget(input.budgetTotal, input.services, input.guests, events.length) : undefined;
  return input.services.map((serviceId) => {
    const eventIds = eventsFor(serviceId);
    const explicit = input.serviceBudgets[serviceId];
    const [budgetMin, budgetMax] = explicit ?? (allocation ? perUnitBudget(serviceId, allocation[serviceId], input.guests, eventIds.length) : [undefined, undefined]);
    return {
      id: uid('rq'),
      serviceId,
      eventIds,
      details: defaultDetails(serviceId),
      styles: input.styles[serviceId] ?? [],
      budgetMin,
      budgetMax,
      status: 'OPEN',
      priority: findService(serviceId)?.core ? 'high' : 'medium',
      candidates: [],
    };
  });
}

interface TaskTemplate {
  title: string;
  /** Days before the main event (negative = after). */
  daysBefore: number;
  category: string;
  assignee: TaskAssignee;
  service?: string;
  priority?: ProjectTask['priority'];
}

const TASK_TEMPLATES: TaskTemplate[] = [
  { title: 'Confirm the auspicious date (sait) with your pandit', daysBefore: 300, category: 'Rituals', assignee: 'family', priority: 'high' },
  { title: 'Agree the overall budget with both families', daysBefore: 290, category: 'Budget', assignee: 'customer', priority: 'high' },
  { title: 'Draft the guest list (bride & groom side)', daysBefore: 270, category: 'Guests', assignee: 'customer' },
  { title: 'Visit and book the venue / party palace', daysBefore: 240, category: 'Venue', assignee: 'coordinator', service: 'venue', priority: 'high' },
  { title: 'Shortlist and book photography', daysBefore: 210, category: 'Photo & video', assignee: 'coordinator', service: 'photography', priority: 'high' },
  { title: 'Book videography & drone', daysBefore: 205, category: 'Photo & video', assignee: 'coordinator', service: 'videography' },
  { title: 'Choose caterer and draft the menu', daysBefore: 180, category: 'Food', assignee: 'coordinator', service: 'catering', priority: 'high' },
  { title: 'Approve decoration theme & mood board', daysBefore: 150, category: 'Decor', assignee: 'customer', service: 'decoration' },
  { title: 'Book makeup artist', daysBefore: 130, category: 'Beauty', assignee: 'customer', service: 'makeup' },
  { title: 'Shop bridal saree / lehenga', daysBefore: 120, category: 'Fashion', assignee: 'customer', service: 'bridal-wear' },
  { title: 'Daura Suruwal / sherwani fitting', daysBefore: 90, category: 'Fashion', assignee: 'partner', service: 'groom-wear' },
  { title: 'Plan the pre-wedding shoot location', daysBefore: 90, category: 'Photo & video', assignee: 'customer', service: 'pre-wedding' },
  { title: 'Approve invitation card design', daysBefore: 75, category: 'Invitations', assignee: 'customer', service: 'invitation' },
  { title: 'Book Panche Baja for the janti', daysBefore: 70, category: 'Music', assignee: 'coordinator', service: 'panche-baja' },
  { title: 'Book DJ and share must-play list', daysBefore: 60, category: 'Music', assignee: 'customer', service: 'dj' },
  { title: 'Send invitations & e-invites', daysBefore: 45, category: 'Invitations', assignee: 'customer', priority: 'high' },
  { title: 'Arrange janti transport & wedding car', daysBefore: 40, category: 'Logistics', assignee: 'coordinator', service: 'transport' },
  { title: 'Menu tasting with the caterer', daysBefore: 30, category: 'Food', assignee: 'customer', service: 'catering' },
  { title: 'Makeup & hair trial', daysBefore: 30, category: 'Beauty', assignee: 'customer', service: 'makeup' },
  { title: 'Book mehendi artist', daysBefore: 30, category: 'Beauty', assignee: 'customer', service: 'mehendi' },
  { title: 'Chase RSVPs and finalise guest count', daysBefore: 15, category: 'Guests', assignee: 'customer', priority: 'high' },
  { title: 'Give final guest count to caterer & venue', daysBefore: 10, category: 'Food', assignee: 'coordinator', priority: 'high' },
  { title: 'Final coordination meeting with all vendors', daysBefore: 7, category: 'Coordination', assignee: 'coordinator', priority: 'high' },
  { title: 'Prepare puja samagri list with pandit', daysBefore: 7, category: 'Rituals', assignee: 'family', service: 'pandit' },
  { title: 'Seating plan for VIP and family tables', daysBefore: 5, category: 'Guests', assignee: 'customer' },
  { title: 'Pack the wedding-day emergency kit', daysBefore: 2, category: 'Coordination', assignee: 'customer' },
  { title: 'Send thank-you messages to guests', daysBefore: -7, category: 'Guests', assignee: 'customer' },
  { title: 'Review your vendors', daysBefore: -10, category: 'Reviews', assignee: 'customer' },
];

/**
 * Checklist for every other celebration (pasni, bratabandha, birthday,
 * anniversary, corporate…): shorter lead times and no bride, groom or janti.
 */
const CELEBRATION_TEMPLATES: TaskTemplate[] = [
  { title: 'Fix the date and time (sait) with your pandit', daysBefore: 60, category: 'Rituals', assignee: 'family', service: 'pandit', priority: 'high' },
  { title: 'Agree the budget with the family', daysBefore: 55, category: 'Budget', assignee: 'customer', priority: 'high' },
  { title: 'Draft the guest list', daysBefore: 50, category: 'Guests', assignee: 'customer' },
  { title: 'Visit and book the venue', daysBefore: 45, category: 'Venue', assignee: 'coordinator', service: 'venue', priority: 'high' },
  { title: 'Book the photographer', daysBefore: 40, category: 'Photo & video', assignee: 'coordinator', service: 'photography', priority: 'high' },
  { title: 'Book videography', daysBefore: 38, category: 'Photo & video', assignee: 'coordinator', service: 'videography' },
  { title: 'Choose the caterer and the menu', daysBefore: 35, category: 'Food', assignee: 'coordinator', service: 'catering', priority: 'high' },
  { title: 'Approve the decoration', daysBefore: 25, category: 'Decor', assignee: 'customer', service: 'decoration' },
  { title: 'Book Panche Baja', daysBefore: 25, category: 'Music', assignee: 'coordinator', service: 'panche-baja' },
  { title: 'Book the DJ or music', daysBefore: 25, category: 'Music', assignee: 'customer', service: 'dj' },
  { title: 'Approve the invitation card', daysBefore: 25, category: 'Invitations', assignee: 'customer', service: 'invitation' },
  { title: 'Send invitations and e-invites', daysBefore: 20, category: 'Invitations', assignee: 'customer', priority: 'high' },
  { title: 'Book vehicles for family and guests', daysBefore: 15, category: 'Logistics', assignee: 'coordinator', service: 'bus-hire' },
  { title: 'Order the cake', daysBefore: 12, category: 'Food', assignee: 'customer', service: 'cake' },
  { title: 'Confirm the guest count with the caterer', daysBefore: 7, category: 'Food', assignee: 'coordinator', priority: 'high' },
  { title: 'Prepare the puja samagri list with the pandit', daysBefore: 7, category: 'Rituals', assignee: 'family', service: 'pandit' },
  { title: 'Final check with every vendor', daysBefore: 3, category: 'Coordination', assignee: 'coordinator', priority: 'high' },
  { title: 'Send thank-you messages to guests', daysBefore: -3, category: 'Guests', assignee: 'customer' },
  { title: 'Review your vendors', daysBefore: -7, category: 'Reviews', assignee: 'customer' },
];

/** Extra tasks for one occasion, on top of the celebration checklist. */
const OCCASION_TASKS: Record<string, TaskTemplate[]> = {
  newborn: [
    { title: 'Buy the baby’s pasni outfit and silver bowl and spoon', daysBefore: 14, category: 'Rituals', assignee: 'family' },
    { title: 'Plan the first-rice menu (kheer and the pasni thal)', daysBefore: 10, category: 'Food', assignee: 'family' },
    { title: 'Set out the objects for the baby’s choosing ritual', daysBefore: 1, category: 'Rituals', assignee: 'family' },
    { title: 'Save photos and gifts in the keepsake box', daysBefore: -5, category: 'Keepsakes', assignee: 'customer' },
  ],
  bratabandha: [
    { title: 'Arrange the daura suruwal, topi and saffron robes', daysBefore: 21, category: 'Rituals', assignee: 'family' },
    { title: 'Book the barber for the ritual shave', daysBefore: 14, category: 'Rituals', assignee: 'family' },
  ],
  baby_shower: [
    { title: 'Plan the games and the gift table', daysBefore: 14, category: 'Activities', assignee: 'customer' },
  ],
  birthday: [
    { title: 'Plan the games and activities', daysBefore: 14, category: 'Activities', assignee: 'customer' },
    { title: 'Order the return gifts', daysBefore: 10, category: 'Gifts', assignee: 'customer' },
  ],
  anniversary: [
    { title: 'Plan the surprise and who is in on it', daysBefore: 21, category: 'Surprise', assignee: 'customer' },
  ],
  corporate: [
    { title: 'Share the agenda with speakers and hosts', daysBefore: 14, category: 'Agenda', assignee: 'customer', priority: 'high' },
    { title: 'Check sound, screen and power at the venue', daysBefore: 3, category: 'Coordination', assignee: 'coordinator' },
  ],
};

/** Occasions planned with the full wedding checklist. */
const WEDDING_LIKE = new Set(['wedding', 'engagement']);

/** Titles that only make sense for a wedding; older non-wedding plans drop them (store migrate v5). */
export const WEDDING_ONLY_TASKS = new Set(TASK_TEMPLATES.map((t) => t.title).filter((title) => !CELEBRATION_TEMPLATES.some((c) => c.title === title)));

/** Personalised checklist for the occasion; overdue templates are compressed into the remaining time. */
export function generateTasks(mainDate: string, services: string[], customerName: string, coordinatorName = 'Your coordinator', occasion = 'wedding'): ProjectTask[] {
  const lead = Math.max(0, daysUntil(mainDate));
  const now = today();
  const wedding = WEDDING_LIKE.has(occasion);
  const templates = wedding ? TASK_TEMPLATES : [...CELEBRATION_TEMPLATES, ...(OCCASION_TASKS[occasion] ?? [])].sort((a, b) => b.daysBefore - a.daysBefore);
  const horizon = wedding ? 300 : 60;
  return templates.filter((t) => !t.service || services.includes(t.service)).map((t) => {
    let due = shift(mainDate, -t.daysBefore);
    if (due < now && t.daysBefore > 0) {
      // Not enough runway: spread these across the time left.
      due = shift(now, Math.max(1, Math.round(lead * (1 - t.daysBefore / horizon) * 0.5)));
    }
    return {
      id: uid('tk'),
      title: t.title,
      assigneeKind: t.assignee,
      assigneeName: t.assignee === 'coordinator' ? coordinatorName : t.assignee === 'customer' ? customerName : t.assignee === 'partner' ? 'Partner' : 'Family',
      due,
      status: 'TODO',
      priority: t.priority ?? 'medium',
      category: t.category,
      visibility: 'shared',
      createdAt: new Date().toISOString(),
    };
  });
}

/** Checklist tasks for the project's date and requested services that aren't on its list yet (the "Suggest tasks" sheet). */
export function suggestedTasks(project: Project): ProjectTask[] {
  const services = project.requirements.filter((r) => r.status !== 'CANCELLED').map((r) => r.serviceId);
  return generateTasks(project.weddingDate, services, project.customerName, project.coordinatorName, project.occasion ?? 'wedding').filter((t) => !project.tasks.some((x) => x.title === t.title));
}

/**
 * Open remaining-days guide items, including earlier preparation, not on the
 * wedding's task list yet. Earlier due dates become today. Items already ticked in the guide (`ticked`,
 * checklist ids) are left out. Weddings and engagements only.
 */
export function guideSuggestions(project: Project, ticked: string[] = []): ProjectTask[] {
  if (!WEDDING_LIKE.has(project.occasion ?? 'wedding')) return [];
  const have = new Set([...project.tasks, ...suggestedTasks(project)].map((t) => t.title.toLowerCase()));
  const now = today();
  return CHECKLIST.filter((t) => !ticked.includes(t.id) && !have.has(t.title.toLowerCase())).map((t) => {
    const due = shift(project.weddingDate, -PHASE_DUE[t.phase]);
    return {
      id: uid('tk'),
      title: t.title,
      assigneeKind: 'customer',
      assigneeName: project.customerName,
      assigneeId: project.customerId,
      due: due < now ? now : due,
      status: 'TODO',
      priority: 'medium',
      category: t.category,
      visibility: 'shared',
      createdAt: new Date().toISOString(),
    };
  });
}

/**
 * Customer-facing timeline built from live project data plus any manual
 * entries (meetings, milestones) stored on the project.
 */
export function buildTimeline(project: Project, opts: { internal?: boolean } = {}): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  const created = project.createdAt.slice(0, 10);
  out.push({ id: `tl-created`, date: created, title: 'Requirement submitted', kind: 'milestone', done: true });
  const confirmed = project.statusHistory.find((s) => s.status === 'CONFIRMED');
  if (confirmed) out.push({ id: 'tl-confirmed', date: confirmed.at.slice(0, 10), title: 'Wedding confirmed', kind: 'milestone', done: true });
  for (const b of project.bookings) {
    if (b.confirmedAt) out.push({ id: `tl-b-${b.id}`, date: b.confirmedAt.slice(0, 10), title: `${serviceName(b.serviceId)} confirmed — ${b.providerName}`, kind: 'booking', done: true, refId: b.id });
    for (const d of b.deliverables) {
      out.push({ id: `tl-d-${d.id}`, date: d.due, title: d.title, kind: 'delivery', done: d.status === 'DELIVERED' || d.status === 'APPROVED', refId: d.id });
    }
  }
  for (const m of project.milestones) {
    out.push({ id: `tl-m-${m.id}`, date: m.due, title: `${m.label} — ${formatMoneyCompact(m.amount)}`, kind: 'payment', done: milestoneStatus(m) === 'PAID', refId: m.id });
  }
  for (const e of project.events) {
    if (e.date) out.push({ id: `tl-e-${e.id}`, date: e.date, title: e.name, kind: 'event', done: e.status === 'done', refId: e.id });
  }
  for (const t of project.timeline) if (opts.internal || !t.internal) out.push(t);
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// Guidance
export interface NextAction {
  title: string;
  body: string;
  href: string;
  icon: string;
  /** My Wedding tab the action lives on; that screen switches tab in place instead of opening `href`. */
  tab?: 'payments' | 'services' | 'tasks';
  /** The milestone or task to open on that tab. */
  focus?: string;
}

export function nextBestAction(project: Project, quotes: Quotation[]): NextAction {
  const pendingQuote = quotes.find((q) => q.projectId === project.id && (q.status === 'sent' || q.status === 'viewed'));
  if (pendingQuote) return { title: 'Review your quotation', body: `${pendingQuote.number} from ${pendingQuote.fromName} is waiting for you.`, href: `/quote/${pendingQuote.id}`, icon: 'document-text' };
  const { next } = paymentSummary(project);
  if (next && milestoneStatus(next) !== 'UPCOMING') return { title: `Pay ${formatMoney(next.amount - next.paidAmount)}`, body: `${next.label} is due ${formatShortDate(next.due)}.`, href: `/my-wedding?tab=payments&focus=${next.id}`, icon: 'card', tab: 'payments', focus: next.id };
  const review = project.bookings.flatMap((b) => b.deliverables.map((d) => ({ b, d }))).find(({ d }) => d.status === 'READY_FOR_REVIEW');
  if (review) return { title: `Review ${review.d.title}`, body: `${review.b.providerName} marked it ready.`, href: '/my-wedding?tab=services', icon: 'eye', tab: 'services' };
  const task = project.tasks
    .filter((t) => t.visibility === 'shared' && (t.assigneeKind === 'customer' || t.assigneeKind === 'partner') && t.status !== 'COMPLETED' && t.status !== 'CANCELLED')
    .sort((a, b) => a.due.localeCompare(b.due))[0];
  if (task) return { title: task.title, body: `Due ${formatShortDate(task.due)}`, href: `/my-wedding?tab=tasks&focus=${task.id}`, icon: 'checkbox', tab: 'tasks', focus: task.id };
  return { title: 'Invite your guests', body: 'Build your guest list and send e-invites.', href: '/guests', icon: 'people' };
}

/** Services couples usually need for their functions but haven't requested. */
export function missingServices(project: Project): string[] {
  const requested = new Set(project.requirements.map((r) => r.serviceId));
  const suggested = new Set(project.events.flatMap((e) => EVENT_TYPE_BY_ID[e.type]?.suggestedServices ?? []));
  return [...suggested].filter((s) => !requested.has(s));
}

export function planningProgress(project: Project) {
  const reqs = project.requirements.filter((r) => r.status !== 'CANCELLED');
  const confirmed = reqs.filter((r) => r.status === 'CONFIRMED').length;
  const tasks = project.tasks.filter((t) => t.visibility === 'shared' && t.status !== 'CANCELLED');
  const doneTasks = tasks.filter((t) => t.status === 'COMPLETED').length;
  const pay = paymentSummary(project);
  const services = reqs.length ? confirmed / reqs.length : 0;
  const taskShare = tasks.length ? doneTasks / tasks.length : 0;
  const paid = pay.total ? pay.paid / pay.total : 0;
  return { services: { confirmed, total: reqs.length }, tasks: { done: doneTasks, total: tasks.length }, pay, overall: services * 0.5 + taskShare * 0.3 + paid * 0.2 };
}

export function savingTips(project: Project): string[] {
  const tips: string[] = [];
  if (isPeakSeason(project.weddingDate)) tips.push('Your date is in peak season (Mangsir/Magh/Falgun/Baisakh). Weekday functions can be 15–25% cheaper.');
  if (project.guests > 500) tips.push(`Every 50 fewer guests saves roughly ${formatMoneyCompact(50 * 1400)} on catering.`);
  if (project.requirements.some((r) => r.serviceId === 'photography') && project.requirements.some((r) => r.serviceId === 'videography'))
    tips.push('Booking photo + video with one studio usually unlocks a 10% bundle discount.');
  if (project.requirements.some((r) => r.serviceId === 'decoration')) tips.push('Reuse the wedding mandap decor for the reception stage to save on a second setup.');
  tips.push('Ask for the platform package price — bundling 5+ services earns a package discount.');
  return tips;
}

// Text generation
export function invitationText(project: Project, tone: 'traditional' | 'modern' | 'nepali' = 'traditional'): string {
  const names = project.partnerName ? `${project.customerName.split(' ')[0]} & ${project.partnerName.split(' ')[0]}` : project.title;
  const main = project.events.find((e) => e.type === project.eventType) ?? project.events[0];
  const when = main?.date ? formatShortDate(main.date) : 'soon';
  const where = main?.venue && main.venue !== 'To be decided' ? main.venue : project.city;
  if (tone === 'nepali')
    return `शुभ विवाह\n\nहाम्रो परिवारको खुसीमा सहभागी भई ${names} को शुभ विवाहमा आशीर्वाद दिन हार्दिक निमन्त्रणा गर्दछौं।\n\nमिति: ${when}\nस्थान: ${where}`;
  if (tone === 'modern') return `We're getting married! 💍\n\n${names} would love for you to celebrate with us on ${when} at ${where}.\n\nRSVP on our wedding website — see you there!`;
  return `With the blessings of our elders, we cordially invite you and your family to the auspicious wedding ceremony of\n\n${names}\n\non ${when} at ${where}.\n\nYour presence and blessings will make the occasion complete.`;
}

export function enquiryText(project: Project, serviceId: string): string {
  const req = project.requirements.find((r) => r.serviceId === serviceId);
  const dates = project.events.filter((e) => !req || req.eventIds.includes(e.id)).map((e) => `${e.name} ${e.date ? formatShortDate(e.date) : '(date TBC)'}`);
  const budget = req?.budgetMax ? ` Our budget is around ${formatMoney(req.budgetMax)}${findService(serviceId)?.unit === 'per plate' ? ' per plate' : ''}.` : '';
  return `Namaste! We're planning our ${project.eventType === 'WEDDING' ? 'wedding' : 'event'} in ${project.city} for about ${project.guests} guests (${dates.join(', ')}). We're looking for ${serviceName(serviceId).toLowerCase()}${req?.styles.length ? ` in a ${req.styles.join('/').toLowerCase()} style` : ''}.${budget} Could you share availability, packages and what's included? Thank you!`;
}

export const QUESTIONS_TO_ASK: Record<string, string[]> = {
  venue: ['Is the date free for all our functions?', 'What is included in the rental (chairs, stage, generator)?', 'Can we bring outside caterers/decorators?', 'Parking capacity for the janti?', 'Cancellation and date-change policy?'],
  catering: ['Minimum plate guarantee?', 'Can we do a tasting?', 'Is service staff included per 50 guests?', 'Are VAT and service charge included?', 'How do you handle leftovers?'],
  photography: ['Who exactly will shoot our wedding?', 'How many edited photos and by when?', 'Is the album included? How many sheets?', 'Do you shoot all rituals (tilak to bidai)?', 'Extra charge for travel or overtime?'],
  videography: ['Highlight film length and delivery time?', 'Do you use drones? Permits handled?', 'Will we get raw footage?', 'How many revisions to the film?'],
  decoration: ['Can we see a 3D/mood board before booking?', 'Fresh or artificial flowers?', 'Setup and teardown times?', 'Is lighting included?'],
  makeup: ['Is a trial included?', 'Which brands do you use?', 'How long does the bridal look take?', 'Do you travel to the venue?'],
};

export const questionsToAsk = (serviceId: string) =>
  QUESTIONS_TO_ASK[serviceId] ?? ['What is included in your packages?', 'Are you available on our dates?', 'What are the payment terms?', 'What is your cancellation policy?'];

export function negotiationPoints(quote: Quotation, marketMedian?: number): string[] {
  const pts: string[] = [];
  const total = quote.items.reduce((s, i) => s + i.qty * i.rate, 0);
  if (marketMedian && total > marketMedian * 1.1) pts.push(`This is ~${Math.round(((total - marketMedian) / marketMedian) * 100)}% above similar bookings — ask for a closer price.`);
  if (!quote.discount) pts.push('No discount applied yet — ask for a package or early-booking discount.');
  if (quote.items.length >= 3) pts.push('Ask to bundle the add-ons into one package price.');
  pts.push('Request a softer payment schedule (e.g. 25% advance instead of 30%).');
  pts.push('Ask what happens if the date moves — can the advance carry over?');
  return pts;
}

export function summarizeReviews(reviews: { rating: number; text: string }[]): { average: number; highlights: string[]; concerns: string[] } {
  if (!reviews.length) return { average: 0, highlights: [], concerns: [] };
  const average = Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10;
  const text = reviews.map((r) => r.text.toLowerCase()).join(' ');
  const has = (words: string[]) => words.some((w) => text.includes(w));
  const highlights = [
    has(['professional']) && 'Professional team',
    has(['punctual', 'on time']) && 'Punctual',
    has(['food', 'bhoj', 'menu']) && 'Food is praised',
    has(['value']) && 'Good value for money',
    has(['beautiful', 'stunning', 'magical', 'gorgeous']) && 'Beautiful results',
    has(['flexible', 'last-minute']) && 'Flexible with changes',
  ].filter(Boolean) as string[];
  const concerns = [has(['delay', 'late']) && 'Occasional delays', has(['parking', 'tight']) && 'Parking can be tight'].filter(Boolean) as string[];
  return { average, highlights, concerns };
}

export const guestBandLabel = (guests: number) => bandFor(guests);
