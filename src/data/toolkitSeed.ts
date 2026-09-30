/** Demo records for the role toolkits, so the main tools open with a believable story. */
import type { Broadcast, ToolEntry, ToolState } from '@/types/platform';
import { addDays, toISODate } from '@/utils/format';

const day = (offset: number) => addDays(toISODate(new Date()), offset);
const at = (offset: number, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

type Seed = Omit<ToolEntry, 'createdAt' | 'updatedAt'> & { ago?: number };
const entry = ({ ago = 3, ...e }: Seed): ToolEntry => ({ ...e, createdAt: at(-ago), updatedAt: at(-ago) });

const COUPLE = 'prj_1021';
const VENDOR = 'acc_vendor_demo';
const CREW = 'acc_freelancer_demo';
const OPS = 'platform';

export function buildToolkitSeed(): { toolEntries: ToolEntry[]; toolState: Record<string, ToolState>; broadcasts: Broadcast[] } {
  const seeds: Seed[] = [
    // Couple (WP-1021): gifts from the engagement, outfits, duties, meetings, savings, rooms.
    { id: 'te_c_gift1', ownerId: COUPLE, tool: 'couple.gifts', title: 'Hari mama and family', amount: 11_001, group: 'Engagement', fields: { side: 'Bride', item: 'Gold earrings' }, done: true, ago: 20 },
    { id: 'te_c_gift2', ownerId: COUPLE, tool: 'couple.gifts', title: 'Sujan’s office team', amount: 25_000, group: 'Engagement', fields: { side: 'Groom' }, ago: 20 },
    { id: 'te_c_gift3', ownerId: COUPLE, tool: 'couple.gifts', title: 'Kamala thulima', amount: 5_001, group: 'Engagement', fields: { side: 'Bride', item: 'Dinner set' }, ago: 19 },
    { id: 'te_c_out1', ownerId: COUPLE, tool: 'couple.outfits', title: 'Red Banarasi saree', group: 'Bride', status: 'fitting', date: day(12), amount: 85_000, fields: { shop: 'Indra Chowk, Kathmandu' }, ago: 25 },
    { id: 'te_c_out2', ownerId: COUPLE, tool: 'couple.outfits', title: 'Daura suruwal and dhaka topi', group: 'Groom', status: 'ordered', date: day(20), amount: 32_000, fields: { shop: 'Bhaktapur tailors' }, ago: 18 },
    { id: 'te_c_out3', ownerId: COUPLE, tool: 'couple.outfits', title: 'Tilhari and potey set', group: 'Bride', status: 'ready', amount: 140_000, fields: { shop: 'New Road jewellers' }, ago: 10 },
    { id: 'te_c_meet1', ownerId: COUPLE, tool: 'couple.meetings', title: 'Everest Grand Party Palace', group: 'Venue', status: 'done', date: day(-28), time: '11:00', note: 'Main hall for 450, parking for 120 cars. Stage included.', fields: { next: 'Confirm generator backup in writing' }, ago: 28 },
    { id: 'te_c_meet2', ownerId: COUPLE, tool: 'couple.meetings', title: 'Catering tasting', group: 'Catering', status: 'planned', date: day(9), time: '13:00', ago: 4 },
    { id: 'te_c_save1', ownerId: COUPLE, tool: 'couple.savings', title: 'Salary savings', amount: 350_000, date: day(-60), ago: 60 },
    { id: 'te_c_save2', ownerId: COUPLE, tool: 'couple.savings', title: 'Parents', amount: 1_000_000, date: day(-35), ago: 35 },
    { id: 'te_c_room1', ownerId: COUPLE, tool: 'couple.rooms', title: 'Hotel Himalaya, Lalitpur', qty: 8, amount: 6_500, date: day(47), fields: { nights: 2, perRoom: 2 }, note: 'Dharan and Biratnagar relatives', ago: 9 },
    { id: 'te_c_pick1', ownerId: COUPLE, tool: 'couple.pickups', title: 'Sujan’s uncle from Dubai', date: day(45), time: '15:30', status: 'confirmed', fields: { from: 'Tribhuvan airport', to: 'Hotel Himalaya', driver: 'Ramesh dai', phone: '9841000011' }, ago: 6 },

    // Vendor (Everest Grand Party Palace): expenses, suppliers, inventory, visits, follow-ups, halls.
    { id: 'te_v_exp1', ownerId: VENDOR, tool: 'vendor.expenses', title: 'Hall rent', group: 'Rent', amount: 180_000, date: day(-2), fields: { via: 'Bank', vat: true }, ago: 2 },
    { id: 'te_v_exp2', ownerId: VENDOR, tool: 'vendor.expenses', title: 'Kitchen staff wages', group: 'Staff wages', amount: 145_000, date: day(-5), fields: { via: 'Cash' }, ago: 5 },
    { id: 'te_v_exp3', ownerId: VENDOR, tool: 'vendor.expenses', title: 'Generator diesel', group: 'Fuel and transport', amount: 22_500, date: day(-9), fields: { via: 'eSewa', vat: true }, ago: 9 },
    { id: 'te_v_exp4', ownerId: VENDOR, tool: 'vendor.expenses', title: 'Facebook and Instagram ads', group: 'Marketing', amount: 15_000, date: day(-33), fields: { via: 'Bank' }, ago: 33 },
    { id: 'te_v_exp5', ownerId: VENDOR, tool: 'vendor.expenses', title: 'Electricity (NEA)', group: 'Utilities', amount: 38_200, date: day(-36), fields: { via: 'Khalti', vat: true }, ago: 36 },
    { id: 'te_v_sup1', ownerId: VENDOR, tool: 'vendor.suppliers', title: 'Phoolbari Flowers, Kalimati', group: 'Flowers', amount: 35_000, fields: { contact: 'Sunita', phone: '9851011122', terms: '50% advance, rest on delivery' }, ago: 40 },
    { id: 'te_v_sup2', ownerId: VENDOR, tool: 'vendor.suppliers', title: 'Bagmati Generator Rental', group: 'Generator', amount: 18_000, fields: { contact: 'Krishna', phone: '9841233344', terms: 'Pay after the event' }, ago: 40 },
    { id: 'te_v_inv1', ownerId: VENDOR, tool: 'vendor.inventory', title: 'Banquet chairs with covers', group: 'Furniture', qty: 600, amount: 1_800, fields: { condition: 'Good' }, ago: 50 },
    { id: 'te_v_inv2', ownerId: VENDOR, tool: 'vendor.inventory', title: 'Round tables (10 seats)', group: 'Furniture', qty: 55, amount: 9_500, fields: { condition: 'Good' }, ago: 50 },
    { id: 'te_v_inv3', ownerId: VENDOR, tool: 'vendor.inventory', title: 'LED par lights', group: 'Lighting', qty: 40, amount: 6_000, fields: { condition: 'Needs repair' }, date: day(6), note: '4 units flicker', ago: 12 },
    { id: 'te_v_visit1', ownerId: VENDOR, tool: 'vendor.visits', title: 'Neha Gurung and family', refId: 'ld_neha', date: day(2), time: '14:00', status: 'scheduled', fields: { host: 'Rajesh' }, ago: 1 },
    { id: 'te_v_visit2', ownerId: VENDOR, tool: 'vendor.visits', title: 'Sneha Rai', refId: 'ld_sneha', date: day(-32), time: '11:00', status: 'booked', note: 'Loved the lawn for the reception', ago: 32 },
    { id: 'te_v_fu1', ownerId: VENDOR, tool: 'vendor.followups', title: 'Send revised menu with 20 veg dishes', refId: 'ld_kiran', date: day(0), ago: 2 },
    { id: 'te_v_fu2', ownerId: VENDOR, tool: 'vendor.followups', title: 'Call about parking for 150 cars', refId: 'ld_bipana', date: day(-1), ago: 3 },
    { id: 'te_v_hall1', ownerId: VENDOR, tool: 'vendor.halls', title: 'Everest main hall', amount: 150_000, fields: { area: 6500, indoor: true }, note: 'Stage, AC, bridal room', ago: 60 },
    { id: 'te_v_hall2', ownerId: VENDOR, tool: 'vendor.halls', title: 'Garden lawn', amount: 90_000, fields: { area: 9000, indoor: false }, note: 'Mandap spot with Himalayan view', ago: 60 },

    // Freelancer (Raj Maharjan): expenses, gear care, invoices, deliveries, certificates, network.
    { id: 'te_f_exp1', ownerId: CREW, tool: 'freelancer.expenses', title: 'Bike fuel to Bhaktapur', group: 'Travel and fuel', amount: 600, date: day(-6), fields: { km: 36 }, ago: 6 },
    { id: 'te_f_exp2', ownerId: CREW, tool: 'freelancer.expenses', title: 'Rented 70–200 mm lens', group: 'Gear rental', amount: 3_500, date: day(-17), ago: 17 },
    { id: 'te_f_exp3', ownerId: CREW, tool: 'freelancer.expenses', title: 'Google One storage (2 TB)', group: 'Software and storage', amount: 1_150, date: day(-12), ago: 12 },
    { id: 'te_f_gear1', ownerId: CREW, tool: 'freelancer.gearcare', title: 'Sony A7 IV body', amount: 320_000, date: day(25), fields: { serial: 'SN-4471920', insured: true, warranty: day(210) }, ago: 90 },
    { id: 'te_f_gear2', ownerId: CREW, tool: 'freelancer.gearcare', title: 'DJI Mini 4 Pro', amount: 115_000, date: day(70), fields: { serial: 'DJ-88213' }, ago: 90 },
    { id: 'te_f_inv1', ownerId: CREW, tool: 'freelancer.invoices', title: 'Tuladhar family', amount: 18_000, date: day(4), status: 'sent', note: 'Bratabandha shoot, 6 hours', fields: { number: 'INV-R014' }, ago: 3 },
    { id: 'te_f_inv2', ownerId: CREW, tool: 'freelancer.invoices', title: 'Himal Cafe', amount: 9_000, date: day(-20), status: 'paid', note: 'Menu photography', fields: { number: 'INV-R012' }, ago: 25 },
    { id: 'te_f_del1', ownerId: CREW, tool: 'freelancer.deliveries', title: '350 edited photos', refId: 'as_1009_raj', date: day(-2), status: 'editing', ago: 17 },
    { id: 'te_f_cert1', ownerId: CREW, tool: 'freelancer.certs', title: 'CAAN drone pilot permit', date: day(40), fields: { issuer: 'Civil Aviation Authority of Nepal', issued: day(-325) }, ago: 300 },
    { id: 'te_f_net1', ownerId: CREW, tool: 'freelancer.network', title: 'Pooja Shrestha', group: 'Second shooter', fields: { city: 'Lalitpur', phone: '9803456789', rate: 7_500, trusted: true }, ago: 80 },

    // Operations team: tickets, recruitment, promos, on-call.
    { id: 'te_p_tk1', ownerId: OPS, tool: 'platform.tickets', title: 'eSewa payment deducted but not showing', group: 'Payment', status: 'open', refId: 'prj_1021', fields: { priority: 'high', requester: 'Aakriti Shrestha', assignee: 'Sita Karki' }, ago: 0 },
    { id: 'te_p_tk2', ownerId: OPS, tool: 'platform.tickets', title: 'Album proof still not received', group: 'Vendor complaint', status: 'pending', refId: 'prj_1009', fields: { priority: 'medium', requester: 'Sarina Karki', assignee: 'Sita Karki' }, ago: 2 },
    { id: 'te_p_tk3', ownerId: OPS, tool: 'platform.tickets', title: 'Cannot upload PAN certificate', group: 'Technical', status: 'open', fields: { priority: 'low', requester: 'Momo Palace, Pokhara' }, ago: 1 },
    { id: 'te_p_rc1', ownerId: OPS, tool: 'platform.recruit', title: 'Lakeside Banquet, Pokhara', group: 'Venue', status: 'demo', date: day(3), fields: { city: 'Pokhara', phone: '9856012345', owner: 'Bikram Adhikari' }, ago: 7 },
    { id: 'te_p_rc2', ownerId: OPS, tool: 'platform.recruit', title: 'Chitwan Tharu Cultural Band', group: 'Band', status: 'contacted', date: day(1), fields: { city: 'Chitwan', owner: 'Sita Karki' }, ago: 4 },
    { id: 'te_p_pr1', ownerId: OPS, tool: 'platform.promos', title: 'Falgun early-bird', status: 'live', group: 'All couples', amount: 150_000, date: day(45), fields: { code: 'FALGUN5', pct: 5, spent: 42_000 }, ago: 14 },
    { id: 'te_p_oc1', ownerId: OPS, tool: 'platform.oncall', title: 'Sita Karki', date: day(0), group: 'All day', ago: 3 },
    { id: 'te_p_oc2', ownerId: OPS, tool: 'platform.oncall', title: 'Bikram Adhikari', date: day(1), group: 'Night', ago: 3 },
  ];

  return {
    toolEntries: seeds.map(entry),
    toolState: {
      [`${COUPLE}:couple.savings`]: { target: 2_500_000, monthly: 120_000 },
      [`${COUPLE}:couple.honeymoon`]: { spot: 'pokhara', nights: 4, tier: 'Comfort', saved: 'pokhara:4:Comfort' },
      [`${VENDOR}:vendor.goals`]: { revenue: 800_000, bookings: 5, leads: 20 },
      [`${CREW}:freelancer.goals`]: { monthly: 60_000, jobs: 6 },
      [`${OPS}:platform.targets`]: { revenue: 400_000, gmv: 8_000_000, newProjects: 12, confirmed: 5 },
    },
    broadcasts: [
      {
        id: 'bc_seed_1',
        audience: 'vendor',
        title: 'Mangsir bookings open',
        body: 'Couples are booking Mangsir dates now. Update your calendar and packages so you show up in matching.',
        sentById: 'acc_platform_admin',
        sentByName: 'Bikram Adhikari',
        at: at(-6, 9),
        recipients: 2,
      },
    ],
  };
}
