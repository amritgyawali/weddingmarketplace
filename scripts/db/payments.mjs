/**
 * Gateway payments (P7, 0014_payments.sql) on a real Postgres with RLS on:
 * the couple starts a payment, only the service role settles it, the amount
 * comes from the milestone, duplicate callbacks record one payment, and money
 * the milestone can no longer take is kept as REFUND_DUE for finance.
 *
 *   npm run db:test   (runs this after accounts.mjs)
 */
import { asUser, freshDb } from './harness.mjs';

const results = [];
const ok = (name, pass, detail = '') => results.push({ name, pass: !!pass, detail });
let reported = false;
process.on('exit', () => {
  if (reported) return;
  results.forEach((r) => console.log(`${r.pass ? 'pass' : 'FAIL'}  ${r.name}${!r.pass && r.detail ? `  (${r.detail})` : ''}`));
  console.log('\nStopped early: a step above failed and later steps depend on it.');
});

const U = {
  couple: '20000000-0000-4000-8000-000000000001',
  stranger: '20000000-0000-4000-8000-000000000002',
  finance: '20000000-0000-4000-8000-000000000003',
};
const P = '20000000-0000-4000-8000-00000000c001';
const O = '20000000-0000-4000-8000-00000000d001';
const M1 = '20000000-0000-4000-8000-00000000e001';
const M2 = '20000000-0000-4000-8000-00000000e002';
const M3 = '20000000-0000-4000-8000-00000000e003';

const db = await freshDb();
async function as(user, sql, params = [], role = 'authenticated') {
  return asUser(db, user, async () => {
    try {
      return (await db.query(sql, params)).rows;
    } catch (e) {
      return { error: e.message };
    }
  }, role);
}
const refused = (r) => r && !Array.isArray(r) && typeof r.error === 'string';
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const service = (sql, params) => as(U.couple, sql, params, 'service_role');

await db.exec(`
insert into auth.users (id, email) values ('${U.couple}', 'aakriti@example.com'), ('${U.stranger}', 'x@example.com'), ('${U.finance}', 'nisha@vivah.com.np');
insert into profiles (id, full_name, phone) values ('${U.couple}', 'Aakriti Shrestha', '9800000001'), ('${U.stranger}', 'Someone Else', '9800000002'), ('${U.finance}', 'Nisha Rai', '9800000010');
insert into user_roles (user_id, role, granted_at) values ('${U.couple}', 'CUSTOMER', now()), ('${U.stranger}', 'CUSTOMER', now()), ('${U.finance}', 'FINANCE', now());
insert into customers (id) values ('${U.couple}'), ('${U.stranger}');
insert into wedding_projects (id, title, customer_id, status) values ('${P}', 'Aakriti & Sujan', '${U.couple}', 'CONFIRMED');
insert into orders (id, project_id, total) values ('${O}', '${P}', 14125000);
insert into payment_milestones (id, order_id, project_id, label, percent, amount, due_rule, sort) values
  ('${M1}', '${O}', '${P}', 'Booking advance', 30, 4237500, 'ON_CONFIRMATION', 0),
  ('${M2}', '${O}', '${P}', 'Before the wedding', 50, 7062500, 'DAYS_BEFORE_EVENT', 1),
  ('${M3}', '${O}', '${P}', 'After the wedding', 20, 2825000, 'AFTER_COMPLETION', 2);
`);

// ─── Starting a payment ───────────────────────────────────────────────────────
ok('signed-out callers cannot start a payment', refused(await as(U.couple, `select rpc_begin_payment($1, 'KHALTI')`, [M1], 'anon')));
ok('someone else cannot pay this couple’s milestone', refused(await as(U.stranger, `select rpc_begin_payment($1, 'KHALTI')`, [M1])));
ok('cash cannot be started online', refused(await as(U.couple, `select rpc_begin_payment($1, 'CASH')`, [M1])));
ok('more than is owed is refused', refused(await as(U.couple, `select rpc_begin_payment($1, 'KHALTI', 4237600)`, [M1])));
ok('less than NPR 10 is refused', refused(await as(U.couple, `select rpc_begin_payment($1, 'KHALTI', 500)`, [M1])));
const b1 = await as(U.couple, `select rpc_begin_payment($1, 'KHALTI', null, 'vivah://pay/result') as r`, [M1]);
ok('the couple starts a Khalti payment', !refused(b1), b1.error);
const k = b1[0]?.r ?? {};
ok('the amount is the outstanding balance, worked out by the server', Number(k.amount) === 4237500, JSON.stringify(k));
ok('the order reference is safe for eSewa (letters, digits, hyphens)', /^[A-Za-z0-9-]+$/.test(k.orderRef ?? ''), k.orderRef);
ok('the customer’s details come back for the gateway', k.customer?.email === 'aakriti@example.com' && k.customer?.name === 'Aakriti Shrestha');
ok('the couple can read their own attempt', (await as(U.couple, `select id from payment_intents where id = $1`, [k.intent])).length === 1);
ok('others cannot read it', (await as(U.stranger, `select id from payment_intents where id = $1`, [k.intent])).length === 0);
ok('the couple cannot write attempts directly', refused(await as(U.couple, `update payment_intents set status = 'COMPLETED' where id = $1 returning id`, [k.intent])) || (await as(U.couple, `update payment_intents set status = 'COMPLETED' where id = $1 returning id`, [k.intent])).length === 0);

// ─── Only the payment service settles ────────────────────────────────────────
ok('the couple cannot attach a gateway reference', refused(await as(U.couple, `select rpc_payment_attach($1, 'pidx-x')`, [k.intent])));
ok('the couple cannot settle their own payment', refused(await as(U.couple, `select rpc_settle_payment($1, 'COMPLETED', $2)`, [k.intent, k.amount])));
ok('the couple cannot read the intent the way the service does', refused(await as(U.couple, `select vivah_payment_intent($1)`, [k.intent])));
ok('the service attaches Khalti’s pidx', !refused(await service(`select rpc_payment_attach($1, 'pidx-abc', '{"payment_url":"https://test-pay.khalti.com/?pidx=pidx-abc"}')`, [k.intent])));
const seen = (await service(`select vivah_payment_intent($1) as r`, [k.intent]))[0]?.r;
ok('the service reads the intent with its pidx and return address', seen?.gatewayRef === 'pidx-abc' && seen?.returnTo === 'vivah://pay/result');

const pending = (await service(`select rpc_settle_payment($1, 'PENDING', $2, 'pidx-abc') as r`, [k.intent, k.amount]))[0]?.r;
ok('a pending lookup records nothing', pending?.status === 'PENDING' && Number((await one(`select paid_amount from payment_milestones where id = $1`, [M1])).paid_amount) === 0);
const wrong = await service(`select rpc_settle_payment($1, 'SUCCESS', $2) as r`, [k.intent, k.amount]);
ok('unknown outcomes are refused', refused(wrong));

const s1 = (await service(`select rpc_settle_payment($1, 'COMPLETED', $2, 'pidx-abc', 'txn-1', '{"status":"Completed"}') as r`, [k.intent, k.amount]))[0]?.r;
ok('a completed lookup records the payment with a receipt', s1?.status === 'COMPLETED' && /^RCPT-\d{4}-\d{4}$/.test(s1?.receiptNo ?? ''), JSON.stringify(s1));
const s2 = (await service(`select rpc_settle_payment($1, 'COMPLETED', $2, 'pidx-abc', 'txn-1') as r`, [k.intent, k.amount]))[0]?.r;
ok('a duplicate callback returns the same payment and records nothing new', s2?.duplicate === true && s2?.paymentId === s1?.paymentId);
const late = (await service(`select rpc_settle_payment($1, 'FAILED', $2) as r`, [k.intent, k.amount]))[0]?.r;
ok('a late failure cannot undo a completed payment', late?.status === 'COMPLETED');
const count = await one(`select count(*)::int as n, sum(amount) as total from payments where milestone_id = $1`, [M1]);
ok('exactly one payment row for the milestone', count.n === 1 && Number(count.total) === 4237500);
const m1 = await one(`select status, paid_amount from payment_milestones where id = $1`, [M1]);
ok('the milestone is PAID', m1.status === 'PAID' && Number(m1.paid_amount) === 4237500);
const pay = await one(`select gateway_ref, raw_response, payer_id from payments where id = $1`, [s1.paymentId]);
ok('the payment keeps the pidx and the gateway’s answer', pay.gateway_ref === 'pidx-abc' && pay.raw_response?.status === 'Completed' && pay.payer_id === U.couple);
ok('the couple is notified of the payment', (await one(`select count(*)::int as n from notifications where user_id = $1 and kind = 'payment'`, [U.couple])).n >= 1);
ok('a paid milestone cannot be started again', refused(await as(U.couple, `select rpc_begin_payment($1, 'ESEWA')`, [M1])));

// ─── Status and receipts ────────────────────────────────────────────────────
const st = (await as(U.couple, `select rpc_payment_status($1) as r`, [k.intent]))[0]?.r;
ok('the couple polls the status and gets the receipt number', st?.status === 'COMPLETED' && st?.receiptNo === s1.receiptNo);
ok('others get nothing', (await as(U.stranger, `select rpc_payment_status($1) as r`, [k.intent]))[0]?.r == null);
const receipt = (await as(U.couple, `select rpc_payment_receipt($1) as r`, [s1.paymentId]))[0]?.r;
ok('the receipt has the milestone, project and payer', receipt?.milestone === 'Booking advance' && receipt?.payer === 'Aakriti Shrestha' && Number(receipt?.amount) === 4237500, JSON.stringify(receipt));
ok('others cannot fetch the receipt', refused(await as(U.stranger, `select rpc_payment_receipt($1)`, [s1.paymentId])));
ok('finance can', !refused(await as(U.finance, `select rpc_payment_receipt($1)`, [s1.paymentId])));

// ─── eSewa, a part payment, and a wrong amount ──────────────────────────────
const e1 = (await as(U.couple, `select rpc_begin_payment($1, 'ESEWA', 2000000) as r`, [M2]))[0]?.r;
ok('a part payment is allowed', Number(e1?.amount) === 2000000);
const bad = (await service(`select rpc_settle_payment($1, 'COMPLETED', 1000, 'ref-1') as r`, [e1.intent]))[0]?.r;
ok('a different amount from the gateway is never recorded; finance is told', bad?.status === 'REFUND_DUE' && Number((await one(`select paid_amount from payment_milestones where id = $1`, [M2])).paid_amount) === 0);
ok('finance hears about the refund', (await one(`select count(*)::int as n from notifications where user_id = $1 and title like 'Gateway payment%'`, [U.finance])).n === 1);

// ─── Two attempts, both paid: the second can’t overpay ───────────────────────
const a = (await as(U.couple, `select rpc_begin_payment($1, 'ESEWA') as r`, [M3]))[0]?.r;
const b = (await as(U.couple, `select rpc_begin_payment($1, 'KHALTI') as r`, [M3]))[0]?.r;
ok('starting again cancels the earlier attempt', (await one(`select status from payment_intents where id = $1`, [a.intent])).status === 'CANCELLED');
const sb = (await service(`select rpc_settle_payment($1, 'COMPLETED', $2, 'pidx-b') as r`, [b.intent, b.amount]))[0]?.r;
const sa = (await service(`select rpc_settle_payment($1, 'COMPLETED', $2, 'esewa-a') as r`, [a.intent, a.amount]))[0]?.r;
ok('a cancelled attempt that was paid after all is still settled', sb?.status === 'COMPLETED' && sa?.status === 'REFUND_DUE', `${sb?.status} / ${sa?.status}`);
const m3 = await one(`select status, paid_amount, amount from payment_milestones where id = $1`, [M3]);
ok('the milestone is never overpaid', Number(m3.paid_amount) === Number(m3.amount) && m3.status === 'PAID');
const order = await one(`select status from orders where id = $1`, [O]);
ok('the order stays open while a milestone is unpaid', order.status === 'OPEN');

// ─── Jobs ────────────────────────────────────────────────────────────────────
const c = (await as(U.couple, `select rpc_begin_payment($1, 'KHALTI', 1000000) as r`, [M2]))[0]?.r;
await db.query(`update payment_intents set created_at = now() - interval '2 days' where id = $1`, [c.intent]);
const expired = await one(`select job_payment_intents() as n`);
ok('the job expires abandoned attempts', expired.n === 1 && (await one(`select status from payment_intents where id = $1`, [c.intent])).status === 'EXPIRED');
const cs = (await service(`select rpc_settle_payment($1, 'COMPLETED', $2, 'pidx-c') as r`, [c.intent, c.amount]))[0]?.r;
ok('a late gateway confirmation still records an expired attempt', cs?.status === 'COMPLETED');
ok('clients cannot run the job', refused(await as(U.couple, `select job_payment_intents()`)));

await db.close();

reported = true;
const failed = results.filter((r) => !r.pass);
results.forEach((r) => console.log(`${r.pass ? 'pass' : 'FAIL'}  ${r.name}${!r.pass && r.detail ? `  (${r.detail})` : ''}`));
console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);
if (failed.length) process.exit(1);
