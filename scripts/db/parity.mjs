/**
 * Parity between the app's money rules (src/services, whole rupees) and the
 * SQL that will run them on the server (0011, paisa): quote totals, booking
 * splits, milestone amounts, payables and freelancer pay. Both sides get the
 * same cases, hand-picked edge cases from scripts/parity-fixtures.json plus a
 * few hundred generated ones, and every result must match to the rupee.
 *
 *   npm run test:parity
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { importApp } from '../ts-loader.mjs';
import { freshDb } from './harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(readFileSync(path.join(here, '..', 'parity-fixtures.json'), 'utf8'));
const { quoteTotals } = await importApp('@/services/quotes');
const { splitBooking, freelancerNet, buildMilestones, payablesForBooking } = await importApp('@/services/pricing');

// Deterministic generator so a failure reproduces.
let seed = 20260930;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = (xs) => xs[Math.floor(rand() * xs.length)];
const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

const GENERATED = 250;
const quotes = [...fixtures.quotes];
const splits = [...fixtures.splits];
const milestones = [...fixtures.milestones];
const payables = [...fixtures.payables];
const freelancers = [...fixtures.freelancers];
for (let n = 0; n < GENERATED; n++) {
  quotes.push({
    items: Array.from({ length: int(1, 6) }, () => ({ qty: pick([1, 2, 3, 1.5, 450, 1250, 0.5, 12.25]), rate: pick([int(1, 999) * 5, int(100, 400000), 1_040, 1_199, 333]) })),
    discount: pick([0, 0, int(0, 90000), 10_000_000]),
    serviceFee: pick([0, 25_000, int(0, 50000), -5]),
    taxRate: pick([0.13, 0.13, 0.13, 0]),
  });
  splits.push({ model: pick(['COMMISSION', 'MARKUP', 'LEAD_FEE', 'FREELANCER_MARGIN']), rate: 0, price: int(500, 2_000_000) });
  const s = splits[splits.length - 1];
  s.rate = s.model === 'LEAD_FEE' ? pick([2000, 500, 5000]) : pick([0.1, 0.12, 0.15, 0.2, 0.175, 0.125]);
  milestones.push({ total: int(1, 9_000_000), percents: pick([[30, 50, 20], [50, 50], [25, 25, 40, 10], [100], [33, 33, 34]]) });
  payables.push({ providerPayable: int(1, 3_000_000) });
  freelancers.push({ clientPay: int(500, 60000), margin: pick([0.2, 0.15, 0.25]) });
}

const db = await freshDb();
const failures = [];
const q1 = async (sql, params) => (await db.query(sql, params)).rows[0];
const P = (rupees) => Math.round(rupees * 100);
const R = (paisa) => Number(paisa) / 100;
const same = (kind, input, ts, sql) => {
  const a = JSON.stringify(ts);
  const b = JSON.stringify(sql);
  if (a !== b) failures.push({ kind, input, ts, sql });
};

for (const c of quotes) {
  const ts = quoteTotals({ items: c.items.map((i) => ({ qty: i.qty, rate: i.rate })), discount: c.discount, serviceFee: c.serviceFee, taxRate: c.taxRate });
  const row = await q1(`select vivah_quote_math($1::jsonb, $2, $3, $4) as t`, [JSON.stringify(c.items.map((i) => ({ qty: i.qty, rate: P(i.rate) }))), P(c.discount), P(c.serviceFee), c.taxRate]);
  const t = row.t;
  same('quote', c, [ts.subtotal, ts.discount, ts.serviceFee, ts.taxable, ts.tax, ts.total], [R(t.subtotal), R(t.discount), R(t.serviceFee), R(t.taxable), R(t.tax), R(t.total)]);
}
for (const c of splits) {
  const ts = splitBooking(c.model, c.rate, c.model === 'MARKUP' ? { providerCost: c.price } : { customerPrice: c.price });
  const row = await q1(`select * from vivah_split_booking($1::pricing_model, $2, $3, $4)`, [c.model, c.rate, c.model === 'MARKUP' ? null : P(c.price), c.model === 'MARKUP' ? P(c.price) : null]);
  same('split', c, [ts.agreedPrice, ts.providerCost, ts.platformFee, ts.providerPayable], [R(row.agreed_price), R(row.provider_cost), R(row.platform_fee), R(row.provider_payable)]);
  if (ts.agreedPrice !== ts.providerPayable + ts.platformFee) failures.push({ kind: 'split invariant', input: c, ts });
}
for (const c of milestones) {
  const steps = c.percents.map((percent, i) => ({ label: `Step ${i + 1}`, percent, rule: 'on_confirmation' }));
  const ts = buildMilestones(steps, c.total, { confirmed: '2030-01-01', event: '2030-06-01' }).map((m) => m.amount);
  const row = await q1(`select vivah_milestone_amounts($1, $2::numeric[]) as a`, [P(c.total), c.percents]);
  same('milestones', c, ts, row.a.map(R));
  if (ts.reduce((s, x) => s + x, 0) !== c.total) failures.push({ kind: 'milestone invariant', input: c, ts });
}
for (const c of payables) {
  const ts = payablesForBooking({ id: 'b', providerId: 'p', providerName: 'Provider', eventIds: [], providerPayable: c.providerPayable }, { id: 'prj', events: [], weddingDate: '2030-06-01' }).map((x) => x.amount);
  const row = await q1(`select vivah_payable_split($1) as a`, [P(c.providerPayable)]);
  same('payables', c, ts, row.a.map(R));
}
for (const c of freelancers) {
  const ts = freelancerNet(c.clientPay, c.margin);
  const row = await q1(`select vivah_freelancer_net($1, $2) as a`, [P(c.clientPay), c.margin]);
  same('freelancer', c, [ts.pay, ts.margin], row.a.map(R));
}
await db.close();

const total = quotes.length + splits.length + milestones.length + payables.length + freelancers.length;
if (failures.length) {
  failures.slice(0, 12).forEach((f) => console.error(`FAIL ${f.kind}: ${JSON.stringify(f.input)}\n  app ${JSON.stringify(f.ts)}\n  sql ${JSON.stringify(f.sql)}`));
  console.error(`\n${failures.length} of ${total} cases differ between the app and SQL.`);
  process.exit(1);
}
console.log(`Parity: ${total} cases match between src/services and SQL (quotes ${quotes.length}, splits ${splits.length}, milestones ${milestones.length}, payables ${payables.length}, freelancer pay ${freelancers.length}).`);
