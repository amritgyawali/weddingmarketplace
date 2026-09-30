/**
 * Demo dataset for the shared on-device backend (Nepal). Dates are relative
 * to today so the demo always has: a new lead, projects in matching / quoting
 * / negotiation, a confirmed wedding in planning, a wedding happening today
 * (with an emergency replacement) and a completed one with deliverables.
 */
import type { PhotoKey } from '@/constants/images';
import { EVENT_TYPE_BY_ID } from '@/data/events';
import { FREELANCER_DIRECTORY } from '@/data/freelancers';
import { IDEA_PHOTOS } from '@/data/ideas';
import { builtInOccasions } from '@/data/occasions';
import { PROVIDERS, type Provider } from '@/data/providers';
import { SERVICE_BY_ID, crewPlanFor, defaultDetails } from '@/data/services';
import { buildToolkitSeed } from '@/data/toolkitSeed';
import { VENDORS } from '@/data/vendors';
import { VENUES } from '@/data/venues';
import { generateTasks } from '@/services/planner';
import { buildMilestones, DEFAULT_SCHEDULE, payablesForBooking, splitBooking } from '@/services/pricing';
import { DEFAULT_TERMS, quoteTotals, TAX_RATE } from '@/services/quotes';
import type { DbData } from '@/store/db/types';
import type {
  Account,
  Assignment,
  BookingStatus,
  Deliverable,
  DeliverableStatus,
  EventType,
  Gig,
  Guest,
  Lead,
  Message,
  Payable,
  PaymentMilestone,
  PricingModel,
  Project,
  ProjectEvent,
  ProjectStatus,
  Quotation,
  QuoteItem,
  Requirement,
  RequirementStatus,
  RevenueEntry,
  RunItem,
  RunStatus,
  ServiceBooking,
  Thread,
} from '@/types/platform';
import { toISODate } from '@/utils/format';
import { seeded } from '@/utils/random';

export const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return toISODate(d);
};
export const at = (offset: number, hour = 10, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

// Providers used across the demo
const pick = (serviceId: string, city: string, n = 0): Provider => {
  const pool = PROVIDERS.filter((p) => p.serviceId === serviceId && p.city === city && p.verification === 'VERIFIED');
  return pool[n] ?? pool[0] ?? PROVIDERS.find((p) => p.serviceId === serviceId)!;
};

export const DEMO_VENUE = VENUES[0];
export const DEMO_STUDIO = VENDORS.find((v) => v.id === 'wedding-story-nepal-kathmandu')!;
export const DEMO_DECOR = VENDORS.find((v) => v.id === 'phoolbari-decor-lalitpur')!;
const P = (id: string) => PROVIDERS.find((p) => p.id === id)!;

// Accounts
export const DEMO_ACCOUNTS: Account[] = [
  {
    id: 'acc_customer_demo',
    role: 'customer',
    name: 'Aakriti Shrestha',
    phone: '9800000001',
    email: 'aakriti@example.com',
    city: 'Kathmandu',
    createdAt: at(-70),
    verified: true,
  },
  {
    id: 'acc_vendor_demo',
    role: 'vendor',
    name: 'Rajesh Pradhan',
    phone: '9800000002',
    email: 'events@everestgrand.com.np',
    city: DEMO_VENUE.city,
    createdAt: at(-400),
    verified: true,
    businessName: DEMO_VENUE.name,
    categoryId: 'venues',
    listingKind: 'venue',
    listingId: DEMO_VENUE.id,
    panVat: '601234567',
    services: ['venue', 'catering'],
    primaryService: 'venue',
    businessForm: 'venue',
    teamSize: 38,
    tradeProfile: { seated: 450, floating: 700, inHouseCatering: true, parking: 120 },
    personaConfirmedAt: at(-400),
  },
  {
    id: 'acc_freelancer_demo',
    role: 'freelancer',
    name: 'Raj Maharjan',
    phone: '9800000003',
    city: 'Kathmandu',
    createdAt: at(-260),
    verified: true,
    skills: ['Photographer', 'Editor'],
    headline: 'Wedding photographer & editor — 7 yrs',
    dayRate: 8_000,
    hourlyRate: 1_000,
    eventRate: 9_500,
    bio: 'Candid wedding photographer from Patan. 150+ weddings across the valley and Pokhara. Fast editor — sneak peeks the same night.',
    available: true,
    rating: 4.8,
    equipment: [
      { kind: 'camera', name: 'Sony A7 IV' },
      { kind: 'lens', name: '24-70mm f/2.8' },
      { kind: 'lens', name: '70-200mm f/2.8' },
      { kind: 'flash', name: 'Godox V1' },
      { kind: 'vehicle', name: 'Scooter' },
    ],
    travelRadiusKm: 50,
    languages: ['Nepali', 'Newari', 'English'],
    experienceYears: 7,
    ownVehicle: true,
    primarySkill: 'Photographer',
    tradeProfile: { bodies: 'Sony A7 IV', styles: ['Candid', 'Traditional'], droneLicence: true, turnaroundDays: 2 },
    personaConfirmedAt: at(-260),
  },
  {
    id: 'acc_platform_demo',
    role: 'platform',
    name: 'Sita Karki',
    phone: '9800000004',
    email: 'sita@vivah.com.np',
    city: 'Kathmandu',
    createdAt: at(-700),
    verified: true,
    team: 'Wedding Coordination',
    staffRole: 'coordinator',
  },
  {
    id: 'acc_vendor_studio',
    role: 'vendor',
    name: 'Anil Gurung',
    phone: '9800000005',
    email: 'hello@weddingstory.com.np',
    city: 'Kathmandu',
    createdAt: at(-500),
    verified: true,
    businessName: DEMO_STUDIO.name,
    categoryId: 'photo-video',
    listingKind: 'vendor',
    listingId: DEMO_STUDIO.id,
    panVat: '609876543',
    services: ['photography', 'videography', 'drone', 'pre-wedding', 'album'],
    primaryService: 'photography',
    businessForm: 'studio',
    teamSize: 14,
    tradeProfile: { startingPackage: 60_000, deliveryWeeks: 6, styles: ['Candid', 'Cinematic', 'Traditional'] },
    personaConfirmedAt: at(-500),
  },
  {
    id: 'acc_platform_admin',
    role: 'platform',
    name: 'Bikram Adhikari',
    phone: '9800000006',
    email: 'bikram@vivah.com.np',
    city: 'Kathmandu',
    createdAt: at(-900),
    verified: true,
    team: 'Admin',
    staffRole: 'super_admin',
  },
  {
    id: 'acc_vendor_decor',
    role: 'vendor',
    name: 'Sunita Maharjan',
    phone: '9800000007',
    email: 'hello@phoolbari.com.np',
    city: 'Lalitpur',
    createdAt: at(-120),
    verified: true,
    businessName: DEMO_DECOR.name,
    categoryId: 'decor',
    listingKind: 'vendor',
    listingId: DEMO_DECOR.id,
    services: ['decoration', 'florist', 'lighting'],
    primaryService: 'decoration',
    businessForm: 'studio',
    teamSize: 9,
    tradeProfile: { themes: ['Floral', 'Traditional', 'Newari'], leadDays: 3, coverage: 'Kathmandu valley' },
    personaConfirmedAt: at(-120),
  },
  {
    id: 'acc_platform_finance',
    role: 'platform',
    name: 'Nisha Rai',
    phone: '9800000010',
    email: 'nisha@vivah.com.np',
    city: 'Kathmandu',
    createdAt: at(-500),
    verified: true,
    team: 'Finance',
    staffRole: 'finance',
  },
  {
    id: 'acc_platform_vendor_success',
    role: 'platform',
    name: 'Prakash Thapa',
    phone: '9800000011',
    email: 'prakash@vivah.com.np',
    city: 'Lalitpur',
    createdAt: at(-300),
    verified: true,
    team: 'Vendor Success',
    staffRole: 'support',
  },
  {
    id: 'acc_customer_newborn',
    role: 'customer',
    name: 'Sarita Duwal',
    phone: '9800000009',
    email: 'sarita.duwal@example.com',
    city: 'Bhaktapur',
    createdAt: at(-30),
    verified: true,
  },
  {
    id: 'acc_freelancer_dj',
    role: 'freelancer',
    name: 'Suman Tamang',
    phone: '9800000008',
    city: 'Kathmandu',
    createdAt: at(-150),
    verified: true,
    skills: ['DJ', 'MC'],
    primarySkill: 'DJ',
    headline: 'DJ Suman: receptions, sangeet and after-parties',
    dayRate: 12_000,
    eventRate: 15_000,
    bio: 'Wedding DJ from Boudha. Nepali pop, lok dohori and Bollywood, with a clean set for the elders and a late set for the cousins. Can host as MC too.',
    available: true,
    rating: 4.7,
    equipment: [
      { kind: 'audio', name: 'Pioneer DDJ-1000 controller' },
      { kind: 'audio', name: '2 × JBL PRX 815 speakers' },
      { kind: 'audio', name: 'Shure wireless mic pair' },
      { kind: 'light', name: '4 × LED par and a smoke machine' },
    ],
    travelRadiusKm: 100,
    languages: ['Nepali', 'Tamang', 'English', 'Hindi'],
    experienceYears: 5,
    ownVehicle: true,
    tradeProfile: { genres: ['Nepali pop', 'Lok dohori', 'Bollywood'], setHours: 4, ownGear: true },
    personaConfirmedAt: at(-150),
  },
];

/** Persona fields that demo accounts on older installs are missing (filled in by the session migration). */
export const DEMO_PERSONA_KEYS = ['services', 'primaryService', 'businessForm', 'teamSize', 'tradeProfile', 'primarySkill', 'personaConfirmedAt', 'staffRole'] as const;

/** Demo OTP for every phone number (no SMS gateway in the prototype). */
export const DEMO_OTP = '1234';
/** Access code required to register a platform-team account. */
export const PLATFORM_ACCESS_CODE = 'VIVAH2026';

const SITA = { id: 'acc_platform_demo', name: 'Sita Karki' };

// Builders
function runSheet(type: EventType, statuses: RunStatus[] = []): RunItem[] {
  return (EVENT_TYPE_BY_ID[type]?.runSheet ?? []).map(([time, title, owner], i) => ({
    id: `ri_${type}_${i}_${time.replace(':', '')}`,
    time,
    title,
    owner,
    status: statuses[i] ?? 'pending',
  }));
}

function ev(id: string, type: EventType, date: string | null, venue: string, city: string, guests: number, extra: Partial<ProjectEvent> = {}): ProjectEvent {
  const def = EVENT_TYPE_BY_ID[type];
  return {
    id,
    type,
    name: def.label.replace(/ \(.*\)$/, ''),
    date,
    dateConfirmed: !!date,
    startTime: def.start,
    venue,
    city,
    guests,
    status: 'planned',
    private: false,
    runSheet: runSheet(type),
    ...extra,
  };
}

function req(id: string, serviceId: string, eventIds: string[], status: RequirementStatus, extra: Partial<Requirement> = {}): Requirement {
  return {
    id,
    serviceId,
    eventIds,
    details: defaultDetails(serviceId),
    styles: [],
    status,
    priority: SERVICE_BY_ID[serviceId]?.core ? 'high' : 'medium',
    candidates: [],
    ...extra,
  };
}

function deliverablesFor(serviceId: string, eventDate: string, statuses: DeliverableStatus[] = []): Deliverable[] {
  const offset = (iso: string, days: number) => {
    const d = new Date(`${iso}T00:00:00`);
    d.setDate(d.getDate() + days);
    return toISODate(d);
  };
  return (SERVICE_BY_ID[serviceId]?.deliverables ?? []).map((d, i) => {
    const status = statuses[i] ?? 'NOT_STARTED';
    const progress = status === 'DELIVERED' || status === 'APPROVED' ? 1 : status === 'READY_FOR_REVIEW' ? 1 : status === 'IN_PROGRESS' ? 0.6 : status === 'REVISION_REQUESTED' ? 0.85 : 0;
    return {
      id: `dl_${serviceId}_${eventDate}_${i}`,
      title: d.title,
      kind: d.kind,
      quantity: d.qty,
      unit: d.unit,
      due: offset(eventDate, d.dueDays),
      status,
      progress,
      link: status === 'READY_FOR_REVIEW' || status === 'DELIVERED' || status === 'APPROVED' ? 'https://drive.google.com/drive/folders/wedding-story-preview' : undefined,
      revisions: status === 'REVISION_REQUESTED' ? 1 : 0,
      revisionLimit: 2,
      history: status === 'NOT_STARTED' ? [] : [{ status, at: at(-2), by: 'Wedding Story Nepal' }],
    };
  });
}

interface BookingSpec {
  id: string;
  requirementId?: string;
  provider: Provider;
  eventIds: string[];
  price: number;
  model?: PricingModel;
  rate?: number;
  status: BookingStatus;
  accountId?: string;
  packageName?: string;
  confirmedAt?: string;
  assignments?: Assignment[];
  deliverables?: Deliverable[];
  crewDetails?: Record<string, string | number | boolean>;
  eventForCrew?: string;
  /** Crew roles staffed through marketplace gigs (others are the provider's in-house team). */
  marketplaceRoles?: string[];
  quoteId?: string;
  providerResponse?: ServiceBooking['providerResponse'];
}

function booking(s: BookingSpec): ServiceBooking {
  const model = s.model ?? 'COMMISSION';
  const rate = s.rate ?? (model === 'MARKUP' ? 0.15 : model === 'LEAD_FEE' ? 2000 : 0.1);
  const split = splitBooking(model, rate, model === 'MARKUP' ? { providerCost: s.price } : { customerPrice: s.price });
  const crew = crewPlanFor(s.provider.serviceId, s.crewDetails ?? defaultDetails(s.provider.serviceId)).map((c, i) => ({
    id: `cr_${s.id}_${i}`,
    role: c.role,
    count: c.count,
    eventId: s.eventForCrew,
    pay: c.pay,
    equipment: c.equipment,
    staffing: s.marketplaceRoles?.includes(c.role) ? ('marketplace' as const) : ('in_house' as const),
  }));
  return {
    id: s.id,
    requirementId: s.requirementId,
    serviceId: s.provider.serviceId,
    providerId: s.provider.id,
    providerName: s.provider.name,
    providerAccountId: s.accountId,
    eventIds: s.eventIds,
    packageName: s.packageName,
    ...split,
    pricingModel: model,
    modelRate: rate,
    status: s.status,
    confirmedAt: s.confirmedAt,
    providerResponse: s.providerResponse ?? (s.status === 'PROPOSED' ? 'pending' : 'accepted'),
    crew,
    assignments: s.assignments ?? [],
    deliverables: s.deliverables ?? [],
    quoteId: s.quoteId,
    createdAt: s.confirmedAt ?? at(-10),
  };
}

function assign(id: string, crewId: string, worker: { id: string; name: string }, role: string, eventId: string, date: string, pay: number, status: Assignment['status'], extra: Partial<Assignment> = {}): Assignment {
  return {
    id,
    crewId,
    workerKind: 'freelancer',
    workerId: worker.id,
    workerName: worker.name,
    role,
    eventId,
    date,
    startTime: '07:00',
    endTime: '21:00',
    pay,
    margin: Math.round(pay * 0.2),
    status,
    confirmedByProvider: status !== 'INVITED',
    ...extra,
  };
}

const fl = (name: string) => {
  const f = FREELANCER_DIRECTORY.find((x) => x.name === name)!;
  return { id: f.id, name: f.name };
};
const RAJ = { id: 'acc_freelancer_demo', name: 'Raj Maharjan' };

function history(...steps: [ProjectStatus, number][]) {
  return steps.map(([status, offset]) => ({ status, at: at(offset, 11), by: status === 'NEW' ? 'Customer' : SITA.name }));
}

function project(p: Omit<Project, 'styles' | 'priorities' | 'inspiration' | 'timeline' | 'incidents' | 'collaborators' | 'updatedAt' | 'budgetMode' | 'source'> & Partial<Project>): Project {
  return {
    styles: {},
    priorities: [],
    inspiration: [],
    timeline: [],
    incidents: [],
    collaborators: [],
    budgetMode: 'overall',
    source: 'plan_wizard',
    updatedAt: p.createdAt,
    ...p,
  };
}

function markTasks(tasks: Project['tasks'], completed: number, doing = 1): Project['tasks'] {
  return tasks.map((t, i) => (i < completed ? { ...t, status: 'COMPLETED' as const, completedAt: at(-20 + i) } : i < completed + doing ? { ...t, status: 'IN_PROGRESS' as const } : t));
}

function paid(ms: PaymentMilestone[], amounts: number[]): PaymentMilestone[] {
  return ms.map((m, i) => {
    const paidAmount = Math.min(m.amount, amounts[i] ?? 0);
    const status = paidAmount >= m.amount ? 'PAID' : paidAmount > 0 ? 'PARTIALLY_PAID' : m.status;
    return { ...m, paidAmount, status };
  });
}

// WP-1021 · Aakriti & Sujan (demo couple, confirmed, planning)
const V1021 = { eng: 'ev_1021_eng', pre: 'ev_1021_pre', meh: 'ev_1021_meh', wed: 'ev_1021_wed', rec: 'ev_1021_rec' };
const CATERER_KTM = pick('catering', 'Kathmandu');
const VIDEO_KTM = pick('videography', 'Kathmandu');
const DECOR_KTM = pick('decoration', 'Kathmandu');
const DECOR_KTM_2 = pick('decoration', 'Kathmandu', 1);
const DRONE_KTM = pick('drone', 'Kathmandu');

function buildQuote1021(): Quotation {
  const items = (cateringRate: number, withDrone: boolean): QuoteItem[] => [
    { id: 'qi_1021_venue', title: `${DEMO_VENUE.name} — Wedding & Reception`, description: '2 functions · hall, garden, jagge area, parking', qty: 2, rate: 180_000, unit: 'function', serviceId: 'venue', requirementId: 'rq_1021_venue', providerId: DEMO_VENUE.id, providerName: DEMO_VENUE.name, cost: 180_000, pricingModel: 'COMMISSION', modelRate: 0.1 },
    { id: 'qi_1021_catering', title: 'Catering — veg + non-veg buffet', description: 'Welcome drinks, 3 live counters, Newari bhoj counter', qty: 1250, rate: cateringRate, unit: 'plate', serviceId: 'catering', requirementId: 'rq_1021_catering', providerId: CATERER_KTM.id, providerName: CATERER_KTM.name, cost: 1_040, pricingModel: 'MARKUP', modelRate: 0.15 },
    { id: 'qi_1021_photo', title: 'Photography — Premium (5 events)', description: '2 photographers + assistant, 400 edited photos, 40-sheet album', qty: 1, rate: 180_000, serviceId: 'photography', requirementId: 'rq_1021_photo', providerId: DEMO_STUDIO.id, providerName: DEMO_STUDIO.name, cost: 180_000, pricingModel: 'COMMISSION', modelRate: 0.12 },
    { id: 'qi_1021_video', title: 'Videography — cinematic film', description: '2 videographers, 4-min highlight, full film', qty: 1, rate: 150_000, serviceId: 'videography', requirementId: 'rq_1021_video', providerId: VIDEO_KTM.id, providerName: VIDEO_KTM.name, cost: 130_000, pricingModel: 'MARKUP', modelRate: 0.15 },
    { id: 'qi_1021_decor', title: 'Decoration — royal floral (wedding + reception)', description: 'Jagge, stage, entrance, fresh flowers', qty: 1, rate: 250_000, serviceId: 'decoration', requirementId: 'rq_1021_decor', providerId: DECOR_KTM.id, providerName: DECOR_KTM.name, cost: 250_000, pricingModel: 'COMMISSION', modelRate: 0.1 },
    ...(withDrone ? [{ id: 'qi_1021_drone', title: 'Drone coverage — wedding day', qty: 1, rate: 20_000, serviceId: 'drone', requirementId: 'rq_1021_drone', providerId: DRONE_KTM.id, providerName: DRONE_KTM.name, cost: 17_000, pricingModel: 'MARKUP' as const, modelRate: 0.15 }] : []),
  ];
  const v1 = { items: items(1_300, false), discount: 0, serviceFee: 25_000, taxRate: TAX_RATE };
  const v2 = { items: items(1_200, true), discount: 60_000, serviceFee: 25_000, taxRate: TAX_RATE };
  const base = { notes: 'Your complete wedding package, coordinated end-to-end by Sita. Prices include setup and teardown.', terms: DEFAULT_TERMS, schedule: DEFAULT_SCHEDULE };
  return {
    id: 'qt_1021',
    number: 'QT-2026-0021',
    fromKind: 'platform',
    fromId: 'platform',
    fromName: 'Vivah Weddings',
    category: 'platform',
    projectId: 'prj_1021',
    customerId: 'acc_customer_demo',
    customerName: 'Aakriti Shrestha',
    eventDate: day(48),
    city: 'Kathmandu',
    title: 'Complete wedding package',
    version: 2,
    ...v2,
    ...base,
    validUntil: day(-20),
    status: 'accepted',
    acceptedVersion: 2,
    versions: [
      { version: 1, ...v1, ...base, validUntil: day(-26), total: quoteTotals(v1).total, sentAt: at(-40), response: { action: 'revision', note: 'Can you bring catering closer to NPR 1,200 per plate and add drone for the wedding day?', at: at(-38, 20) } },
      { version: 2, ...v2, ...base, validUntil: day(-20), total: quoteTotals(v2).total, sentAt: at(-35), changeSummary: 'Catering 1,300 → 1,200 per plate · added drone · package discount NPR 60,000', response: { action: 'accept', at: at(-33, 19) } },
    ],
    createdAt: at(-41),
    updatedAt: at(-33),
  };
}

function buildProject1021(): Project {
  const quote = buildQuote1021();
  const total = quoteTotals(quote).total;
  const milestones = paid(buildMilestones(DEFAULT_SCHEDULE, total, { confirmed: day(-33), event: day(48), lastEvent: day(49) }, quote.id), [Math.round(total * 0.3), 500_000]);
  const photo = booking({
    id: 'bk_1021_photo',
    requirementId: 'rq_1021_photo',
    provider: P(DEMO_STUDIO.id),
    accountId: 'acc_vendor_studio',
    eventIds: [V1021.eng, V1021.pre, V1021.meh, V1021.wed, V1021.rec],
    price: 180_000,
    rate: 0.12,
    status: 'CONFIRMED',
    confirmedAt: at(-33),
    packageName: 'Premium',
    eventForCrew: V1021.wed,
    marketplaceRoles: ['Photographer', 'Editor'],
    quoteId: quote.id,
    deliverables: [
      ...deliverablesFor('photography', day(-25), ['DELIVERED', 'READY_FOR_REVIEW'])
        .slice(0, 2)
        .map((d) => ({ ...d, id: `${d.id}_eng`, title: `Engagement — ${d.title.toLowerCase()}` })),
      ...deliverablesFor('photography', day(48)),
    ],
  });
  const photographer = photo.crew.find((c) => c.role === 'Photographer')!;
  const editor = photo.crew.find((c) => c.role === 'Editor')!;
  photo.assignments = [
    assign('as_1021_raj', photographer.id, RAJ, 'Photographer', V1021.wed, day(48), 8_000, 'CONFIRMED'),
    assign('as_1021_raj_pre', photographer.id, RAJ, 'Photographer', V1021.pre, day(20), 8_000, 'CONFIRMED', { startTime: '05:30', endTime: '12:00' }),
    assign('as_1021_manish', editor.id, fl('Manish Joshi'), 'Editor', V1021.wed, day(48), 6_000, 'ASSIGNED'),
  ];

  const bookings: ServiceBooking[] = [
    booking({ id: 'bk_1021_venue', requirementId: 'rq_1021_venue', provider: P(DEMO_VENUE.id), accountId: 'acc_vendor_demo', eventIds: [V1021.wed, V1021.rec], price: 360_000, status: 'CONFIRMED', confirmedAt: at(-33), quoteId: quote.id }),
    booking({ id: 'bk_1021_catering', requirementId: 'rq_1021_catering', provider: CATERER_KTM, eventIds: [V1021.wed, V1021.rec], price: 1_300_000, model: 'MARKUP', status: 'CONFIRMED', confirmedAt: at(-33), eventForCrew: V1021.wed, quoteId: quote.id }),
    photo,
    booking({ id: 'bk_1021_video', requirementId: 'rq_1021_video', provider: VIDEO_KTM, eventIds: [V1021.pre, V1021.wed, V1021.rec], price: 130_000, model: 'MARKUP', status: 'HELD', providerResponse: 'pending', eventForCrew: V1021.wed, quoteId: quote.id }),
    booking({ id: 'bk_1021_drone', requirementId: 'rq_1021_drone', provider: DRONE_KTM, eventIds: [V1021.wed], price: 17_000, model: 'MARKUP', status: 'CONFIRMED', confirmedAt: at(-32), eventForCrew: V1021.wed, quoteId: quote.id }),
    booking({ id: 'bk_1021_decor', requirementId: 'rq_1021_decor', provider: DECOR_KTM, eventIds: [V1021.wed, V1021.rec], price: 250_000, status: 'PROPOSED', eventForCrew: V1021.wed, quoteId: quote.id, deliverables: deliverablesFor('decoration', day(48), ['IN_PROGRESS']) }),
  ];

  const tasks = markTasks(generateTasks(day(48), ['venue', 'catering', 'photography', 'videography', 'decoration', 'makeup', 'dj', 'pandit', 'drone', 'pre-wedding', 'bridal-wear', 'groom-wear', 'invitation'], 'Aakriti Shrestha', SITA.name), 6, 2);
  tasks.push(
    { id: 'tk_1021_int1', title: 'Push videographer for availability confirmation', assigneeKind: 'coordinator', assigneeId: SITA.id, assigneeName: SITA.name, due: day(2), status: 'IN_PROGRESS', priority: 'high', category: 'Vendors', visibility: 'internal', createdAt: at(-3) },
    { id: 'tk_1021_int2', title: 'Book second photographer via gig', assigneeKind: 'provider', assigneeName: DEMO_STUDIO.name, bookingId: 'bk_1021_photo', due: day(14), status: 'WAITING', priority: 'medium', category: 'Crew', visibility: 'shared', createdAt: at(-4) },
    { id: 'tk_1021_decor', title: 'Upload decoration concepts', assigneeKind: 'provider', assigneeName: DECOR_KTM.name, bookingId: 'bk_1021_decor', due: day(10), status: 'TODO', priority: 'high', category: 'Decor', visibility: 'shared', createdAt: at(-5) },
  );

  return project({
    id: 'prj_1021',
    code: 'WP-1021',
    title: 'Aakriti & Sujan',
    customerId: 'acc_customer_demo',
    customerName: 'Aakriti Shrestha',
    customerPhone: '9800000001',
    partnerName: 'Sujan Maharjan',
    eventType: 'WEDDING',
    city: 'Kathmandu',
    area: 'Tinkune',
    venueSelected: DEMO_VENUE.name,
    weddingDate: day(48),
    guests: 600,
    budget: 3_500_000,
    status: 'CONFIRMED',
    statusHistory: history(['NEW', -45], ['REVIEWING', -45], ['MATCHING_PROVIDERS', -43], ['QUOTE_PREPARED', -41], ['QUOTE_SENT', -40], ['CUSTOMER_NEGOTIATING', -38], ['QUOTE_SENT', -35], ['CONFIRMED', -33]),
    managedBy: 'platform',
    coordinatorId: SITA.id,
    coordinatorName: SITA.name,
    geniePackageId: 'signature',
    styles: { photography: ['Candid', 'Cinematic'], decoration: ['Royal', 'Floral'], makeup: ['Natural'], catering: ['Newari bhoj', 'Live counters'] },
    priorities: ['Photography', 'Food', 'Decor'],
    notes: 'Bride wants natural makeup. Drone is required for the wedding. Need the same photo team for engagement and wedding. Outdoor pre-wedding at Nagarkot at sunrise.',
    inspiration: ['decorMandapFloral', 'ideaBrideParasol', 'decorMandapNight'],
    events: [
      ev(V1021.eng, 'ENGAGEMENT', day(-25), 'Rhododendron Banquet', 'Kathmandu', 250, { status: 'done', runSheet: runSheet('ENGAGEMENT', ['done', 'done', 'done', 'done']) }),
      ev(V1021.pre, 'PRE_WEDDING', day(20), 'Nagarkot viewpoint', 'Nagarkot', 0),
      ev(V1021.meh, 'MEHENDI', day(46), 'Shrestha residence, Baneshwor', 'Kathmandu', 200),
      ev(V1021.wed, 'WEDDING', day(48), DEMO_VENUE.name, 'Kathmandu', 600, { venueProviderId: DEMO_VENUE.id }),
      ev(V1021.rec, 'RECEPTION', day(49), DEMO_VENUE.name, 'Kathmandu', 650, { venueProviderId: DEMO_VENUE.id }),
    ],
    requirements: [
      req('rq_1021_venue', 'venue', [V1021.wed, V1021.rec], 'CONFIRMED', { budgetMin: 120_000, budgetMax: 200_000, styles: ['Indoor', 'Garden'] }),
      req('rq_1021_catering', 'catering', [V1021.wed, V1021.rec], 'CONFIRMED', { budgetMin: 900, budgetMax: 1_250, styles: ['Newari bhoj', 'Live counters'] }),
      req('rq_1021_photo', 'photography', [V1021.eng, V1021.pre, V1021.meh, V1021.wed, V1021.rec], 'CONFIRMED', { budgetMin: 120_000, budgetMax: 200_000, styles: ['Candid', 'Cinematic'] }),
      req('rq_1021_video', 'videography', [V1021.pre, V1021.wed, V1021.rec], 'QUOTED', { budgetMin: 100_000, budgetMax: 160_000, styles: ['Cinematic'] }),
      req('rq_1021_drone', 'drone', [V1021.wed], 'CONFIRMED', { budgetMax: 25_000 }),
      req('rq_1021_decor', 'decoration', [V1021.wed, V1021.rec], 'QUOTED', { budgetMin: 150_000, budgetMax: 280_000, styles: ['Royal', 'Floral'] }),
      req('rq_1021_makeup', 'makeup', [V1021.eng, V1021.wed, V1021.rec], 'MATCHING', { budgetMin: 25_000, budgetMax: 60_000, styles: ['Natural'] }),
      req('rq_1021_dj', 'dj', [V1021.rec], 'OPEN', { budgetMax: 50_000 }),
      req('rq_1021_pandit', 'pandit', [V1021.wed], 'OPEN', { budgetMax: 25_000, styles: ['Brahmin/Chhetri'] }),
    ],
    bookings,
    tasks,
    timeline: [
      { id: 'tl_1021_visit', date: day(-38), title: 'Venue site visit with the families', kind: 'meeting', done: true, time: '11:00', location: DEMO_VENUE.name },
      { id: 'tl_1021_decor', date: day(10), title: 'Decoration concept approval', kind: 'milestone', done: false },
      { id: 'tl_1021_menu', date: day(18), title: 'Menu tasting at the party palace', kind: 'meeting', done: false, time: '13:00', location: DEMO_VENUE.name },
      { id: 'tl_1021_final', date: day(46), title: 'Final coordination meeting', kind: 'meeting', done: false, time: '16:00', location: 'Vivah office, Baneshwor' },
      { id: 'tl_1021_int', date: day(40), title: 'Crew briefing (internal)', kind: 'meeting', done: false, internal: true },
    ],
    milestones,
    collaborators: [
      { id: 'col_1021_sujan', name: 'Sujan Maharjan', phone: '9800000011', relation: 'Partner', permission: 'editor', inviteCode: 'AKSJ21', joinedAt: at(-44) },
      { id: 'col_1021_mom', name: 'Sarita Shrestha', phone: '9800000012', relation: 'Mother', permission: 'viewer', inviteCode: 'SRMA21' },
    ],
    createdAt: at(-45),
    updatedAt: at(-1),
    driveFolder: 'Wedding Projects/WP-1021-Aakriti-Sujan',
  });
}

// WP-1017 · Pratiksha & Bibek (wedding today, Pokhara)
function buildProject1017(): Project {
  const e = { meh: 'ev_1017_meh', wed: 'ev_1017_wed', rec: 'ev_1017_rec' };
  const venue = pick('venue', 'Pokhara');
  const photo = booking({ id: 'bk_1017_photo', requirementId: 'rq_1017_photo', provider: pick('photography', 'Pokhara'), eventIds: [e.meh, e.wed, e.rec], price: 150_000, status: 'IN_PROGRESS', confirmedAt: at(-80), eventForCrew: e.wed, marketplaceRoles: ['Photographer'] });
  const photographer = photo.crew.find((c) => c.role === 'Photographer')!;
  photo.assignments = [
    assign('as_1017_aarati', photographer.id, fl('Aarati Gurung'), 'Photographer', e.wed, day(0), 8_500, 'CHECKED_IN', { checkedInAt: at(0, 7, 12), checkInNote: 'At venue — lakeside gate' }),
    assign('as_1017_dipak', photographer.id, fl('Dipak Paudel'), 'Photographer', e.wed, day(0), 8_000, 'EMERGENCY_REPLACEMENT', { checkInNote: 'Called in sick at 6:10 AM (fever)' }),
  ];
  const video = booking({ id: 'bk_1017_video', requirementId: 'rq_1017_video', provider: pick('videography', 'Pokhara'), eventIds: [e.wed, e.rec], price: 120_000, model: 'MARKUP', status: 'IN_PROGRESS', confirmedAt: at(-80), eventForCrew: e.wed, marketplaceRoles: ['Videographer'] });
  const vg = video.crew.find((c) => c.role === 'Videographer')!;
  video.assignments = [assign('as_1017_santosh', vg.id, fl('Santosh Thapa'), 'Videographer', e.wed, day(0), 9_000, 'IN_PROGRESS', { checkedInAt: at(0, 6, 55) })];
  const total = 1_950_000;
  return project({
    id: 'prj_1017',
    code: 'WP-1017',
    title: 'Pratiksha & Bibek',
    customerId: 'acc_customer_pratiksha',
    customerName: 'Pratiksha Gurung',
    customerPhone: '9800000021',
    partnerName: 'Bibek Thapa',
    eventType: 'WEDDING',
    city: 'Pokhara',
    area: 'Lakeside',
    weddingDate: day(0),
    guests: 350,
    budget: 2_200_000,
    status: 'IN_PROGRESS',
    statusHistory: history(['NEW', -120], ['REVIEWING', -119], ['QUOTE_SENT', -110], ['CONFIRMED', -100], ['IN_PROGRESS', -1]),
    managedBy: 'platform',
    coordinatorId: SITA.id,
    coordinatorName: SITA.name,
    events: [
      ev(e.meh, 'MEHENDI', day(-1), venue.name, 'Pokhara', 150, { status: 'done', runSheet: runSheet('MEHENDI', ['done', 'done', 'done', 'done']) }),
      ev(e.wed, 'WEDDING', day(0), venue.name, 'Pokhara', 350, { status: 'live', runSheet: runSheet('WEDDING', ['done', 'done', 'done', 'in_progress', 'delayed', 'pending', 'pending', 'pending']) }),
      ev(e.rec, 'RECEPTION', day(1), venue.name, 'Pokhara', 380),
    ],
    requirements: [
      req('rq_1017_venue', 'venue', [e.meh, e.wed, e.rec], 'CONFIRMED'),
      req('rq_1017_catering', 'catering', [e.wed, e.rec], 'CONFIRMED'),
      req('rq_1017_photo', 'photography', [e.meh, e.wed, e.rec], 'CONFIRMED'),
      req('rq_1017_video', 'videography', [e.wed, e.rec], 'CONFIRMED'),
      req('rq_1017_decor', 'decoration', [e.wed, e.rec], 'CONFIRMED'),
    ],
    bookings: [
      booking({ id: 'bk_1017_venue', requirementId: 'rq_1017_venue', provider: venue, eventIds: [e.meh, e.wed, e.rec], price: 450_000, status: 'IN_PROGRESS', confirmedAt: at(-100) }),
      booking({ id: 'bk_1017_catering', requirementId: 'rq_1017_catering', provider: pick('catering', 'Pokhara'), eventIds: [e.wed, e.rec], price: 850_000, model: 'MARKUP', status: 'IN_PROGRESS', confirmedAt: at(-100), eventForCrew: e.wed }),
      photo,
      video,
      booking({ id: 'bk_1017_decor', requirementId: 'rq_1017_decor', provider: pick('decoration', 'Pokhara'), eventIds: [e.wed, e.rec], price: 220_000, status: 'IN_PROGRESS', confirmedAt: at(-95), eventForCrew: e.wed }),
    ],
    tasks: [
      { id: 'tk_1017_1', title: 'Confirm janti bus pickup at 9:30', assigneeKind: 'coordinator', assigneeName: SITA.name, due: day(0), status: 'IN_PROGRESS', priority: 'urgent', category: 'Logistics', visibility: 'shared', createdAt: at(-2) },
      { id: 'tk_1017_2', title: 'Find replacement photographer', assigneeKind: 'coordinator', assigneeName: SITA.name, due: day(0), status: 'IN_PROGRESS', priority: 'urgent', category: 'Crew', visibility: 'internal', createdAt: at(0, 6, 20) },
      { id: 'tk_1017_3', title: 'Collect final payment after reception', assigneeKind: 'coordinator', assigneeName: SITA.name, due: day(3), status: 'TODO', priority: 'medium', category: 'Payments', visibility: 'internal', createdAt: at(-3) },
    ],
    milestones: paid(buildMilestones(DEFAULT_SCHEDULE, total, { confirmed: day(-100), event: day(0), lastEvent: day(1) }), [Math.round(total * 0.3), Math.round(total * 0.5)]),
    incidents: [
      { id: 'inc_1017_1', eventId: e.wed, title: 'Photographer Dipak called in sick — emergency replacement started', severity: 'high', status: 'open', reportedBy: 'Wedding Story crew lead', at: at(0, 6, 15) },
      { id: 'inc_1017_2', eventId: e.wed, title: 'Janti running 20 minutes late (traffic at Prithvi Chowk)', severity: 'medium', status: 'open', reportedBy: SITA.name, at: at(0, 10, 40) },
    ],
    createdAt: at(-120),
  });
}

// WP-1030 · Srijana & Nabin (brand-new lead)
function buildProject1030(): Project {
  const e = { eng: 'ev_1030_eng', wed: 'ev_1030_wed', rec: 'ev_1030_rec' };
  return project({
    id: 'prj_1030',
    code: 'WP-1030',
    title: 'Srijana & Nabin',
    customerId: 'acc_customer_srijana',
    customerName: 'Srijana Maharjan',
    customerPhone: '9800000031',
    partnerName: 'Nabin Shakya',
    eventType: 'WEDDING',
    city: 'Lalitpur',
    area: 'Jhamsikhel',
    weddingDate: day(95),
    guests: 400,
    budget: 2_500_000,
    status: 'NEW',
    statusHistory: history(['NEW', 0]),
    managedBy: 'platform',
    styles: { photography: ['Candid', 'Documentary'], decoration: ['Minimal', 'Floral'], makeup: ['Natural'] },
    priorities: ['Photography', 'Decor'],
    notes: 'We need outdoor pre-wedding near Pokhara. Bride wants natural makeup. Drone is required. Need same team for engagement and wedding.',
    inspiration: ['ideaCoupleGardenWalk', 'venueGardenEstate'],
    events: [
      ev(e.eng, 'ENGAGEMENT', day(70), 'To be decided', 'Lalitpur', 200),
      ev(e.wed, 'WEDDING', day(95), 'To be decided', 'Lalitpur', 400),
      ev(e.rec, 'RECEPTION', null, 'To be decided', 'Lalitpur', 450, { dateConfirmed: false }),
    ],
    requirements: [
      req('rq_1030_venue', 'venue', [e.wed, e.rec], 'OPEN', { budgetMin: 150_000, budgetMax: 250_000, styles: ['Garden'] }),
      req('rq_1030_catering', 'catering', [e.eng, e.wed, e.rec], 'OPEN', { budgetMin: 800, budgetMax: 1_200 }),
      req('rq_1030_photo', 'photography', [e.eng, e.wed, e.rec], 'OPEN', { budgetMin: 40_000, budgetMax: 60_000, styles: ['Candid', 'Documentary'] }),
      req('rq_1030_video', 'videography', [e.wed, e.rec], 'OPEN', { budgetMin: 50_000, budgetMax: 80_000 }),
      req('rq_1030_drone', 'drone', [e.wed], 'OPEN', { budgetMax: 25_000 }),
      req('rq_1030_decor', 'decoration', [e.wed, e.rec], 'OPEN', { budgetMin: 100_000, budgetMax: 180_000, styles: ['Minimal', 'Floral'] }),
      req('rq_1030_makeup', 'makeup', [e.eng, e.wed], 'OPEN', { budgetMin: 20_000, budgetMax: 45_000, styles: ['Natural'] }),
    ],
    bookings: [],
    tasks: generateTasks(day(95), ['venue', 'catering', 'photography', 'videography', 'decoration', 'makeup', 'drone'], 'Srijana Maharjan', 'Your coordinator'),
    milestones: [],
    createdAt: at(0, 8, 40),
  });
}

// WP-1026 · Anisha & Rojan (quote sent)
function buildProject1026(): { project: Project; quote: Quotation } {
  const e = { wed: 'ev_1026_wed', rec: 'ev_1026_rec' };
  const venue = pick('venue', 'Bhaktapur');
  const caterer = pick('catering', 'Bhaktapur');
  const photo = pick('photography', 'Bhaktapur');
  const items: QuoteItem[] = [
    { id: 'qi_1026_1', title: `${venue.name} — Wedding & Reception`, qty: 2, rate: 220_000, unit: 'function', serviceId: 'venue', requirementId: 'rq_1026_venue', providerId: venue.id, providerName: venue.name, cost: 220_000, pricingModel: 'COMMISSION', modelRate: 0.1 },
    { id: 'qi_1026_2', title: 'Newari bhoj catering', qty: 700, rate: 1_150, unit: 'plate', serviceId: 'catering', requirementId: 'rq_1026_catering', providerId: caterer.id, providerName: caterer.name, cost: 1_000, pricingModel: 'MARKUP', modelRate: 0.15 },
    { id: 'qi_1026_3', title: 'Photography — Signature', qty: 1, rate: 95_000, serviceId: 'photography', requirementId: 'rq_1026_photo', providerId: photo.id, providerName: photo.name, cost: 95_000, pricingModel: 'COMMISSION', modelRate: 0.1 },
    { id: 'qi_1026_4', title: 'Studio photography crew (Wedding Story Nepal)', qty: 1, rate: 60_000, serviceId: 'videography', requirementId: 'rq_1026_video', providerId: DEMO_STUDIO.id, providerName: DEMO_STUDIO.name, cost: 60_000, pricingModel: 'COMMISSION', modelRate: 0.12 },
  ];
  const q = { items, discount: 25_000, serviceFee: 20_000, taxRate: TAX_RATE };
  const quote: Quotation = {
    id: 'qt_1026',
    number: 'QT-2026-0026',
    fromKind: 'platform',
    fromId: 'platform',
    fromName: 'Vivah Weddings',
    category: 'platform',
    projectId: 'prj_1026',
    customerId: 'acc_customer_anisha',
    customerName: 'Anisha Bajracharya',
    eventDate: day(62),
    city: 'Bhaktapur',
    title: 'Wedding & reception package',
    version: 1,
    ...q,
    notes: 'Heritage courtyard wedding with a Newari bhoj. Includes jagge setup and parking attendants.',
    terms: DEFAULT_TERMS,
    validUntil: day(8),
    schedule: DEFAULT_SCHEDULE,
    status: 'viewed',
    versions: [{ version: 1, ...q, notes: '', terms: DEFAULT_TERMS, validUntil: day(8), schedule: DEFAULT_SCHEDULE, total: quoteTotals(q).total, sentAt: at(-2) }],
    createdAt: at(-3),
    updatedAt: at(-1),
  };
  const p = project({
    id: 'prj_1026',
    code: 'WP-1026',
    title: 'Anisha & Rojan',
    customerId: 'acc_customer_anisha',
    customerName: 'Anisha Bajracharya',
    customerPhone: '9800000041',
    partnerName: 'Rojan Tuladhar',
    eventType: 'WEDDING',
    city: 'Bhaktapur',
    weddingDate: day(62),
    guests: 350,
    budget: 1_800_000,
    status: 'QUOTE_SENT',
    statusHistory: history(['NEW', -9], ['REVIEWING', -9], ['MATCHING_PROVIDERS', -7], ['QUOTE_PREPARED', -3], ['QUOTE_SENT', -2]),
    managedBy: 'platform',
    coordinatorId: SITA.id,
    coordinatorName: SITA.name,
    events: [ev(e.wed, 'WEDDING', day(62), venue.name, 'Bhaktapur', 350), ev(e.rec, 'RECEPTION', day(62), venue.name, 'Bhaktapur', 350, { startTime: '18:00' })],
    requirements: [
      req('rq_1026_venue', 'venue', [e.wed, e.rec], 'QUOTED'),
      req('rq_1026_catering', 'catering', [e.wed, e.rec], 'QUOTED'),
      req('rq_1026_photo', 'photography', [e.wed, e.rec], 'QUOTED'),
      req('rq_1026_video', 'videography', [e.wed, e.rec], 'QUOTED'),
    ],
    bookings: [
      booking({ id: 'bk_1026_venue', requirementId: 'rq_1026_venue', provider: venue, eventIds: [e.wed, e.rec], price: 440_000, status: 'HELD', quoteId: quote.id }),
      booking({ id: 'bk_1026_catering', requirementId: 'rq_1026_catering', provider: caterer, eventIds: [e.wed, e.rec], price: 700_000, model: 'MARKUP', status: 'PROPOSED', quoteId: quote.id }),
      booking({ id: 'bk_1026_photo', requirementId: 'rq_1026_photo', provider: photo, eventIds: [e.wed, e.rec], price: 95_000, status: 'PROPOSED', quoteId: quote.id }),
      booking({ id: 'bk_1026_video', requirementId: 'rq_1026_video', provider: P(DEMO_STUDIO.id), accountId: 'acc_vendor_studio', eventIds: [e.wed, e.rec], price: 60_000, rate: 0.12, status: 'PROPOSED', providerResponse: 'pending', quoteId: quote.id }),
    ],
    tasks: [],
    milestones: [],
    createdAt: at(-9),
  });
  return { project: p, quote };
}

// WP-1009 · Sarina & Prabin (completed, deliverables)
function buildProject1009(): Project {
  const e = { wed: 'ev_1009_wed', rec: 'ev_1009_rec' };
  const photo = booking({
    id: 'bk_1009_photo',
    requirementId: 'rq_1009_photo',
    provider: P(DEMO_STUDIO.id),
    accountId: 'acc_vendor_studio',
    eventIds: [e.wed, e.rec],
    price: 140_000,
    rate: 0.12,
    status: 'COMPLETED',
    confirmedAt: at(-120),
    eventForCrew: e.wed,
    marketplaceRoles: ['Photographer'],
    deliverables: deliverablesFor('photography', day(-20), ['DELIVERED', 'READY_FOR_REVIEW', 'IN_PROGRESS']),
  });
  photo.deliverables = [...photo.deliverables, ...deliverablesFor('videography', day(-20), ['DELIVERED', 'IN_PROGRESS', 'NOT_STARTED'])];
  const ph = photo.crew.find((c) => c.role === 'Photographer')!;
  photo.assignments = [
    assign('as_1009_raj', ph.id, RAJ, 'Photographer', e.wed, day(-20), 8_000, 'COMPLETED', { checkedInAt: at(-20, 6, 50), checkedOutAt: at(-20, 21, 5) }),
    assign('as_1009_pooja', ph.id, fl('Pooja Shrestha'), 'Photographer', e.wed, day(-20), 7_500, 'COMPLETED', { checkedInAt: at(-20, 7, 20), checkedOutAt: at(-20, 21, 0), lateMinutes: 20 }),
  ];
  const venue = pick('venue', 'Kathmandu', 2);
  const total = 1_400_000;
  return project({
    id: 'prj_1009',
    code: 'WP-1009',
    title: 'Sarina & Prabin',
    customerId: 'acc_customer_sarina',
    customerName: 'Sarina Karki',
    customerPhone: '9800000051',
    partnerName: 'Prabin Rai',
    eventType: 'WEDDING',
    city: 'Kathmandu',
    weddingDate: day(-20),
    guests: 450,
    budget: 1_600_000,
    status: 'COMPLETED',
    statusHistory: history(['NEW', -160], ['CONFIRMED', -120], ['IN_PROGRESS', -21], ['COMPLETED', -18]),
    managedBy: 'platform',
    coordinatorId: SITA.id,
    coordinatorName: SITA.name,
    events: [
      ev(e.wed, 'WEDDING', day(-20), venue.name, 'Kathmandu', 450, { status: 'done', runSheet: runSheet('WEDDING', Array(8).fill('done')) }),
      ev(e.rec, 'RECEPTION', day(-19), venue.name, 'Kathmandu', 500, { status: 'done', runSheet: runSheet('RECEPTION', Array(5).fill('done')) }),
    ],
    requirements: [req('rq_1009_venue', 'venue', [e.wed, e.rec], 'CONFIRMED'), req('rq_1009_photo', 'photography', [e.wed, e.rec], 'CONFIRMED'), req('rq_1009_catering', 'catering', [e.wed, e.rec], 'CONFIRMED')],
    bookings: [
      booking({ id: 'bk_1009_venue', requirementId: 'rq_1009_venue', provider: venue, eventIds: [e.wed, e.rec], price: 380_000, status: 'COMPLETED', confirmedAt: at(-120) }),
      booking({ id: 'bk_1009_catering', requirementId: 'rq_1009_catering', provider: pick('catering', 'Kathmandu', 1), eventIds: [e.wed, e.rec], price: 800_000, model: 'MARKUP', status: 'COMPLETED', confirmedAt: at(-120) }),
      photo,
    ],
    tasks: [{ id: 'tk_1009_1', title: 'Review your vendors', assigneeKind: 'customer', assigneeName: 'Sarina Karki', due: day(3), status: 'TODO', priority: 'medium', category: 'Reviews', visibility: 'shared', createdAt: at(-15) }],
    milestones: paid(buildMilestones(DEFAULT_SCHEDULE, total, { confirmed: day(-120), event: day(-20), lastEvent: day(-19) }), [Math.round(total * 0.3), Math.round(total * 0.5), 0]),
    createdAt: at(-160),
  });
}

// Smaller projects across the pipeline
function buildPipeline(): Project[] {
  const pasni = project({
    id: 'prj_1033',
    code: 'WP-1033',
    title: "Baby Aarav's Pasni",
    customerId: 'acc_customer_rashmi',
    customerName: 'Rashmi Thapa',
    customerPhone: '9800000061',
    eventType: 'PASNI',
    city: 'Chitwan',
    weddingDate: day(40),
    guests: 150,
    budget: 400_000,
    status: 'NEEDS_CLARIFICATION',
    statusHistory: history(['NEW', -3], ['REVIEWING', -2], ['NEEDS_CLARIFICATION', -2]),
    managedBy: 'platform',
    coordinatorId: SITA.id,
    coordinatorName: SITA.name,
    notes: 'Date depends on the pandit — somewhere in Mangsir. Want it at a garden venue.',
    events: [ev('ev_1033_pasni', 'PASNI', null, 'To be decided', 'Chitwan', 150, { dateConfirmed: false })],
    requirements: [
      req('rq_1033_venue', 'venue', ['ev_1033_pasni'], 'OPEN', { budgetMax: 80_000, styles: ['Garden'] }),
      req('rq_1033_catering', 'catering', ['ev_1033_pasni'], 'OPEN', { budgetMax: 1_000 }),
      req('rq_1033_photo', 'photography', ['ev_1033_pasni'], 'OPEN', { budgetMax: 35_000 }),
      req('rq_1033_pandit', 'pandit', ['ev_1033_pasni'], 'OPEN', { budgetMax: 15_000 }),
    ],
    bookings: [],
    tasks: [{ id: 'tk_1033_1', title: 'Call Rashmi to confirm the Pasni date with her pandit', assigneeKind: 'coordinator', assigneeName: SITA.name, due: day(1), status: 'TODO', priority: 'high', category: 'Clarification', visibility: 'internal', createdAt: at(-2) }],
    milestones: [],
    createdAt: at(-3),
  });
  const brata = project({
    id: 'prj_1035',
    code: 'WP-1035',
    title: "Kushal's Bratabandha",
    customerId: 'acc_customer_hari',
    customerName: 'Hari Neupane',
    customerPhone: '9800000071',
    eventType: 'BRATABANDHA',
    city: 'Butwal',
    weddingDate: day(33),
    guests: 300,
    budget: 700_000,
    status: 'MATCHING_PROVIDERS',
    statusHistory: history(['NEW', -5], ['REVIEWING', -4], ['MATCHING_PROVIDERS', -1]),
    managedBy: 'platform',
    coordinatorId: 'acc_platform_admin',
    coordinatorName: 'Bikram Adhikari',
    events: [ev('ev_1035_brata', 'BRATABANDHA', day(33), 'To be decided', 'Butwal', 300)],
    requirements: [
      req('rq_1035_venue', 'venue', ['ev_1035_brata'], 'MATCHING', { budgetMax: 120_000 }),
      req('rq_1035_catering', 'catering', ['ev_1035_brata'], 'MATCHING', { budgetMax: 1_000 }),
      req('rq_1035_photo', 'photography', ['ev_1035_brata'], 'MATCHING', { budgetMax: 50_000 }),
      req('rq_1035_baja', 'panche-baja', ['ev_1035_brata'], 'OPEN', { budgetMax: 30_000 }),
      req('rq_1035_pandit', 'pandit', ['ev_1035_brata'], 'OPEN', { budgetMax: 25_000 }),
    ],
    bookings: [],
    tasks: [],
    milestones: [],
    createdAt: at(-5),
  });
  const nikita = project({
    id: 'prj_1012',
    code: 'WP-1012',
    title: 'Nikita & Suman',
    customerId: 'acc_customer_nikita',
    customerName: 'Nikita Joshi',
    customerPhone: '9800000081',
    partnerName: 'Suman Pradhan',
    eventType: 'WEDDING',
    city: 'Kathmandu',
    weddingDate: day(110),
    guests: 500,
    budget: 2_800_000,
    status: 'CUSTOMER_NEGOTIATING',
    statusHistory: history(['NEW', -20], ['REVIEWING', -19], ['MATCHING_PROVIDERS', -18], ['QUOTE_SENT', -12], ['CUSTOMER_NEGOTIATING', -6]),
    managedBy: 'platform',
    coordinatorId: SITA.id,
    coordinatorName: SITA.name,
    events: [ev('ev_1012_wed', 'WEDDING', day(110), DEMO_VENUE.name, 'Kathmandu', 500), ev('ev_1012_rec', 'RECEPTION', day(111), DEMO_VENUE.name, 'Kathmandu', 550)],
    requirements: [
      req('rq_1012_venue', 'venue', ['ev_1012_wed', 'ev_1012_rec'], 'QUOTED'),
      req('rq_1012_decor', 'decoration', ['ev_1012_wed', 'ev_1012_rec'], 'QUOTED', { budgetMax: 200_000 }),
      req('rq_1012_photo', 'photography', ['ev_1012_wed', 'ev_1012_rec'], 'SHORTLISTED'),
    ],
    bookings: [
      booking({ id: 'bk_1012_venue', requirementId: 'rq_1012_venue', provider: P(DEMO_VENUE.id), accountId: 'acc_vendor_demo', eventIds: ['ev_1012_wed', 'ev_1012_rec'], price: 360_000, status: 'PROPOSED', providerResponse: 'pending', quoteId: 'qt_1012' }),
      booking({ id: 'bk_1012_decor', requirementId: 'rq_1012_decor', provider: DECOR_KTM_2, eventIds: ['ev_1012_wed', 'ev_1012_rec'], price: 260_000, status: 'PROPOSED', quoteId: 'qt_1012' }),
    ],
    tasks: [],
    milestones: [],
    createdAt: at(-20),
  });
  const sneha = project({
    id: 'prj_1051',
    code: 'WP-1051',
    title: 'Sneha & Arjun',
    customerId: 'acc_customer_sneha',
    customerName: 'Sneha Rai',
    customerPhone: '9800000091',
    eventType: 'WEDDING',
    city: DEMO_VENUE.city,
    weddingDate: day(30),
    guests: 250,
    budget: 1_200_000,
    status: 'CONFIRMED',
    statusHistory: history(['NEW', -28], ['CONFIRMED', -26]),
    managedBy: 'self',
    source: 'enquiry',
    events: [ev('ev_1051_wed', 'WEDDING', day(30), DEMO_VENUE.name, DEMO_VENUE.city, 250), ev('ev_1051_rec', 'RECEPTION', day(30), DEMO_VENUE.name, DEMO_VENUE.city, 250, { startTime: '18:00' })],
    requirements: [req('rq_1051_venue', 'venue', ['ev_1051_wed', 'ev_1051_rec'], 'CONFIRMED')],
    bookings: [booking({ id: 'bk_1051_venue', requirementId: 'rq_1051_venue', provider: P(DEMO_VENUE.id), accountId: 'acc_vendor_demo', eventIds: ['ev_1051_wed', 'ev_1051_rec'], price: 650_000, status: 'CONFIRMED', confirmedAt: at(-26), quoteId: 'qt_sneha', eventForCrew: 'ev_1051_wed' })],
    tasks: [
      { id: 'tk_1051_1', title: 'Menu tasting with the couple', assigneeKind: 'provider', assigneeName: 'Rajesh Pradhan', due: day(12), status: 'TODO', priority: 'medium', category: 'Food', visibility: 'shared', createdAt: at(-20) },
      { id: 'tk_1051_2', title: 'Share jagge & stage layout', assigneeKind: 'provider', assigneeName: 'Rajesh Pradhan', due: day(8), status: 'IN_PROGRESS', priority: 'high', category: 'Venue', visibility: 'shared', createdAt: at(-20) },
    ],
    milestones: paid(buildMilestones(DEFAULT_SCHEDULE, 734_500, { confirmed: day(-26), event: day(30) }, 'qt_sneha'), [220_350]),
    createdAt: at(-28),
  });
  // WP-1040 · the newborn demo family (Sarita Duwal): Aarohi's pasni in Bhaktapur.
  const e1040 = { nwaran: 'ev_1040_nwaran', pasni: 'ev_1040_pasni' };
  const aarohi = project({
    id: 'prj_1040',
    code: 'WP-1040',
    title: 'Aarohi’s pasni',
    customerId: 'acc_customer_newborn',
    customerName: 'Sarita Duwal',
    customerPhone: '9800000009',
    eventType: 'PASNI',
    occasion: 'newborn',
    honourees: { kind: 'baby', names: ['Aarohi'], dob: day(-160) },
    city: 'Bhaktapur',
    area: 'Suryamadhi',
    weddingDate: day(35),
    guests: 150,
    budget: 450_000,
    status: 'MATCHING_PROVIDERS',
    statusHistory: history(['NEW', -6], ['REVIEWING', -6], ['MATCHING_PROVIDERS', -4]),
    managedBy: 'platform',
    coordinatorId: SITA.id,
    coordinatorName: SITA.name,
    styles: { decoration: ['Newari', 'Traditional'] },
    notes: 'Pasni at home in the courtyard with lunch for about 150. Hajurba’s purohit does the puja; we need photos, catering, a small decor setup and a cake for the cousins.',
    inspiration: ['ideaCeremonyHands'],
    events: [
      ev(e1040.nwaran, 'NWARAN', day(-149), 'Home, Suryamadhi', 'Bhaktapur', 30, { status: 'done' }),
      ev(e1040.pasni, 'PASNI', day(35), 'Home courtyard, Suryamadhi', 'Bhaktapur', 150),
    ],
    requirements: [
      req('rq_1040_pandit', 'pandit', [e1040.pasni], 'OPEN', { budgetMax: 15_000 }),
      req('rq_1040_photo', 'photography', [e1040.pasni], 'MATCHING', { budgetMin: 20_000, budgetMax: 35_000, styles: ['Candid'] }),
      req('rq_1040_catering', 'catering', [e1040.pasni], 'MATCHING', { budgetMin: 700, budgetMax: 1_000 }),
      req('rq_1040_decor', 'decoration', [e1040.pasni], 'OPEN', { budgetMax: 60_000, styles: ['Newari', 'Traditional'] }),
      req('rq_1040_cake', 'cake', [e1040.pasni], 'OPEN', { budgetMax: 8_000 }),
    ],
    bookings: [],
    tasks: markTasks(generateTasks(day(35), ['pandit', 'photography', 'catering', 'decoration', 'cake'], 'Sarita Duwal', SITA.name), 2),
    milestones: [],
    createdAt: at(-6),
  });
  return [pasni, brata, nikita, sneha, aarohi];
}

// Quotes that stand alone (vendor quotes, negotiations)
function buildOtherQuotes(): Quotation[] {
  const base = { taxRate: TAX_RATE, terms: DEFAULT_TERMS, schedule: DEFAULT_SCHEDULE, serviceFee: 0 };
  const nikitaV1 = {
    items: [
      { id: 'qi_1012_1', title: `${DEMO_VENUE.name} — Wedding & Reception`, qty: 2, rate: 180_000, serviceId: 'venue', providerId: DEMO_VENUE.id, providerName: DEMO_VENUE.name, cost: 180_000, pricingModel: 'COMMISSION' as const, modelRate: 0.1 },
      { id: 'qi_1012_2', title: 'Decoration — luxury floral', qty: 1, rate: 320_000, serviceId: 'decoration', providerId: DECOR_KTM_2.id, providerName: DECOR_KTM_2.name, cost: 320_000, pricingModel: 'COMMISSION' as const, modelRate: 0.1 },
    ],
    discount: 0,
    serviceFee: 20_000,
  };
  const snehaItems = [
    { id: 'qi_sneha_1', title: 'Party palace rental — 2 functions', qty: 2, rate: 150_000, serviceId: 'venue' },
    { id: 'qi_sneha_2', title: 'Veg + non-veg buffet (per plate)', qty: 250, rate: 1_300, serviceId: 'catering' },
  ];
  const kiranItems = [
    { id: 'qi_kiran_1', title: 'Party palace rental (per function)', qty: 3, rate: 170_000, serviceId: 'venue' },
    { id: 'qi_kiran_2', title: 'Veg buffet (per plate)', qty: 400, rate: 1_150, serviceId: 'catering' },
  ];
  return [
    {
      ...base,
      ...nikitaV1,
      id: 'qt_1012',
      number: 'QT-2026-0012',
      fromKind: 'platform',
      fromId: 'platform',
      fromName: 'Vivah Weddings',
      category: 'platform',
      projectId: 'prj_1012',
      customerId: 'acc_customer_nikita',
      customerName: 'Nikita Joshi',
      eventDate: day(110),
      city: 'Kathmandu',
      title: 'Venue & decoration',
      version: 2,
      notes: 'Luxury floral decor with a mirror-work stage.',
      validUntil: day(4),
      status: 'revision',
      revisionNote: 'Decoration is above our budget — can you bring it under NPR 2.6 lakh and include the entrance gate?',
      versions: [
        { version: 1, ...nikitaV1, taxRate: TAX_RATE, notes: '', terms: DEFAULT_TERMS, validUntil: day(4), schedule: DEFAULT_SCHEDULE, total: quoteTotals({ ...nikitaV1, taxRate: TAX_RATE }).total, sentAt: at(-12), response: { action: 'revision', note: 'Decoration is above our budget — can you bring it under NPR 2.6 lakh and include the entrance gate?', at: at(-6) } },
      ],
      createdAt: at(-13),
      updatedAt: at(-6),
    },
    {
      ...base,
      id: 'qt_sneha',
      number: 'QT-2026-0008',
      fromKind: 'vendor',
      fromId: 'acc_vendor_demo',
      fromName: DEMO_VENUE.name,
      listingId: DEMO_VENUE.id,
      category: 'venues',
      leadId: 'ld_sneha',
      projectId: 'prj_1051',
      customerId: 'acc_customer_sneha',
      customerName: 'Sneha Rai',
      eventDate: day(30),
      city: DEMO_VENUE.city,
      version: 1,
      items: snehaItems,
      discount: 0,
      notes: '20 complimentary chairs for the janti welcome.',
      validUntil: day(-10),
      status: 'accepted',
      acceptedVersion: 1,
      versions: [{ version: 1, items: snehaItems, discount: 0, serviceFee: 0, taxRate: TAX_RATE, notes: '', terms: DEFAULT_TERMS, validUntil: day(-10), schedule: DEFAULT_SCHEDULE, total: quoteTotals({ items: snehaItems, discount: 0, taxRate: TAX_RATE }).total, sentAt: at(-27), response: { action: 'accept', at: at(-26) } }],
      createdAt: at(-27),
      updatedAt: at(-26),
    },
    {
      ...base,
      id: 'qt_kiran',
      number: 'QT-2026-0031',
      fromKind: 'vendor',
      fromId: 'acc_vendor_demo',
      fromName: DEMO_VENUE.name,
      listingId: DEMO_VENUE.id,
      category: 'venues',
      leadId: 'ld_kiran',
      customerId: 'acc_customer_kiran',
      customerName: 'Kiran Tamang',
      eventDate: day(120),
      city: DEMO_VENUE.city,
      version: 1,
      items: kiranItems,
      discount: 40_000,
      notes: '',
      validUntil: day(10),
      status: 'viewed',
      versions: [{ version: 1, items: kiranItems, discount: 40_000, serviceFee: 0, taxRate: TAX_RATE, notes: '', terms: DEFAULT_TERMS, validUntil: day(10), schedule: DEFAULT_SCHEDULE, total: quoteTotals({ items: kiranItems, discount: 40_000, taxRate: TAX_RATE }).total, sentAt: at(-2) }],
      createdAt: at(-2),
      updatedAt: at(-1),
    },
  ];
}

function buildLeads(): Lead[] {
  const common = { listingKind: 'venue' as const, listingId: DEMO_VENUE.id, listingName: DEMO_VENUE.name, city: DEMO_VENUE.city, source: 'marketplace' as const };
  return [
    { ...common, id: 'ld_isha', customerId: 'acc_customer_isha', customerName: 'Isha Karki', customerPhone: '9800000101', eventDate: day(95), guests: 500, functions: ['Wedding', 'Reception'], services: ['venue', 'catering'], message: 'Looking for a party palace with in-house catering for Falgun. Is the main hall available?', budget: 900_000, status: 'new', priority: 'high', createdAt: at(0, 9) },
    { ...common, id: 'ld_neha', customerId: 'acc_customer_neha', customerName: 'Neha Gurung', customerPhone: '9800000102', eventDate: day(60), guests: 300, functions: ['Sangeet', 'Wedding'], message: 'Can we do a site visit this Saturday?', status: 'contacted', priority: 'medium', followUp: day(1), labels: ['Site visit'], createdAt: at(-1, 15) },
    { ...common, id: 'ld_kiran', customerId: 'acc_customer_kiran', customerName: 'Kiran Tamang', customerPhone: '9800000103', eventDate: day(120), guests: 400, functions: ['Mehendi', 'Wedding', 'Reception'], status: 'quoted', priority: 'medium', createdAt: at(-4) },
    { ...common, id: 'ld_bipana', customerId: 'acc_customer_bipana', customerName: 'Bipana Rai', customerPhone: '9800000104', eventDate: day(75), guests: 700, functions: ['Wedding'], message: 'Need parking for 150 cars and a separate dining hall.', status: 'negotiating', priority: 'high', labels: ['Big wedding'], followUp: day(2), createdAt: at(-6) },
    { ...common, id: 'ld_sneha', customerId: 'acc_customer_sneha', customerName: 'Sneha Rai', customerPhone: '9800000091', eventDate: day(30), guests: 250, functions: ['Wedding', 'Reception'], status: 'won', createdAt: at(-30) },
    { ...common, id: 'ld_old', customerId: 'acc_customer_samir', customerName: 'Samir Lama', customerPhone: '9800000105', eventDate: day(15), guests: 120, functions: ['Engagement'], status: 'lost', createdAt: at(-40) },
    { listingKind: 'vendor', listingId: DEMO_DECOR.id, listingName: DEMO_DECOR.name, city: 'Lalitpur', source: 'marketplace', id: 'ld_decor_1', customerId: 'acc_customer_rojina', customerName: 'Rojina Shakya', customerPhone: '9800000107', eventDate: day(40), guests: 350, functions: ['Wedding', 'Reception'], services: ['decoration', 'florist'], message: 'We want a Newari courtyard look with marigolds for the wedding and a pastel stage for the reception.', budget: 250_000, status: 'new', priority: 'high', createdAt: at(0, 10) },
    { listingKind: 'vendor', listingId: DEMO_DECOR.id, listingName: DEMO_DECOR.name, city: 'Lalitpur', source: 'marketplace', id: 'ld_decor_2', customerId: 'acc_customer_prakash', customerName: 'Prakash Bajracharya', customerPhone: '9800000108', eventDate: day(18), guests: 120, functions: ['Pasni'], services: ['decoration'], message: 'Small pasni at home in Patan. Can you do a simple floral backdrop?', status: 'contacted', priority: 'medium', createdAt: at(-2) },
    { listingKind: 'vendor', listingId: DEMO_STUDIO.id, listingName: DEMO_STUDIO.name, city: 'Kathmandu', source: 'marketplace', id: 'ld_studio_1', customerId: 'acc_customer_shristi', customerName: 'Shristi Thapa', customerPhone: '9800000106', eventDate: day(52), guests: 300, functions: ['Engagement', 'Wedding'], services: ['photography', 'videography'], message: 'Loved your Nagarkot pre-wedding reel! Need photo + video for 2 events.', budget: 200_000, status: 'new', priority: 'high', createdAt: at(0, 11) },
  ];
}

// Gigs
function buildGigs(): Gig[] {
  const g = (partial: Omit<Gig, 'applications' | 'createdAt' | 'status'> & Partial<Pick<Gig, 'applications' | 'status' | 'createdAt'>>): Gig => ({ status: 'open', applications: [], createdAt: at(-1), ...partial });
  const app = (id: string, name: string, skill: string, pay: number, status: Gig['applications'][number]['status'], message = '', extra = {}) => {
    const f = FREELANCER_DIRECTORY.find((x) => x.name === name);
    return { id, freelancerId: f?.id ?? 'acc_freelancer_demo', freelancerName: name, skill, rating: f?.rating ?? 4.8, message, expectedPay: pay, status, appliedAt: at(-2), ...extra };
  };
  return [
    g({
      id: 'gig_1021_photo2',
      title: 'Second photographer — Aakriti & Sujan wedding',
      skill: 'Photographer',
      postedById: 'acc_vendor_studio',
      postedByName: DEMO_STUDIO.name,
      postedByKind: 'vendor',
      projectId: 'prj_1021',
      eventId: V1021.wed,
      bookingId: 'bk_1021_photo',
      crewId: 'cr_bk_1021_photo_0',
      city: 'Kathmandu',
      location: DEMO_VENUE.name,
      date: day(48),
      startTime: '07:00',
      hours: 14,
      pay: 8_000,
      description: 'Candid coverage of a 600-guest wedding alongside our lead photographer. Janti, swayambar and sindoor-halne are must-cover moments.',
      requirements: ['Full-frame camera', '70-200mm lens', 'Formal attire'],
      equipment: ['Full-frame camera', '70-200mm'],
      slots: 1,
      deadline: day(30),
      invited: ['fl_sujan_lama'],
      questions: [{ id: 'gq1', freelancerId: 'fl_sanjay_gurung', freelancerName: 'Sanjay Gurung', question: 'Is travel from Bhaktapur covered?', answer: 'Yes — NPR 500 travel allowance included.', at: at(-1) }],
      applications: [
        app('ga_1', 'Sanjay Gurung', 'Photographer', 8_000, 'applied', 'Shot 60+ weddings in the valley, own A7 IV + 70-200.'),
        app('ga_2', 'Pooja Shrestha', 'Photographer', 7_500, 'shortlisted', 'Available all day, can also help with editing.'),
      ],
    }),
    g({
      id: 'gig_emergency_pokhara',
      title: 'EMERGENCY: Photographer needed today — Pokhara wedding',
      skill: 'Photographer',
      postedById: 'platform',
      postedByName: 'Vivah Operations',
      postedByKind: 'platform',
      projectId: 'prj_1017',
      eventId: 'ev_1017_wed',
      bookingId: 'bk_1017_photo',
      crewId: 'cr_bk_1017_photo_0',
      replacesAssignmentId: 'as_1017_dipak',
      city: 'Pokhara',
      location: 'Lakeside, Pokhara',
      date: day(0),
      startTime: '11:00',
      hours: 10,
      pay: 10_000,
      description: 'Our booked photographer fell sick this morning. Cover the wedding rituals and portraits from 11 AM. Lead photographer on site will brief you.',
      requirements: ['Full-frame camera', 'Can reach Lakeside by 11:00'],
      equipment: ['Full-frame camera'],
      slots: 1,
      emergency: true,
      createdAt: at(0, 6, 20),
      applications: [app('ga_em1', 'Bijay Mahato', 'Photographer', 10_000, 'applied', 'Leaving Chitwan now, can reach by 11:30.')],
    }),
    g({
      id: 'gig_1017_crew',
      title: 'Reception floor crew (4 people)',
      skill: 'Event Staff',
      postedById: 'platform',
      postedByName: 'Vivah Operations',
      postedByKind: 'platform',
      projectId: 'prj_1017',
      eventId: 'ev_1017_rec',
      city: 'Pokhara',
      date: day(1),
      startTime: '16:00',
      hours: 7,
      pay: 2_000,
      description: 'Guest guidance, seating and backstage coordination for the reception.',
      requirements: ['Black formal attire', 'Nepali & English'],
      slots: 4,
      applications: [app('ga_3', 'Kumar Pun', 'Event Staff', 2_000, 'hired'), app('ga_4', 'Nabin Shrestha', 'Event Staff', 2_000, 'applied')],
    }),
    g({ id: 'gig_drone_nagarkot', title: 'Drone operator — sunrise pre-wedding at Nagarkot', skill: 'Drone Operator', postedById: 'acc_vendor_studio', postedByName: DEMO_STUDIO.name, postedByKind: 'vendor', projectId: 'prj_1021', eventId: V1021.pre, city: 'Nagarkot', date: day(20), startTime: '05:30', hours: 5, pay: 8_000, description: 'Cinematic aerials for a sunrise couple shoot. Must handle permits.', requirements: ['Own drone', 'CAAN flight permit'], equipment: ['Drone'], slots: 1 }),
    g({ id: 'gig_engage_lalitpur', title: 'Second shooter — engagement in Lalitpur', skill: 'Photographer', postedById: 'acc_vendor_studio', postedByName: DEMO_STUDIO.name, postedByKind: 'vendor', city: 'Lalitpur', date: day(9), startTime: '10:00', hours: 6, pay: 6_000, description: 'Candid coverage of a 200-guest engagement. Raw files to be handed over the same night.', requirements: ['Full-frame body + 85mm'], equipment: ['Full-frame camera'], slots: 1 }),
    g({ id: 'gig_makeup_asst', title: 'Makeup assistant — family looks (6 people)', skill: 'Makeup Artist', postedById: 'platform', postedByName: 'Vivah Operations', postedByKind: 'platform', city: 'Kathmandu', date: day(12), startTime: '06:00', hours: 6, pay: 7_000, description: 'Party makeup and hair for the bride’s family before a morning wedding.', requirements: ['Own kit', 'Hair styling'], slots: 2 }),
    g({ id: 'gig_mehendi_bkt', title: 'Mehendi artists for ~80 guests', skill: 'Mehendi Artist', postedById: 'platform', postedByName: 'Vivah Operations', postedByKind: 'platform', city: 'Bhaktapur', date: day(18), startTime: '11:00', hours: 6, pay: 4_000, description: 'Arabic and minimal designs for guests at a mehendi function.', requirements: ['Organic henna'], slots: 3 }),
    g({ id: 'gig_dj_ktm', title: 'DJ for reception night', skill: 'DJ', postedById: 'acc_vendor_demo', postedByName: DEMO_VENUE.name, postedByKind: 'vendor', city: 'Kathmandu', date: day(22), startTime: '19:00', hours: 4, pay: 15_000, description: 'Nepali pop + Bollywood set for 400 guests. Sound system provided by the venue.', requirements: ['Own controller', 'Playlist samples'], slots: 1 }),
    g({ id: 'gig_decor_helpers', title: 'Decor setup helpers', skill: 'Decor Staff', postedById: 'acc_vendor_demo', postedByName: DEMO_VENUE.name, postedByKind: 'vendor', city: 'Kathmandu', date: day(6), startTime: '06:00', hours: 8, pay: 2_000, description: 'Floral installation and jagge assembly for a day wedding.', requirements: ['Can lift 20 kg', 'Punctual'], slots: 5 }),
    g({ id: 'gig_editor_remote', title: 'Editor — 4-min highlight film (remote)', skill: 'Editor', postedById: 'acc_vendor_studio', postedByName: DEMO_STUDIO.name, postedByKind: 'vendor', city: 'Kathmandu', date: day(14), startTime: '10:00', hours: 16, pay: 12_000, description: 'Cut a cinematic highlight from 6 hours of 4K footage. Premiere/DaVinci.', requirements: ['Showreel', 'Delivery in 5 days'], slots: 1 }),
    g({
      id: 'gig_1009_done',
      title: 'Wedding photographer — Sarina & Prabin',
      skill: 'Photographer',
      postedById: 'acc_vendor_studio',
      postedByName: DEMO_STUDIO.name,
      postedByKind: 'vendor',
      projectId: 'prj_1009',
      eventId: 'ev_1009_wed',
      bookingId: 'bk_1009_photo',
      city: 'Kathmandu',
      date: day(-20),
      startTime: '07:00',
      hours: 14,
      pay: 8_000,
      description: 'Main-day coverage.',
      requirements: [],
      slots: 1,
      status: 'completed',
      createdAt: at(-60),
      applications: [app('ga_5', 'Raj Maharjan', 'Photographer', 8_000, 'completed', '', { freelancerId: 'acc_freelancer_demo', assignmentId: 'as_1009_raj', checkInAt: at(-20, 6, 50), checkOutAt: at(-20, 21, 5) })],
    }),
  ];
}

// Couple tools for WP-1021
const GUEST_NAMES = [
  ['Ram Bahadur Shrestha', 'bride', 'Family', true],
  ['Gita Shrestha', 'bride', 'Family', true],
  ['Bikash Shrestha', 'bride', 'Family', false],
  ['Sunita Shrestha', 'bride', 'Family', false],
  ['Hari Prasad Maharjan', 'groom', 'Family', true],
  ['Laxmi Maharjan', 'groom', 'Family', true],
  ['Sagar Maharjan', 'groom', 'Family', false],
  ['Puja Maharjan', 'groom', 'Family', false],
  ['Krishna Pradhan', 'bride', 'Relatives', false],
  ['Kamala Pradhan', 'bride', 'Relatives', false],
  ['Dinesh Bajracharya', 'groom', 'Relatives', false],
  ['Sabina Bajracharya', 'groom', 'Relatives', false],
  ['Anjana Thapa', 'bride', 'Friends', false],
  ['Roshni KC', 'bride', 'Friends', false],
  ['Prerana Gurung', 'bride', 'Friends', false],
  ['Samjhana Rai', 'bride', 'Friends', false],
  ['Aayush Tamang', 'groom', 'Friends', false],
  ['Nirajan Karki', 'groom', 'Friends', false],
  ['Suman Lama', 'groom', 'Friends', false],
  ['Pratik Joshi', 'groom', 'Friends', false],
  ['Manoj Adhikari', 'bride', 'Office', false],
  ['Sarita Bhattarai', 'bride', 'Office', false],
  ['Ujjwal Neupane', 'groom', 'Office', false],
  ['Rekha Poudel', 'groom', 'Office', false],
  ['Shyam Shakya', 'both', 'Neighbours', false],
  ['Mina Shakya', 'both', 'Neighbours', false],
  ['Dr. Bishnu Koirala', 'bride', 'Family', true],
  ['Nabin Magar', 'groom', 'Friends', false],
  ['Kabita Limbu', 'bride', 'Friends', false],
  ['Rajan Shrestha', 'bride', 'Relatives', false],
  ['Anita Maharjan', 'groom', 'Relatives', false],
  ['Deepak Thapa', 'groom', 'Office', false],
  ['Srijana Pokharel', 'bride', 'Friends', false],
  ['Binod Gurung', 'groom', 'Relatives', false],
  ['Hem Kumari Shrestha', 'bride', 'Family', true],
  ['Bimal Maharjan', 'groom', 'Family', false],
] as const;

function buildGuests(): Guest[] {
  const r = seeded('guests-1021');
  const households = ['Shrestha family (Baneshwor)', 'Maharjan family (Patan)', 'Pradhan family', 'Bajracharya family'];
  return GUEST_NAMES.map(([name, side, category, vip], i) => {
    const rsvps: Guest['invites'][number]['rsvp'][] = ['yes', 'yes', 'yes', 'maybe', 'no', 'pending', 'pending'];
    const wedding = rsvps[i % rsvps.length];
    const plusOnes = category === 'Friends' && i % 3 === 0 ? 1 : 0;
    const children = category === 'Family' && i % 2 === 0 ? r.int(0, 2) : 0;
    const attending = (rsvp: string) => (rsvp === 'yes' ? 1 + plusOnes + children : rsvp === 'maybe' ? 1 : 0);
    return {
      id: `gst_${i + 1}`,
      projectId: 'prj_1021',
      name,
      side,
      household: category === 'Family' ? households[i % 4 < 2 ? (side === 'bride' ? 0 : 1) : i % 4] : undefined,
      category,
      vip,
      phone: `98${String(41000000 + i * 3217).slice(0, 8)}`,
      email: i % 4 === 0 ? `${name.split(' ')[0].toLowerCase()}@example.com` : undefined,
      plusOnes,
      children,
      dietary: i % 7 === 0 ? ['Vegetarian'] : i % 11 === 0 ? ['Vegan'] : i % 13 === 0 ? ['No alcohol'] : [],
      accommodation: i % 9 === 0,
      transport: i % 6 === 0,
      gift: i < 4 ? 'Gold coin' : undefined,
      thanked: i < 2,
      code: `G${(1000 + i * 37).toString(36).toUpperCase()}`,
      invites: [
        { eventId: V1021.eng, rsvp: i < 24 ? 'yes' : 'no', attending: i < 24 ? 1 : 0, sentAt: at(-40), respondedAt: at(-35), checkedInAt: i < 20 ? at(-25, 11) : undefined },
        ...(category === 'Family' || category === 'Relatives' || category === 'Friends' ? [{ eventId: V1021.meh, rsvp: wedding, attending: attending(wedding), sentAt: at(-20), openedAt: at(-19) }] : []),
        { eventId: V1021.wed, rsvp: wedding, attending: attending(wedding), meal: i % 3 === 0 ? 'Veg' : 'Non-veg', sentAt: at(-20), openedAt: wedding === 'pending' && i % 2 ? undefined : at(-18), respondedAt: wedding === 'pending' ? undefined : at(-15), tableId: i < 20 ? `tbl_${vip ? 'head' : (i % 6) + 1}` : undefined },
        { eventId: V1021.rec, rsvp: wedding === 'no' ? 'yes' : wedding, attending: attending(wedding === 'no' ? 'yes' : wedding), sentAt: at(-20) },
      ],
    };
  });
}

function buildSeating(): DbData['seating'] {
  return [
    {
      eventId: V1021.wed,
      projectId: 'prj_1021',
      elements: [
        { id: 'el_stage', kind: 'stage', label: 'Jagge / stage', capacity: 0, x: 380, y: 30 },
        { id: 'tbl_head', kind: 'rect', label: 'Family head table', capacity: 10, x: 360, y: 150, vip: true },
        ...Array.from({ length: 6 }, (_, i) => ({ id: `tbl_${i + 1}`, kind: 'round' as const, label: `Table ${i + 1}`, capacity: 8, x: 90 + (i % 3) * 260, y: 280 + Math.floor(i / 3) * 170 })),
        { id: 'el_dance', kind: 'dance', label: 'Dance floor', capacity: 0, x: 620, y: 150 },
        { id: 'el_buffet', kind: 'buffet', label: 'Buffet', capacity: 0, x: 60, y: 120 },
        { id: 'el_dj', kind: 'dj', label: 'DJ', capacity: 0, x: 760, y: 40 },
        { id: 'el_entry', kind: 'entrance', label: 'Entrance', capacity: 0, x: 420, y: 620 },
      ],
    },
  ];
}

function buildBudget(p: Project): DbData['budget'] {
  const booked = (sid: string) => p.bookings.find((b) => b.serviceId === sid && b.status !== 'CANCELLED');
  const line = (id: string, serviceId: string, label: string, estimated: number, paidAmount = 0, extra = {}) => {
    const b = booked(serviceId);
    return { id, projectId: p.id, serviceId, label, estimated, actual: b ? b.agreedPrice : undefined, paid: paidAmount, bookingId: b?.id, ...extra };
  };
  return [
    line('bl_venue', 'venue', 'Party palace (2 functions)', 380_000, 108_000),
    line('bl_catering', 'catering', 'Catering (1,250 plates)', 1_400_000, 400_000),
    line('bl_photo', 'photography', 'Photography', 180_000, 54_000),
    line('bl_video', 'videography', 'Videography', 150_000),
    line('bl_decor', 'decoration', 'Decoration', 280_000),
    line('bl_drone', 'drone', 'Drone', 20_000, 6_000),
    line('bl_makeup', 'makeup', 'Bridal makeup (3 looks)', 60_000),
    line('bl_bridal', 'bridal-wear', 'Bridal saree & lehenga', 180_000, 90_000, { actual: 165_000, notes: 'Saree from Dhaka House, lehenga from New Road' }),
    line('bl_groom', 'groom-wear', 'Daura Suruwal & suit', 60_000, 60_000, { actual: 58_000 }),
    line('bl_jewel', 'jewellery', 'Tilhari, pote & gold set', 450_000, 450_000, { actual: 470_000 }),
    line('bl_cards', 'invitation', 'Invitation cards (400)', 45_000, 20_000, { actual: 42_000 }),
    line('bl_pandit', 'pandit', 'Pandit & puja samagri', 25_000),
    line('bl_dj', 'dj', 'DJ for reception', 45_000),
  ];
}

function buildThreads(): { threads: Thread[]; messages: Message[] } {
  const threads: Thread[] = [
    {
      id: 'th_1021_project',
      kind: 'project',
      projectId: 'prj_1021',
      title: 'Aakriti & Sujan · Wedding team',
      members: [
        { id: 'acc_customer_demo', name: 'Aakriti Shrestha', role: 'customer' },
        { id: 'acc_platform_demo', name: 'Sita Karki', role: 'platform' },
      ],
      lastAt: at(0, 9, 5),
      archivedBy: [],
      mutedBy: [],
      blockedBy: [],
    },
    {
      id: 'th_1021_photo',
      kind: 'service',
      projectId: 'prj_1021',
      bookingId: 'bk_1021_photo',
      title: 'Photography · Wedding Story Nepal',
      image: 'photographerCeremony',
      members: [
        { id: 'acc_customer_demo', name: 'Aakriti Shrestha', role: 'customer' },
        { id: 'acc_platform_demo', name: 'Sita Karki', role: 'platform' },
        { id: 'acc_vendor_studio', name: 'Wedding Story Nepal', role: 'vendor' },
        { id: 'acc_freelancer_demo', name: 'Raj Maharjan', role: 'freelancer' },
      ],
      lastAt: at(-1, 18, 30),
      archivedBy: [],
      mutedBy: [],
      blockedBy: [],
    },
    {
      id: 'th_1021_venue',
      kind: 'service',
      projectId: 'prj_1021',
      bookingId: 'bk_1021_venue',
      title: `Venue · ${DEMO_VENUE.name}`,
      image: DEMO_VENUE.images[0],
      members: [
        { id: 'acc_customer_demo', name: 'Aakriti Shrestha', role: 'customer' },
        { id: 'acc_platform_demo', name: 'Sita Karki', role: 'platform' },
        { id: 'acc_vendor_demo', name: DEMO_VENUE.name, role: 'vendor' },
      ],
      lastAt: at(-3, 14),
      archivedBy: [],
      mutedBy: [],
      blockedBy: [],
    },
    {
      id: 'th_lead_isha',
      kind: 'direct',
      listingId: DEMO_VENUE.id,
      title: `Isha Karki · ${DEMO_VENUE.name}`,
      image: DEMO_VENUE.images[0],
      members: [
        { id: 'acc_customer_isha', name: 'Isha Karki', role: 'customer' },
        { id: 'acc_vendor_demo', name: DEMO_VENUE.name, role: 'vendor' },
      ],
      lastAt: at(0, 9),
      archivedBy: [],
      mutedBy: [],
      blockedBy: [],
    },
  ];
  const m = (id: string, threadId: string, sender: { id: string; name: string; role: Message['senderRole'] }, text: string, when: string, extra: Partial<Message> = {}): Message => ({
    id,
    threadId,
    senderId: sender.id,
    senderName: sender.name,
    senderRole: sender.role,
    kind: 'text',
    text,
    at: when,
    readBy: [sender.id],
    ...extra,
  });
  const aakriti = { id: 'acc_customer_demo', name: 'Aakriti Shrestha', role: 'customer' as const };
  const sita = { id: 'acc_platform_demo', name: 'Sita Karki', role: 'platform' as const };
  const studio = { id: 'acc_vendor_studio', name: 'Wedding Story Nepal', role: 'vendor' as const };
  const venue = { id: 'acc_vendor_demo', name: DEMO_VENUE.name, role: 'vendor' as const };
  const messages: Message[] = [
    m('msg1', 'th_1021_project', sita, 'Namaste Aakriti! I’m Sita, your wedding coordinator. I’ll be your single point of contact for all vendors — message me here anytime 🙏', at(-44, 12), { readBy: ['acc_platform_demo', 'acc_customer_demo'] }),
    m('msg2', 'th_1021_project', aakriti, 'Thank you Sita! Can we see a couple more decoration options? The current one feels a bit heavy.', at(-12, 19), { readBy: ['acc_platform_demo', 'acc_customer_demo'] }),
    m('msg3', 'th_1021_project', sita, 'Of course. I’ve asked the decorator for a lighter floral concept — expect it by next week. Meanwhile, here is the updated quotation.', at(-12, 20), { readBy: ['acc_platform_demo', 'acc_customer_demo'] }),
    m('msg4', 'th_1021_project', sita, 'Quotation QT-2026-0021 (v2)', at(-35, 11), { kind: 'quote', meta: { quoteId: 'qt_1021' }, readBy: ['acc_platform_demo', 'acc_customer_demo'] }),
    m('msg5', 'th_1021_project', sita, 'Menu tasting at the party palace', at(-2, 16), { kind: 'meeting', meta: { meeting: { at: at(18, 13), title: 'Menu tasting' } }, readBy: ['acc_platform_demo'] }),
    m('msg6', 'th_1021_project', sita, 'Reminder: your next instalment is due soon. You can pay by eSewa, Khalti or bank transfer from the Payments tab.', at(0, 9, 5), { readBy: ['acc_platform_demo'] }),
    m('msg7', 'th_1021_photo', studio, 'Hi Aakriti! Engagement edited photos are ready for your review — please approve or send changes from Services.', at(-1, 18, 30), { readBy: ['acc_vendor_studio'] }),
    m('msg8', 'th_1021_photo', aakriti, 'For the pre-wedding, can we start at Nagarkot at 5:30 for the sunrise?', at(-3, 21), { readBy: ['acc_customer_demo', 'acc_vendor_studio', 'acc_platform_demo'] }),
    m('msg9', 'th_1021_photo', { id: 'acc_freelancer_demo', name: 'Raj Maharjan', role: 'freelancer' }, 'Yes, 5:30 works. I’ll bring the 70-200 for mountain compression shots 📸', at(-3, 21, 30), { readBy: ['acc_freelancer_demo', 'acc_customer_demo'] }),
    m('msg10', 'th_1021_photo', aakriti, 'Nagarkot viewpoint', at(-3, 21, 40), { kind: 'location', meta: { location: { label: 'Nagarkot View Tower', lat: 27.7154, lng: 85.5206 } }, readBy: ['acc_customer_demo'] }),
    m('msg11', 'th_1021_venue', venue, 'Parking attendants and a separate janti welcome area are confirmed for the wedding day.', at(-3, 14), { readBy: ['acc_vendor_demo', 'acc_customer_demo'] }),
    m('msg12', 'th_lead_isha', { id: 'acc_customer_isha', name: 'Isha Karki', role: 'customer' }, 'Hi! Is the main hall free in Falgun for 500 guests?', at(0, 9), { readBy: ['acc_customer_isha'] }),
  ];
  return { threads, messages };
}

// Assemble
export function buildSeedData(): DbData {
  const p1021 = buildProject1021();
  const p1017 = buildProject1017();
  const p1030 = buildProject1030();
  const { project: p1026, quote: q1026 } = buildProject1026();
  const p1009 = buildProject1009();
  const pipeline = buildPipeline();
  const projects = [p1021, p1017, p1030, p1026, p1009, ...pipeline];
  const { threads, messages } = buildThreads();

  // Payables accrue for every confirmed/completed booking.
  const payables: Payable[] = projects.flatMap((p) =>
    p.bookings
      .filter((b) => b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS' || b.status === 'COMPLETED')
      .flatMap((b) =>
        payablesForBooking(b, p).map((pay, i) => {
          if (p.status === 'COMPLETED') return { ...pay, id: `pay_${b.id}_${i}`, status: i === 0 ? ('PAID' as const) : b.id === 'bk_1009_photo' ? ('ON_HOLD' as const) : ('READY' as const), paidAt: i === 0 ? at(-27) : undefined, holdReason: b.id === 'bk_1009_photo' && i === 1 ? 'Dispute open: album delay' : undefined };
          if (p.id === 'prj_1017' && i === 0) return { ...pay, id: `pay_${b.id}_${i}`, status: 'PAID' as const, paidAt: at(-7), reference: `NIBL-${b.id.slice(-4).toUpperCase()}` };
          return { ...pay, id: `pay_${b.id}_${i}` };
        }),
      ),
  );
  payables.push(
    { id: 'fpay_raj_1009', payeeKind: 'freelancer', payeeId: 'acc_freelancer_demo', payeeName: 'Raj Maharjan', projectId: 'prj_1009', assignmentId: 'as_1009_raj', gigId: 'gig_1009_done', label: 'Wedding photographer — Sarina & Prabin', amount: 8_000, status: 'READY', release: 'after_event', due: day(-17) },
    { id: 'fpay_raj_old1', payeeKind: 'freelancer', payeeId: 'acc_freelancer_demo', payeeName: 'Raj Maharjan', label: 'Engagement shoot — Tuladhar family', amount: 6_000, status: 'PAID', release: 'after_event', due: day(-44), paidAt: at(-40), reference: 'ESW-88213' },
    { id: 'fpay_raj_old2', payeeKind: 'freelancer', payeeId: 'acc_freelancer_demo', payeeName: 'Raj Maharjan', label: 'Pasni photography — Chitwan', amount: 5_500, status: 'PAID', release: 'after_event', due: day(-70), paidAt: at(-66), reference: 'KHT-11904' },
    { id: 'fpay_raj_eng', payeeKind: 'freelancer', payeeId: 'acc_freelancer_demo', payeeName: 'Raj Maharjan', projectId: 'prj_1021', label: 'Engagement — Aakriti & Sujan', amount: 7_000, status: 'PAID', release: 'after_event', due: day(-22), paidAt: at(-21), reference: 'NIBL-44120' },
    { id: 'fpay_pooja_1009', payeeKind: 'freelancer', payeeId: 'fl_pooja_shrestha', payeeName: 'Pooja Shrestha', projectId: 'prj_1009', assignmentId: 'as_1009_pooja', label: 'Wedding photographer — Sarina & Prabin', amount: 7_500, status: 'READY', release: 'after_event', due: day(-17) },
  );

  const revenue: RevenueEntry[] = projects.flatMap((p) =>
    p.bookings
      .filter((b) => b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS' || b.status === 'COMPLETED')
      .map((b) => ({ id: `rev_${b.id}`, kind: (b.pricingModel === 'MARKUP' ? 'MARKUP' : b.pricingModel === 'LEAD_FEE' ? 'LEAD_FEE' : 'COMMISSION') as DbData['revenue'][number]['kind'], amount: b.platformFee, projectId: p.id, bookingId: b.id, providerId: b.providerId, at: b.confirmedAt ?? p.createdAt })),
  );
  revenue.push(
    { id: 'rev_fee_1021', kind: 'SERVICE_FEE', amount: 25_000, projectId: 'prj_1021', at: at(-33) },
    { id: 'rev_margin_1009', kind: 'FREELANCER_MARGIN', amount: 3_100, projectId: 'prj_1009', at: at(-20) },
    { id: 'rev_sub_1', kind: 'SUBSCRIPTION', amount: 4_999, providerId: DEMO_STUDIO.id, note: 'Pro plan — monthly', at: at(-10) },
    { id: 'rev_feat_1', kind: 'FEATURED', amount: 15_000, providerId: DEMO_VENUE.id, note: 'Homepage feature — Mangsir', at: at(-15) },
    { id: 'rev_lead_1', kind: 'LEAD_FEE', amount: 2_000, providerId: pick('dj', 'Kathmandu').id, note: 'Qualified lead', at: at(-8) },
    { id: 'rev_em_1017', kind: 'EMERGENCY_FEE', amount: 3_000, projectId: 'prj_1017', note: 'Rush replacement', at: at(0, 6, 30) },
  );

  const m1021 = p1021.milestones;
  const payments: DbData['payments'] = [
    { id: 'pmt_1021_1', projectId: 'prj_1021', milestoneId: m1021[0].id, amount: m1021[0].paidAmount, method: 'esewa', reference: 'ESW-5KX93D', receiptNo: 'RCPT-2026-0101', status: 'SUCCEEDED', refunded: 0, payerName: 'Aakriti Shrestha', at: at(-31, 15) },
    { id: 'pmt_1021_2', projectId: 'prj_1021', milestoneId: m1021[1].id, amount: 500_000, method: 'bank_transfer', reference: 'NIBL-778812', receiptNo: 'RCPT-2026-0144', status: 'SUCCEEDED', refunded: 0, payerName: 'Ram Bahadur Shrestha', at: at(-5, 12) },
    ...p1017.milestones.filter((x) => x.paidAmount > 0).map((x, i) => ({ id: `pmt_1017_${i}`, projectId: 'prj_1017', milestoneId: x.id, amount: x.paidAmount, method: (i ? 'connect_ips' : 'khalti') as DbData['payments'][number]['method'], reference: `TXN-1017-${i}`, receiptNo: `RCPT-2026-00${60 + i}`, status: 'SUCCEEDED' as const, refunded: 0, payerName: 'Pratiksha Gurung', at: at(i ? -12 : -98) })),
    ...p1009.milestones.filter((x) => x.paidAmount > 0).map((x, i) => ({ id: `pmt_1009_${i}`, projectId: 'prj_1009', milestoneId: x.id, amount: x.paidAmount, method: 'fonepay' as const, reference: `FNP-1009-${i}`, receiptNo: `RCPT-2026-00${30 + i}`, status: 'SUCCEEDED' as const, refunded: 0, payerName: 'Sarina Karki', at: at(i ? -34 : -118) })),
    { id: 'pmt_1051_1', projectId: 'prj_1051', milestoneId: pipeline[3].milestones[0].id, amount: 220_350, method: 'khalti', reference: 'KHT-SN2201', receiptNo: 'RCPT-2026-0120', status: 'SUCCEEDED', refunded: 0, payerName: 'Sneha Rai', at: at(-25) },
    { id: 'pmt_refund_demo', projectId: 'prj_1009', amount: 25_000, method: 'esewa', reference: 'ESW-MKUP-01', receiptNo: 'RCPT-2026-0099', status: 'REFUNDED', refunded: 25_000, payerName: 'Sarina Karki', at: at(-60) },
  ];

  const availability: DbData['availability'] = [
    { id: 'av_raj_1', ownerKind: 'freelancer', ownerId: 'acc_freelancer_demo', date: day(48), part: 'full', status: 'BOOKED', source: 'assignment', refId: 'as_1021_raj' },
    { id: 'av_raj_2', ownerKind: 'freelancer', ownerId: 'acc_freelancer_demo', date: day(20), part: 'morning', status: 'BOOKED', source: 'assignment', refId: 'as_1021_raj_pre' },
    { id: 'av_raj_3', ownerKind: 'freelancer', ownerId: 'acc_freelancer_demo', date: day(30), part: 'full', status: 'UNAVAILABLE', source: 'manual', note: 'Family puja' },
    { id: 'av_raj_4', ownerKind: 'freelancer', ownerId: 'acc_freelancer_demo', date: day(31), part: 'full', status: 'UNAVAILABLE', source: 'manual', note: 'Family puja' },
    { id: 'av_raj_5', ownerKind: 'freelancer', ownerId: 'acc_freelancer_demo', date: day(55), part: 'full', status: 'TENTATIVE', source: 'manual', note: 'Possible Pokhara shoot' },
    ...[48, 49, 30].map((o, i) => ({ id: `av_venue_${i}`, ownerKind: 'provider' as const, ownerId: DEMO_VENUE.id, date: day(o), part: 'full' as const, status: 'BOOKED' as const, source: 'booking' as const, refId: o === 30 ? 'bk_1051_venue' : 'bk_1021_venue' })),
    { id: 'av_venue_hold', ownerKind: 'provider', ownerId: DEMO_VENUE.id, date: day(110), part: 'full', status: 'HELD', source: 'hold', refId: 'bk_1012_venue' },
    { id: 'av_venue_maint', ownerKind: 'provider', ownerId: DEMO_VENUE.id, date: day(14), part: 'full', status: 'UNAVAILABLE', source: 'manual', note: 'Hall renovation' },
    ...[-25, 20, 46, 48, 49].map((o, i) => ({ id: `av_studio_${i}`, ownerKind: 'provider' as const, ownerId: DEMO_STUDIO.id, date: day(o), part: 'full' as const, status: 'BOOKED' as const, source: 'booking' as const, refId: 'bk_1021_photo' })),
  ];

  return {
    projects,
    quotes: [buildQuote1021(), q1026, ...buildOtherQuotes()],
    leads: buildLeads(),
    gigs: buildGigs(),
    payments,
    payables,
    revenue,
    refunds: [{ id: 'rf_1', paymentId: 'pmt_refund_demo', projectId: 'prj_1009', amount: 25_000, reason: 'Makeup artist cancelled — full refund of advance', status: 'PROCESSED', requestedBy: 'Sarina Karki', at: at(-58), processedAt: at(-56) }],
    disputes: [
      {
        id: 'dsp_1',
        projectId: 'prj_1009',
        bookingId: 'bk_1009_photo',
        raisedById: 'acc_customer_sarina',
        raisedByName: 'Sarina Karki',
        raisedByRole: 'customer',
        against: DEMO_STUDIO.name,
        reason: 'Album design proof is late — promised within 21 days of the wedding.',
        amount: 20_000,
        status: 'INVESTIGATING',
        paymentFrozen: true,
        at: at(-2),
        log: [
          { at: at(-2), by: 'Sarina Karki', text: 'Raised dispute: album delay' },
          { at: at(-1), by: 'Sita Karki', text: 'Froze final settlement; asked studio for a delivery date' },
        ],
      },
    ],
    invoices: [
      { id: 'inv_1', number: 'INV-EG-0101', issuerId: 'acc_vendor_demo', issuerName: DEMO_VENUE.name, projectId: 'prj_1051', customerName: 'Sneha Rai', kind: 'deposit', amount: 220_350, vat: 25_350, status: 'paid', issuedAt: at(-26), dueAt: day(-23) },
      { id: 'inv_2', number: 'INV-EG-0102', issuerId: 'acc_vendor_demo', issuerName: DEMO_VENUE.name, projectId: 'prj_1051', customerName: 'Sneha Rai', kind: 'instalment', amount: 367_250, vat: 42_250, status: 'issued', issuedAt: at(-1), dueAt: day(15) },
    ],
    availability,
    availabilityRules: [{ id: 'rule_raj_tue', ownerId: 'acc_freelancer_demo', weekday: 2, status: 'UNAVAILABLE', part: 'morning' }],
    threads,
    messages,
    notes: [
      { id: 'note1', projectId: 'prj_1021', authorId: SITA.id, authorName: SITA.name, text: 'Customer prefers Photographer A (Raj Maharjan) — keep him on every event.', pinned: true, at: at(-40) },
      { id: 'note2', projectId: 'prj_1021', authorId: SITA.id, authorName: SITA.name, text: 'Customer is price sensitive on catering — settled at NPR 1,200/plate (cost 1,040).', pinned: false, at: at(-36) },
      { id: 'note3', projectId: 'prj_1021', authorId: SITA.id, authorName: SITA.name, text: 'Provider B (Himalayan Films) is unavailable on the wedding date — do not re-propose.', pinned: false, at: at(-42) },
      { id: 'note4', projectId: 'prj_1017', authorId: SITA.id, authorName: SITA.name, text: 'Dipak sick at 6:10 AM. Emergency gig posted at NPR 10,000 (+25%). Bijay from Chitwan applied.', pinned: true, at: at(0, 6, 25) },
    ],
    files: [
      { id: 'f1', projectId: 'prj_1021', folder: '05-Quotation', name: 'QT-2026-0021-v2.pdf', kind: 'pdf', size: 184_000, storage: 'drive', visibility: 'customer', uploadedBy: SITA.name, at: at(-35) },
      { id: 'f2', projectId: 'prj_1021', folder: '01-Contract', name: 'Venue contract — signed.pdf', kind: 'pdf', size: 242_000, storage: 'drive', visibility: 'customer', uploadedBy: SITA.name, at: at(-32) },
      { id: 'f3', projectId: 'prj_1021', folder: '04-Decoration', name: 'Decor moodboard v1', kind: 'image', storage: 'cloudinary', visibility: 'customer', uploadedBy: DECOR_KTM.name, at: at(-12) },
      { id: 'f4', projectId: 'prj_1021', folder: '06-Invoices', name: 'Receipt RCPT-2026-0101.pdf', kind: 'pdf', size: 92_000, storage: 'drive', visibility: 'customer', uploadedBy: 'System', at: at(-31) },
      { id: 'f5', projectId: 'prj_1021', folder: '02-Photography', name: 'Engagement previews', kind: 'link', uri: 'https://drive.google.com/drive/folders/wedding-story-preview', storage: 'drive', visibility: 'customer', uploadedBy: DEMO_STUDIO.name, at: at(-1) },
      { id: 'f6', projectId: 'prj_1021', folder: '00-Internal', name: 'Vendor cost sheet.xlsx', kind: 'doc', storage: 'drive', visibility: 'internal', uploadedBy: SITA.name, at: at(-36) },
    ],
    notifications: [
      { id: 'n1', to: 'acc_vendor_demo', title: 'New lead: Isha Karki', body: 'Wedding & Reception for 500 guests in Falgun.', at: at(0, 9), read: false, href: '/business/lead/ld_isha', kind: 'lead' },
      { id: 'n2', to: 'acc_vendor_demo', title: 'Booking request from Vivah', body: 'Nikita & Suman · 2 functions · NPR 360,000. Confirm availability.', at: at(-6), read: false, href: '/business/booking/bk_1012_venue', kind: 'booking' },
      { id: 'n3', to: 'acc_customer_demo', title: 'Engagement photos are ready', body: 'Wedding Story Nepal delivered your edited engagement photos for review.', at: at(-1, 18, 30), read: false, href: '/my-wedding?tab=services', kind: 'booking' },
      { id: 'n4', to: 'acc_customer_demo', title: 'Payment reminder', body: 'Your 2nd instalment is partially paid. Balance due before the event.', at: at(0, 9), read: false, href: '/my-wedding?tab=payments', kind: 'payment' },
      { id: 'n5', to: 'acc_freelancer_demo', title: 'New photography gig near you', body: 'Second shooter — engagement in Lalitpur · NPR 6,000', at: at(-1), read: false, href: '/freelancer/gig/gig_engage_lalitpur', kind: 'gig' },
      { id: 'n6', to: 'acc_freelancer_demo', title: 'Payout ready', body: 'NPR 8,000 for Sarina & Prabin is ready for release.', at: at(-2), read: false, href: '/freelancer/earnings', kind: 'payment' },
      { id: 'n7', to: 'platform', title: 'New wedding lead WP-1030', body: 'Srijana & Nabin · Lalitpur · 400 guests · 7 services', at: at(0, 8, 40), read: false, href: '/platform/project/prj_1030', kind: 'lead' },
      { id: 'n8', to: 'platform', title: 'Emergency at WP-1017', body: 'Photographer sick — replacement needed by 11:00 in Pokhara.', at: at(0, 6, 15), read: false, href: '/platform/project/prj_1017?tab=crew', kind: 'emergency' },
      { id: 'n9', to: 'platform', title: 'Revision requested on QT-2026-0012', body: 'Nikita & Suman want decoration under NPR 2.6 lakh.', at: at(-6), read: false, href: '/platform/quote/qt_1012', kind: 'quote' },
      { id: 'n10', to: 'acc_vendor_studio', title: 'Booking request: Anisha & Rojan', body: 'Photography crew for 2 functions in Bhaktapur. Accept or decline.', at: at(-3), read: false, href: '/business/booking/bk_1026_video', kind: 'booking' },
      { id: 'n11', to: 'acc_vendor_studio', title: 'Dispute opened on WP-1009', body: 'Album delay — final settlement is on hold.', at: at(-2), read: false, kind: 'payment' },
    ],
    audit: [
      { id: 'au1', at: at(-33), actorId: 'acc_customer_demo', actorName: 'Aakriti Shrestha', action: 'quote.accept', entity: 'quote', entityId: 'qt_1021', detail: 'Accepted version 2' },
      { id: 'au2', at: at(-31), actorId: 'system', actorName: 'eSewa', action: 'payment.succeeded', entity: 'payment', entityId: 'pmt_1021_1' },
      { id: 'au3', at: at(0, 6, 20), actorId: SITA.id, actorName: SITA.name, action: 'assignment.emergency', entity: 'assignment', entityId: 'as_1017_dipak', detail: 'Started emergency replacement' },
    ],
    reviews: [
      { id: 'rv1', targetKind: 'provider', targetId: DEMO_STUDIO.id, targetName: DEMO_STUDIO.name, projectId: 'prj_1009', bookingId: 'bk_1009_photo', authorId: 'acc_customer_sarina', authorName: 'Sarina Karki', authorRole: 'customer', overall: 4.6, criteria: { 'Photo quality': 5, Communication: 4.5, Punctuality: 4, Professionalism: 5, 'Delivery speed': 4 }, text: 'Stunning candid photos of our janti and sindoor-halne. Sneak peeks came the next day! Album is a bit late though.', photos: ['photographerCeremony'], verifiedBooking: true, status: 'published', reply: { text: 'Thank you Sarina! Your album is in final print — sorry for the delay.', at: at(-1) }, helpful: ['acc_customer_demo'], at: at(-10) },
      { id: 'rv2', targetKind: 'provider', targetId: DEMO_VENUE.id, targetName: DEMO_VENUE.name, projectId: 'prj_1009', authorId: 'acc_customer_x1', authorName: 'Bipana & Roshan', authorRole: 'customer', overall: 4.8, criteria: { Food: 5, Venue: 5, Cleanliness: 4.5, Service: 5, Parking: 4 }, text: 'Food was the highlight. 600 guests handled smoothly, parking was a little tight during janti.', photos: [], verifiedBooking: true, status: 'published', helpful: [], at: at(-40) },
      { id: 'rv3', targetKind: 'freelancer', targetId: 'acc_freelancer_demo', targetName: 'Raj Maharjan', projectId: 'prj_1009', authorId: 'acc_vendor_studio', authorName: DEMO_STUDIO.name, authorRole: 'vendor', overall: 4.9, criteria: { Skill: 5, Punctuality: 5, Behaviour: 5, Reliability: 4.5 }, text: 'Raj was early, calm under pressure and his candids were the best of the day.', photos: [], verifiedBooking: true, status: 'published', helpful: [], at: at(-18) },
      { id: 'rv4', targetKind: 'provider', targetId: pick('venue', 'Pokhara').id, targetName: pick('venue', 'Pokhara').name, authorId: 'acc_customer_spam', authorName: 'Rohit P.', authorRole: 'customer', overall: 1, criteria: {}, text: 'Worst venue ever, call 98XXXXXXXX for better deals!!', photos: [], verifiedBooking: false, status: 'flagged', flagReason: 'Contains a phone number and no verified booking', helpful: [], at: at(-1, 20) },
      { id: 'rv5', targetKind: 'provider', targetId: VIDEO_KTM.id, targetName: VIDEO_KTM.name, authorId: 'acc_customer_x2', authorName: 'Nikita & Suman', authorRole: 'customer', overall: 4.4, criteria: { 'Film quality': 5, Communication: 4, Punctuality: 4, Professionalism: 4.5, 'Delivery speed': 4 }, text: 'Beautiful highlight film. Took a bit longer than promised.', photos: [], verifiedBooking: true, status: 'published', helpful: [], at: at(-55) },
    ],
    verifications: [
      { id: 'vc1', subjectKind: 'provider', subjectId: 'laligurans-decor-kathmandu', title: 'Laligurans Decor', subtitle: 'Decoration · Kathmandu', status: 'UNDER_REVIEW', checks: { business: 'passed', identity: 'passed', phone: 'passed', bank: 'pending', portfolio: 'pending' }, documents: [{ kind: 'PAN/VAT certificate', name: 'pan-601112233.pdf', status: 'passed' }, { kind: 'Company registration', name: 'ocr-reg.pdf', status: 'passed' }, { kind: 'Bank cheque', name: 'cheque.jpg', status: 'pending' }], submittedAt: at(-1) },
      { id: 'vc2', subjectKind: 'freelancer', subjectId: 'fl_priya_joshi', title: 'Priya Joshi', subtitle: 'Assistant Photographer · Lalitpur', status: 'DOCUMENT_SUBMITTED', checks: { business: 'passed', identity: 'pending', phone: 'passed', bank: 'pending', portfolio: 'pending' }, documents: [{ kind: 'Citizenship', name: 'citizenship-front.jpg', status: 'pending' }, { kind: 'Portfolio', name: 'instagram.com/priya.frames', status: 'pending' }], submittedAt: at(0, 8) },
      { id: 'vc3', subjectKind: 'provider', subjectId: 'sayapatri-events-pokhara', title: 'Sayapatri Events', subtitle: 'Decoration · Pokhara', status: 'DOCUMENT_SUBMITTED', checks: { business: 'pending', identity: 'pending', phone: 'passed', bank: 'pending', portfolio: 'pending' }, documents: [{ kind: 'PAN/VAT certificate', name: 'pan.pdf', status: 'pending' }], submittedAt: at(-2) },
      { id: 'vc4', subjectKind: 'freelancer', subjectId: 'acc_freelancer_demo', title: 'Raj Maharjan', subtitle: 'Photographer · Kathmandu', status: 'VERIFIED', checks: { business: 'passed', identity: 'passed', phone: 'passed', bank: 'passed', portfolio: 'passed' }, documents: [{ kind: 'Citizenship', name: 'citizenship.jpg', status: 'passed' }], submittedAt: at(-250), decidedAt: at(-248), expiresAt: day(115) },
      { id: 'vc5', subjectKind: 'provider', subjectId: DEMO_VENUE.id, title: DEMO_VENUE.name, subtitle: 'Party Palace · Kathmandu', status: 'VERIFIED', checks: { business: 'passed', identity: 'passed', phone: 'passed', bank: 'passed', portfolio: 'passed' }, documents: [{ kind: 'PAN/VAT certificate', name: 'pan-601234567.pdf', status: 'passed' }], submittedAt: at(-395), decidedAt: at(-390), expiresAt: day(20) },
    ],
    guests: buildGuests(),
    seating: buildSeating(),
    budget: buildBudget(p1021),
    websites: [
      {
        projectId: 'prj_1021',
        slug: 'aakriti-weds-sujan',
        template: 'himalayan',
        accent: '#B8325A',
        font: 'serif',
        headline: 'Aakriti & Sujan',
        story: 'We met at a friend’s Tihar party in Patan in 2021 — one deusi-bhailo song later, Sujan asked for my number. Five years, three Pokhara trips and one very nervous proposal at Nagarkot later, we’re getting married!',
        cover: 'ideaCoupleGardenWalk',
        gallery: ['ideaBrideParasol', 'ideaCoupleGardenWalk', 'decorMandapFloral', 'ideaReceptionToast'],
        sections: { schedule: true, travel: true, faq: true, registry: true, rsvp: true, gallery: true, dressCode: true, story: true },
        travel: `${DEMO_VENUE.name} is 15 minutes from Tribhuvan International Airport. Ample parking. Guests from outside the valley: we’ve blocked rooms at Hotel Tinkune Inn (mention our names).`,
        dressCode: 'Wedding: traditional (saree, daura suruwal, dhaka topi). Reception: festive formal.',
        faqs: [
          { q: 'Can I bring a plus-one?', a: 'Your invitation shows how many seats are reserved for you.' },
          { q: 'Is there parking?', a: 'Yes, free parking for 200+ cars at the venue.' },
          { q: 'Will food be vegetarian?', a: 'Both veg and non-veg buffets, plus a Newari bhoj counter.' },
        ],
        rsvpDeadline: day(30),
        rsvpQuestions: [
          { id: 'q_song', q: 'Which song will get you on the dance floor?', kind: 'song' },
          { id: 'q_bus', q: 'Will you take the janti bus from Baneshwor?', kind: 'choice', options: ['Yes', 'No'] },
        ],
        published: true,
        searchable: false,
        views: 412,
        updatedAt: at(-3),
      },
    ],
    registry: [
      { id: 'reg1', projectId: 'prj_1021', kind: 'honeymoon', title: 'Honeymoon in the Maldives', note: 'Help us get to the beach after the wedding rush!', target: 300_000, image: 'venueDestinationBeach', contributions: [{ id: 'c1', name: 'Anjana Thapa', amount: 10_000, message: 'Have the best time! 🌴', at: at(-6), thanked: true }, { id: 'c2', name: 'Bikash Shrestha', amount: 25_000, at: at(-3), thanked: false }, { id: 'c3', name: 'Office friends', amount: 30_000, message: 'From everyone at the office', at: at(-1), thanked: false }] },
      { id: 'reg2', projectId: 'prj_1021', kind: 'gift', title: 'Kitchen appliance set', price: 45_000, quantity: 1, image: 'expertDesk', contributions: [] },
      { id: 'reg3', projectId: 'prj_1021', kind: 'charity', title: 'Plant 100 trees in Shivapuri', target: 20_000, image: 'venueLawn', contributions: [{ id: 'c4', name: 'Dr. Bishnu Koirala', amount: 5_000, at: at(-4), thanked: true }] },
      { id: 'reg4', projectId: 'prj_1021', kind: 'external', title: 'Daraz wishlist', link: 'https://www.daraz.com.np', contributions: [] },
    ],
    boards: [
      { id: 'bd1', projectId: 'prj_1021', name: 'Decor ideas', items: IDEA_PHOTOS.filter((i) => i.category === 'Decor').slice(0, 5).map((i) => i.id) },
      { id: 'bd2', projectId: 'prj_1021', name: 'Bridal looks', items: IDEA_PHOTOS.filter((i) => i.category === 'Bridal Wear').slice(0, 4).map((i) => i.id) },
    ],
    contracts: [
      {
        id: 'ct_1021_venue',
        projectId: 'prj_1021',
        bookingId: 'bk_1021_venue',
        quoteId: 'qt_1021',
        number: 'CT-2026-0041',
        title: `Venue agreement — ${DEMO_VENUE.name}`,
        version: 1,
        parties: { customer: 'Aakriti Shrestha', provider: DEMO_VENUE.name, platform: 'Vivah Weddings Pvt. Ltd.' },
        sections: contractSections(DEMO_VENUE.name, 'Party palace for Wedding & Reception (2 functions), hall, garden, jagge area, parking and generator backup.', 360_000),
        status: 'signed',
        signatures: [
          { party: 'customer', name: 'Aakriti Shrestha', at: at(-32, 18) },
          { party: 'provider', name: 'Rajesh Pradhan', at: at(-32, 20) },
          { party: 'platform', name: 'Sita Karki', at: at(-31, 9) },
        ],
        createdAt: at(-33),
      },
      {
        id: 'ct_1021_photo',
        projectId: 'prj_1021',
        bookingId: 'bk_1021_photo',
        quoteId: 'qt_1021',
        number: 'CT-2026-0042',
        title: 'Photography agreement — Wedding Story Nepal',
        version: 1,
        parties: { customer: 'Aakriti Shrestha', provider: DEMO_STUDIO.name, platform: 'Vivah Weddings Pvt. Ltd.' },
        sections: contractSections(DEMO_STUDIO.name, 'Photography for 5 events with 2 photographers and an assistant. 400 edited photos within 30 days, 40-sheet album within 60 days. Two free revision rounds.', 180_000),
        status: 'partially_signed',
        signatures: [{ party: 'provider', name: 'Anil Gurung', at: at(-30) }],
        createdAt: at(-33),
      },
    ],
    shortlists: {
      acc_customer_demo: [
        { providerId: pick('makeup', 'Kathmandu').id, status: 'contacted', notes: 'Loved her natural looks on Instagram', tags: ['Natural'], addedAt: at(-8) },
        { providerId: pick('makeup', 'Kathmandu', 1).id, status: 'quote_received', tags: [], addedAt: at(-7) },
        { providerId: pick('dj', 'Kathmandu').id, status: 'saved', tags: ['Reception'], addedAt: at(-4) },
        { providerId: DECOR_KTM_2.id, status: 'negotiating', notes: 'Lighter floral concept', tags: ['Backup'], addedAt: at(-12) },
      ],
    },
    deals: [
      { id: 'deal1', providerId: DEMO_VENUE.id, providerName: DEMO_VENUE.name, serviceId: 'venue', title: 'Mangsir early-booking 10% off', description: 'Book any Mangsir date before the end of this month and save 10% on hall rental.', kind: 'early_booking', discountPct: 10, endsAt: day(25), featured: true, active: true, redemptions: 7 },
      { id: 'deal2', providerId: DEMO_STUDIO.id, providerName: DEMO_STUDIO.name, serviceId: 'photography', title: 'Photo + video bundle — 12% off', description: 'Book photography and videography together and save 12%. Free drone on Premium.', kind: 'bundle', discountPct: 12, featured: true, active: true, redemptions: 12 },
      { id: 'deal3', providerId: pick('venue', 'Pokhara').id, providerName: pick('venue', 'Pokhara').name, serviceId: 'venue', title: 'Last-minute Poush dates', description: 'Three Poush weekends open at the lakeside — NPR 50,000 off.', kind: 'last_minute', discountAmount: 50_000, endsAt: day(40), featured: false, active: true, redemptions: 1 },
      { id: 'deal4', title: 'SHUBHA10 — 10% off your first package', description: 'Platform-wide: 10% off the coordination fee on any complete wedding package.', kind: 'promo_code', code: 'SHUBHA10', discountPct: 10, featured: true, active: true, redemptions: 38 },
      { id: 'deal5', title: 'Refer a couple, get NPR 5,000', description: 'Share your code — you both get NPR 5,000 off once they confirm a booking.', kind: 'referral', code: 'AAKRITI5K', discountAmount: 5_000, featured: false, active: true, redemptions: 2 },
      { id: 'deal6', providerId: pick('makeup', 'Kathmandu').id, providerName: pick('makeup', 'Kathmandu').name, serviceId: 'makeup', title: 'Free trial with bridal package', description: 'Complimentary makeup trial when you book the bridal package.', kind: 'seasonal', featured: false, active: true, redemptions: 4 },
    ],
    staff: [
      { id: 'st1', orgAccountId: 'acc_vendor_demo', name: 'Manoj Shrestha', phone: '9800000201', role: 'Banquet Manager', permissions: ['leads', 'quotes', 'bookings', 'calendar'], active: true },
      { id: 'st2', orgAccountId: 'acc_vendor_demo', name: 'Kamala Rai', phone: '9800000202', role: 'Accounts', permissions: ['finance'], active: true },
      { id: 'st3', orgAccountId: 'acc_vendor_studio', name: 'Prakash Lama', phone: '9800000203', role: 'Lead Photographer', permissions: ['bookings', 'calendar'], active: true },
      { id: 'st4', orgAccountId: 'acc_vendor_studio', name: 'Sunita Karki', phone: '9800000204', role: 'Editor', permissions: ['bookings'], active: true },
    ],
    packages: [
      ...[0, 1, 2].map((i) => ({
        id: `pkg_studio_${i}`,
        providerId: DEMO_STUDIO.id,
        serviceId: 'photography',
        title: `Wedding Photography ${['Basic', 'Premium', 'Luxury'][i]}`,
        price: [45_000, 90_000, 150_000][i],
        unit: 'per package',
        description: ['Perfect for intimate weddings', 'Our most booked package', 'Full cinematic coverage for every function'][i],
        included: [
          ['1 photographer', '1 videographer', '8 hours', '300 edited photos', '1 highlight video'],
          ['2 photographers', '2 videographers', 'Drone', 'Full wedding film', 'Album (40 sheets)'],
          ['3 photographers', '3 videographers', 'Drone', 'Pre-wedding shoot', 'Same-day edit', '2 albums'],
        ][i],
        excluded: ['Travel outside the valley', 'Raw footage'],
        crew: ([{ Photographer: 1, Videographer: 1 }, { Photographer: 2, Videographer: 2, 'Drone Operator': 1 }, { Photographer: 3, Videographer: 3, 'Drone Operator': 1, Editor: 1 }] as Record<string, number>[])[i],
        hours: [8, 12, 16][i],
        deliverables: [
          [{ title: 'Edited photos', qty: 300 }, { title: 'Highlight video', qty: 1 }],
          [{ title: 'Edited photos', qty: 500 }, { title: 'Wedding film', qty: 1 }, { title: 'Album', qty: 1 }],
          [{ title: 'Edited photos', qty: 800 }, { title: 'Wedding film', qty: 1 }, { title: 'Same-day edit', qty: 1 }, { title: 'Albums', qty: 2 }],
        ][i],
        deliveryDays: [21, 30, 30][i],
        addOns: [
          { title: 'Extra photographer', price: 12_000 },
          { title: 'Drone', price: 15_000 },
          { title: 'Extra album', price: 18_000 },
        ],
        discountPct: i === 1 ? 5 : undefined,
        limitedSlots: i === 2 ? 4 : undefined,
        active: true,
      })),
      {
        id: 'pkg_venue_1',
        providerId: DEMO_VENUE.id,
        serviceId: 'venue',
        title: 'Hall + Garden (per function)',
        price: 180_000,
        unit: 'per event',
        description: 'Main hall for 1,500 guests with a garden for the janti welcome',
        included: ['Hall & garden', 'Stage & jagge area', 'Parking attendants', 'Generator backup'],
        excluded: ['Catering', 'Decoration'],
        crew: {},
        deliverables: [],
        addOns: [
          { title: 'Bridal suite', price: 15_000 },
          { title: 'Extra hour', price: 10_000 },
        ],
        active: true,
      },
      {
        id: 'pkg_venue_2',
        providerId: DEMO_VENUE.id,
        serviceId: 'catering',
        title: 'Wedding buffet (per plate)',
        price: 1_250,
        unit: 'per plate',
        description: 'Veg + non-veg with 3 live counters',
        included: ['Welcome drinks', '3 live counters', 'Newari bhoj corner', 'Service staff'],
        excluded: ['Alcohol'],
        crew: {},
        deliverables: [],
        addOns: [{ title: 'Dessert table', price: 25_000 }],
        active: true,
      },
    ],
    portfolio: [
      ...(['photographerCeremony', 'ideaCoupleGardenWalk', 'ideaBrideParasol', 'photographerTeam', 'venueCliffside', 'ideaReceptionToast'] as PhotoKey[]).map((image, i) => ({
        id: `pf_studio_${i}`,
        providerId: DEMO_STUDIO.id,
        image,
        kind: 'image' as const,
        caption: ['Sindoor-halne at Patan', 'Nagarkot sunrise pre-wedding', 'Bride portrait, Bhaktapur', 'Our team on a 600-guest wedding', 'Pokhara drone aerial', 'Reception toast'][i],
        tags: [['Ritual', 'Candid'], ['Pre-wedding'], ['Portrait'], ['Team'], ['Drone'], ['Reception']][i],
        featured: i < 2,
        order: i,
      })),
      ...DEMO_VENUE.images.map((image, i) => ({
        id: `pf_venue_${i}`,
        providerId: DEMO_VENUE.id,
        image,
        kind: 'image' as const,
        caption: ['Main hall set for reception', 'Mandap lighting', 'Garden pavilion', 'Floral jagge'][i] ?? 'Venue',
        tags: ['Venue'],
        featured: i === 0,
        order: i,
      })),
    ],
    settings: {
      commissionRate: 0.1,
      markupRate: 0.15,
      leadFee: 2_000,
      freelancerMargin: 0.2,
      serviceFeeRate: 0.01,
      emergencyFee: 3_000,
      autoAssignCoordinator: true,
      cities: ['Kathmandu', 'Lalitpur', 'Bhaktapur', 'Pokhara', 'Chitwan', 'Butwal', 'Biratnagar', 'Dharan'],
      featuredProviderIds: [DEMO_VENUE.id, DEMO_STUDIO.id],
      banners: [
        { id: 'bn1', title: 'Mangsir weddings are filling fast', subtitle: 'Tell us your date — we’ll lock the best venues for you', href: '/plan', active: true },
        { id: 'bn2', title: 'Emergency cover included', subtitle: 'If a photographer falls sick, we replace them within hours', href: '/info/emergency', active: true },
      ],
    },
    ...buildToolkitSeed(),
    occasions: builtInOccasions(),
  };
}

export function contractSections(provider: string, scope: string, amount: number): { heading: string; body: string }[] {
  return [
    { heading: 'Parties', body: `This agreement is between the Customer, ${provider} (the "Provider") and Vivah Weddings Pvt. Ltd. (the "Platform"), which coordinates the booking and holds payments in escrow.` },
    { heading: 'Scope of work', body: scope },
    { heading: 'Fees', body: `Total agreed price: NPR ${amount.toLocaleString('en-US')} (inclusive of 13% VAT where applicable), payable to the Platform per the payment schedule.` },
    { heading: 'Payment terms', body: '30% on confirmation, 50% fifteen days before the event and 20% after completion. The Platform releases the Provider’s payout 40% before the event and 60% after successful completion.' },
    { heading: 'Cancellation', body: 'Cancellations 60+ days before the event: advance refunded minus 10%. 30–60 days: 50% of the advance refunded. Under 30 days: non-refundable. Provider cancellations are fully refunded and the Platform arranges a replacement at no extra cost.' },
    { heading: 'Revisions & deliverables', body: 'Deliverables are tracked in the Vivah app. Two free revision rounds are included. Delays beyond the agreed date may be raised as a dispute; the Platform may hold settlement until resolved.' },
    { heading: 'Emergency replacement', body: 'If assigned crew cannot attend, the Platform will source an equivalent replacement. The Provider remains responsible for quality.' },
    { heading: 'Governing law', body: 'This agreement is governed by the laws of Nepal. Disputes are first mediated by the Platform, then by the courts of Kathmandu.' },
  ];
}

export const DEMO_IMAGES: PhotoKey[] = ['photographerCeremony', 'decorMandapFloral', 'venueLuxuryStage', 'ideaBrideParasol'];
