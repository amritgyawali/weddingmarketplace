/**
 * Freelancer gig marketplace and calendars. Hiring on a gig that belongs to a
 * booking crew slot creates a booking assignment, so crew, payouts and the
 * coordinator's risk view stay in sync.
 */
import { FREELANCER_DIRECTORY } from '@/data/freelancers';
import { useSession } from '@/store/useSession';
import type {
  Account,
  ApplicationStatus,
  AvailabilityEntry,
  AvailabilityRule,
  AvailabilityStatus,
  DayPart,
  FreelancerProfile,
  Gig,
  GigApplication,
} from '@/types/platform';
import { addDays, formatMoney, formatShortDate, uid } from '@/utils/format';

import { accountById, currentActor, type GetDb, now, type SetDb, today } from './helpers';

export interface GigActions {
  postGig: (gig: Omit<Gig, 'id' | 'createdAt' | 'status' | 'applications'>) => Gig;
  applyToGig: (gigId: string, application: Omit<GigApplication, 'id' | 'appliedAt' | 'status'>) => void;
  inviteToGig: (gigId: string, freelancerId: string) => void;
  respondToInvite: (gigId: string, freelancer: Account, accept: boolean) => void;
  askGigQuestion: (gigId: string, freelancer: { id: string; name: string }, question: string) => void;
  answerGigQuestion: (gigId: string, questionId: string, answer: string) => void;
  setApplicationStatus: (gigId: string, applicationId: string, status: ApplicationStatus) => void;
  withdrawApplication: (gigId: string, freelancerId: string) => void;
  checkIn: (gigId: string, applicationId: string) => void;
  checkOut: (gigId: string, applicationId: string) => void;
  cancelGig: (gigId: string) => void;
  /** Directory freelancers merged with freelancer accounts on this device. */
  freelancerPool: () => FreelancerProfile[];

  setAvailability: (ownerKind: AvailabilityEntry['ownerKind'], ownerId: string, dates: string[], status: AvailabilityStatus | null, part?: DayPart, note?: string) => void;
  addAvailabilityRule: (rule: Omit<AvailabilityRule, 'id'>) => void;
  removeAvailabilityRule: (id: string) => void;
}

/** Freelancer profile for an account (used by matching and directories). */
export function profileFromAccount(a: Account, stats?: { completed: number; rating?: number }): FreelancerProfile {
  return {
    id: a.id,
    name: a.name,
    city: a.city,
    skills: a.skills ?? [],
    headline: a.headline ?? (a.skills ?? []).join(' · '),
    bio: a.bio ?? '',
    experienceYears: a.experienceYears ?? 1,
    dayRate: a.dayRate ?? 5_000,
    hourlyRate: a.hourlyRate ?? Math.round((a.dayRate ?? 5_000) / 8),
    eventRate: a.eventRate ?? a.dayRate ?? 5_000,
    travelRadiusKm: a.travelRadiusKm ?? 25,
    languages: a.languages ?? ['Nepali'],
    equipment: a.equipment ?? [],
    ownVehicle: a.ownVehicle ?? false,
    rating: stats?.rating ?? a.rating ?? 4.5,
    ratingCount: Math.max(1, Math.round((stats?.completed ?? 0) * 0.6)),
    completedGigs: stats?.completed ?? 0,
    cancellationRate: 0,
    responseRate: 0.95,
    lateArrivals: 0,
    noShows: 0,
    reliability: a.verified ? 92 : 70,
    verification: a.verified ? 'VERIFIED' : 'UNDER_REVIEW',
    available: a.available ?? true,
    portfolio: [],
  };
}

export const gigActions = (set: SetDb, get: GetDb): GigActions => ({
  postGig: (input) => {
    const gig: Gig = { ...input, id: uid('gig'), status: 'open', applications: [], createdAt: now() };
    set((s) => ({ gigs: [gig, ...s.gigs] }));
    const accounts = useSession.getState().accounts.filter((a) => a.role === 'freelancer' && (a.skills ?? []).includes(gig.skill) && a.available !== false);
    accounts.forEach((f) =>
      get().notify(
        f.id,
        gig.emergency ? `🚨 Emergency gig ${formatShortDate(gig.date) === formatShortDate(today()) ? 'today' : formatShortDate(gig.date)} — ${gig.city}` : gig.invited?.includes(f.id) ? `You're invited: ${gig.title}` : `New ${gig.skill} gig near you`,
        `${gig.title} · ${formatMoney(gig.pay)}`,
        `/freelancer/gig/${gig.id}`,
        gig.emergency ? 'emergency' : 'gig',
      ),
    );
    get().log(currentActor(), gig.emergency ? 'gig.emergency' : 'gig.post', 'gig', gig.id, gig.title);
    return gig;
  },

  applyToGig: (gigId, application) => {
    set((s) => ({
      gigs: s.gigs.map((g) =>
        g.id === gigId
          ? {
              ...g,
              applications: [
                ...g.applications.filter((a) => a.freelancerId !== application.freelancerId),
                { ...application, id: uid('app'), appliedAt: now(), status: 'applied' as const },
              ],
            }
          : g,
      ),
    }));
    const gig = get().gigs.find((g) => g.id === gigId);
    if (gig) {
      const to = gig.postedByKind === 'platform' ? (gig.projectId ? (get().projects.find((p) => p.id === gig.projectId)?.coordinatorId ?? 'platform') : 'platform') : gig.postedById;
      get().notify(to, `${gig.emergency ? '🚨 ' : ''}New applicant: ${application.freelancerName}`, gig.title, gig.postedByKind === 'platform' ? `/platform/gig/${gig.id}` : `/business/gig/${gig.id}`, 'gig');
    }
  },

  inviteToGig: (gigId, freelancerId) => {
    set((s) => ({ gigs: s.gigs.map((g) => (g.id === gigId ? { ...g, invited: [...new Set([...(g.invited ?? []), freelancerId])] } : g)) }));
    const gig = get().gigs.find((g) => g.id === gigId);
    if (gig && accountById(freelancerId)) get().notify(freelancerId, `You're invited: ${gig.title}`, `${formatShortDate(gig.date)} · ${gig.city} · ${formatMoney(gig.pay)}`, `/freelancer/gig/${gig.id}`, gig.emergency ? 'emergency' : 'gig');
  },

  respondToInvite: (gigId, freelancer, accept) => {
    const gig = get().gigs.find((g) => g.id === gigId);
    if (!gig) return;
    if (accept) {
      get().applyToGig(gigId, { freelancerId: freelancer.id, freelancerName: freelancer.name, skill: gig.skill, rating: freelancer.rating ?? 4.8, message: 'Accepted your invitation.', expectedPay: gig.pay });
      // Emergency invitations are first-come, first-served.
      if (gig.emergency) {
        const app = get().gigs.find((g) => g.id === gigId)?.applications.find((a) => a.freelancerId === freelancer.id);
        if (app) get().setApplicationStatus(gigId, app.id, 'hired');
      }
    } else {
      set((s) => ({ gigs: s.gigs.map((g) => (g.id === gigId ? { ...g, invited: (g.invited ?? []).filter((id) => id !== freelancer.id), applications: g.applications.filter((a) => a.freelancerId !== freelancer.id) } : g)) }));
    }
  },

  askGigQuestion: (gigId, freelancer, question) => {
    set((s) => ({ gigs: s.gigs.map((g) => (g.id === gigId ? { ...g, questions: [...(g.questions ?? []), { id: uid('gq'), freelancerId: freelancer.id, freelancerName: freelancer.name, question, at: now() }] } : g)) }));
    const gig = get().gigs.find((g) => g.id === gigId);
    if (gig) get().notify(gig.postedByKind === 'platform' ? 'platform' : gig.postedById, `Question on ${gig.title}`, `${freelancer.name}: ${question}`, gig.postedByKind === 'platform' ? `/platform/gig/${gigId}` : `/business/gig/${gigId}`, 'gig');
  },

  answerGigQuestion: (gigId, questionId, answer) => {
    const q = get().gigs.find((g) => g.id === gigId)?.questions?.find((x) => x.id === questionId);
    set((s) => ({ gigs: s.gigs.map((g) => (g.id === gigId ? { ...g, questions: (g.questions ?? []).map((x) => (x.id === questionId ? { ...x, answer } : x)) } : g)) }));
    if (q && accountById(q.freelancerId)) get().notify(q.freelancerId, 'Your question was answered', answer, `/freelancer/gig/${gigId}`, 'gig');
  },

  setApplicationStatus: (gigId, applicationId, status) => {
    const before = get().gigs.find((g) => g.id === gigId);
    const app = before?.applications.find((a) => a.id === applicationId);
    if (!before || !app) return;

    // Hiring against a booking crew slot creates the booking assignment.
    let assignmentId = app.assignmentId;
    if ((status === 'hired' || status === 'confirmed') && !assignmentId && before.projectId && before.bookingId) {
      const assignment = get().assignWorker(
        before.projectId,
        before.bookingId,
        before.crewId,
        { id: app.freelancerId, name: app.freelancerName, kind: 'freelancer' },
        { role: before.skill, pay: app.expectedPay || before.pay, eventId: before.eventId, date: before.date, startTime: before.startTime, gigId, replacesId: before.replacesAssignmentId, status: status === 'confirmed' ? 'CONFIRMED' : 'ASSIGNED' },
      );
      assignmentId = assignment?.id;
    } else if (status === 'hired' && !before.bookingId) {
      set((s) => ({ availability: [...s.availability, { id: uid('av'), ownerKind: 'freelancer', ownerId: app.freelancerId, date: before.date, part: 'full', status: 'BOOKED', source: 'assignment', refId: applicationId }] }));
    }

    set((s) => ({
      gigs: s.gigs.map((g) => {
        if (g.id !== gigId) return g;
        const applications = g.applications.map((a) => (a.id === applicationId ? { ...a, status, assignmentId } : a));
        const hired = applications.filter((a) => ['hired', 'confirmed', 'checked_in', 'completed'].includes(a.status)).length;
        return { ...g, applications, status: g.status === 'open' && hired >= g.slots ? 'filled' : g.status };
      }),
    }));
    if (status === 'hired' || status === 'rejected' || status === 'shortlisted') {
      const title = status === 'hired' ? 'You’re hired! 🎉' : status === 'shortlisted' ? 'You’ve been shortlisted' : 'Application update';
      get().notify(app.freelancerId, title, before.title, assignmentId ? `/freelancer/assignment/${assignmentId}` : `/freelancer/job/${gigId}`, 'gig');
    }
  },

  withdrawApplication: (gigId, freelancerId) =>
    set((s) => ({ gigs: s.gigs.map((g) => (g.id === gigId ? { ...g, applications: g.applications.map((a) => (a.freelancerId === freelancerId && a.status === 'applied' ? { ...a, status: 'withdrawn' } : a)) } : g)) })),

  checkIn: (gigId, applicationId) =>
    set((s) => ({
      gigs: s.gigs.map((g) => (g.id === gigId ? { ...g, applications: g.applications.map((a) => (a.id === applicationId ? { ...a, checkInAt: now(), status: 'checked_in' as const } : a)) } : g)),
    })),

  checkOut: (gigId, applicationId) => {
    const gig = get().gigs.find((g) => g.id === gigId);
    const app = gig?.applications.find((a) => a.id === applicationId);
    if (!gig || !app) return;
    set((s) => ({
      gigs: s.gigs.map((g) => {
        if (g.id !== gigId) return g;
        const applications = g.applications.map((a) => (a.id === applicationId ? { ...a, checkOutAt: now(), status: 'completed' as const } : a));
        const allDone = !applications.some((a) => a.status === 'hired' || a.status === 'confirmed' || a.status === 'checked_in');
        return { ...g, applications, status: allDone ? 'completed' : g.status };
      }),
      payables: [
        { id: uid('fpay'), payeeKind: 'freelancer', payeeId: app.freelancerId, payeeName: app.freelancerName, gigId, projectId: gig.projectId, label: gig.title, amount: app.expectedPay || gig.pay, status: 'ACCRUED', release: 'after_event', due: addDays(today(), 3) },
        ...s.payables,
      ],
    }));
    const to = gig.postedByKind === 'platform' ? 'platform' : gig.postedById;
    get().notify(to, `${app.freelancerName} checked out`, `${gig.title} — confirm to release the payout.`, gig.postedByKind === 'platform' ? '/platform/finance?tab=payables' : '/business/finance', 'gig');
  },

  cancelGig: (gigId) => {
    const gig = get().gigs.find((g) => g.id === gigId);
    set((s) => ({ gigs: s.gigs.map((g) => (g.id === gigId ? { ...g, status: 'cancelled' } : g)) }));
    gig?.applications.filter((a) => a.status !== 'rejected').forEach((a) => accountById(a.freelancerId) && get().notify(a.freelancerId, 'Gig cancelled', gig.title, undefined, 'gig'));
  },

  freelancerPool: () => {
    const accounts = useSession.getState().accounts.filter((a) => a.role === 'freelancer');
    const payables = get().payables;
    return [
      ...accounts.map((a) => profileFromAccount(a, { completed: payables.filter((p) => p.payeeId === a.id).length + 12 })),
      ...FREELANCER_DIRECTORY.filter((f) => !accounts.some((a) => a.name === f.name)),
    ];
  },

  setAvailability: (ownerKind, ownerId, dates, status, part = 'full', note) =>
    set((s) => ({
      availability: [
        // Manual edits never override booking-driven entries.
        ...s.availability.filter((a) => !(a.ownerId === ownerId && dates.includes(a.date) && a.source === 'manual' && a.part === part)),
        ...(status && status !== 'AVAILABLE'
          ? dates.filter((d) => !s.availability.some((a) => a.ownerId === ownerId && a.date === d && a.source !== 'manual')).map((date) => ({ id: uid('av'), ownerKind, ownerId, date, part, status, source: 'manual' as const, note }))
          : []),
      ],
    })),

  addAvailabilityRule: (rule) => set((s) => ({ availabilityRules: [...s.availabilityRules.filter((r) => !(r.ownerId === rule.ownerId && r.weekday === rule.weekday)), { ...rule, id: uid('rule') }] })),
  removeAvailabilityRule: (id) => set((s) => ({ availabilityRules: s.availabilityRules.filter((r) => r.id !== id) })),
});
