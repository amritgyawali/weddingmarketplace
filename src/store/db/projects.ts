/**
 * Wedding-project workflow: requirement intake, matching, provider bookings,
 * crew assignments, emergency replacement, deliverables, tasks and events.
 */
import { contractSections } from '@/data/seed';
import { EVENT_TYPE_BY_ID } from '@/data/events';
import { findProvider } from '@/data/providers';
import { crewPlanFor, findService, serviceName } from '@/data/services';
import { rankFreelancers, rankProviders, type RankedProvider, toCandidate } from '@/services/matching';
import { buildEvents, buildRequirements, generateTasks, type PlanInput, runSheetFor } from '@/services/planner';
import { freelancerNet, payablesForBooking, splitBooking } from '@/services/pricing';
import { useSession } from '@/store/useSession';
import type {
  Account,
  Assignment,
  AssignmentStatus,
  Collaborator,
  Deliverable,
  EventStatus,
  Gig,
  Incident,
  MatchCandidate,
  PricingModel,
  Project,
  ProjectEvent,
  ProjectStatus,
  ProjectTask,
  Requirement,
  RunItem,
  RunStatus,
  ServiceBooking,
  TaskStatus,
  TimelineEntry,
} from '@/types/platform';
import { addDays, daysUntil, formatMoney, formatShortDate, shortCode, uid } from '@/utils/format';

import { accountById, bookingDates, currentActor, type GetDb, mapBooking, mapProject, now, ownersOf, type SetDb, SYSTEM, today } from './helpers';

export interface ProjectActions {
  submitPlan: (customer: Account, input: PlanInput) => Project;
  ensureCustomerProject: (customer: Account, details?: { weddingDate?: string | null; city?: string; managedBy?: Project['managedBy']; geniePackageId?: string }) => Project;
  updateProject: (id: string, update: (p: Project) => Project) => void;
  patchProject: (id: string, patch: Partial<Project>) => void;
  setProjectStatus: (id: string, status: ProjectStatus, note?: string) => void;
  assignCoordinator: (id: string, coordinator: { id: string; name: string }) => void;

  addEvent: (projectId: string, event: Pick<ProjectEvent, 'type' | 'date' | 'venue' | 'guests'> & Partial<ProjectEvent>) => void;
  updateEvent: (projectId: string, eventId: string, patch: Partial<ProjectEvent>) => void;
  removeEvent: (projectId: string, eventId: string) => void;
  setEventStatus: (projectId: string, eventId: string, status: EventStatus) => void;
  setRunStatus: (projectId: string, eventId: string, itemId: string, status: RunStatus) => void;
  addRunItem: (projectId: string, eventId: string, item: Omit<RunItem, 'id' | 'status'>) => void;
  reportIncident: (projectId: string, incident: Omit<Incident, 'id' | 'at' | 'status'>) => void;
  resolveIncident: (projectId: string, incidentId: string) => void;

  addRequirement: (projectId: string, serviceId: string, eventIds?: string[]) => void;
  updateRequirement: (projectId: string, reqId: string, patch: Partial<Requirement>) => void;
  removeRequirement: (projectId: string, reqId: string) => void;
  runMatching: (projectId: string, reqId: string) => RankedProvider[];
  setCandidateStatus: (projectId: string, reqId: string, providerId: string, status: MatchCandidate['status'], note?: string) => void;

  proposeBooking: (projectId: string, reqId: string, providerId: string, opts?: { price?: number; model?: PricingModel; rate?: number; hold?: boolean; packageName?: string }) => ServiceBooking | null;
  respondToBooking: (projectId: string, bookingId: string, accept: boolean, note?: string) => void;
  confirmBooking: (projectId: string, bookingId: string) => void;
  cancelBooking: (projectId: string, bookingId: string, reason: string) => void;
  updateBooking: (projectId: string, bookingId: string, patch: Partial<ServiceBooking>) => void;

  setCrew: (projectId: string, bookingId: string, crew: ServiceBooking['crew']) => void;
  assignWorker: (
    projectId: string,
    bookingId: string,
    crewId: string | undefined,
    worker: { id: string; name: string; kind?: 'freelancer' | 'staff' },
    opts?: { role?: string; pay?: number; eventId?: string; date?: string; startTime?: string; endTime?: string; gigId?: string; replacesId?: string; status?: AssignmentStatus },
  ) => Assignment | null;
  setAssignmentStatus: (projectId: string, bookingId: string, assignmentId: string, status: AssignmentStatus) => void;
  checkInAssignment: (projectId: string, bookingId: string, assignmentId: string, info?: { coords?: { lat: number; lng: number }; note?: string }) => void;
  checkOutAssignment: (projectId: string, bookingId: string, assignmentId: string, proofNote?: string) => void;
  confirmAssignmentWork: (projectId: string, bookingId: string, assignmentId: string) => void;
  startEmergencyReplacement: (projectId: string, bookingId: string, assignmentId: string, reason: string, pay?: number) => Gig | null;

  addDeliverable: (projectId: string, bookingId: string, d: Pick<Deliverable, 'title' | 'kind' | 'due'> & Partial<Deliverable>) => void;
  updateDeliverable: (projectId: string, bookingId: string, deliverableId: string, patch: Partial<Deliverable>, note?: string) => void;

  addTask: (projectId: string, task: Omit<ProjectTask, 'id' | 'createdAt'>) => void;
  updateTask: (projectId: string, taskId: string, patch: Partial<ProjectTask>) => void;
  setTaskStatus: (projectId: string, taskId: string, status: TaskStatus) => void;
  removeTask: (projectId: string, taskId: string) => void;
  regenerateChecklist: (projectId: string) => void;

  addTimelineEntry: (projectId: string, entry: Omit<TimelineEntry, 'id' | 'done'> & { done?: boolean }) => void;
  toggleTimelineEntry: (projectId: string, id: string) => void;

  inviteCollaborator: (projectId: string, c: Pick<Collaborator, 'name' | 'relation' | 'permission'> & { phone?: string }) => Collaborator;
  joinWithCode: (code: string, account: Account) => Project | null;
  removeCollaborator: (projectId: string, id: string) => void;
}

const ACTIVE_BOOKING = ['PROPOSED', 'HELD', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'];

/** Creates booking side effects once confirmed: requirement, deliverables, payables, revenue, calendar, contract. */
function activateBooking(set: SetDb, get: GetDb, projectId: string, bookingId: string) {
  const project = get().projects.find((p) => p.id === projectId);
  const b = project?.bookings.find((x) => x.id === bookingId);
  if (!project || !b || b.status === 'CANCELLED') return;
  const dates = bookingDates(project, b);
  const main = dates[0] ?? project.weddingDate;
  const def = findService(b.serviceId);
  const deliverables: Deliverable[] = b.deliverables.length
    ? b.deliverables
    : (def?.deliverables ?? []).map((d) => ({
        id: uid('dl'),
        title: d.title,
        kind: d.kind,
        quantity: d.qty,
        unit: d.unit,
        due: addDays(main, d.dueDays),
        status: 'NOT_STARTED',
        progress: 0,
        revisions: 0,
        revisionLimit: 2,
        history: [],
      }));
  const crew = b.crew.length
    ? b.crew
    : crewPlanFor(b.serviceId, project.requirements.find((r) => r.id === b.requirementId)?.details).map((c) => ({ id: uid('cr'), role: c.role, count: c.count, eventId: b.eventIds[0], pay: c.pay, equipment: c.equipment, staffing: 'in_house' as const }));
  const confirmed: ServiceBooking = { ...b, status: 'CONFIRMED', confirmedAt: b.confirmedAt ?? now(), providerResponse: b.providerResponse === 'declined' ? 'declined' : 'accepted', deliverables, crew };
  const contractId = uid('ct');
  set((s) => ({
    projects: mapProject(s.projects, projectId, (p) => ({
      ...mapBooking(p, bookingId, () => ({ ...confirmed, contractId: b.contractId ?? contractId })),
      requirements: p.requirements.map((r) => (r.id === b.requirementId ? { ...r, status: 'CONFIRMED', candidates: r.candidates.map((c) => (c.providerId === b.providerId ? { ...c, status: 'selected' } : c)) } : r)),
    })),
    payables: s.payables.some((x) => x.bookingId === bookingId) ? s.payables : [...s.payables, ...payablesForBooking(confirmed, project)],
    revenue: s.revenue.some((x) => x.bookingId === bookingId)
      ? s.revenue
      : [{ id: uid('rev'), kind: b.pricingModel === 'MARKUP' ? 'MARKUP' : b.pricingModel === 'LEAD_FEE' ? 'LEAD_FEE' : 'COMMISSION', amount: b.platformFee, projectId, bookingId, providerId: b.providerId, at: now() }, ...s.revenue],
    availability: [
      ...s.availability.filter((a) => !(a.refId === bookingId)),
      ...dates.map((date) => ({ id: uid('av'), ownerKind: 'provider' as const, ownerId: b.providerId, date, part: 'full' as const, status: 'BOOKED' as const, source: 'booking' as const, refId: bookingId })),
    ],
    contracts: b.contractId
      ? s.contracts
      : [
          {
            id: contractId,
            projectId,
            bookingId,
            quoteId: b.quoteId,
            number: `CT-${new Date().getFullYear()}-${String(s.contracts.length + 101).padStart(4, '0')}`,
            title: `${serviceName(b.serviceId)} agreement — ${b.providerName}`,
            version: 1,
            parties: { customer: project.customerName, provider: b.providerName, platform: 'Vivah Weddings Pvt. Ltd.' },
            sections: contractSections(b.providerName, `${serviceName(b.serviceId)} for ${dates.map((d) => formatShortDate(d)).join(', ') || 'the booked events'}${b.packageName ? ` (${b.packageName} package)` : ''}.`, b.agreedPrice),
            status: 'sent',
            signatures: [],
            createdAt: now(),
          },
          ...s.contracts,
        ],
  }));
  const to = b.providerAccountId ?? ownersOf(b.providerId)[0]?.id;
  if (to) get().notify(to, `Booking confirmed: ${project.title}`, `${serviceName(b.serviceId)} · ${formatMoney(b.providerPayable)} payable to you`, `/business/booking/${bookingId}`, 'booking');
  get().log(currentActor(), 'booking.confirm', 'booking', bookingId, `${b.providerName} for ${project.code}`);
}

export const projectActions = (set: SetDb, get: GetDb): ProjectActions => ({
  // ── Intake ───────────────────────────────────────────────────────────
  submitPlan: (customer, input) => {
    const events = buildEvents(input);
    const requirements = buildRequirements(input, events);
    const main = events[0];
    const weddingDate = main?.date ?? addDays(today(), 120);
    const settings = get().settings;
    const coordinator = settings.autoAssignCoordinator ? useSession.getState().accounts.find((a) => a.role === 'platform' && a.staffRole === 'coordinator') : undefined;
    const code = `WP-${1000 + get().projects.length + 31}`;
    const title = input.partnerName
      ? `${customer.name.split(' ')[0]} & ${input.partnerName.split(' ')[0]}`
      : `${customer.name.split(' ')[0]}'s ${EVENT_TYPE_BY_ID[main?.type ?? 'WEDDING'].label.replace(/ \(.*\)$/, '')}`;
    const project: Project = {
      id: uid('prj'),
      code,
      title,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      partnerName: input.partnerName,
      eventType: main?.type ?? 'WEDDING',
      city: input.city,
      area: input.area,
      venueSelected: input.venueSelected,
      weddingDate,
      guests: input.guests,
      budget: input.budgetTotal ?? 0,
      budgetMode: input.budgetMode,
      status: coordinator ? 'REVIEWING' : 'NEW',
      statusHistory: [{ status: 'NEW', at: now(), by: customer.name }, ...(coordinator ? [{ status: 'REVIEWING' as const, at: now(), by: 'Auto-assignment', note: `Assigned to ${coordinator.name}` }] : [])],
      source: 'plan_wizard',
      managedBy: 'platform',
      coordinatorId: coordinator?.id,
      coordinatorName: coordinator?.name,
      styles: input.styles,
      priorities: [],
      notes: input.notes,
      inspiration: input.inspiration,
      events,
      requirements,
      bookings: [],
      tasks: generateTasks(weddingDate, input.services, customer.name, coordinator?.name ?? 'Your coordinator'),
      timeline: [],
      milestones: [],
      incidents: [],
      collaborators: input.partnerName ? [{ id: uid('col'), name: input.partnerName, relation: 'Partner', permission: 'editor', inviteCode: shortCode() }] : [],
      driveFolder: `Wedding Projects/${code}-${title.replace(/\W+/g, '-')}`,
      createdAt: now(),
      updatedAt: now(),
    };
    set((s) => ({ projects: [project, ...s.projects] }));
    get().openThread({
      kind: 'project',
      projectId: project.id,
      title: `${project.title} · Wedding team`,
      members: [{ id: customer.id, name: customer.name, role: 'customer' }, ...(coordinator ? [{ id: coordinator.id, name: coordinator.name, role: 'platform' as const }] : [])],
    });
    if (coordinator) {
      const thread = get().threads.find((t) => t.projectId === project.id && t.kind === 'project');
      if (thread)
        get().sendMessage(thread.id, { id: coordinator.id, name: coordinator.name, role: 'platform' }, `Namaste ${customer.name.split(' ')[0]}! I'm ${coordinator.name.split(' ')[0]}, your wedding coordinator. I've received your requirements for ${project.requirements.length} services and I'm shortlisting the best providers now. I'll call you within 2 hours 🙏`, 'text', undefined, { silent: true });
      get().notify(coordinator.id, `New wedding lead ${code}`, `${customer.name} · ${input.city} · ${input.guests} guests · ${requirements.length} services`, `/platform/project/${project.id}`, 'lead');
    }
    get().notify('platform', `New wedding lead ${code}`, `${customer.name} · ${input.city} · ${requirements.length} services`, `/platform/project/${project.id}`, 'lead');
    get().notify(customer.id, 'Requirement received 🎉', coordinator ? `${coordinator.name} is your coordinator and will reach out shortly.` : 'A coordinator will be assigned within the hour.', '/my-wedding', 'system');
    get().log({ id: customer.id, name: customer.name }, 'project.submit', 'project', project.id, `${requirements.length} services`);
    return project;
  },

  ensureCustomerProject: (customer, details = {}) => {
    const existing = get().projects.find((p) => p.customerId === customer.id && p.status !== 'CANCELLED' && p.status !== 'CLOSED');
    if (existing) {
      if (details.managedBy === 'platform' && existing.managedBy !== 'platform') {
        const coordinator = useSession.getState().accounts.find((a) => a.role === 'platform' && a.staffRole === 'coordinator');
        get().patchProject(existing.id, { managedBy: 'platform', coordinatorId: coordinator?.id, coordinatorName: coordinator?.name, geniePackageId: details.geniePackageId });
      }
      return get().projects.find((p) => p.id === existing.id)!;
    }
    const weddingDate = details.weddingDate ?? addDays(today(), 120);
    return get().submitPlan(customer, {
      eventTypes: ['WEDDING', 'RECEPTION'],
      city: details.city ?? customer.city,
      dates: { WEDDING: weddingDate, RECEPTION: addDays(weddingDate, 1) },
      guests: 300,
      services: [],
      budgetMode: 'undecided',
      serviceBudgets: {},
      styles: {},
      notes: '',
      inspiration: [],
    });
  },

  updateProject: (id, update) => set((s) => ({ projects: mapProject(s.projects, id, update) })),
  patchProject: (id, patch) => set((s) => ({ projects: mapProject(s.projects, id, (p) => ({ ...p, ...patch })) })),

  setProjectStatus: (id, status, note) => {
    const actor = currentActor();
    const project = get().projects.find((p) => p.id === id);
    if (!project || project.status === status) return;
    set((s) => ({ projects: mapProject(s.projects, id, (p) => ({ ...p, status, statusHistory: [...p.statusHistory, { status, at: now(), by: actor.name, note }] })) }));
    const labels: Partial<Record<ProjectStatus, string>> = {
      NEEDS_CLARIFICATION: 'Your coordinator needs a few more details',
      MATCHING_PROVIDERS: 'We’re matching the best providers for you',
      QUOTE_SENT: 'Your quotation is ready',
      CONFIRMED: 'Your wedding is confirmed 🎉',
      IN_PROGRESS: 'Your celebrations have begun!',
      COMPLETED: 'Congratulations! Your events are complete',
      CANCELLED: 'Your project was cancelled',
    };
    if (labels[status]) get().notify(project.customerId, labels[status]!, note ?? `${project.code} is now ${status.replace(/_/g, ' ').toLowerCase()}.`, '/my-wedding', 'system');
    get().log(actor, 'project.status', 'project', id, status);
  },

  assignCoordinator: (id, coordinator) => {
    const project = get().projects.find((p) => p.id === id);
    if (!project) return;
    set((s) => ({
      projects: mapProject(s.projects, id, (p) => ({
        ...p,
        coordinatorId: coordinator.id,
        coordinatorName: coordinator.name,
        status: p.status === 'NEW' ? 'REVIEWING' : p.status,
        statusHistory: p.status === 'NEW' ? [...p.statusHistory, { status: 'REVIEWING', at: now(), by: coordinator.name, note: 'Coordinator assigned' }] : p.statusHistory,
        tasks: p.tasks.map((t) => (t.assigneeKind === 'coordinator' ? { ...t, assigneeName: coordinator.name, assigneeId: coordinator.id } : t)),
      })),
      threads: s.threads.map((t) =>
        t.projectId === id && !t.members.some((m) => m.id === coordinator.id) ? { ...t, members: [...t.members, { id: coordinator.id, name: coordinator.name, role: 'platform' }] } : t,
      ),
    }));
    get().notify(project.customerId, `Meet your coordinator, ${coordinator.name.split(' ')[0]}`, 'They will manage every vendor for you — chat or call anytime from My Wedding.', '/my-wedding', 'system');
    get().notify(coordinator.id, `You now own ${project.code}`, project.title, `/platform/project/${id}`, 'lead');
    get().log(currentActor(), 'project.assign', 'project', id, coordinator.name);
  },

  // ── Events ───────────────────────────────────────────────────────────
  addEvent: (projectId, e) => {
    const def = EVENT_TYPE_BY_ID[e.type];
    const project = get().projects.find((p) => p.id === projectId);
    const event: ProjectEvent = {
      id: uid('ev'),
      name: def?.label.replace(/ \(.*\)$/, '') ?? e.type,
      dateConfirmed: !!e.date,
      startTime: def?.start ?? '11:00',
      city: project?.city ?? '',
      status: 'planned',
      private: false,
      runSheet: runSheetFor(e.type),
      ...e,
    };
    set((s) => ({ projects: mapProject(s.projects, projectId, (p) => ({ ...p, events: [...p.events, event].sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999')) })) }));
  },

  updateEvent: (projectId, eventId, patch) =>
    set((s) => ({
      projects: mapProject(s.projects, projectId, (p) => {
        const events = p.events.map((e) => (e.id === eventId ? { ...e, ...patch, dateConfirmed: patch.date !== undefined ? !!patch.date : e.dateConfirmed } : e));
        const main = events.find((e) => e.type === p.eventType && e.date) ?? events.find((e) => e.date);
        return { ...p, events, weddingDate: main?.date ?? p.weddingDate };
      }),
    })),

  removeEvent: (projectId, eventId) =>
    set((s) => ({
      projects: mapProject(s.projects, projectId, (p) => ({
        ...p,
        events: p.events.filter((e) => e.id !== eventId),
        requirements: p.requirements.map((r) => ({ ...r, eventIds: r.eventIds.filter((id) => id !== eventId) })),
      })),
    })),

  setEventStatus: (projectId, eventId, status) => {
    set((s) => ({
      projects: mapProject(s.projects, projectId, (p) => {
        const events = p.events.map((e) => (e.id === eventId ? { ...e, status } : e));
        const active = events.filter((e) => e.status !== 'cancelled');
        const allDone = active.length > 0 && active.every((e) => e.status === 'done');
        const anyLive = events.some((e) => e.status === 'live');
        const nextStatus: ProjectStatus = allDone ? 'COMPLETED' : anyLive && (p.status === 'CONFIRMED' || p.status === 'IN_PROGRESS') ? 'IN_PROGRESS' : p.status;
        const bookings = p.bookings.map((b) =>
          b.eventIds.includes(eventId) && b.status === 'CONFIRMED' && status === 'live' ? { ...b, status: 'IN_PROGRESS' as const } : allDone && (b.status === 'IN_PROGRESS' || b.status === 'CONFIRMED') ? { ...b, status: 'COMPLETED' as const } : b,
        );
        return {
          ...p,
          events,
          bookings,
          status: nextStatus,
          statusHistory: nextStatus !== p.status ? [...p.statusHistory, { status: nextStatus, at: now(), by: currentActor().name }] : p.statusHistory,
        };
      }),
    }));
    const project = get().projects.find((p) => p.id === projectId);
    const event = project?.events.find((e) => e.id === eventId);
    if (project && event && status === 'live') get().notify(project.customerId, `${event.name} is live 🎊`, 'Follow the run sheet in My Wedding.', '/my-wedding', 'event');
    if (project && project.status === 'COMPLETED') {
      get().notify(project.customerId, 'How did we do?', 'Rate your providers and your coordinator — it takes a minute.', '/my-wedding?tab=services', 'review');
    }
  },

  setRunStatus: (projectId, eventId, itemId, status) =>
    set((s) => ({
      projects: mapProject(s.projects, projectId, (p) => ({
        ...p,
        events: p.events.map((e) =>
          e.id === eventId ? { ...e, status: e.status === 'planned' && status !== 'pending' ? 'live' : e.status, runSheet: e.runSheet.map((r) => (r.id === itemId ? { ...r, status } : r)) } : e,
        ),
      })),
    })),

  addRunItem: (projectId, eventId, item) =>
    set((s) => ({
      projects: mapProject(s.projects, projectId, (p) => ({
        ...p,
        events: p.events.map((e) =>
          e.id === eventId ? { ...e, runSheet: [...e.runSheet, { ...item, id: uid('ri'), status: 'pending' as const }].sort((a, b) => a.time.localeCompare(b.time)) } : e,
        ),
      })),
    })),

  reportIncident: (projectId, incident) => {
    set((s) => ({ projects: mapProject(s.projects, projectId, (p) => ({ ...p, incidents: [{ ...incident, id: uid('inc'), at: now(), status: 'open' }, ...p.incidents] })) }));
    const project = get().projects.find((p) => p.id === projectId);
    get().notify('platform', `Incident at ${project?.code ?? 'a wedding'}`, incident.title, `/platform/project/${projectId}`, incident.severity === 'high' ? 'emergency' : 'event');
    if (project?.coordinatorId) get().notify(project.coordinatorId, `Incident at ${project.code}`, incident.title, `/platform/project/${projectId}`, 'event');
  },

  resolveIncident: (projectId, incidentId) =>
    set((s) => ({ projects: mapProject(s.projects, projectId, (p) => ({ ...p, incidents: p.incidents.map((i) => (i.id === incidentId ? { ...i, status: 'resolved' } : i)) })) })),

  // ── Requirements & matching ─────────────────────────────────────────
  addRequirement: (projectId, serviceId, eventIds) => {
    const project = get().projects.find((p) => p.id === projectId);
    if (!project || project.requirements.some((r) => r.serviceId === serviceId && r.status !== 'CANCELLED')) return;
    const def = findService(serviceId);
    const ids = eventIds ?? project.events.filter((e) => EVENT_TYPE_BY_ID[e.type]?.suggestedServices.includes(serviceId)).map((e) => e.id);
    const requirement: Requirement = {
      id: uid('rq'),
      serviceId,
      eventIds: ids.length ? ids : project.events.slice(0, 1).map((e) => e.id),
      details: Object.fromEntries((def?.fields ?? []).map((f) => [f.key, f.default])),
      styles: project.styles[serviceId] ?? [],
      status: 'OPEN',
      priority: def?.core ? 'high' : 'medium',
      candidates: [],
    };
    set((s) => ({ projects: mapProject(s.projects, projectId, (p) => ({ ...p, requirements: [...p.requirements, requirement] })) }));
    if (project.coordinatorId && currentActor().id === project.customerId) {
      get().notify(project.coordinatorId, `${project.code}: new service requested`, `${project.customerName} added ${serviceName(serviceId)}`, `/platform/project/${projectId}?tab=services`, 'lead');
    }
  },

  updateRequirement: (projectId, reqId, patch) =>
    set((s) => ({ projects: mapProject(s.projects, projectId, (p) => ({ ...p, requirements: p.requirements.map((r) => (r.id === reqId ? { ...r, ...patch } : r)) })) })),

  removeRequirement: (projectId, reqId) =>
    set((s) => ({ projects: mapProject(s.projects, projectId, (p) => ({ ...p, requirements: p.requirements.map((r) => (r.id === reqId ? { ...r, status: 'CANCELLED' } : r)) })) })),

  runMatching: (projectId, reqId) => {
    const project = get().projects.find((p) => p.id === projectId);
    const requirement = project?.requirements.find((r) => r.id === reqId);
    if (!project || !requirement) return [];
    const repeatProviderIds = get()
      .projects.filter((p) => p.customerId === project.customerId && p.id !== projectId)
      .flatMap((p) => p.bookings.filter((b) => b.status === 'COMPLETED').map((b) => b.providerId));
    const skipProviderIds = project.bookings.filter((b) => b.requirementId === reqId && ACTIVE_BOOKING.includes(b.status)).map((b) => b.providerId);
    const ranked = rankProviders(project, requirement, { availability: get().availability, rules: get().availabilityRules, repeatProviderIds, skipProviderIds }, { limit: 8 });
    set((s) => ({
      projects: mapProject(s.projects, projectId, (p) => ({
        ...p,
        status: p.status === 'NEW' || p.status === 'REVIEWING' ? 'MATCHING_PROVIDERS' : p.status,
        statusHistory: p.status === 'NEW' || p.status === 'REVIEWING' ? [...p.statusHistory, { status: 'MATCHING_PROVIDERS', at: now(), by: currentActor().name }] : p.statusHistory,
        requirements: p.requirements.map((r) => {
          if (r.id !== reqId) return r;
          const kept = r.candidates.filter((c) => c.status !== 'suggested');
          const fresh = ranked.filter((x) => !kept.some((k) => k.providerId === x.provider.id)).map((x) => toCandidate(x));
          return { ...r, status: r.status === 'OPEN' ? 'MATCHING' : r.status, candidates: [...kept, ...fresh] };
        }),
      })),
    }));
    return ranked;
  },

  setCandidateStatus: (projectId, reqId, providerId, status, note) =>
    set((s) => ({
      projects: mapProject(s.projects, projectId, (p) => ({
        ...p,
        requirements: p.requirements.map((r) =>
          r.id === reqId
            ? {
                ...r,
                status: status === 'shortlisted' && (r.status === 'OPEN' || r.status === 'MATCHING') ? 'SHORTLISTED' : r.status,
                candidates: r.candidates.map((c) => (c.providerId === providerId ? { ...c, status, note: note ?? c.note } : c)),
              }
            : r,
        ),
      })),
    })),

  // ── Bookings ─────────────────────────────────────────────────────────
  proposeBooking: (projectId, reqId, providerId, opts = {}) => {
    const project = get().projects.find((p) => p.id === projectId);
    const requirement = project?.requirements.find((r) => r.id === reqId);
    const provider = findProvider(providerId);
    if (!project || !requirement || !provider) return null;
    const settings = get().settings;
    const candidate = requirement.candidates.find((c) => c.providerId === providerId);
    const model = opts.model ?? 'COMMISSION';
    const rate = opts.rate ?? (model === 'MARKUP' ? settings.markupRate : model === 'LEAD_FEE' ? settings.leadFee : settings.commissionRate);
    const price = opts.price ?? candidate?.quotedPrice ?? provider.startingPrice;
    const split = splitBooking(model, rate, model === 'MARKUP' ? { providerCost: price } : { customerPrice: price });
    const owner = ownersOf(providerId)[0];
    const booking: ServiceBooking = {
      id: uid('bk'),
      requirementId: reqId,
      serviceId: requirement.serviceId,
      providerId,
      providerName: provider.name,
      providerAccountId: owner?.id,
      eventIds: requirement.eventIds,
      packageName: opts.packageName,
      ...split,
      pricingModel: model,
      modelRate: rate,
      status: opts.hold ? 'HELD' : 'PROPOSED',
      heldUntil: opts.hold ? addDays(today(), 7) : undefined,
      providerResponse: 'pending',
      crew: crewPlanFor(requirement.serviceId, requirement.details).map((c) => ({ id: uid('cr'), role: c.role, count: c.count, eventId: requirement.eventIds[0], pay: c.pay, equipment: c.equipment, staffing: 'in_house' as const })),
      assignments: [],
      deliverables: [],
      createdAt: now(),
    };
    const dates = bookingDates(project, booking);
    set((s) => ({
      projects: mapProject(s.projects, projectId, (p) => ({
        ...p,
        bookings: [...p.bookings, booking],
        requirements: p.requirements.map((r) =>
          r.id === reqId ? { ...r, status: r.status === 'CONFIRMED' ? r.status : 'SHORTLISTED', candidates: r.candidates.map((c) => (c.providerId === providerId ? { ...c, status: 'contacted' } : c)) } : r,
        ),
      })),
      availability: opts.hold
        ? [...s.availability, ...dates.map((date) => ({ id: uid('av'), ownerKind: 'provider' as const, ownerId: providerId, date, part: 'full' as const, status: 'HELD' as const, source: 'hold' as const, refId: booking.id }))]
        : s.availability,
    }));
    if (owner) {
      get().notify(owner.id, `Booking request: ${project.title}`, `${serviceName(requirement.serviceId)} · ${dates.map((d) => formatShortDate(d)).join(', ')} · ${formatMoney(split.providerPayable)} to you`, `/business/booking/${booking.id}`, 'booking');
    } else {
      // Unclaimed catalogue listing: simulate the provider confirming by phone.
      setTimeout(() => get().respondToBooking(projectId, booking.id, true, 'Confirmed availability by phone'), 3500);
    }
    get().log(currentActor(), 'booking.propose', 'booking', booking.id, `${provider.name} → ${project.code}`);
    return booking;
  },

  respondToBooking: (projectId, bookingId, accept, note) => {
    const project = get().projects.find((p) => p.id === projectId);
    const b = project?.bookings.find((x) => x.id === bookingId);
    if (!project || !b) return;
    set((s) => ({
      projects: mapProject(s.projects, projectId, (p) => ({
        ...mapBooking(p, bookingId, (x) => ({ ...x, providerResponse: accept ? 'accepted' : 'declined', status: accept ? x.status : 'CANCELLED', cancelReason: accept ? undefined : (note ?? 'Provider declined') })),
        requirements: accept
          ? p.requirements.map((r) => (r.id === b.requirementId ? { ...r, candidates: r.candidates.map((c) => (c.providerId === b.providerId ? { ...c, status: 'available' } : c)) } : r))
          : p.requirements.map((r) => (r.id === b.requirementId ? { ...r, status: r.status === 'CONFIRMED' ? r.status : 'MATCHING', candidates: r.candidates.map((c) => (c.providerId === b.providerId ? { ...c, status: 'declined', note } : c)) } : r)),
      })),
      availability: accept ? s.availability : s.availability.filter((a) => a.refId !== bookingId),
    }));
    const to = project.coordinatorId ?? 'platform';
    get().notify(to, accept ? `${b.providerName} is available ✅` : `${b.providerName} declined`, `${project.code} · ${serviceName(b.serviceId)}${note ? ` — ${note}` : ''}`, `/platform/project/${projectId}?tab=services`, 'booking');
    // Already part of an accepted quote → confirm straight away.
    if (accept && b.quoteId && get().quotes.find((q) => q.id === b.quoteId)?.status === 'accepted') activateBooking(set, get, projectId, bookingId);
  },

  confirmBooking: (projectId, bookingId) => activateBooking(set, get, projectId, bookingId),

  cancelBooking: (projectId, bookingId, reason) => {
    const project = get().projects.find((p) => p.id === projectId);
    const b = project?.bookings.find((x) => x.id === bookingId);
    if (!project || !b) return;
    set((s) => ({
      projects: mapProject(s.projects, projectId, (p) => ({
        ...mapBooking(p, bookingId, (x) => ({ ...x, status: 'CANCELLED', cancelReason: reason, assignments: x.assignments.map((a) => ({ ...a, status: 'CANCELLED' as const })) })),
        requirements: p.requirements.map((r) => (r.id === b.requirementId ? { ...r, status: 'MATCHING' } : r)),
      })),
      payables: s.payables.map((x) => (x.bookingId === bookingId && x.status !== 'PAID' ? { ...x, status: 'CANCELLED' } : x)),
      availability: s.availability.filter((a) => a.refId !== bookingId && !b.assignments.some((as) => as.id === a.refId)),
    }));
    const to = b.providerAccountId;
    if (to) get().notify(to, `Booking cancelled: ${project.title}`, reason, `/business/booking/${bookingId}`, 'booking');
    get().log(currentActor(), 'booking.cancel', 'booking', bookingId, reason);
  },

  updateBooking: (projectId, bookingId, patch) => set((s) => ({ projects: mapProject(s.projects, projectId, (p) => mapBooking(p, bookingId, (b) => ({ ...b, ...patch }))) })),

  // ── Crew ─────────────────────────────────────────────────────────────
  setCrew: (projectId, bookingId, crew) => set((s) => ({ projects: mapProject(s.projects, projectId, (p) => mapBooking(p, bookingId, (b) => ({ ...b, crew }))) })),

  assignWorker: (projectId, bookingId, crewId, worker, opts = {}) => {
    const project = get().projects.find((p) => p.id === projectId);
    const b = project?.bookings.find((x) => x.id === bookingId);
    if (!project || !b) return null;
    const crew = b.crew.find((c) => c.id === crewId);
    const eventId = opts.eventId ?? crew?.eventId ?? b.eventIds[0];
    const event = project.events.find((e) => e.id === eventId);
    const pay = opts.pay ?? crew?.pay ?? 0;
    const assignment: Assignment = {
      id: uid('as'),
      crewId,
      workerKind: worker.kind ?? 'freelancer',
      workerId: worker.id,
      workerName: worker.name,
      role: opts.role ?? crew?.role ?? 'Crew',
      eventId,
      date: opts.date ?? event?.date ?? project.weddingDate,
      startTime: opts.startTime ?? event?.startTime ?? '08:00',
      endTime: opts.endTime ?? '21:00',
      pay,
      margin: worker.kind === 'staff' ? 0 : Math.round(pay * (get().settings.freelancerMargin / (1 - get().settings.freelancerMargin))),
      status: opts.status ?? 'ASSIGNED',
      gigId: opts.gigId,
      replacesId: opts.replacesId,
      confirmedByProvider: true,
    };
    set((s) => ({
      projects: mapProject(s.projects, projectId, (p) =>
        mapBooking(p, bookingId, (x) => ({ ...x, assignments: [...x.assignments, assignment], crew: x.crew.map((c) => (c.id === crewId && worker.kind !== 'staff' ? { ...c, staffing: 'marketplace' as const } : c)) })),
      ),
      availability:
        worker.kind === 'staff'
          ? s.availability
          : [...s.availability, { id: uid('av'), ownerKind: 'freelancer', ownerId: worker.id, date: assignment.date, part: 'full', status: 'BOOKED', source: 'assignment', refId: assignment.id }],
    }));
    if (accountById(worker.id)) {
      get().notify(worker.id, `You're assigned: ${assignment.role}`, `${project.title} · ${formatShortDate(assignment.date)} · ${formatMoney(pay)}`, `/freelancer/assignment/${assignment.id}`, 'gig');
    }
    if (opts.replacesId) {
      get().notify(project.coordinatorId ?? 'platform', 'Replacement confirmed ✅', `${worker.name} replaces the ${assignment.role.toLowerCase()} for ${project.code}`, `/platform/project/${projectId}?tab=crew`, 'emergency');
      set((s) => ({
        projects: mapProject(s.projects, projectId, (p) => ({
          ...p,
          incidents: p.incidents.map((i) => (i.status === 'open' && /sick|emergency|replace/i.test(i.title) ? { ...i, status: 'resolved' } : i)),
        })),
      }));
    }
    return assignment;
  },

  setAssignmentStatus: (projectId, bookingId, assignmentId, status) => {
    set((s) => ({
      projects: mapProject(s.projects, projectId, (p) => mapBooking(p, bookingId, (b) => ({ ...b, assignments: b.assignments.map((a) => (a.id === assignmentId ? { ...a, status } : a)) }))),
      availability: status === 'CANCELLED' || status === 'NO_SHOW' || status === 'EMERGENCY_REPLACEMENT' ? s.availability.filter((a) => a.refId !== assignmentId) : s.availability,
    }));
    const project = get().projects.find((p) => p.id === projectId);
    const a = project?.bookings.find((b) => b.id === bookingId)?.assignments.find((x) => x.id === assignmentId);
    if (project && a && status === 'CONFIRMED') {
      const b = project.bookings.find((x) => x.id === bookingId)!;
      get().notify(b.providerAccountId ?? project.coordinatorId ?? 'platform', `${a.workerName} confirmed`, `${a.role} · ${project.code} · ${formatShortDate(a.date)}`, undefined, 'gig');
    }
    if (project && a && status === 'NO_SHOW') get().log(currentActor(), 'assignment.no_show', 'assignment', assignmentId, a.workerName);
  },

  checkInAssignment: (projectId, bookingId, assignmentId, info = {}) => {
    const project = get().projects.find((p) => p.id === projectId);
    const a = project?.bookings.find((b) => b.id === bookingId)?.assignments.find((x) => x.id === assignmentId);
    if (!project || !a) return;
    const [h, m] = a.startTime.split(':').map(Number);
    const start = new Date(`${a.date}T00:00:00`);
    start.setHours(h, m, 0, 0);
    const late = Math.max(0, Math.round((Date.now() - start.getTime()) / 60_000));
    set((s) => ({
      projects: mapProject(s.projects, projectId, (p) =>
        mapBooking(p, bookingId, (b) => ({
          ...b,
          assignments: b.assignments.map((x) => (x.id === assignmentId ? { ...x, status: 'CHECKED_IN', checkedInAt: now(), checkInCoords: info.coords, checkInNote: info.note, lateMinutes: daysUntil(a.date) === 0 && late > 10 && late < 600 ? late : 0 } : x)),
        })),
      ),
    }));
    const b = project.bookings.find((x) => x.id === bookingId)!;
    get().notify(b.providerAccountId ?? project.coordinatorId ?? 'platform', `${a.workerName} checked in`, `${a.role} · ${project.title}${late > 10 && late < 600 ? ` · ${late} min late` : ''}`, undefined, 'event');
  },

  checkOutAssignment: (projectId, bookingId, assignmentId, proofNote) => {
    const project = get().projects.find((p) => p.id === projectId);
    const b = project?.bookings.find((x) => x.id === bookingId);
    const a = b?.assignments.find((x) => x.id === assignmentId);
    if (!project || !b || !a) return;
    set((s) => ({
      projects: mapProject(s.projects, projectId, (p) =>
        mapBooking(p, bookingId, (x) => ({
          ...x,
          assignments: x.assignments.map((y) => (y.id === assignmentId ? { ...y, status: 'COMPLETED', checkedOutAt: now(), proofNote, confirmedByProvider: false } : y)),
        })),
      ),
      payables: s.payables.some((p) => p.assignmentId === assignmentId)
        ? s.payables
        : [
            ...s.payables,
            { id: uid('fpay'), payeeKind: 'freelancer', payeeId: a.workerId, payeeName: a.workerName, projectId, assignmentId, gigId: a.gigId, label: `${a.role} — ${project.title}`, amount: a.pay, status: 'ACCRUED', release: 'after_event', due: addDays(today(), 3) },
          ],
      revenue: a.margin ? [{ id: uid('rev'), kind: 'FREELANCER_MARGIN', amount: a.margin, projectId, bookingId, at: now() }, ...s.revenue] : s.revenue,
    }));
    get().notify(b.providerAccountId ?? project.coordinatorId ?? 'platform', `${a.workerName} finished work`, 'Confirm the work to release their payout.', b.providerAccountId ? `/business/booking/${bookingId}` : `/platform/project/${projectId}?tab=crew`, 'gig');
  },

  confirmAssignmentWork: (projectId, bookingId, assignmentId) => {
    const project = get().projects.find((p) => p.id === projectId);
    const a = project?.bookings.find((x) => x.id === bookingId)?.assignments.find((x) => x.id === assignmentId);
    if (!project || !a) return;
    set((s) => ({
      projects: mapProject(s.projects, projectId, (p) => mapBooking(p, bookingId, (b) => ({ ...b, assignments: b.assignments.map((x) => (x.id === assignmentId ? { ...x, confirmedByProvider: true } : x)) }))),
      payables: s.payables.map((p) => (p.assignmentId === assignmentId && p.status === 'ACCRUED' ? { ...p, status: 'READY' } : p)),
    }));
    if (accountById(a.workerId)) get().notify(a.workerId, 'Work confirmed ✅', `Your payout of ${formatMoney(a.pay)} is ready for release.`, '/freelancer/earnings', 'payment');
  },

  startEmergencyReplacement: (projectId, bookingId, assignmentId, reason, pay) => {
    const project = get().projects.find((p) => p.id === projectId);
    const b = project?.bookings.find((x) => x.id === bookingId);
    const a = b?.assignments.find((x) => x.id === assignmentId);
    if (!project || !b || !a) return null;
    const event = project.events.find((e) => e.id === a.eventId);
    const offered = pay ?? Math.round((a.pay * 1.25) / 500) * 500;
    get().setAssignmentStatus(projectId, bookingId, assignmentId, 'EMERGENCY_REPLACEMENT');
    set((s) => ({ projects: mapProject(s.projects, projectId, (p) => mapBooking(p, bookingId, (x) => ({ ...x, assignments: x.assignments.map((y) => (y.id === assignmentId ? { ...y, checkInNote: reason } : y)) }))) }));
    const candidates = rankFreelancers({ role: a.role, date: a.date, city: event?.city ?? project.city, pay: offered, equipment: b.crew.find((c) => c.id === a.crewId)?.equipment ?? [], emergency: true }, { availability: get().availability, rules: get().availabilityRules, skipIds: [a.workerId], pool: get().freelancerPool() }, { limit: 6 });
    const isToday = daysUntil(a.date) === 0;
    const gig = get().postGig({
      title: `EMERGENCY: ${a.role} needed ${isToday ? 'today' : formatShortDate(a.date)} — ${project.city}`,
      skill: a.role,
      postedById: 'platform',
      postedByName: 'Vivah Operations',
      postedByKind: 'platform',
      projectId,
      eventId: a.eventId,
      bookingId,
      crewId: a.crewId,
      city: event?.city ?? project.city,
      location: event?.venue,
      date: a.date,
      startTime: a.startTime,
      hours: 10,
      pay: offered,
      description: `${reason}. Cover ${event?.name ?? 'the event'} for ${project.title}. The team on site will brief you.`,
      requirements: b.crew.find((c) => c.id === a.crewId)?.equipment ?? [],
      equipment: b.crew.find((c) => c.id === a.crewId)?.equipment ?? [],
      slots: 1,
      emergency: true,
      replacesAssignmentId: assignmentId,
      invited: candidates.map((c) => c.freelancer.id),
    });
    get().reportIncident(projectId, { eventId: a.eventId ?? project.events[0]?.id ?? '', title: `${a.role} ${a.workerName} unavailable — emergency replacement started`, severity: 'high', reportedBy: currentActor().name });
    set((s) => ({ revenue: [{ id: uid('rev'), kind: 'EMERGENCY_FEE', amount: s.settings.emergencyFee, projectId, note: 'Rush replacement', at: now() }, ...s.revenue] }));
    if (b.providerAccountId) get().notify(b.providerAccountId, `Emergency replacement for ${project.code}`, `${a.workerName} is out. Vivah is sourcing a replacement ${a.role.toLowerCase()}.`, `/business/booking/${bookingId}`, 'emergency');
    get().log(currentActor(), 'assignment.emergency', 'assignment', assignmentId, reason);
    return gig;
  },

  // ── Deliverables ─────────────────────────────────────────────────────
  addDeliverable: (projectId, bookingId, d) =>
    set((s) => ({
      projects: mapProject(s.projects, projectId, (p) =>
        mapBooking(p, bookingId, (b) => ({ ...b, deliverables: [...b.deliverables, { id: uid('dl'), status: 'NOT_STARTED', progress: 0, revisions: 0, revisionLimit: 2, history: [], ...d }] })),
      ),
    })),

  updateDeliverable: (projectId, bookingId, deliverableId, patch, note) => {
    const actor = currentActor();
    const project = get().projects.find((p) => p.id === projectId);
    const b = project?.bookings.find((x) => x.id === bookingId);
    const d = b?.deliverables.find((x) => x.id === deliverableId);
    if (!project || !b || !d) return;
    const statusChanged = patch.status && patch.status !== d.status;
    set((s) => ({
      projects: mapProject(s.projects, projectId, (p) =>
        mapBooking(p, bookingId, (x) => ({
          ...x,
          deliverables: x.deliverables.map((y) =>
            y.id === deliverableId
              ? {
                  ...y,
                  ...patch,
                  revisions: patch.status === 'REVISION_REQUESTED' ? y.revisions + 1 : y.revisions,
                  progress: patch.progress ?? (patch.status === 'READY_FOR_REVIEW' || patch.status === 'APPROVED' || patch.status === 'DELIVERED' ? 1 : y.progress),
                  history: statusChanged ? [...y.history, { status: patch.status!, at: now(), by: actor.name, note }] : y.history,
                }
              : y,
          ),
        })),
      ),
    }));
    if (!statusChanged) return;
    if (patch.status === 'READY_FOR_REVIEW') get().notify(project.customerId, `${d.title} is ready for review`, `${b.providerName} delivered it — approve or request changes.`, '/my-wedding?tab=services', 'booking');
    if (patch.status === 'REVISION_REQUESTED' || patch.status === 'APPROVED') {
      const to = b.providerAccountId ?? project.coordinatorId ?? 'platform';
      get().notify(to, patch.status === 'APPROVED' ? `${d.title} approved ✅` : `Changes requested: ${d.title}`, note ?? project.title, b.providerAccountId ? `/business/booking/${bookingId}` : `/platform/project/${projectId}`, 'booking');
      if (patch.status === 'APPROVED')
        set((s) => ({ payables: s.payables.map((x) => (x.bookingId === bookingId && x.release === 'on_delivery' && x.status === 'ACCRUED' ? { ...x, status: 'READY' } : x)) }));
    }
  },

  // ── Tasks ────────────────────────────────────────────────────────────
  addTask: (projectId, task) => {
    const full: ProjectTask = { ...task, id: uid('tk'), createdAt: now() };
    set((s) => ({ projects: mapProject(s.projects, projectId, (p) => ({ ...p, tasks: [full, ...p.tasks] })) }));
    if (task.assigneeId && task.assigneeId !== currentActor().id) {
      const role = accountById(task.assigneeId)?.role;
      const href = role === 'vendor' ? '/business/projects' : role === 'freelancer' ? '/freelancer/jobs' : role === 'platform' ? `/platform/project/${projectId}?tab=tasks` : '/my-wedding?tab=tasks';
      get().notify(task.assigneeId, 'New task for you', `${task.title} · due ${formatShortDate(task.due)}`, href, 'task');
    }
  },

  updateTask: (projectId, taskId, patch) =>
    set((s) => ({ projects: mapProject(s.projects, projectId, (p) => ({ ...p, tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)) })) })),

  setTaskStatus: (projectId, taskId, status) =>
    set((s) => ({
      projects: mapProject(s.projects, projectId, (p) => ({ ...p, tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, status, completedAt: status === 'COMPLETED' ? now() : undefined } : t)) })),
    })),

  removeTask: (projectId, taskId) => set((s) => ({ projects: mapProject(s.projects, projectId, (p) => ({ ...p, tasks: p.tasks.filter((t) => t.id !== taskId) })) })),

  regenerateChecklist: (projectId) => {
    const project = get().projects.find((p) => p.id === projectId);
    if (!project) return;
    const services = project.requirements.filter((r) => r.status !== 'CANCELLED').map((r) => r.serviceId);
    const fresh = generateTasks(project.weddingDate, services, project.customerName, project.coordinatorName).filter((t) => !project.tasks.some((x) => x.title === t.title));
    set((s) => ({ projects: mapProject(s.projects, projectId, (p) => ({ ...p, tasks: [...p.tasks, ...fresh] })) }));
  },

  // ── Timeline ─────────────────────────────────────────────────────────
  addTimelineEntry: (projectId, entry) => {
    set((s) => ({ projects: mapProject(s.projects, projectId, (p) => ({ ...p, timeline: [...p.timeline, { ...entry, id: uid('tl'), done: entry.done ?? false }] })) }));
    const project = get().projects.find((p) => p.id === projectId);
    if (project && !entry.internal && entry.kind === 'meeting' && currentActor().id !== project.customerId) {
      get().notify(project.customerId, `Meeting scheduled: ${entry.title}`, `${formatShortDate(entry.date)}${entry.time ? ` at ${entry.time}` : ''}${entry.location ? ` · ${entry.location}` : ''}`, '/my-wedding?tab=timeline', 'event');
    }
  },

  toggleTimelineEntry: (projectId, id) =>
    set((s) => ({ projects: mapProject(s.projects, projectId, (p) => ({ ...p, timeline: p.timeline.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) })) })),

  // ── Collaborators ────────────────────────────────────────────────────
  inviteCollaborator: (projectId, c) => {
    const collaborator: Collaborator = { ...c, id: uid('col'), inviteCode: shortCode() };
    set((s) => ({ projects: mapProject(s.projects, projectId, (p) => ({ ...p, collaborators: [...p.collaborators, collaborator] })) }));
    return collaborator;
  },

  joinWithCode: (code, account) => {
    const normalized = code.trim().toUpperCase();
    const project = get().projects.find((p) => p.collaborators.some((c) => c.inviteCode === normalized));
    if (!project) return null;
    set((s) => ({
      projects: mapProject(s.projects, project.id, (p) => ({
        ...p,
        collaborators: p.collaborators.map((c) => (c.inviteCode === normalized ? { ...c, accountId: account.id, joinedAt: now() } : c)),
      })),
    }));
    get().notify(project.customerId, `${account.name} joined your wedding`, 'They can now view and help plan.', '/my-wedding', 'system');
    return project;
  },

  removeCollaborator: (projectId, id) =>
    set((s) => ({ projects: mapProject(s.projects, projectId, (p) => ({ ...p, collaborators: p.collaborators.filter((c) => c.id !== id) })) })),
});

/** Readable one-liner for a payable/assignment amount split (model D). */
export const describeMargin = (clientPay: number, margin = 0.2) => {
  const { pay, margin: m } = freelancerNet(clientPay, margin);
  return `Client pays ${formatMoney(clientPay)} · freelancer ${formatMoney(pay)} · platform ${formatMoney(m)}`;
};

export const SYSTEM_ACTOR = SYSTEM;
