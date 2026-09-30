/**
 * Accounts, media, documents, notifications and jobs (P6) on a real Postgres
 * with RLS on (PGlite, in-process): sign-up for every role, the staff
 * approval gate, the access-token hook, media registration, the private
 * documents bucket, push tokens and preferences, and the scheduled jobs.
 *
 *   npm run db:test   (runs this after core-loop.mjs)
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
  couple: '10000000-0000-4000-8000-000000000001',
  vendor: '10000000-0000-4000-8000-000000000002',
  crew: '10000000-0000-4000-8000-000000000003',
  staff: '10000000-0000-4000-8000-000000000004',
  admin: '10000000-0000-4000-8000-000000000006',
  stranger: '10000000-0000-4000-8000-000000000009',
};

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
insert into auth.users (id, email) values
  ('${U.couple}', 'couple@example.com'), ('${U.vendor}', 'vendor@example.com'), ('${U.crew}', 'dj@example.com'),
  ('${U.staff}', 'new.staff@vivah.com.np'), ('${U.admin}', 'bikram@vivah.com.np'), ('${U.stranger}', 'someone@example.com');
insert into profiles (id, full_name) values ('${U.admin}', 'Bikram Adhikari');
insert into user_roles (user_id, role) values ('${U.admin}', 'SUPER_ADMIN');
`);

// ─── Sign-up for every role ───────────────────────────────────────────────────
const fresh = await as(U.couple, `select rpc_me() as me`);
ok('a new user is not signed up yet', fresh[0]?.me?.signedUp === false && fresh[0]?.me?.email === 'couple@example.com', JSON.stringify(fresh));
const couple = await as(U.couple, `select rpc_complete_signup('customer', $1::jsonb) as me`, [JSON.stringify({ name: 'Aakriti Shrestha', phone: '9800000001', city: 'Kathmandu', partnerName: 'Sujan' })]);
ok('a couple signs up', !refused(couple) && couple[0]?.me?.roles?.includes('CUSTOMER'), couple.error);
const again = await as(U.couple, `select rpc_complete_signup('vendor', $1::jsonb) as me`, [JSON.stringify({ name: 'Someone else' })]);
ok('signing up again changes nothing', !refused(again) && again[0]?.me?.roles?.length === 1 && again[0]?.me?.name === 'Aakriti Shrestha');

const vendor = await as(U.vendor, `select rpc_complete_signup('vendor', $1::jsonb) as me`, [JSON.stringify({ name: 'Sunita Maharjan', businessName: 'Phoolbari Decor', primaryService: 'decoration', services: ['decoration', 'florist', 'lighting'], businessForm: 'studio', teamSize: 9 })]);
ok('a vendor signs up with a business, listing and three services', !refused(vendor) && vendor[0]?.me?.provider?.services?.length === 3 && vendor[0]?.me?.provider?.services?.[0] === 'decoration', vendor.error ?? JSON.stringify(vendor[0]?.me?.provider));
const listing = await one(`select is_active from providers p join organization_members m on m.org_id = p.org_id where m.user_id = $1`, [U.vendor]);
ok('the new listing stays hidden until verified', listing?.is_active === false);

const crew = await as(U.crew, `select rpc_complete_signup('freelancer', $1::jsonb) as me`, [JSON.stringify({ name: 'Suman Tamang', skills: ['DJ', 'MC'], primarySkill: 'DJ', dayRate: 12000, eventRate: 15000 })]);
ok('a freelancer signs up with skills and rates', !refused(crew) && crew[0]?.me?.freelancer?.primarySkill === 'DJ' && Number(crew[0]?.me?.freelancer?.dayRate) === 12000, crew.error ?? JSON.stringify(crew[0]?.me?.freelancer));

ok('staff sign-up needs a valid access code', refused(await as(U.staff, `select rpc_complete_signup('platform', $1::jsonb, 'WRONG-CODE')`, [JSON.stringify({ name: 'Nisha Rai', team: 'Finance', staffRole: 'finance' })])));
ok('only admins set the access code', refused(await as(U.crew, `select rpc_set_staff_access_code('VIVAH-2027-OPS')`)));
ok('the admin sets the access code', !refused(await as(U.admin, `select rpc_set_staff_access_code('VIVAH-2027-OPS')`)));
const staff = await as(U.staff, `select rpc_complete_signup('platform', $1::jsonb, 'vivah-2027-ops') as me`, [JSON.stringify({ name: 'Nisha Rai', team: 'Finance', staffRole: 'admin' })]);
ok('staff with the code get a pending request, not a role', !refused(staff) && staff[0]?.me?.roles?.length === 0 && staff[0]?.me?.staffRequest?.status === 'PENDING', staff.error ?? JSON.stringify(staff[0]?.me));
ok('sign-up cannot ask for admin rights', staff[0]?.me?.staffRequest?.staffRole === 'coordinator');
const request = await one(`select id from staff_requests where user_id = $1`, [U.staff]);
ok('staff cannot approve themselves', refused(await as(U.staff, `select rpc_decide_staff_request($1, true, 'finance')`, [request.id])));
ok('the admin approves them as finance', !refused(await as(U.admin, `select rpc_decide_staff_request($1, true, 'finance')`, [request.id])));
const approved = await as(U.staff, `select rpc_me() as me`);
ok('after approval they hold the FINANCE role', approved[0]?.me?.roles?.includes('FINANCE'));
ok('signed-out callers cannot sign up', refused(await as(U.stranger, `select rpc_complete_signup('customer', '{"name":"X Y"}'::jsonb)`, [], 'anon')));

// ─── Access-token hook ─────────────────────────────────────────────────────────
const hook = await one(`select custom_access_token_hook($1::jsonb) as e`, [JSON.stringify({ user_id: U.vendor, claims: { sub: U.vendor, role: 'authenticated' } })]);
ok('the JWT gets app roles and the persona key', hook.e.claims.persona_key === 'vendor:decoration' && hook.e.claims.app_roles.includes('SERVICE_PROVIDER') && hook.e.claims.sub === U.vendor, JSON.stringify(hook.e.claims));
const staffHook = await one(`select custom_access_token_hook($1::jsonb) as e`, [JSON.stringify({ user_id: U.staff, claims: {} })]);
ok('staff get their staff role in the JWT', staffHook.e.claims.staff_role === 'finance' && staffHook.e.claims.persona_key === 'platform:finance');
ok('clients cannot call the hook', refused(await as(U.couple, `select custom_access_token_hook('{}'::jsonb)`)));

// ─── Media ─────────────────────────────────────────────────────────────────────
ok('a vendor registers an upload in their own folder', !refused(await as(U.vendor, `select rpc_register_media('portfolio', $1, 'IMAGE', 'Mandap, Patan')`, [`vivah/portfolio/${U.vendor}/abc123`])));
ok('someone else’s public id is refused', refused(await as(U.vendor, `select rpc_register_media('portfolio', $1)`, [`vivah/portfolio/${U.crew}/abc123`])));
ok('a freelancer’s upload lands in their portfolio', !refused(await as(U.crew, `select rpc_register_media('portfolio', $1)`, [`vivah/portfolio/${U.crew}/set1`])) && (await one(`select count(*)::int as n from freelancer_portfolio where freelancer_id = $1`, [U.crew])).n === 1);
ok('couples keep no portfolio', refused(await as(U.couple, `select rpc_register_media('portfolio', $1)`, [`vivah/portfolio/${U.couple}/x`])));
const media = await one(`select url from provider_media limit 1`);
ok('Postgres stores only the public id', media?.url === `vivah/portfolio/${U.vendor}/abc123`);

// ─── Private documents ─────────────────────────────────────────────────────────
const bucket = await one(`select public from storage.buckets where id = 'documents'`);
ok('the documents bucket is private', bucket?.public === false);
ok('a vendor uploads KYC to their own folder', !refused(await as(U.vendor, `insert into storage.objects (bucket_id, name, owner) values ('documents', $1, $2)`, [`${U.vendor}/kyc/pan.pdf`, U.vendor])));
ok('nobody writes into someone else’s folder', refused(await as(U.crew, `insert into storage.objects (bucket_id, name, owner) values ('documents', $1, $2)`, [`${U.vendor}/kyc/fake.pdf`, U.crew])));
ok('another user cannot read it', (await as(U.couple, `select name from storage.objects where bucket_id = 'documents'`)).length === 0);
ok('finance (no provider.verify) cannot read KYC', (await as(U.staff, `select name from storage.objects where bucket_id = 'documents'`)).length === 0);
ok('a super admin can read KYC', (await as(U.admin, `select name from storage.objects where bucket_id = 'documents'`)).length === 1);

// ─── Notifications ─────────────────────────────────────────────────────────────
ok('a user registers an Expo push token', !refused(await as(U.couple, `select rpc_register_push_token('ExponentPushToken[abc123]', 'android')`)));
ok('junk tokens are refused', refused(await as(U.couple, `select rpc_register_push_token('not-a-token', 'android')`)));
ok('push tokens are private', (await as(U.vendor, `select token from push_tokens`)).length === 0);
const prefs = await as(U.couple, `select rpc_set_notification_prefs($1::jsonb) as p`, [JSON.stringify({ push: true, email: false, muted: ['quote', 'emergency'] })]);
ok('preferences are saved, and emergencies cannot be muted', prefs[0]?.p?.email === false && JSON.stringify(prefs[0]?.p?.muted) === '["quote"]', JSON.stringify(prefs));
await db.query(`insert into notifications (user_id, kind, title, body) values ($1, 'payment', 'Payment received', 'NPR 42,375')`, [U.couple]);
const n = await one(`select id from notifications where user_id = $1 order by created_at desc limit 1`, [U.couple]);
const targets = await one(`select vivah_fanout_targets($1) as t`, [n.id]);
ok('the fan-out sees tokens, email and preferences', targets.t.tokens[0] === 'ExponentPushToken[abc123]' && targets.t.email === 'couple@example.com' && targets.t.prefs.email === false);
ok('clients cannot read fan-out targets', refused(await as(U.couple, `select vivah_fanout_targets($1)`, [n.id])));
ok('inserting a notification works without pg_net (local)', !!n.id);

// ─── Jobs ──────────────────────────────────────────────────────────────────────
await db.exec(`
insert into wedding_projects (id, title, customer_id, status, created_at) values ('20000000-0000-4000-8000-000000000001', 'Late lead', '${U.couple}', 'NEW', now() - interval '3 hours');
insert into orders (id, project_id, total) values ('20000000-0000-4000-8000-0000000000a1', '20000000-0000-4000-8000-000000000001', 1000000);
insert into payment_milestones (order_id, project_id, label, amount, due_rule, due_date, status) values
  ('20000000-0000-4000-8000-0000000000a1', '20000000-0000-4000-8000-000000000001', 'Advance', 300000, 'ON_CONFIRMATION', current_date - 1, 'UPCOMING'),
  ('20000000-0000-4000-8000-0000000000a1', '20000000-0000-4000-8000-000000000001', '15 days before', 500000, 'DAYS_BEFORE_EVENT', current_date + 7, 'UPCOMING'),
  ('20000000-0000-4000-8000-0000000000a1', '20000000-0000-4000-8000-000000000001', 'After', 200000, 'AFTER_COMPLETION', current_date + 60, 'UPCOMING');
insert into user_roles (user_id, role) values ('${U.admin}', 'PLATFORM_ADMIN');
`);
ok('milestone sweep marks overdue and due', (await one(`select job_milestone_sweep() as n`)).n === 2 && (await one(`select string_agg(status::text, ',' order by due_date) as s from payment_milestones where project_id = '20000000-0000-4000-8000-000000000001'`)).s === 'OVERDUE,DUE,UPCOMING');
ok('running it again changes nothing', (await one(`select job_milestone_sweep() as n`)).n === 0);
ok('payment reminders go out once', (await one(`select job_payment_reminders() as n`)).n === 1 && (await one(`select job_payment_reminders() as n`)).n === 0);
ok('an unassigned lead older than 2 hours raises one SLA alert', (await one(`select job_lead_sla() as n`)).n === 1 && (await one(`select job_lead_sla() as n`)).n === 0);
await db.query(`insert into notifications (user_id, kind, title, read_at, created_at) select $1, 'system', 'old ' || g, now() - interval '100 days', now() - interval '100 days' from generate_series(1, 5) g`, [U.couple]);
ok('cleanup removes old read notifications', (await one(`select job_cleanup() as n`)).n >= 5);
ok('clients cannot run jobs', refused(await as(U.couple, `select job_cleanup()`)));

await db.close();
reported = true;
const failed = results.filter((r) => !r.pass);
results.forEach((r) => console.log(`${r.pass ? 'pass' : 'FAIL'}  ${r.name}${!r.pass && r.detail ? `  (${r.detail})` : ''}`));
console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);
if (failed.length) process.exit(1);
