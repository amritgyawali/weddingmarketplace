/**
 * App content checks on a real Postgres with RLS on (PGlite, in-process):
 * everyone reads the console configuration (signed in or out), only super
 * admins publish content, text overrides and feature switches, every save
 * moves the revision on and is audited, a device that is up to date gets the
 * revision alone, and nobody writes the table directly.
 *
 *   npm run db:test   (runs this after bugs.mjs)
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
const config = async (who, known = null) => {
  const rows = who ? await as(who, `select rpc_app_config($1) as c`, [known]) : await anon(`select rpc_app_config($1) as c`, [known]);
  return Array.isArray(rows) ? rows[0]?.c : rows;
};

await db.exec(`
insert into cities (id, name, province, grp) values ('kathmandu', 'Kathmandu', 'Bagmati', 'VALLEY') on conflict do nothing;
insert into auth.users (id, email) values ('${U.couple}', 'couple@example.com'), ('${U.coordinator}', 'sita@vivah.com.np'), ('${U.admin}', 'bikram@vivah.com.np');
insert into profiles (id, full_name) values ('${U.coordinator}', 'Sita Karki'), ('${U.admin}', 'Bikram Adhikari');
insert into user_roles (user_id, role) values ('${U.coordinator}', 'WEDDING_COORDINATOR'), ('${U.admin}', 'SUPER_ADMIN');
`);
ok('a couple signs up', !refused(await as(U.couple, `select rpc_complete_signup('customer', $1::jsonb)`, [JSON.stringify({ name: 'Aakriti Shrestha', phone: '9800000001', city: 'Kathmandu' })])));

const CONTENT = {
  images: { venueLawn: 'https://res.cloudinary.com/vivah/image/upload/t_full/vivah/idea/lawn.jpg' },
  entries: { 'venue:everest-grand': { fields: { name: 'Everest Grand Palace', rentalCost: 275000 } } },
  home: { order: ['strip', 'venues'], titles: { venues: 'Halls in {city}' } },
  banners: [{ id: 'ban_1', title: 'Mangsir dates are filling', active: true, href: '/venues' }],
  brand: { supportPhone: '+9779800000000' },
};

// ─── Reading ───────────────────────────────────────────────────────────────────
const first = await config(null);
ok('a visitor reads the configuration before anything is saved', first?.revision === 0 && JSON.stringify(first.content) === '{}' && JSON.stringify(first.texts) === '{}' && JSON.stringify(first.flags) === '{}');

// ─── Who may publish ───────────────────────────────────────────────────────────
ok('a couple cannot publish content', refused(await as(U.couple, `select rpc_save_app_content($1::jsonb)`, [JSON.stringify(CONTENT)])));
ok('a coordinator cannot publish content', refused(await as(U.coordinator, `select rpc_save_app_content($1::jsonb)`, [JSON.stringify(CONTENT)])));
ok('a visitor cannot publish content', refused(await anon(`select rpc_save_app_content($1::jsonb)`, [JSON.stringify(CONTENT)])));
ok('a coordinator cannot publish text or switches', refused(await as(U.coordinator, `select rpc_save_text_overrides('{}'::jsonb)`)) && refused(await as(U.coordinator, `select rpc_save_feature_flags('{}'::jsonb)`)));
ok('nobody writes the table directly', refused(await as(U.admin, `update app_content set content = '{"x":1}' where id = 'live'`)) && refused(await as(U.couple, `insert into app_content (id) values ('live')`)) && refused(await anon(`delete from app_content where true`)));
ok('nothing was changed by the refused calls', (await config(null))?.revision === 0);

// ─── Publishing content ────────────────────────────────────────────────────────
const saved = await as(U.admin, `select rpc_save_app_content($1::jsonb) as r`, [JSON.stringify(CONTENT)]);
ok('the super admin publishes content', !refused(saved) && Number(saved[0]?.r) === 1, JSON.stringify(saved));
const seen = await config(U.couple);
ok('a couple’s phone gets it', seen?.revision === 1 && seen.content?.entries?.['venue:everest-grand']?.fields?.name === 'Everest Grand Palace' && seen.content.banners?.[0]?.title === 'Mangsir dates are filling');
ok('a signed-out visitor gets it too', (await config(null))?.content?.images?.venueLawn === CONTENT.images.venueLawn);
const upToDate = await config(U.couple, 1);
ok('a phone that is up to date gets the revision alone', upToDate?.revision === 1 && upToDate.content === undefined && upToDate.texts === undefined);
ok('a phone that is behind gets everything', (await config(U.couple, 0))?.content !== undefined);
ok('the save is audited with who did it', (await one(`select count(*)::int as n from audit_logs where action = 'content.publish' and actor_id = $1`, [U.admin])).n === 1 && (await one(`select updated_by from app_content where id = 'live'`)).updated_by === U.admin);
ok('content must be an object', refused(await as(U.admin, `select rpc_save_app_content('[1,2]'::jsonb)`)) && refused(await as(U.admin, `select rpc_save_app_content(null)`)));
ok('oversized content is refused', refused(await as(U.admin, `select rpc_save_app_content($1::jsonb)`, [JSON.stringify({ brand: { name: 'x'.repeat(2_000_001) } })])));
ok('a refused save leaves the content and revision alone', (await config(null))?.revision === 1 && (await config(null))?.content?.brand?.supportPhone === '+9779800000000');

// ─── Text overrides ────────────────────────────────────────────────────────────
const texts = { 'Start a plan': { en: 'Plan your day', ne: 'योजना सुरु गर्नुहोस्' }, 'View all': { ne: 'सबै हेर्नुहोस्' }, Empty: {}, '   ': { en: 'x' }, Bad: 'text' };
const t1 = await as(U.admin, `select rpc_save_text_overrides($1::jsonb) as r`, [JSON.stringify(texts)]);
ok('the super admin publishes text changes', !refused(t1) && Number(t1[0]?.r) === 2, JSON.stringify(t1));
const withTexts = await config(U.couple);
ok('phones get both languages', withTexts?.texts?.['Start a plan']?.en === 'Plan your day' && withTexts.texts['Start a plan'].ne === 'योजना सुरु गर्नुहोस्' && withTexts.texts['View all'].ne === 'सबै हेर्नुहोस्' && withTexts.texts['View all'].en === undefined);
ok('empty and malformed text changes are left out', Object.keys(withTexts?.texts ?? {}).length === 2);
await as(U.admin, `select rpc_save_text_overrides($1::jsonb)`, [JSON.stringify({ 'View all': { en: 'See all' } })]);
const replaced = await config(U.couple);
ok('a save replaces every text change', Object.keys(replaced?.texts ?? {}).length === 1 && replaced.texts['View all'].en === 'See all' && replaced.texts['View all'].ne === undefined);

// ─── Feature switches ──────────────────────────────────────────────────────────
const f1 = await as(U.admin, `select rpc_save_feature_flags($1::jsonb) as r`, [JSON.stringify({ 'home.venues': false, 'couple.seating': true, x: true, 'home.makeup': 'no' })]);
ok('the super admin publishes feature switches', !refused(f1) && Number(f1[0]?.r) === 4, JSON.stringify(f1));
const withFlags = await config(null);
ok('phones get the switches', withFlags?.flags?.['home.venues'] === false && withFlags.flags['couple.seating'] === true);
ok('malformed switches are left out', Object.keys(withFlags?.flags ?? {}).length === 2);
await as(U.admin, `select rpc_save_feature_flags('{}'::jsonb)`);
const cleared = await config(null);
ok('saving none switches everything back to its default', JSON.stringify(cleared?.flags) === '{}' && cleared.revision === 5);
ok('content survived the other saves', cleared?.content?.home?.titles?.venues === 'Halls in {city}');
ok('each kind of save is audited', (await one(`select count(*)::int as n from audit_logs where action in ('text.publish', 'feature.publish')`)).n === 4);

await db.close();
reported = true;
const failed = results.filter((r) => !r.pass);
results.forEach((r) => console.log(`${r.pass ? 'pass' : 'FAIL'}  ${r.name}${!r.pass && r.detail ? `  (${r.detail})` : ''}`));
console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);
if (failed.length) process.exit(1);
