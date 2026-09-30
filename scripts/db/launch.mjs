/**
 * Launch checks (P8) on a real Postgres with RLS on (PGlite, in-process): the
 * public health check, consent records, data export and account deletion,
 * including the cases where deletion must wait (confirmed celebrations,
 * bookings, the last super admin) and the records that must survive it.
 *
 *   npm run db:test   (runs this after payments.mjs)
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
  couple: '30000000-0000-4000-8000-000000000001',
  vendor: '30000000-0000-4000-8000-000000000002',
  admin: '30000000-0000-4000-8000-000000000006',
  anon: '30000000-0000-4000-8000-000000000009',
};
const PROJECT = '31000000-0000-4000-8000-000000000001';

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

await db.exec(`
insert into cities (id, name, province, grp) values ('kathmandu', 'Kathmandu', 'Bagmati', 'VALLEY') on conflict do nothing;
insert into auth.users (id, email) values ('${U.couple}', 'couple@example.com'), ('${U.vendor}', 'vendor@example.com'), ('${U.admin}', 'bikram@vivah.com.np');
insert into profiles (id, full_name) values ('${U.admin}', 'Bikram Adhikari');
insert into user_roles (user_id, role) values ('${U.admin}', 'SUPER_ADMIN');
`);

// ─── Health ────────────────────────────────────────────────────────────────────
const health = await as(U.anon, `select rpc_health() as h`, [], 'anon');
ok('anyone can call the health check', !refused(health) && health[0]?.h?.ok === true, health.error);

// ─── Sign-up and consent ───────────────────────────────────────────────────────
const couple = await as(U.couple, `select rpc_complete_signup('customer', $1::jsonb) as me`, [JSON.stringify({ name: 'Aakriti Shrestha', phone: '9800000001', city: 'Kathmandu', partnerName: 'Sujan' })]);
ok('a couple signs up', !refused(couple), couple.error);
const vendor = await as(U.vendor, `select rpc_complete_signup('vendor', $1::jsonb) as me`, [JSON.stringify({ name: 'Sunita Maharjan', businessName: 'Phoolbari Decor', primaryService: 'decoration', services: ['decoration'] })]);
ok('a vendor signs up', !refused(vendor), vendor.error);

ok('a new user has accepted nothing yet', (await as(U.couple, `select rpc_me() as me`))[0]?.me?.legal === null);
ok('the couple accepts the terms and privacy policy', !refused(await as(U.couple, `select rpc_accept_legal('2026-10-01')`)));
ok('accepting twice keeps one record per document', (await one(`select count(*)::int as n from legal_acceptances where user_id = $1`, [U.couple])).n === 2 && !refused(await as(U.couple, `select rpc_accept_legal('2026-10-01')`)) && (await one(`select count(*)::int as n from legal_acceptances where user_id = $1`, [U.couple])).n === 2);
ok('rpc_me reports the accepted version', (await as(U.couple, `select rpc_me() as me`))[0]?.me?.legal === '2026-10-01');
ok('an unknown version is refused', refused(await as(U.couple, `select rpc_accept_legal('latest')`)));
ok('consent rows cannot be written directly', refused(await as(U.couple, `insert into legal_acceptances (user_id, document, version) values ($1, 'terms', '2099-01-01')`, [U.couple])));
ok('consent rows are private', (await as(U.vendor, `select * from legal_acceptances`)).length === 0);
ok('signed-out callers cannot accept', refused(await as(U.anon, `select rpc_accept_legal('2026-10-01')`, [], 'anon')));

// ─── A confirmed celebration with a booking and a payment ─────────────────────
const provider = await one(`select p.id from providers p join organization_members m on m.org_id = p.org_id where m.user_id = $1`, [U.vendor]);
await db.exec(`
update providers set is_active = true where id = '${provider.id}';
insert into wedding_projects (id, title, customer_id, status) values ('${PROJECT}', 'Aakriti weds Sujan', '${U.couple}', 'CONFIRMED');
insert into service_bookings (id, project_id, provider_id, agreed_price, provider_cost, platform_fee, provider_payable, status)
values ('31000000-0000-4000-8000-0000000000b1', '${PROJECT}', '${provider.id}', 10000000, 9000000, 1000000, 9000000, 'CONFIRMED');
insert into payments (project_id, payer_id, amount, method, status, receipt_no, paid_at) values ('${PROJECT}', '${U.couple}', 3000000, 'KHALTI', 'SUCCEEDED', 'RC-LAUNCH-1', now());
insert into push_tokens (token, user_id, platform) values ('ExponentPushToken[couple]', '${U.couple}', 'android');
`);
await db.query(`insert into notifications (user_id, kind, title) values ($1, 'system', 'Welcome')`, [U.couple]);

// ─── Export ────────────────────────────────────────────────────────────────────
const exported = await as(U.couple, `select rpc_export_my_data() as d`);
const data = exported[0]?.d;
ok('the couple downloads their data', !refused(exported) && data?.profile?.email === 'couple@example.com' && data?.projects?.length === 1 && data?.projects?.[0]?.payments?.length === 1, exported.error);
ok('the export includes consent and devices', data?.legal?.length === 2 && Number(data?.devices) === 1);
ok('gateway responses stay out of the export', data?.projects?.[0]?.payments?.[0] && !('raw_response' in data.projects[0].payments[0]));
const vendorData = (await as(U.vendor, `select rpc_export_my_data() as d`))[0]?.d;
ok('the vendor’s export holds their business, not the couple’s plan', vendorData?.business?.[0]?.name === 'Phoolbari Decor' && vendorData?.projects?.length === 0);
ok('signed-out callers cannot export', refused(await as(U.anon, `select rpc_export_my_data()`, [], 'anon')));

// ─── Deletion waits for open commitments ───────────────────────────────────────
ok('deletion needs the word DELETE', refused(await as(U.couple, `select rpc_delete_my_account('yes')`)));
const coupleBlocked = await as(U.couple, `select rpc_delete_my_account('DELETE')`);
ok('a couple with a confirmed celebration must wait', refused(coupleBlocked) && /confirmed/.test(coupleBlocked.error), coupleBlocked.error);
const vendorBlocked = await as(U.vendor, `select rpc_delete_my_account('DELETE')`);
ok('a vendor with confirmed bookings must wait', refused(vendorBlocked) && /bookings/.test(vendorBlocked.error), vendorBlocked.error);
const adminBlocked = await as(U.admin, `select rpc_delete_my_account('DELETE')`);
ok('the only super admin must wait', refused(adminBlocked) && /super admin/.test(adminBlocked.error), adminBlocked.error);
ok('clients cannot call the blocker check', refused(await as(U.couple, `select vivah_deletion_blocker($1)`, [U.couple])));

// ─── The celebration is completed; deletion goes through ──────────────────────
await db.exec(`
update wedding_projects set status = 'COMPLETED' where id = '${PROJECT}';
update service_bookings set status = 'COMPLETED' where project_id = '${PROJECT}';
`);
const deleted = await as(U.couple, `select rpc_delete_my_account('delete') as r`);
ok('the couple closes their account', !refused(deleted) && deleted[0]?.r?.deleted === true && deleted[0]?.r?.files === U.couple, deleted.error);
const profile = await one(`select full_name, phone, email, deleted_at from profiles where id = $1`, [U.couple]);
ok('their profile no longer names them', profile.full_name === 'Deleted user' && profile.phone === null && profile.email === null && profile.deleted_at !== null);
ok('their partner’s name is removed', (await one(`select partner_name from customers where id = $1`, [U.couple])).partner_name === null);
ok('devices, notifications and roles are gone', (await one(`select (select count(*) from push_tokens where user_id = $1) + (select count(*) from notifications where user_id = $1) + (select count(*) from user_roles where user_id = $1) as n`, [U.couple])).n === 0);
ok('the project and payment records stay for the accounts', (await one(`select count(*)::int as n from payments where project_id = $1`, [PROJECT])).n === 1 && (await one(`select count(*)::int as n from wedding_projects where id = $1`, [PROJECT])).n === 1);
ok('the closure is in the audit log', (await one(`select count(*)::int as n from audit_logs where action = 'account.delete' and entity_id = $1`, [U.couple])).n === 1);
ok('a closed account is not signed up any more', (await as(U.couple, `select rpc_me() as me`))[0]?.me?.signedUp === false);
ok('a closed account cannot export', refused(await as(U.couple, `select rpc_export_my_data()`)));
const againDeleted = await as(U.couple, `select rpc_delete_my_account('DELETE') as r`);
ok('closing it again is harmless', !refused(againDeleted) && againDeleted[0]?.r?.deleted === true);

const vendorDeleted = await as(U.vendor, `select rpc_delete_my_account('DELETE') as r`);
ok('the vendor closes their account once the booking is done', !refused(vendorDeleted), vendorDeleted.error);
ok('their listing goes offline', (await one(`select is_active from providers where id = $1`, [provider.id])).is_active === false);
ok('the booking record stays', (await one(`select count(*)::int as n from service_bookings where provider_id = $1`, [provider.id])).n === 1);

await db.close();
reported = true;
const failed = results.filter((r) => !r.pass);
results.forEach((r) => console.log(`${r.pass ? 'pass' : 'FAIL'}  ${r.name}${!r.pass && r.detail ? `  (${r.detail})` : ''}`));
console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);
if (failed.length) process.exit(1);
