/**
 * The core loop (AGENTS.md §5) on a real Postgres with RLS on: the migrations
 * are applied to a throwaway in-process database (PGlite), a small cast signs
 * in one after another, and every step goes through the RPCs or through the
 * tables as that user would. Each invariant and each fixed defect from
 * AGENTS.md §10 has a check.
 *
 *   npm run db:test
 */
import { asUser, freshDb } from './harness.mjs';

const results = [];
const ok = (name, pass, detail = '') => results.push({ name, pass: !!pass, detail });
const rupees = (paisa) => Number(paisa) / 100;

const ID = {
  customer: '00000000-0000-4000-8000-000000000001',
  sita: '00000000-0000-4000-8000-000000000004',
  hari: '00000000-0000-4000-8000-000000000014',
  nisha: '00000000-0000-4000-8000-000000000010',
  rajesh: '00000000-0000-4000-8000-000000000002',
  viewer: '00000000-0000-4000-8000-000000000021',
};

const db = await freshDb();

/** Runs SQL as a user; resolves to rows, or to { error } when Postgres refuses. */
async function as(user, sql, params = [], role = 'authenticated') {
  return asUser(db, user, async () => {
    try {
      return (await db.query(sql, params)).rows;
    } catch (e) {
      return { error: e.message };
    }
  }, role);
}
let reported = false;
process.on('exit', () => {
  if (reported) return;
  results.forEach((r) => console.log(`${r.pass ? 'pass' : 'FAIL'}  ${r.name}${!r.pass && r.detail ? `  (${r.detail})` : ''}`));
  console.log('\nStopped early: a step above failed and later steps depend on it.');
});
const refused = (r) => r && !Array.isArray(r) && typeof r.error === 'string';
const one = async (sql, params) => (await db.query(sql, params)).rows[0];

// ─── Cast and catalogue (as the database owner) ──────────────────────────────
await db.exec(`
insert into cities (id, name, province, grp) values ('kathmandu', 'Kathmandu', 'Bagmati', 'VALLEY') on conflict do nothing;
insert into service_categories (id, name) values ('venue', 'Venue') on conflict do nothing;
insert into auth.users (id, email) values
  ('${ID.customer}', 'aakriti@example.com'), ('${ID.sita}', 'sita@vivah.com.np'), ('${ID.hari}', 'hari@vivah.com.np'),
  ('${ID.nisha}', 'nisha@vivah.com.np'), ('${ID.rajesh}', 'events@everestgrand.com.np'), ('${ID.viewer}', 'mama@example.com');
insert into profiles (id, full_name, phone) values
  ('${ID.customer}', 'Aakriti Shrestha', '9800000001'), ('${ID.sita}', 'Sita Karki', '9800000004'), ('${ID.hari}', 'Hari Thapa', '9800000044'),
  ('${ID.nisha}', 'Nisha Rai', '9800000010'), ('${ID.rajesh}', 'Rajesh Pradhan', '9800000002'), ('${ID.viewer}', 'Hari mama', '9800000021');
insert into user_roles (user_id, role, granted_at) values
  ('${ID.customer}', 'CUSTOMER', now()), ('${ID.sita}', 'WEDDING_COORDINATOR', now() - interval '2 years'),
  ('${ID.hari}', 'WEDDING_COORDINATOR', now()), ('${ID.nisha}', 'FINANCE', now()), ('${ID.rajesh}', 'SERVICE_PROVIDER', now()),
  ('${ID.viewer}', 'CUSTOMER', now());
insert into customers (id, partner_name) values ('${ID.customer}', 'Sujan'), ('${ID.viewer}', null);
insert into organizations (id, kind, name) values
  ('00000000-0000-4000-8000-00000000a001', 'PLATFORM', 'Vivah Weddings'), ('00000000-0000-4000-8000-00000000a002', 'PROVIDER', 'Everest Grand Party Palace');
insert into organization_members (org_id, user_id, member_role) values ('00000000-0000-4000-8000-00000000a002', '${ID.rajesh}', 'OWNER');
insert into providers (id, org_id, slug, kind, primary_category_id, city_id) values
  ('00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000a002', 'everest-grand', 'VENUE', 'venue', 'kathmandu');
`);

// ─── 1. Couple submits a plan ─────────────────────────────────────────────────
const plan = await as(ID.customer, `select rpc_submit_plan($1::jsonb) as id`, [
  JSON.stringify({ title: 'Aakriti & Sujan', eventTypes: ['WEDDING'], dates: { WEDDING: '2030-02-14' }, city: 'Kathmandu', guests: 450, services: ['venue'], budgetMode: 'overall', budgetTotal: 3500000, occasion: 'wedding' }),
]);
ok('couple submits a plan (rpc_submit_plan)', !refused(plan), plan.error);
const pid = plan[0]?.id;
const project = await one(`select status, coordinator_id from wedding_projects where id = $1`, [pid]);
ok('a coordinator is auto-assigned and the lead is REVIEWING', project?.coordinator_id === ID.sita && project?.status === 'REVIEWING', JSON.stringify(project));
const history = await one(`select count(*)::int as n from project_status_history where project_id = $1`, [pid]);
ok('status history is written under RLS (log_project_status is security definer)', history.n >= 1);

// ─── 2. The couple only edits plan details ───────────────────────────────────
ok('couple edits their notes', !refused(await as(ID.customer, `update wedding_projects set customer_notes = 'Garden if possible' where id = $1`, [pid])));
ok('couple cannot set their own status (defect fixed)', refused(await as(ID.customer, `update wedding_projects set status = 'CONFIRMED' where id = $1`, [pid])));
ok('couple cannot reassign the coordinator (defect fixed)', refused(await as(ID.customer, `update wedding_projects set coordinator_id = $2 where id = $1`, [pid, ID.hari])));

// ─── 3. Only the owning coordinator manages the project ─────────────────────
ok('another coordinator cannot change the status', refused(await as(ID.hari, `select rpc_set_project_status($1, 'MATCHING_PROVIDERS', null)`, [pid])));
ok('the owning coordinator can', !refused(await as(ID.sita, `select rpc_set_project_status($1, 'MATCHING_PROVIDERS', 'Shortlisting venues')`, [pid])));
ok('finance cannot manage projects', refused(await as(ID.nisha, `select rpc_set_project_status($1, 'QUOTE_PREPARED', null)`, [pid])));

// ─── 4. Booking with the commission split ─────────────────────────────────────
const split = await one(`select * from vivah_split_booking('COMMISSION', 0.10, 10000000, null)`);
ok('commission split: customer 100,000 → provider 90,000', rupees(split.provider_payable) === 90000 && rupees(split.platform_fee) === 10000);
const req = await one(`select id from project_requirements where project_id = $1`, [pid]);
const ev = await one(`select id from project_events where project_id = $1`, [pid]);
const booking = await as(ID.sita, `
  insert into service_bookings (project_id, requirement_id, provider_id, agreed_price, provider_cost, platform_fee, provider_payable, pricing_model, commission_rate, status)
  values ($1, $2, '00000000-0000-4000-8000-00000000b001', $3, $3, $4, $5, 'COMMISSION', 0.10, 'PROPOSED') returning id`, [pid, req.id, split.agreed_price, split.platform_fee, split.provider_payable]);
ok('coordinator proposes a booking', !refused(booking), booking.error);
const bid = booking[0]?.id;
await db.query(`insert into booking_events (booking_id, event_id) values ($1, $2)`, [bid, ev.id]);

// ─── 5. Quotation: server-side totals, then frozen ───────────────────────────
const quote = await as(ID.sita, `insert into quotes (project_id, customer_id, issuer_kind, issuer_org_id, title) values ($1, $2, 'PLATFORM', '00000000-0000-4000-8000-00000000a001', 'Your wedding') returning id`, [pid, ID.customer]);
const qid = quote[0]?.id;
const version = await as(ID.sita, `insert into quote_versions (quote_id, version, service_fee, package_discount) values ($1, 1, 2500000, 0) returning id`, [qid]);
const items = await as(ID.sita, `
  insert into quote_items (quote_version_id, requirement_id, provider_id, title, qty, unit_price, provider_cost, pricing_model, commission_rate)
  values ($1, $2, '00000000-0000-4000-8000-00000000b001', 'Everest Grand — Wedding', 1, 10000000, 10000000, 'COMMISSION', 0.10) returning id`, [version[0]?.id, req.id]);
ok('coordinator drafts a quotation', !refused(quote) && !refused(version) && !refused(items), quote.error ?? version.error ?? items.error);
ok('another coordinator cannot send it', refused(await as(ID.hari, `select rpc_send_quote($1, null)`, [qid])));
const sent = await as(ID.sita, `select rpc_send_quote($1, 'First version') as totals`, [qid]);
ok('owning coordinator sends it', !refused(sent), sent.error);
const totals = sent[0]?.totals ?? {};
ok('quote maths: 100,000 + 25,000 fee → tax 16,250, total 141,250', rupees(totals.total) === 141250 && rupees(totals.tax) === 16250, JSON.stringify(totals));
ok('sent version cannot be edited (freeze: notes)', refused(await as(ID.sita, `update quote_versions set notes = 'changed' where quote_id = $1`, [qid])));
ok('sent version cannot be un-sent (defect fixed)', refused(await as(ID.sita, `update quote_versions set sent_at = null where quote_id = $1`, [qid])));
ok('sent version VAT cannot change (defect fixed)', refused(await as(ID.sita, `update quote_versions set vat_rate = 0 where quote_id = $1`, [qid])));
ok('sent version cannot be deleted (defect fixed)', refused(await as(ID.sita, `delete from quote_versions where quote_id = $1`, [qid])));
ok('sent quotation cannot go back to draft without a new version (defect fixed)', refused(await as(ID.sita, `update quotes set status = 'DRAFT' where id = $1`, [qid])));
ok('couple cannot edit the quotation directly (defect fixed)', (await as(ID.customer, `update quotes set status = 'ACCEPTED' where id = $1 returning id`, [qid])).length === 0);

// ─── 6. Couple accepts: order, milestones, booking confirmed ─────────────────
const accept = await as(ID.customer, `select rpc_respond_to_quote($1, 'accept', 'Looks good') as r`, [qid]);
ok('couple accepts the quotation', !refused(accept), accept.error);
const ms = await db.query(`select amount from payment_milestones where project_id = $1 order by sort`, [pid]);
const msSum = ms.rows.reduce((s, r) => s + Number(r.amount), 0);
ok('milestones are 30/50/20 and sum exactly to the total', ms.rows.length === 3 && msSum === Number(totals.total) && rupees(ms.rows[0].amount) === 42375, ms.rows.map((r) => rupees(r.amount)).join(' + '));
const b = await one(`select status from service_bookings where id = $1`, [bid]);
ok('the booking is CONFIRMED', b.status === 'CONFIRMED');
await as(ID.sita, `select rpc_confirm_booking($1)`, [bid]);
const pay = await db.query(`select amount from provider_payables where booking_id = $1 order by due_date`, [bid]);
ok('exactly two payables (40/60), summing to the provider payable, even after confirming twice', pay.rows.length === 2 && pay.rows.reduce((s, r) => s + Number(r.amount), 0) === Number(split.provider_payable) && rupees(pay.rows[0].amount) === 36000);
const rev = await one(`select count(*)::int as n, sum(amount) as total from platform_revenue where booking_id = $1`, [bid]);
ok('exactly one revenue entry for the platform fee', rev.n === 1 && Number(rev.total) === Number(split.platform_fee));
const cal = await one(`select count(*)::int as n from availability where ref_id = $1 and status = 'BOOKED'`, [bid]);
ok('the provider calendar is blocked (block_calendar_for_booking under RLS)', cal.n === 1);
const proj = await one(`select status from wedding_projects where id = $1`, [pid]);
ok('the project is CONFIRMED', proj.status === 'CONFIRMED');

// ─── 7. Payments: never faked by the couple, never above what is owed ──────
const m1 = (await db.query(`select id, amount from payment_milestones where project_id = $1 order by sort limit 1`, [pid])).rows[0];
ok('couple cannot insert a payment row', refused(await as(ID.customer, `insert into payments (project_id, milestone_id, amount, method, status) values ($1, $2, 100, 'ESEWA', 'SUCCEEDED')`, [pid, m1.id])));
ok('couple cannot record a gateway payment without the gateway', refused(await as(ID.customer, `select rpc_record_payment($1, $2, 'ESEWA', 'fake-ref')`, [m1.id, m1.amount])));
ok('coordinator cannot record cash', refused(await as(ID.sita, `select rpc_record_payment($1, $2, 'CASH', null)`, [m1.id, m1.amount])));
ok('finance cannot overpay a milestone', refused(await as(ID.nisha, `select rpc_record_payment($1, $2, 'CASH', null)`, [m1.id, Number(m1.amount) + 100])));
const paid = await as(ID.nisha, `select rpc_record_payment($1, $2, 'CASH', null) as id`, [m1.id, m1.amount]);
ok('finance records the cash payment', !refused(paid), paid.error);
const m2 = (await db.query(`select id from payment_milestones where project_id = $1 order by sort offset 1 limit 1`, [pid])).rows[0].id;
const gw1 = await as(ID.customer, `select rpc_record_payment($1, 100000, 'KHALTI', 'pidx-1') as id`, [m2], 'service_role');
const gw2 = await as(ID.customer, `select rpc_record_payment($1, 100000, 'KHALTI', 'pidx-1') as id`, [m2], 'service_role');
ok('a verified gateway callback is idempotent on its reference', !refused(gw1) && gw1[0]?.id === gw2[0]?.id, gw1.error ?? gw2.error);

// ─── 8. Payouts: finance only; paid ones never twice ─────────────────────────
const p1 = pay.rows.length ? (await db.query(`select id from provider_payables where booking_id = $1 order by due_date limit 1`, [bid])).rows[0].id : null;
ok('coordinator cannot release a payout', refused(await as(ID.sita, `select rpc_release_payable('provider', $1, null)`, [p1])));
ok('finance releases it', !refused(await as(ID.nisha, `select rpc_release_payable('provider', $1, 'NIBL-1')`, [p1])));
ok('a paid payout cannot be released again', refused(await as(ID.nisha, `select rpc_release_payable('provider', $1, 'NIBL-2')`, [p1])));

// ─── 9. Refunds: capped at the payment (defect fixed) ────────────────────────
const pmt = paid[0]?.id;
ok('a refund above the payment is refused', refused(await as(ID.customer, `select rpc_request_refund($1, $2, 'Too much')`, [pmt, Number(m1.amount) + 100])));
const r1 = await as(ID.customer, `select rpc_request_refund($1, $2, 'Guest count dropped') as id`, [pmt, 1000000]);
ok('couple requests a partial refund', !refused(r1), r1.error);
ok('the same money cannot be requested twice (defect fixed)', refused(await as(ID.customer, `select rpc_request_refund($1, $2, 'Again')`, [pmt, Number(m1.amount) - 1000000 + 100])));
ok('coordinator cannot approve refunds', refused(await as(ID.sita, `select rpc_decide_refund($1, true)`, [r1[0]?.id])));
ok('finance approves it', !refused(await as(ID.nisha, `select rpc_decide_refund($1, true)`, [r1[0]?.id])));
const pst = await one(`select status from payments where id = $1`, [pmt]);
ok('the payment is PARTIALLY_REFUNDED', pst.status === 'PARTIALLY_REFUNDED');

// ─── 10. Collaborators: VIEWER reads, doesn't write (defect fixed) ──────────
await db.query(`insert into project_collaborators (project_id, user_id, name, permission, accepted_at) values ($1, $2, 'Hari mama', 'VIEWER', now())`, [pid, ID.viewer]);
ok('a viewer can read the guest list', !refused(await as(ID.viewer, `select id from guests where project_id = $1`, [pid])));
ok('a viewer cannot add a guest', refused(await as(ID.viewer, `insert into guests (project_id, name) values ($1, 'Ram')`, [pid])));
ok('the couple can add a guest', !refused(await as(ID.customer, `insert into guests (project_id, name) values ($1, 'Ram')`, [pid])));

// ─── 11. Cancelling reverses the platform fee ────────────────────────────────
ok('coordinator cancels the booking with a reason', !refused(await as(ID.sita, `select rpc_cancel_booking($1, 'Venue flooded')`, [bid])));
const net = await one(`select coalesce(sum(amount), 0) as net from platform_revenue where booking_id = $1`, [bid]);
ok('revenue for the cancelled booking nets to zero', Number(net.net) === 0);
const open = await one(`select count(*)::int as n from provider_payables where booking_id = $1 and status not in ('PAID', 'CANCELLED')`, [bid]);
ok('unpaid payables are cancelled, the paid one stays paid', open.n === 0);

// ─── 12. The API surface ─────────────────────────────────────────────────────
ok('signed-out callers cannot use the RPCs', refused(await as(ID.customer, `select rpc_submit_plan('{}'::jsonb)`, [], 'anon')));
ok('clients cannot forge notifications', refused(await as(ID.customer, `select vivah_notify($1, 'system', 'Hi', null, null)`, [ID.sita])));
ok('clients cannot forge audit entries', refused(await as(ID.customer, `select vivah_audit('x', 'y', null, null)`)));

await db.close();

reported = true;
const failed = results.filter((r) => !r.pass);
results.forEach((r) => console.log(`${r.pass ? 'pass' : 'FAIL'}  ${r.name}${!r.pass && r.detail ? `  (${r.detail})` : ''}`));
console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);
if (failed.length) process.exit(1);
