/**
 * Demo dataset for the shared "backend". Dates are relative to today so the
 * demo always has an upcoming wedding, a wedding happening today (execution
 * control room) and a completed one.
 */
import { VENUES } from '@/data/venues';
import { VENDORS } from '@/data/vendors';
import { DEFAULT_TERMS, GST_RATE } from '@/services/quotes';
import type {
  Account,
  AppNotification,
  Approval,
  Gig,
  Lead,
  Payout,
  Project,
  Quotation,
  RunItem,
  RunStatus,
  WeddingEvent,
} from '@/types/platform';
import { toISODate } from '@/utils/format';

export const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return toISODate(d);
};
const at = (offset: number, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

const DEMO_VENUE = VENUES[0];
const DEMO_PHOTOGRAPHER = VENDORS.find((v) => v.subcategoryId === 'photographers' && v.city === 'Bangalore') ?? VENDORS[0];

export const DEMO_ACCOUNTS: Account[] = [
  {
    id: 'acc_customer_demo',
    role: 'customer',
    name: 'Ananya Sharma',
    phone: '9000000001',
    email: 'ananya@example.com',
    city: 'Udaipur',
    createdAt: at(-60),
    verified: true,
  },
  {
    id: 'acc_vendor_demo',
    role: 'vendor',
    name: 'Rahul Menon',
    phone: '9000000002',
    city: DEMO_VENUE.city,
    createdAt: at(-400),
    verified: true,
    businessName: DEMO_VENUE.name,
    categoryId: 'venues',
    listingKind: 'venue',
    listingId: DEMO_VENUE.id,
  },
  {
    id: 'acc_freelancer_demo',
    role: 'freelancer',
    name: 'Riya Sharma',
    phone: '9000000003',
    city: 'Bangalore',
    createdAt: at(-200),
    verified: true,
    skills: ['Makeup', 'Hair Styling'],
    dayRate: 8000,
    bio: 'Bridal makeup artist with 6 years of experience in HD & airbrush looks.',
    available: true,
    rating: 4.8,
  },
  {
    id: 'acc_platform_demo',
    role: 'platform',
    name: 'Kavya Menon',
    phone: '9000000004',
    email: 'kavya@vivah.app',
    city: 'Bangalore',
    createdAt: at(-700),
    verified: true,
    team: 'Genie Planning',
  },
];

/** Demo OTP for every phone number (no SMS gateway in the prototype). */
export const DEMO_OTP = '1234';
/** Access code required to register a platform-team account. */
export const PLATFORM_ACCESS_CODE = 'VIVAH2026';

function run(items: [string, string, string][], statuses: RunStatus[] = []): RunItem[] {
  return items.map(([time, title, owner], i) => ({
    id: `ri_${title.replace(/\W+/g, '').slice(0, 10)}_${i}_${time.replace(':', '')}`,
    time,
    title,
    owner,
    status: statuses[i] ?? 'pending',
  }));
}

const WEDDING_RUN: [string, string, string][] = [
  ['15:00', 'Decor final walkthrough', 'Decor team'],
  ['16:30', 'Bride makeup & styling', 'Makeup artist'],
  ['17:30', 'Groom baraat assembles', 'Family'],
  ['18:15', 'Baraat arrival & milni', 'Coordinator'],
  ['19:00', 'Jaimala on stage', 'Coordinator'],
  ['19:30', 'Dinner service opens', 'Catering'],
  ['21:00', 'Pheras begin', 'Pandit'],
  ['23:30', 'Vidaai', 'Family'],
];

const MEHENDI_RUN: [string, string, string][] = [
  ['11:00', 'Mehendi artists set up', 'Mehendi team'],
  ['12:00', 'Bride mehendi begins', 'Mehendi artist'],
  ['13:30', 'Lunch & live dhol', 'Catering'],
  ['16:00', 'Guest mehendi wraps up', 'Coordinator'],
];

const SANGEET_RUN: [string, string, string][] = [
  ['18:00', 'Sound check & lights', 'DJ'],
  ['19:30', 'Family performances', 'Choreographer'],
  ['21:00', 'Couple performance', 'Couple'],
  ['21:30', 'DJ night', 'DJ'],
];

const RECEPTION_RUN: [string, string, string][] = [
  ['19:00', 'Couple entry', 'Coordinator'],
  ['19:30', 'Stage photographs', 'Photographer'],
  ['20:00', 'Dinner', 'Catering'],
  ['22:30', 'Send-off', 'Coordinator'],
];

const ev = (
  id: string,
  name: string,
  date: string,
  startTime: string,
  venue: string,
  guests: number,
  runSheet: RunItem[],
  status: WeddingEvent['status'] = 'planned',
): WeddingEvent => ({ id, name, date, startTime, venue, guests, status, runSheet });

export function buildSeedProjects(): Project[] {
  return [
    {
      id: 'prj_1042',
      code: 'WED-1042',
      title: 'Ananya & Rohan',
      customerId: 'acc_customer_demo',
      customerName: 'Ananya Sharma',
      customerPhone: '9000000001',
      city: 'Udaipur',
      weddingDate: day(75),
      guests: 350,
      budget: 4500000,
      managedBy: 'platform',
      plannerName: 'Kavya Menon',
      geniePackageId: 'signature',
      stage: 'booked',
      vendors: [
        { id: 'pv1', name: 'Lake Palace Pichola Retreat', category: 'Venue', amount: 1800000, status: 'booked' },
        { id: 'pv2', listingId: DEMO_PHOTOGRAPHER.id, name: DEMO_PHOTOGRAPHER.name, category: 'Photography', amount: 280000, status: 'booked' },
        { id: 'pv3', name: 'Petals & Kesar Decor', category: 'Decor', amount: 450000, status: 'quoted', quoteId: 'qt_petals' },
        { id: 'pv4', name: 'Makeup by Tara', category: 'Makeup', amount: 60000, status: 'shortlisted' },
      ],
      events: [
        ev('ev_1042_m', 'Mehendi', day(73), '11:00', 'Poolside Lawn', 150, run(MEHENDI_RUN)),
        ev('ev_1042_s', 'Sangeet', day(74), '18:00', 'Crystal Ballroom', 300, run(SANGEET_RUN)),
        ev('ev_1042_w', 'Wedding', day(75), '15:00', 'Lake Terrace', 350, run(WEDDING_RUN)),
        ev('ev_1042_r', 'Reception', day(76), '19:00', 'Grand Lawn', 400, run(RECEPTION_RUN)),
      ],
      tasks: [
        { id: 'tk1', title: 'Finalise decor mood board', assignee: 'Ananya Sharma', assigneeRole: 'customer', due: day(10), status: 'doing', priority: 'high' },
        { id: 'tk2', title: 'Share final guest list', assignee: 'Ananya Sharma', assigneeRole: 'customer', due: day(30), status: 'todo', priority: 'medium' },
        { id: 'tk3', title: 'Negotiate decor quote', assignee: 'Kavya Menon', assigneeRole: 'platform', due: day(5), status: 'doing', priority: 'high' },
        { id: 'tk4', title: 'Block 60 rooms for guests', assignee: 'Kavya Menon', assigneeRole: 'platform', due: day(14), status: 'done', priority: 'high' },
        { id: 'tk5', title: 'Makeup trial', assignee: 'Makeup by Tara', assigneeRole: 'vendor', due: day(45), status: 'todo', priority: 'medium' },
      ],
      payments: [
        { id: 'pm1', title: 'Venue advance (30%)', payee: 'Lake Palace Pichola Retreat', amount: 540000, due: day(-20), status: 'paid', paidAt: at(-20) },
        { id: 'pm2', title: 'Photography advance', payee: DEMO_PHOTOGRAPHER.name, amount: 84000, due: day(-5), status: 'paid', paidAt: at(-5) },
        { id: 'pm3', title: 'Venue second instalment', payee: 'Lake Palace Pichola Retreat', amount: 900000, due: day(20), status: 'due' },
        { id: 'pm4', title: 'Genie Signature Plan', payee: 'Vivah', amount: 23599, due: day(-30), status: 'paid', paidAt: at(-30) },
      ],
      incidents: [],
      createdAt: at(-45),
    },
    {
      id: 'prj_1038',
      code: 'WED-1038',
      title: 'Priya & Karthik',
      customerId: 'acc_customer_priya',
      customerName: 'Priya Nair',
      customerPhone: '9000000011',
      city: 'Goa',
      weddingDate: day(0),
      guests: 180,
      budget: 3200000,
      managedBy: 'platform',
      plannerName: 'Kavya Menon',
      geniePackageId: 'destination',
      stage: 'execution',
      vendors: [
        { id: 'pv5', name: 'Cliffside Cove Retreat', category: 'Venue', amount: 1400000, status: 'booked' },
        { id: 'pv6', name: 'Golden Hour Studio', category: 'Photography', amount: 250000, status: 'booked' },
        { id: 'pv7', name: 'Lotus Weddings & Events', category: 'Decor', amount: 380000, status: 'booked' },
      ],
      events: [
        ev('ev_1038_h', 'Haldi', day(-1), '10:00', 'Beach Deck', 120, run(MEHENDI_RUN, ['done', 'done', 'done', 'done']), 'done'),
        ev(
          'ev_1038_w',
          'Wedding',
          day(0),
          '15:00',
          'Cliff Lawn',
          180,
          run(WEDDING_RUN, ['done', 'done', 'in_progress', 'delayed', 'pending', 'pending', 'pending', 'pending']),
          'live',
        ),
        ev('ev_1038_r', 'Reception', day(1), '19:00', 'Sunset Terrace', 200, run(RECEPTION_RUN)),
      ],
      tasks: [
        { id: 'tk6', title: 'Confirm shuttle for baraat', assignee: 'Ops crew', assigneeRole: 'platform', due: day(0), status: 'doing', priority: 'high' },
        { id: 'tk7', title: 'Collect final payment', assignee: 'Kavya Menon', assigneeRole: 'platform', due: day(2), status: 'todo', priority: 'medium' },
      ],
      payments: [
        { id: 'pm5', title: 'Venue full payment', payee: 'Cliffside Cove Retreat', amount: 1400000, due: day(-10), status: 'paid', paidAt: at(-10) },
        { id: 'pm6', title: 'Decor balance', payee: 'Lotus Weddings & Events', amount: 190000, due: day(1), status: 'due' },
      ],
      incidents: [
        { id: 'inc1', eventId: 'ev_1038_w', title: 'Baraat delayed by 20 mins due to traffic', severity: 'medium', status: 'open', reportedBy: 'Ops crew', at: at(0, 18) },
      ],
      createdAt: at(-120),
    },
    {
      id: 'prj_1051',
      code: 'WED-1051',
      title: 'Sneha & Arjun',
      customerId: 'acc_customer_sneha',
      customerName: 'Sneha Iyer',
      customerPhone: '9000000012',
      city: DEMO_VENUE.city,
      weddingDate: day(30),
      guests: 250,
      budget: 2500000,
      managedBy: 'self',
      stage: 'booked',
      vendors: [
        { id: 'pv8', listingId: DEMO_VENUE.id, vendorAccountId: 'acc_vendor_demo', name: DEMO_VENUE.name, category: 'Venue', amount: 1350000, status: 'booked', quoteId: 'qt_sneha' },
      ],
      events: [
        ev('ev_1051_s', 'Sangeet', day(29), '18:00', 'Crystal Ballroom', 200, run(SANGEET_RUN)),
        ev('ev_1051_w', 'Wedding', day(30), '15:00', 'Grand Lawn', 250, run(WEDDING_RUN)),
      ],
      tasks: [
        { id: 'tk8', title: 'Menu tasting with couple', assignee: 'Rahul Menon', assigneeRole: 'vendor', due: day(12), status: 'todo', priority: 'medium' },
        { id: 'tk9', title: 'Share mandap layout', assignee: 'Rahul Menon', assigneeRole: 'vendor', due: day(8), status: 'doing', priority: 'high' },
      ],
      payments: [
        { id: 'pm7', title: 'Booking advance (30%)', payee: DEMO_VENUE.name, amount: 405000, due: day(-15), status: 'paid', paidAt: at(-15) },
        { id: 'pm8', title: 'Pre-event instalment (50%)', payee: DEMO_VENUE.name, amount: 675000, due: day(23), status: 'upcoming' },
        { id: 'pm9', title: 'Final balance (20%)', payee: DEMO_VENUE.name, amount: 270000, due: day(31), status: 'upcoming' },
      ],
      incidents: [],
      createdAt: at(-25),
    },
    {
      id: 'prj_1017',
      code: 'WED-1017',
      title: 'Meera & Vikram',
      customerId: 'acc_customer_meera',
      customerName: 'Meera Rathore',
      customerPhone: '9000000013',
      city: 'Jaipur',
      weddingDate: day(-20),
      guests: 500,
      budget: 6000000,
      managedBy: 'platform',
      plannerName: 'Kavya Menon',
      stage: 'completed',
      vendors: [
        { id: 'pv9', name: 'Amber Fort View Palace', category: 'Venue', amount: 3200000, status: 'booked' },
        { id: 'pv10', name: 'Saffron Films', category: 'Photography', amount: 350000, status: 'booked' },
      ],
      events: [ev('ev_1017_w', 'Wedding', day(-20), '16:00', 'Palace Courtyard', 500, run(WEDDING_RUN, Array(8).fill('done')), 'done')],
      tasks: [],
      payments: [{ id: 'pm10', title: 'All payments', payee: 'Vendors', amount: 3550000, due: day(-21), status: 'paid', paidAt: at(-21) }],
      incidents: [],
      createdAt: at(-200),
    },
  ];
}

export function buildSeedQuotes(): Quotation[] {
  const base = { taxRate: GST_RATE, terms: DEFAULT_TERMS, createdAt: at(-3), updatedAt: at(-3) };
  return [
    {
      ...base,
      id: 'qt_petals',
      number: 'QT-2026-0031',
      fromKind: 'vendor',
      fromId: 'vendor_petals',
      fromName: 'Petals & Kesar Decor',
      category: 'planning-decor',
      projectId: 'prj_1042',
      customerId: 'acc_customer_demo',
      customerName: 'Ananya Sharma',
      eventDate: day(75),
      city: 'Udaipur',
      items: [
        { id: 'qi1', title: 'Mandap design & florals', description: 'Pastel florals, 4-pillar mandap', qty: 1, rate: 220000 },
        { id: 'qi2', title: 'Sangeet stage & lighting', qty: 1, rate: 120000 },
        { id: 'qi3', title: 'Entrance & photo-booth', qty: 2, rate: 45000 },
      ],
      discount: 20000,
      notes: 'Includes setup, teardown and 2 on-site decor supervisors.',
      validUntil: day(12),
      status: 'sent',
    },
    {
      ...base,
      id: 'qt_platform_1042',
      number: 'QT-2026-0028',
      fromKind: 'platform',
      fromId: 'platform',
      fromName: 'Vivah Genie',
      category: 'platform',
      projectId: 'prj_1042',
      customerId: 'acc_customer_demo',
      customerName: 'Ananya Sharma',
      eventDate: day(75),
      city: 'Udaipur',
      items: [
        { id: 'qi4', title: 'Wedding-day execution crew (per day)', qty: 4, rate: 25000 },
        { id: 'qi5', title: 'Guest hospitality desk', qty: 1, rate: 40000 },
      ],
      discount: 0,
      notes: 'Crew of 6 across all four functions, led by your Genie planner.',
      validUntil: day(20),
      status: 'accepted',
    },
    {
      ...base,
      id: 'qt_sneha',
      number: 'QT-2026-0022',
      fromKind: 'vendor',
      fromId: 'acc_vendor_demo',
      fromName: DEMO_VENUE.name,
      listingId: DEMO_VENUE.id,
      category: 'venues',
      leadId: 'ld_sneha',
      projectId: 'prj_1051',
      customerId: 'acc_customer_sneha',
      customerName: 'Sneha Iyer',
      eventDate: day(30),
      city: DEMO_VENUE.city,
      items: [
        { id: 'qi6', title: 'Venue rental — 2 functions', qty: 2, rate: 350000 },
        { id: 'qi7', title: 'Veg catering (per plate)', qty: 250, rate: 1800 },
        { id: 'qi8', title: 'Decor & lighting package', qty: 1, rate: 200000 },
      ],
      discount: 0,
      notes: '20 complimentary rooms for family.',
      validUntil: day(-5),
      status: 'accepted',
      createdAt: at(-28),
      updatedAt: at(-26),
    },
    {
      ...base,
      id: 'qt_kiara',
      number: 'QT-2026-0034',
      fromKind: 'vendor',
      fromId: 'acc_vendor_demo',
      fromName: DEMO_VENUE.name,
      listingId: DEMO_VENUE.id,
      category: 'venues',
      leadId: 'ld_kiara',
      customerId: 'acc_customer_kiara',
      customerName: 'Kiara Kapoor',
      eventDate: day(120),
      city: DEMO_VENUE.city,
      items: [
        { id: 'qi9', title: 'Venue rental (per function)', qty: 3, rate: 350000 },
        { id: 'qi10', title: 'Veg catering (per plate)', qty: 400, rate: 1650 },
      ],
      discount: 50000,
      notes: '',
      validUntil: day(10),
      status: 'viewed',
      createdAt: at(-2),
      updatedAt: at(-1),
    },
  ];
}

export function buildSeedLeads(): Lead[] {
  const common = { listingKind: 'venue' as const, listingId: DEMO_VENUE.id, listingName: DEMO_VENUE.name, city: DEMO_VENUE.city };
  return [
    { ...common, id: 'ld_isha', customerId: 'acc_customer_isha', customerName: 'Isha Kapoor', customerPhone: '9000000021', eventDate: day(95), guests: 300, functions: ['Wedding', 'Reception'], message: 'Looking for a lawn wedding with in-house catering. Is Feb available?', budget: 1500000, status: 'new', createdAt: at(0, 9) },
    { ...common, id: 'ld_neha', customerId: 'acc_customer_neha', customerName: 'Neha Reddy', customerPhone: '9000000022', eventDate: day(60), guests: 200, functions: ['Sangeet', 'Wedding'], message: 'Can we do a site visit this weekend?', status: 'contacted', createdAt: at(-1, 15) },
    { ...common, id: 'ld_kiara', customerId: 'acc_customer_kiara', customerName: 'Kiara Kapoor', customerPhone: '9000000023', eventDate: day(120), guests: 400, functions: ['Mehendi', 'Sangeet', 'Wedding'], status: 'quoted', createdAt: at(-4) },
    { ...common, id: 'ld_sneha', customerId: 'acc_customer_sneha', customerName: 'Sneha Iyer', customerPhone: '9000000012', eventDate: day(30), guests: 250, functions: ['Sangeet', 'Wedding'], status: 'won', createdAt: at(-30) },
  ];
}

export function buildSeedGigs(): Gig[] {
  const g = (partial: Omit<Gig, 'applications' | 'createdAt' | 'status'> & Partial<Pick<Gig, 'applications' | 'status'>>): Gig => ({
    status: 'open',
    applications: [],
    createdAt: at(-1),
    ...partial,
  });
  return [
    g({
      id: 'gig_makeup_sneha',
      title: 'Bridal makeup assistant — Sneha & Arjun',
      skill: 'Makeup',
      postedById: 'acc_vendor_demo',
      postedByName: DEMO_VENUE.name,
      postedByKind: 'vendor',
      projectId: 'prj_1051',
      eventId: 'ev_1051_w',
      city: DEMO_VENUE.city,
      date: day(30),
      startTime: '14:00',
      hours: 8,
      pay: 9000,
      description: 'Assist the lead makeup artist with bridal and family looks for the wedding.',
      requirements: ['Own HD makeup kit', '2+ years of bridal experience'],
      slots: 1,
      status: 'filled',
      applications: [
        { id: 'app1', freelancerId: 'acc_freelancer_demo', freelancerName: 'Riya Sharma', skill: 'Makeup', rating: 4.8, message: 'Happy to help! I have done 40+ bridal looks.', expectedPay: 9000, status: 'hired', appliedAt: at(-6) },
      ],
    }),
    g({
      id: 'gig_crew_goa',
      title: 'Wedding-day floor crew (4 people)',
      skill: 'Event Crew',
      postedById: 'platform',
      postedByName: 'Vivah Operations',
      postedByKind: 'platform',
      projectId: 'prj_1038',
      eventId: 'ev_1038_r',
      city: 'Goa',
      date: day(1),
      startTime: '16:00',
      hours: 8,
      pay: 3500,
      description: 'Guest guidance, seating and backstage coordination for the reception.',
      requirements: ['Formal black attire', 'Basic English & Hindi'],
      slots: 4,
      applications: [
        { id: 'app2', freelancerId: 'fl_ravi', freelancerName: 'Ravi Kumar', skill: 'Event Crew', rating: 4.5, message: 'Available all evening.', expectedPay: 3500, status: 'hired', appliedAt: at(-2) },
        { id: 'app3', freelancerId: 'fl_sam', freelancerName: 'Sam D’Souza', skill: 'Event Crew', rating: 4.2, message: 'Local to Goa, 3 years experience.', expectedPay: 3500, status: 'applied', appliedAt: at(-1) },
      ],
    }),
    g({
      id: 'gig_touchup_goa',
      title: 'Bridal touch-ups — Priya & Karthik wedding',
      skill: 'Makeup',
      postedById: 'platform',
      postedByName: 'Vivah Operations',
      postedByKind: 'platform',
      projectId: 'prj_1038',
      eventId: 'ev_1038_w',
      city: 'Goa',
      date: day(0),
      startTime: '16:00',
      hours: 6,
      pay: 7500,
      description: 'Stay on standby for bridal & family touch-ups through the pheras. Report to the bridal suite.',
      requirements: ['Own touch-up kit', 'Formal attire'],
      slots: 1,
      status: 'filled',
      applications: [
        { id: 'app5', freelancerId: 'acc_freelancer_demo', freelancerName: 'Riya Sharma', skill: 'Makeup', rating: 4.8, message: 'Can reach Goa by noon.', expectedPay: 7500, status: 'hired', appliedAt: at(-4) },
      ],
    }),
    g({ id: 'gig_second_shooter', title: 'Second shooter for candid coverage', skill: 'Photography', postedById: 'vendor_goldenhour', postedByName: 'Golden Hour Studio', postedByKind: 'vendor', city: 'Bangalore', date: day(9), startTime: '10:00', hours: 10, pay: 12000, description: 'Candid coverage of a 250-guest wedding alongside our lead photographer. Raw files to be handed over the same night.', requirements: ['Full-frame body + 70-200mm', 'Portfolio link'], slots: 1 }),
    g({ id: 'gig_family_makeup', title: 'Family makeup artist — 6 people', skill: 'Makeup', postedById: 'vendor_glow', postedByName: 'Glow Studio', postedByKind: 'vendor', city: 'Bangalore', date: day(12), startTime: '08:00', hours: 6, pay: 10000, description: 'Party makeup and hairstyling for the bride’s family ahead of the morning muhurtham.', requirements: ['Own kit', 'Hairstyling skills'], slots: 2 }),
    g({ id: 'gig_mehendi_jaipur', title: 'Mehendi artist for guests', skill: 'Mehendi', postedById: 'platform', postedByName: 'Vivah Operations', postedByKind: 'platform', city: 'Jaipur', date: day(18), startTime: '11:00', hours: 6, pay: 6000, description: 'Arabic and minimal designs for ~80 guests at the mehendi function.', requirements: ['Organic henna', 'Fast turnaround'], slots: 3 }),
    g({ id: 'gig_udaipur_coord', title: 'Hospitality desk — Ananya & Rohan', skill: 'Event Crew', postedById: 'platform', postedByName: 'Vivah Operations', postedByKind: 'platform', projectId: 'prj_1042', eventId: 'ev_1042_w', city: 'Udaipur', date: day(75), startTime: '12:00', hours: 10, pay: 4000, description: 'Welcome desk, room allocation and guest help for a 350-guest palace wedding.', requirements: ['Hospitality experience'], slots: 3 }),
    g({ id: 'gig_anchor_mumbai', title: 'Bilingual anchor for sangeet', skill: 'Anchoring', postedById: 'vendor_pearl', postedByName: 'The Pearl Banquets', postedByKind: 'vendor', city: 'Mumbai', date: day(22), startTime: '19:00', hours: 4, pay: 15000, description: 'Host a high-energy sangeet with games and family performances.', requirements: ['Hindi & English', 'Showreel'], slots: 1 }),
    g({ id: 'gig_decor_helper', title: 'Decor setup helpers', skill: 'Decor', postedById: 'vendor_petals', postedByName: 'Petals & Kesar Decor', postedByKind: 'vendor', city: 'Bangalore', date: day(6), startTime: '07:00', hours: 9, pay: 2500, description: 'Floral installation and mandap assembly for a day wedding.', requirements: ['Can lift 20 kg', 'Punctual'], slots: 5 }),
    g({ id: 'gig_dj_pune', title: 'DJ for cocktail night', skill: 'DJ', postedById: 'vendor_sahyadri', postedByName: 'Sahyadri Hills Resort', postedByKind: 'vendor', city: 'Pune', date: day(15), startTime: '20:00', hours: 5, pay: 25000, description: 'Bollywood + EDM set for 200 guests. Sound system provided by venue.', requirements: ['Own controller', 'Playlist samples'], slots: 1 }),
    g({
      id: 'gig_meera_done',
      title: 'Bridal makeup — Meera & Vikram',
      skill: 'Makeup',
      postedById: 'platform',
      postedByName: 'Vivah Operations',
      postedByKind: 'platform',
      projectId: 'prj_1017',
      city: 'Jaipur',
      date: day(-20),
      startTime: '12:00',
      hours: 8,
      pay: 14000,
      description: 'Bridal look for the wedding ceremony.',
      requirements: [],
      slots: 1,
      status: 'completed',
      applications: [
        { id: 'app4', freelancerId: 'acc_freelancer_demo', freelancerName: 'Riya Sharma', skill: 'Makeup', rating: 4.8, message: '', expectedPay: 14000, status: 'completed', appliedAt: at(-35), checkInAt: at(-20, 12), checkOutAt: at(-20, 20) },
      ],
    }),
  ];
}

export function buildSeedPayouts(): Payout[] {
  return [
    { id: 'po1', freelancerId: 'acc_freelancer_demo', gigId: 'gig_meera_done', title: 'Bridal makeup — Meera & Vikram', amount: 14000, status: 'paid', date: day(-17) },
    { id: 'po2', freelancerId: 'acc_freelancer_demo', gigId: 'gig_prev_1', title: 'Engagement makeup — Tanvi', amount: 7000, status: 'paid', date: day(-40) },
    { id: 'po3', freelancerId: 'acc_freelancer_demo', gigId: 'gig_prev_2', title: 'Family makeup — Iyer wedding', amount: 9500, status: 'pending', date: day(-3) },
  ];
}

export function buildSeedApprovals(): Approval[] {
  return [
    { id: 'apv1', kind: 'vendor', subjectId: 'vendor_saffron', title: 'Saffron Films', subtitle: 'Cinematographers · Mumbai', details: ['GST certificate uploaded', 'Portfolio: 24 weddings', 'Owner: Kabir Malhotra'], status: 'pending', submittedAt: at(-1) },
    { id: 'apv2', kind: 'vendor', subjectId: 'vendor_petals', title: 'Petals & Kesar Decor', subtitle: 'Decorators · Udaipur', details: ['PAN & GST verified', 'Warehouse photos pending'], status: 'pending', submittedAt: at(-2) },
    { id: 'apv3', kind: 'freelancer', subjectId: 'fl_aarav', title: 'Aarav Mehta', subtitle: 'Photographer · Bangalore', details: ['Aadhaar verified', 'Day rate ₹9,000', '3 reference weddings'], status: 'pending', submittedAt: at(0, 8) },
    { id: 'apv4', kind: 'review', subjectId: 'rev_seabreeze', title: 'Review on Seabreeze Grand', subtitle: '1★ by “Rohit P.” — possible spam', details: ['“Worst venue ever, call 98xxxx for better deals”', 'Contains phone number'], status: 'pending', submittedAt: at(-1, 20) },
    { id: 'apv5', kind: 'freelancer', subjectId: 'acc_freelancer_demo', title: 'Riya Sharma', subtitle: 'Makeup · Bangalore', details: ['KYC complete'], status: 'approved', submittedAt: at(-200) },
  ];
}

export function buildSeedNotifications(): AppNotification[] {
  return [
    { id: 'n1', to: 'acc_vendor_demo', title: 'New lead: Isha Kapoor', body: 'Wedding & Reception for 300 guests, 3 months away.', at: at(0, 9), read: false, href: '/business/lead/ld_isha' },
    { id: 'n2', to: 'acc_vendor_demo', title: 'Kiara viewed your quotation', body: 'QT-2026-0034 was opened by the customer.', at: at(-1), read: false },
    { id: 'n3', to: 'acc_customer_demo', title: 'New quotation received', body: 'Petals & Kesar Decor sent you a decor quote.', at: at(-3), read: false, href: '/quote/qt_petals' },
    { id: 'n4', to: 'acc_freelancer_demo', title: 'You’re hired! 🎉', body: 'Bridal makeup assistant — Sneha & Arjun.', at: at(-5), read: false, href: '/freelancer/job/gig_makeup_sneha' },
    { id: 'n5', to: 'platform', title: 'Incident at WED-1038', body: 'Baraat delayed by 20 mins due to traffic.', at: at(0, 18), read: false, href: '/platform/project/prj_1038' },
    { id: 'n6', to: 'platform', title: '3 approvals waiting', body: 'New vendor & freelancer verifications need review.', at: at(0, 8), read: false, href: '/platform/approvals' },
  ];
}
