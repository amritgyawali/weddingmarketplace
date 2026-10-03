/**
 * Bug report checks on a real Postgres with RLS on (PGlite, in-process):
 * anyone can send a report (signed in or out), the screenshot is kept only
 * when it is an image, the account details are dropped for signed-out
 * senders, super admins are told, only super admins read, mark and delete
 * reports, and the rate limit stops a flood.
 *
 *   npm run db:test   (runs this after social.mjs)
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
  couple: '50000000-0000-4000-8000-000000000001',
  coordinator: '50000000-0000-4000-8000-000000000004',
  admin: '50000000-0000-4000-8000-000000000006',
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
const anon = (sql, params = []) => as('', sql, params, 'anon');
const refused = (r) => r && !Array.isArray(r) && typeof r.error === 'string';
const one = async (sql, params) => (await db.query(sql, params)).rows[0];

await db.exec(`
insert into cities (id, name, province, grp) values ('kathmandu', 'Kathmandu', 'Bagmati', 'VALLEY') on conflict do nothing;
insert into auth.users (id, email) values ('${U.couple}', 'couple@example.com'), ('${U.coordinator}', 'sita@vivah.com.np'), ('${U.admin}', 'bikram@vivah.com.np');
insert into profiles (id, full_name) values ('${U.coordinator}', 'Sita Karki'), ('${U.admin}', 'Bikram Adhikari');
insert into user_roles (user_id, role) values ('${U.coordinator}', 'WEDDING_COORDINATOR'), ('${U.admin}', 'SUPER_ADMIN');
`);
ok('a couple signs up', !refused(await as(U.couple, `select rpc_complete_signup('customer', $1::jsonb)`, [JSON.stringify({ name: 'Aakriti Shrestha', phone: '9800000001', city: 'Kathmandu' })])));

const SHOT = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';
const report = (extra = {}) =>
  JSON.stringify({
    description: 'The guest list button does nothing',
    screenshot: SHOT,
    route: '/guests',
    params: { tab: 'all' },
    capturedAt: '2026-10-03T08:00:00.000Z',
    account: { id: U.couple, name: 'Aakriti Shrestha', role: 'customer' },
    device: { os: 'ios', osVersion: '19.0', width: 390, height: 844, scale: 3, runtime: 'Expo Go' },
    app: { name: 'Vivah', version: '1.0.0', backend: 'supabase', language: 'en', calendar: 'BS' },
    recentRoutes: [{ at: '08:00:00', path: '/' }],
    logs: [{ at: '08:00:01', level: 'error', message: 'TypeError: x is undefined' }],
    ...extra,
  });

// ─── Sending ───────────────────────────────────────────────────────────────────
const sent = await as(U.couple, `select rpc_submit_bug_report($1::jsonb) as id`, [report()]);
ok('a signed-in couple sends a report', !refused(sent) && sent[0]?.id, sent.error);
const id = sent[0]?.id;
const row = await one(`select reporter_id, screenshot, route, account->>'name' as name, status from bug_reports where id = $1`, [id]);
ok('it keeps the reporter, screenshot, screen and account', row.reporter_id === U.couple && row.screenshot === SHOT && row.route === '/guests' && row.name === 'Aakriti Shrestha' && row.status === 'new');
ok('the super admin is told', (await one(`select count(*)::int as n from notifications where user_id = $1 and href = $2`, [U.admin, `/platform/admin/bug/${id}`])).n === 1);
ok('a coordinator is not told', (await one(`select count(*)::int as n from notifications where user_id = $1`, [U.coordinator])).n === 0);

const guest = await anon(`select rpc_submit_bug_report($1::jsonb) as id`, [report({ screenshot: 'javascript:alert(1)' })]);
ok('a signed-out visitor sends a report', !refused(guest) && guest[0]?.id, guest.error);
const guestRow = await one(`select reporter_id, screenshot, account from bug_reports where id = $1`, [guest[0]?.id]);
ok('a signed-out report has no reporter and no claimed account', guestRow.reporter_id === null && guestRow.account === null);
ok('a screenshot that is not an image is dropped', guestRow.screenshot === null);
ok('an empty description is refused', refused(await as(U.couple, `select rpc_submit_bug_report($1::jsonb)`, [report({ description: '   ' })])));
ok('nobody inserts directly', refused(await as(U.couple, `insert into bug_reports (description) values ('x')`)) && refused(await anon(`insert into bug_reports (description) values ('x')`)));

// ─── Reading ───────────────────────────────────────────────────────────────────
ok('the couple cannot read reports, even their own', refused(await as(U.couple, `select rpc_list_bug_reports()`)) && (await as(U.couple, `select count(*)::int as n from bug_reports`))[0]?.n === 0);
ok('a coordinator cannot read reports', refused(await as(U.coordinator, `select rpc_list_bug_reports()`)));
ok('signed-out visitors cannot read reports', refused(await anon(`select rpc_list_bug_reports()`)));
const list = await as(U.admin, `select rpc_list_bug_reports() as l`);
ok('the super admin lists them, newest first, without screenshots', !refused(list) && list[0]?.l?.length === 2 && list[0].l.every((r) => r.screenshot === null) && list[0].l[1].id === id, list.error);
const detail = await as(U.admin, `select rpc_get_bug_report($1) as r`, [id]);
ok('one report comes with its screenshot and app details', detail[0]?.r?.screenshot === SHOT && detail[0].r.device.runtime === 'Expo Go' && detail[0].r.logs.length === 1);

// ─── Status and deleting ───────────────────────────────────────────────────────
ok('a coordinator cannot mark a report fixed', refused(await as(U.coordinator, `select rpc_set_bug_report_status($1, 'fixed')`, [id])));
ok('the super admin marks it fixed with a note', !refused(await as(U.admin, `select rpc_set_bug_report_status($1, 'fixed', 'PR #31')`, [id])));
const fixed = (await as(U.admin, `select rpc_get_bug_report($1) as r`, [id]))[0]?.r;
ok('it records who fixed it and when', fixed?.status === 'fixed' && fixed.resolvedBy === 'Bikram Adhikari' && fixed.resolvedAt && fixed.note === 'PR #31');
ok('the change is audited', (await one(`select count(*)::int as n from audit_logs where action = 'bug.fixed' and entity_id = $1`, [id])).n === 1);
ok('an unknown status is refused', refused(await as(U.admin, `select rpc_set_bug_report_status($1, 'maybe')`, [id])));
ok('reopening clears who fixed it', !refused(await as(U.admin, `select rpc_set_bug_report_status($1, 'new')`, [id])) && (await one(`select resolved_by from bug_reports where id = $1`, [id])).resolved_by === null);
ok('a coordinator cannot delete reports', refused(await as(U.coordinator, `select rpc_delete_bug_reports(array[$1]::uuid[])`, [id])));
const deleted = await as(U.admin, `select rpc_delete_bug_reports(array[$1]::uuid[]) as n`, [guest[0]?.id]);
ok('the super admin deletes one', deleted[0]?.n === 1 && (await one(`select count(*)::int as n from bug_reports`)).n === 1, deleted.error);

// ─── Rate limit ────────────────────────────────────────────────────────────────
for (let i = 0; i < 9; i++) await as(U.couple, `select rpc_submit_bug_report($1::jsonb)`, [report()]);
ok('ten reports in ten minutes is the limit for one person', refused(await as(U.couple, `select rpc_submit_bug_report($1::jsonb)`, [report()])));
ok('someone else can still report', !refused(await anon(`select rpc_submit_bug_report($1::jsonb)`, [report()])));

await db.close();
reported = true;
const failed = results.filter((r) => !r.pass);
results.forEach((r) => console.log(`${r.pass ? 'pass' : 'FAIL'}  ${r.name}${!r.pass && r.detail ? `  (${r.detail})` : ''}`));
console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);
if (failed.length) process.exit(1);
