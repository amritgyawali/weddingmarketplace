/**
 * Unit checks for the smart toolkit rules (src/services/insights.ts): health
 * score, headcount forecast, price check, votes, lead scores, revenue
 * forecast, gig fit, workload, money reconciliation and the rate simulator.
 * Node 24+ strips the TypeScript.
 *
 *   npm run test:insights
 */
import './ts-loader.mjs';

import { importApp } from './ts-loader.mjs';

const x = await importApp('@/services/insights');
const { addDays, today } = await importApp('@/utils/format');

const results = [];
const ok = (name, pass, detail = '') => results.push({ name, pass: !!pass, detail });

// Health check
const perfect = x.weddingHealth({ daysToGo: 10, services: { confirmed: 6, total: 6 }, missingServices: 0, tasks: { done: 10, total: 10 }, overdueMilestones: 0, guests: { total: 100, invited: 100, responded: 100 }, contracts: { signed: 6, total: 6 }, budget: 1_000_000, committed: 900_000 });
ok('health: everything done scores 100', perfect.score === 100 && perfect.pace === 'done', `${perfect.score} ${perfect.pace}`);
const empty = x.weddingHealth({ daysToGo: 30, services: { confirmed: 0, total: 6 }, missingServices: 2, tasks: { done: 0, total: 5 }, overdueMilestones: 2, guests: { total: 0, invited: 0, responded: 0 }, contracts: { signed: 0, total: 0 }, budget: 1_000_000, committed: 1_600_000 });
ok('health: nothing done a month out is behind', empty.score < 20 && empty.pace === 'behind', `${empty.score} ${empty.pace}`);
ok('health: biggest gap first', empty.gaps[0]?.id === 'vendors');
ok('health: weights sum to 100', perfect.parts.reduce((s, p) => s + p.weight, 0) === 100);
const early = x.weddingHealth({ daysToGo: 400, services: { confirmed: 0, total: 6 }, missingServices: 0, tasks: { done: 0, total: 0 }, overdueMilestones: 0, guests: { total: 0, invited: 0, responded: 0 }, contracts: { signed: 0, total: 0 }, budget: 0, committed: 0 });
ok('health: a year out, a fresh plan is on track', early.expected === 0 && early.pace !== 'behind', `${early.score}/${early.expected} ${early.pace}`);

// Headcount
const guest = (id, rsvp, attending, plusOnes = 0, children = 0) => ({ id, plusOnes, children, invites: [{ eventId: 'e1', rsvp, attending }] });
const rows = x.headcountForecast(
  [guest('a', 'yes', 4), guest('b', 'maybe', 0, 1), guest('c', 'pending', 0, 2, 1), guest('d', 'no', 0, 3), { id: 'z', plusOnes: 0, children: 0, invites: [] }],
  [{ id: 'e1', name: 'Wedding', date: '2027-01-20', guests: 10 }],
  { maybe: 0.5, pending: 0.5, buffer: 0.1 },
);
const r = rows[0];
ok('headcount: counts by reply', r.yes === 4 && r.maybe === 2 && r.pending === 4 && r.no === 4 && r.invited === 4, JSON.stringify(r));
ok('headcount: expected = yes + half maybe + half pending', r.expected === 7, String(r.expected));
ok('headcount: plates round up to tables of 10 with buffer', r.plates === 10 && r.ceiling === 10 && r.floor === 4, `${r.plates} ${r.ceiling}`);

// Price check
const pc = x.priceCheck(1_500, [1_000, 1_200, 1_400, 1_600, 1_800, 2_000], [800, 2_500]);
ok('price: median and percentile from listings', pc.basis === 'listings' && pc.median === 1_500 && pc.percentile === 0.5 && pc.verdict === 'fair', JSON.stringify(pc));
ok('price: far above is very high', x.priceCheck(5_000, [1_000, 1_200, 1_400], [800, 2_500]).verdict === 'very_high');
ok('price: few listings falls back to the range', x.priceCheck(900, [1_000], [800, 2_000]).basis === 'range' && x.priceCheck(900, [1_000], [800, 2_000]).verdict === 'good');

// Registration
const reg = x.registrationDeadline('2026-01-01');
ok('registration: 35 days after the wedding', reg.due === '2026-02-05' && reg.started, reg.due);

// Votes
const tally = x.tallyVotes(['A', 'B', 'C'], { options: 'A\nB\nC', 'vote:u1': 0, 'vote:u2': 1, 'vote:u3': 1, 'vote:u4': 9, 'name:u1': 'Hari' });
ok('votes: tally ignores bad indexes', tally.total === 3 && tally.counts.join() === '1,2,0' && tally.leaders.join() === 'B', JSON.stringify(tally));
ok('votes: options parsed and de-duplicated', x.parseOptions(' A \nB, A\n\n|C').join() === 'A,B,C');

// Lead score
const now = new Date().toISOString();
const soon = addDays(today(), 30);
const hot = x.leadScore({ status: 'negotiating', eventDate: soon, guests: 300, budget: 600_000, message: 'We loved your hall and would like to visit this weekend with our parents to finalise.', source: 'referral', createdAt: now }, { startingPrice: 400_000, capacity: { min: 100, max: 500 }, free: true, nowIso: now });
const cold = x.leadScore({ status: 'new', eventDate: soon, guests: 900, budget: 100_000, createdAt: addDays(today(), -40) + 'T00:00:00.000Z' }, { startingPrice: 400_000, capacity: { min: 100, max: 500 }, free: false, nowIso: now });
ok('lead: strong enquiry is hot', hot.band === 'hot' && hot.score > 80, `${hot.score}`);
ok('lead: weak enquiry is cold', cold.band === 'cold' && cold.score < 20, `${cold.score}`);
ok('lead: score within 0–100', [hot, cold].every((s) => s.score >= 0 && s.score <= 100));

// Revenue forecast
const month = today().slice(0, 7);
const fc = x.revenueForecast(today(), 3, [{ date: `${month}-15`, amount: 100_000 }], [{ date: `${month}-20`, value: 200_000, status: 'quoted' }, { date: `${month}-21`, value: 999_999, status: 'lost' }], { quoted: 0.5 });
ok('forecast: certain plus weighted pipeline', fc.length === 3 && fc[0].certain === 100_000 && fc[0].likely === 100_000 && fc[0].open === 1 && fc[0].total === 200_000, JSON.stringify(fc[0]));

// Conversion
const conv = x.conversionBy([{ status: 'won', s: 'a' }, { status: 'lost', s: 'a' }, { status: 'won', s: 'b' }, { status: 'new', s: 'b' }], (l) => l.s);
ok('conversion: rate is won of decided', conv[0].key === 'b' && conv[0].rate === 1 && conv[1].rate === 0.5, JSON.stringify(conv));

// Date demand
const dd = x.dateDemand('2026-11-28', { sait: true, requests: 4 });
ok('date demand: sait Saturday in Mangsir with requests is top demand', dd.saturday && dd.demand >= 75 && dd.upliftPct === 25, JSON.stringify(dd));

// Gig fit
const profile = { skills: ['Photographer'], hourlyRate: 1_000, dayRate: 10_000, travelRadiusKm: 50, perKm: 10, busy: false };
const local = x.gigFit({ pay: 12_000, hours: 8, skill: 'Photographer', date: '2027-03-01', km: null }, profile);
const far = x.gigFit({ pay: 12_000, hours: 8, skill: 'Photographer', date: '2027-03-01', km: 200 }, profile);
ok('gig fit: travel is costed both ways', far.travelCost === 4_000 && far.net === 8_000 && local.travelCost === 0, `${far.travelCost}`);
ok('gig fit: local beats far for the same pay', local.score > far.score, `${local.score} vs ${far.score}`);
ok('gig fit: a clash sinks the score', x.gigFit({ pay: 12_000, hours: 8, skill: 'Photographer', date: '2027-03-01', km: null }, { ...profile, busy: true }).score < local.score - 30);

ok('gig fit: outside your skills is never strong', x.gigFit({ pay: 50_000, hours: 4, skill: 'DJ', date: '2027-03-01', km: null }, profile).score <= 35);

// Workload
const wl = x.workloadSummary([
  { date: '2027-01-04', start: '09:00', end: '17:00' },
  { date: '2027-01-05', start: '16:00', end: '23:30' },
  { date: '2027-01-06', start: '20:00', end: '01:00' },
  { date: '2027-01-08', start: '09:00', end: '12:00' },
]);
ok('workload: longest streak', wl.longestStreak === 3 && wl.longestStreakStart === '2027-01-04', JSON.stringify(wl));
ok('workload: late finishes include past midnight', wl.lateFinishes === 2);
ok('workload: one week, hours summed', wl.weeks.length === 1 && wl.weeks[0].days === 4 && wl.weeks[0].hours === 23.5, JSON.stringify(wl.weeks));
ok('workload: shift across midnight', x.shiftHours('20:00', '01:00') === 5);

// Reconciliation
const project = {
  id: 'p1',
  code: 'WP-1',
  milestones: [
    { id: 'm1', label: 'Advance', amount: 30_000, paidAmount: 30_000, due: '2026-01-01', status: 'PAID', quoteId: 'q1' },
    { id: 'm2', label: 'Balance', amount: 69_000, paidAmount: 0, due: '2026-02-01', status: 'UPCOMING', quoteId: 'q1' },
  ],
  bookings: [{ id: 'b1', status: 'CONFIRMED', providerName: 'Studio', agreedPrice: 100_000, providerPayable: 90_000, platformFee: 9_000 }],
};
const quotes = [{ id: 'q1', number: 'QT-1', projectId: 'p1', status: 'accepted', acceptedVersion: 1, versions: [{ version: 1, total: 100_000 }] }];
const payables = [{ bookingId: 'b1', payeeKind: 'provider', status: 'ACCRUED', amount: 36_000 }, { bookingId: 'b1', payeeKind: 'provider', status: 'ACCRUED', amount: 54_000 }];
const payments = [{ id: 'pay1', projectId: 'p1', milestoneId: 'm1', amount: 30_000, refunded: 0, status: 'SUCCEEDED', receiptNo: 'R1' }];
const refunds = [{ paymentId: 'pay1', amount: 40_000, status: 'APPROVED' }];
const issues = x.reconcileProject(project, { quotes, payments, payables, refunds });
const kinds = issues.map((i) => i.kind).sort().join();
ok('reconcile: finds milestone, split and refund issues', kinds === 'booking_split,milestones,refund', kinds);
ok('reconcile: payouts that match are not flagged', !issues.some((i) => i.kind === 'payables'));
ok('reconcile: diffs are positive', issues.every((i) => i.diff > 0));

// Rate simulator
const sim = x.simulateRates(
  [
    { pricingModel: 'COMMISSION', agreedPrice: 100_000, providerCost: 100_000, platformFee: 10_000 },
    { pricingModel: 'MARKUP', agreedPrice: 80_500, providerCost: 70_000, platformFee: 10_500 },
  ],
  { commissionRate: 0.12, markupRate: 0.15, leadFee: 2_000 },
);
ok('rates: commission raises the fee and cuts the payout', sim.rows.find((r) => r.model === 'COMMISSION').proposed === 12_000 && sim.rows.find((r) => r.model === 'COMMISSION').provider === -2_000);
ok('rates: unchanged markup stays the same', sim.rows.find((r) => r.model === 'MARKUP').proposed === 10_500 && sim.rows.find((r) => r.model === 'MARKUP').customer === 0);
ok('rates: delta', sim.delta === 2_000, String(sim.delta));

// Satisfaction and listing quality
const sat = x.satisfaction([{ overall: 5 }, { overall: 5 }, { overall: 4 }, { overall: 2 }]);
ok('satisfaction: net score', sat.nps === 25 && sat.stars.join() === '0,1,0,1,2' && sat.average === 4, JSON.stringify(sat));
const lq = x.listingQuality({ verified: true, hasPhoto: true, styles: 1, reviewCount: 10, rating: 4.8, responseMinutes: 30, priceListed: true, languages: 2, packages: 1, portfolio: 3 });
ok('listing: complete profile scores 100', lq.score === 100 && lq.missing.length === 0);
ok('listing: missing items heaviest first', x.listingQuality({ verified: false, hasPhoto: true, styles: 0, reviewCount: 0, rating: 0, responseMinutes: 999, priceListed: true, languages: 0, packages: 0, portfolio: 0 }).missing[0] === 'Verified');

const failed = results.filter((t) => !t.pass);
for (const t of results) console.log(`${t.pass ? 'ok  ' : 'FAIL'} ${t.name}${t.detail && !t.pass ? `  (${t.detail})` : ''}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
