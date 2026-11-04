/**
 * Security checks (0023): ordinary users and signed-out visitors try to
 * forge data or read what isn't theirs, against the migrations with RLS on.
 * Each attack must be refused, and the legitimate change next to it must
 * still work, so the hardening never breaks a real flow.
 *
 *   npm run db:test   (or: node scripts/db/security.mjs)
 */
import { asUser, freshDb } from './harness.mjs';

const results = [];
const ok = (name, pass, detail = '') => results.push({ name, pass: !!pass, detail });

const ID = {
  couple: '00000000-0000-4000-8000-00000000c001',
  stranger: '00000000-0000-4000-8000-00000000c002',
  owner: '00000000-0000-4000-8000-00000000c003',
  manager: '00000000-0000-4000-8000-00000000c004',
  freelancer: '00000000-0000-4000-8000-00000000c005',
  finance: '00000000-0000-4000-8000-00000000c006',
  vendorSuccess: '00000000-0000-4000-8000-00000000c007',
  nobody: '00000000-0000-4000-8000-00000000c0ff',
  org: '00000000-0000-4000-8000-00000000c0a1',
  provider: '00000000-0000-4000-8000-00000000c0b1',
  project: '00000000-0000-4000-8000-00000000c0d1',
  item: '00000000-0000-4000-8000-00000000c0e1',
  review: '00000000-0000-4000-8000-00000000c0f1',
  chat: '00000000-0000-4000-8000-00000000c101',
  privateChat: '00000000-0000-4000-8000-00000000c102',
};

const db = await freshDb();

/** Runs SQL as a user; resolves to rows, or to { error } when Postgres refuses. */
const as = (user, sql, params = [], role = 'authenticated') =>
  asUser(db, user, async () => {
    try {
      return (await db.query(sql, params)).rows;
    } catch (e) {
      return { error: e.message };
    }
  }, role);
const refused = (r) => (r && !Array.isArray(r) && typeof r.error === 'string') || (Array.isArray(r) && r.length === 0);
const worked = (r) => Array.isArray(r) && r.length > 0;
const one = async (sql, params) => (await db.query(sql, params)).rows[0];

await db.exec(`
insert into cities (id, name, province, grp) values ('kathmandu', 'Kathmandu', 'Bagmati', 'VALLEY') on conflict do nothing;
insert into service_categories (id, name) values ('venue', 'Venue') on conflict do nothing;
insert into auth.users (id, email) values
  ('${ID.couple}', 'couple@example.com'), ('${ID.stranger}', 'stranger@example.com'), ('${ID.owner}', 'owner@example.com'),
  ('${ID.manager}', 'manager@example.com'), ('${ID.freelancer}', 'raj@example.com'), ('${ID.finance}', 'nisha@vivah.com.np'),
  ('${ID.vendorSuccess}', 'prakash@vivah.com.np');
insert into profiles (id, full_name, phone, staff_team) values
  ('${ID.couple}', 'Couple', '9800000101', null), ('${ID.stranger}', 'Stranger', '9800000102', null),
  ('${ID.owner}', 'Owner', '9800000103', null), ('${ID.manager}', 'Manager', '9800000104', null),
  ('${ID.freelancer}', 'Raj', '9800000105', null), ('${ID.finance}', 'Nisha', '9800000106', null),
  ('${ID.vendorSuccess}', 'Prakash', '9800000107', 'Vendor Success');
insert into user_roles (user_id, role, granted_at) values
  ('${ID.couple}', 'CUSTOMER', now()), ('${ID.stranger}', 'CUSTOMER', now()), ('${ID.owner}', 'SERVICE_PROVIDER', now()),
  ('${ID.manager}', 'SERVICE_PROVIDER', now()), ('${ID.freelancer}', 'FREELANCER', now()), ('${ID.finance}', 'FINANCE', now()),
  ('${ID.vendorSuccess}', 'SUPPORT', now());
insert into customers (id) values ('${ID.couple}'), ('${ID.stranger}');
insert into organizations (id, kind, name) values ('${ID.org}', 'PROVIDER', 'Everest Grand');
insert into organization_members (org_id, user_id, member_role) values ('${ID.org}', '${ID.owner}', 'OWNER'), ('${ID.org}', '${ID.manager}', 'MANAGER');
insert into providers (id, org_id, slug, kind, primary_category_id, city_id, is_active) values ('${ID.provider}', '${ID.org}', 'everest', 'VENUE', 'venue', 'kathmandu', true);
insert into freelancers (id, lat, lng, reliability_score, no_shows) values ('${ID.freelancer}', 27.7172, 85.3240, 62, 3);
insert into wedding_projects (id, customer_id, title) values ('${ID.project}', '${ID.couple}', 'Our wedding');
insert into wedding_websites (project_id, slug, password_hash, is_published) values ('${ID.project}', 'our-wedding', 'bcrypt$secret', true);
insert into registry_items (id, project_id, kind, title, price) values ('${ID.item}', '${ID.project}', 'CASH_FUND', 'Honeymoon', 5000000);
insert into reviews (id, reviewer_id, reviewer_role, target_kind, target_id, overall, body, status)
  values ('${ID.review}', '${ID.couple}', 'CUSTOMER', 'PROVIDER', '${ID.provider}', 2, 'Food was cold', 'PUBLISHED');
insert into conversations (id, kind) values ('${ID.chat}', 'DIRECT'), ('${ID.privateChat}', 'DIRECT');
insert into conversation_members (conversation_id, user_id, member_role) values ('${ID.chat}', '${ID.stranger}', 'MEMBER'), ('${ID.privateChat}', '${ID.couple}', 'MEMBER');
`);

// ─── Permissions and capabilities ─────────────────────────────────────────────
ok('finance cannot join another team to gain its permissions', refused(await as(ID.finance, `update profiles set staff_team = 'Vendor Success' where id = $1 returning id`, [ID.finance])));
ok('…so finance still lacks provider.verify', (await as(ID.finance, `select has_permission('provider.verify') as p`))[0]?.p === false);
ok('a vendor cannot grant themselves capabilities', refused(await as(ID.owner, `update profiles set caps_override = '{media.camera}' where id = $1 returning id`, [ID.owner])));
ok('a user cannot change the phone they sign in with', refused(await as(ID.couple, `update profiles set phone = '9800000199' where id = $1 returning id`, [ID.couple])));
ok('a user can still edit their own name and city', worked(await as(ID.couple, `update profiles set full_name = 'Aakriti', city = 'Lalitpur' where id = $1 returning id`, [ID.couple])));

// ─── Reviews ──────────────────────────────────────────────────────────────────
ok('a vendor cannot change the stars of a review about them', refused(await as(ID.owner, `update reviews set overall = 5 where id = $1 returning id`, [ID.review])));
ok('a vendor cannot rewrite a review', refused(await as(ID.owner, `update reviews set body = 'Amazing' where id = $1 returning id`, [ID.review])));
await as(ID.owner, `update reviews set status = 'REMOVED' where id = $1`, [ID.review]);
ok('a vendor cannot take a review down', (await one(`select status from reviews where id = $1`, [ID.review])).status === 'PUBLISHED');
ok('a vendor can still reply to it', worked(await as(ID.owner, `update reviews set vendor_reply = 'Sorry, we have fixed this', replied_at = now() where id = $1 returning id`, [ID.review])));
ok('the stars are unchanged', Number((await one(`select overall from reviews where id = $1`, [ID.review])).overall) === 2);

// ─── Marketplace signals and verification ─────────────────────────────────────
ok('a freelancer cannot verify themselves', refused(await as(ID.freelancer, `update freelancers set verification_status = 'VERIFIED' where id = $1 returning id`, [ID.freelancer])));
ok('a freelancer cannot set their own rating or reliability', refused(await as(ID.freelancer, `update freelancers set rating_avg = 5, reliability_score = 100, no_shows = 0 where id = $1 returning id`, [ID.freelancer])));
ok('a freelancer can still edit their profile', worked(await as(ID.freelancer, `update freelancers set headline = 'Candid photographer', day_rate = 2500000 where id = $1 returning id`, [ID.freelancer])));
ok('Vendor Success can verify a freelancer', worked(await as(ID.vendorSuccess, `update freelancers set verification_status = 'VERIFIED' where id = $1 returning id`, [ID.freelancer])));
ok('a vendor cannot feature their listing', refused(await as(ID.owner, `update providers set is_featured = true where id = $1 returning id`, [ID.provider])));
ok('a vendor cannot mark it sponsored', refused(await as(ID.owner, `update providers set is_sponsored = true where id = $1 returning id`, [ID.provider])));
ok('a vendor cannot set its rating or reliability', refused(await as(ID.owner, `update providers set rating_avg = 5, rating_count = 400, reliability_score = 100 where id = $1 returning id`, [ID.provider])));
ok('a vendor cannot move their listing to another business', refused(await as(ID.owner, `update providers set org_id = gen_random_uuid() where id = $1 returning id`, [ID.provider])));
ok('a vendor can still edit their listing', worked(await as(ID.owner, `update providers set locality = 'Baneshwor', starting_price = 150000000 where id = $1 returning id`, [ID.provider])));
ok('a vendor cannot verify their own business', refused(await as(ID.owner, `update organizations set verification_status = 'VERIFIED' where id = $1 returning id`, [ID.org])));

// ─── Payout details ───────────────────────────────────────────────────────────
ok('a manager cannot change where payouts go', refused(await as(ID.manager, `update organizations set bank_account = '{"account":"999"}' where id = $1 returning id`, [ID.org])));
ok('the owner can', worked(await as(ID.owner, `update organizations set bank_account = '{"account":"123"}' where id = $1 returning id`, [ID.org])));
const payoutAudit = await one(`select actor_id, after from audit_logs where action = 'organization.payout_details' and entity_id = $1`, [ID.org]);
ok('…and the change is audited without the account number', payoutAudit?.actor_id === ID.owner && payoutAudit?.after?.bank_account === true && !JSON.stringify(payoutAudit.after).includes('123'), JSON.stringify(payoutAudit));
ok('a manager can still edit the business description', worked(await as(ID.manager, `update organizations set description = 'Banquets in Baneshwor' where id = $1 returning id`, [ID.org])));

// ─── Conversations ────────────────────────────────────────────────────────────
ok('a member cannot move their membership into another conversation', refused(await as(ID.stranger, `update conversation_members set conversation_id = $1 where user_id = $2 returning conversation_id`, [ID.privateChat, ID.stranger])));
ok('a member cannot promote themselves', refused(await as(ID.stranger, `update conversation_members set member_role = 'OWNER' where user_id = $1 returning user_id`, [ID.stranger])));
ok('a member can still mark the chat read and mute it', worked(await as(ID.stranger, `update conversation_members set last_read_at = now(), muted = true where user_id = $1 returning user_id`, [ID.stranger])));

// ─── Public reads ─────────────────────────────────────────────────────────────
ok('signed out, the wedding website opens', worked(await as(ID.nobody, `select slug, content from wedding_websites where slug = 'our-wedding'`, [], 'anon')));
ok('signed out, its password hash does not', refused(await as(ID.nobody, `select password_hash from wedding_websites`, [], 'anon')));
ok('signed out, freelancer profiles open', worked(await as(ID.nobody, `select id, headline, rating_avg from freelancers`, [], 'anon')));
ok('signed out, a freelancer’s exact location does not', refused(await as(ID.nobody, `select lat, lng from freelancers`, [], 'anon')));
ok('signed in, internal reliability signals do not', refused(await as(ID.couple, `select reliability_score, no_shows from freelancers`)));

// ─── Registry gifts ───────────────────────────────────────────────────────────
/** A signed-out guest gives a gift; resolves to [row] when it was recorded (guests can't read gifts back, so it's counted as the owner). */
async function gift(fields) {
  const before = (await one(`select count(*)::int as n from registry_contributions`)).n;
  const r = await as(ID.nobody, `insert into registry_contributions (item_id, contributor_name, amount, message, payment_id, thanked_at) values ($1, $2, $3, $4, $5, $6)`,
    [fields.item ?? ID.item, fields.name ?? 'Hari mama', fields.amount ?? 500000, fields.message ?? null, fields.payment ?? null, fields.thanked ?? null], 'anon');
  const after = (await one(`select count(*)::int as n from registry_contributions`)).n;
  return after > before ? [{ recorded: true }] : r && !Array.isArray(r) ? r : [];
}
ok('a guest can give through the published website', worked(await gift({})));
ok('a negative gift is refused', refused(await gift({ amount: -500000 })));
ok('a gift cannot claim a payment or be pre-thanked', refused(await gift({ thanked: new Date().toISOString() })));
ok('a gift needs a name', refused(await gift({ name: '  ' })));
await db.exec(`update wedding_websites set is_published = false where project_id = '${ID.project}'`);
ok('nobody can give to an unpublished registry', refused(await gift({})));

// ─── Functions closed to the public ───────────────────────────────────────────
ok('signed out, the ops summary is refused', refused(await as(ID.nobody, `select operations_today(current_date)`, [], 'anon')));
ok('a couple cannot read the ops summary', refused(await as(ID.couple, `select operations_today(current_date)`)));
ok('staff can', worked(await as(ID.finance, `select operations_today(current_date) as o`)));
ok('nobody outside the server recomputes reliability', refused(await as(ID.couple, `select recompute_reliability('FREELANCER', $1)`, [ID.freelancer])));
ok('nobody outside the server reads event dates', refused(await as(ID.nobody, `select vivah_event_dates($1, null)`, [ID.project], 'anon')));

// ─── Every security definer function pins its search_path ────────────────────
const loose = (await db.query(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`)).rows;
ok('every security definer function sets search_path', loose.length === 0, loose.map((r) => r.proname).join(', '));

await db.close();
results.forEach((r) => console.log(`${r.pass ? 'pass' : 'FAIL'}  ${r.name}${!r.pass && r.detail ? `  (${r.detail})` : ''}`));
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
