/**
 * Edit profile and Help and support on a real Postgres with RLS on (PGlite,
 * in-process): people edit only their own profile within the limits; couples,
 * businesses and freelancers open help requests and see only theirs (never
 * internal notes); staff with support.manage see and answer every request,
 * assign it and change its status; finance staff can't; owners mark a
 * request solved, reopen it and rate it; nobody writes the tables directly.
 *
 *   npm run db:test   (runs this after content.mjs)
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
  couple: '60000000-0000-4000-8000-000000000001',
  other: '60000000-0000-4000-8000-000000000002',
  freelancer: '60000000-0000-4000-8000-000000000003',
  coordinator: '60000000-0000-4000-8000-000000000004',
  support: '60000000-0000-4000-8000-000000000005',
  finance: '60000000-0000-4000-8000-000000000006',
};

const db = await freshDb();
async function as(user, sql, params = []) {
  return asUser(db, user, async () => {
    try {
      return (await db.query(sql, params)).rows;
    } catch (e) {
      return { error: e.message };
    }
  });
}
const refused = (r) => r && !Array.isArray(r) && typeof r.error === 'string';
const one = async (sql, params) => (await db.query(sql, params)).rows[0];

await db.exec(`
insert into auth.users (id, email) values
  ('${U.couple}', 'aakriti@example.com'), ('${U.other}', 'other@example.com'), ('${U.freelancer}', 'raj@example.com'),
  ('${U.coordinator}', 'sita@vivah.com.np'), ('${U.support}', 'prakash@vivah.com.np'), ('${U.finance}', 'nisha@vivah.com.np');
insert into profiles (id, full_name, city) values
  ('${U.couple}', 'Aakriti Shrestha', 'Kathmandu'), ('${U.other}', 'Someone Else', 'Pokhara'), ('${U.freelancer}', 'Raj Maharjan', 'Lalitpur'),
  ('${U.coordinator}', 'Sita Karki', 'Kathmandu'), ('${U.support}', 'Prakash Thapa', 'Kathmandu'), ('${U.finance}', 'Nisha Rai', 'Kathmandu');
insert into user_roles (user_id, role) values
  ('${U.couple}', 'CUSTOMER'), ('${U.other}', 'CUSTOMER'), ('${U.freelancer}', 'FREELANCER'),
  ('${U.coordinator}', 'WEDDING_COORDINATOR'), ('${U.support}', 'SUPPORT'), ('${U.finance}', 'FINANCE');
insert into freelancers (id) values ('${U.freelancer}');
`);

// ─── Edit profile ────────────────────────────────────────────────────────────────
ok('a couple renames themselves and moves city', !refused(await as(U.couple, `select rpc_update_my_profile($1::jsonb)`, [JSON.stringify({ name: '  Aakriti   S. Shrestha ', city: 'Lalitpur' })])));
const me = await one(`select full_name, city from profiles where id = $1`, [U.couple]);
ok('the name is tidied and saved', me.full_name === 'Aakriti S. Shrestha' && me.city === 'Lalitpur', JSON.stringify(me));
ok('an empty name is refused', refused(await as(U.couple, `select rpc_update_my_profile('{"name":" "}'::jsonb)`)));
ok('a photo that is not a web address is refused', refused(await as(U.couple, `select rpc_update_my_profile('{"photo":"javascript:alert(1)"}'::jsonb)`)));
ok('a web photo is kept', !refused(await as(U.couple, `select rpc_update_my_profile('{"photo":"https://res.cloudinary.com/demo/a.jpg"}'::jsonb)`)) && (await one(`select avatar_url from profiles where id = $1`, [U.couple])).avatar_url === 'https://res.cloudinary.com/demo/a.jpg');
ok('nobody else’s profile changes', (await one(`select full_name from profiles where id = $1`, [U.other])).full_name === 'Someone Else');
ok('a freelancer edits headline, bio, experience and languages', !refused(await as(U.freelancer, `select rpc_update_my_profile($1::jsonb)`, [JSON.stringify({ headline: 'Wedding photographer', bio: 'Candid and calm.', experienceYears: 8, languages: ['Nepali', 'English', 'Nepali'] })])));
const fl = await one(`select headline, bio, experience_years, languages from freelancers where id = $1`, [U.freelancer]);
ok('the freelancer profile is saved', fl.headline === 'Wedding photographer' && fl.bio === 'Candid and calm.' && fl.experience_years === 8 && fl.languages.length === 2, JSON.stringify(fl));
ok('experience over 60 years is refused', refused(await as(U.freelancer, `select rpc_update_my_profile('{"experienceYears":99}'::jsonb)`)));
ok('signed out, nothing changes', refused(await as('', `select rpc_update_my_profile('{"name":"X Y"}'::jsonb)`)));
ok('profile edits are audited', (await one(`select count(*)::int as n from audit_logs where action = 'profile.update'`)).n >= 2);

// ─── Opening a request ───────────────────────────────────────────────────────────
const opened = await as(U.couple, `select rpc_open_support_ticket('payment', 'Receipt for the first payment', 'Where can we download the receipt for the family?') as id`);
ok('a couple opens a help request', !refused(opened) && opened[0]?.id, opened.error);
const tid = opened[0]?.id;
const t = await one(`select code, role, status, priority from support_tickets where id = $1`, [tid]);
ok('it gets a code, the couple role and starts open', /^SUP-\d{4}-0101$/.test(t.code) && t.role === 'customer' && t.status === 'open' && t.priority === 'normal', JSON.stringify(t));
ok('the person’s message and the acknowledgement are saved', (await one(`select count(*)::int as n from support_messages where ticket_id = $1`, [tid])).n === 2);
ok('staff who answer help requests are told', (await one(`select count(*)::int as n from notifications where user_id = $1 and href = $2`, [U.support, `/platform/support/${tid}`])).n === 1);
ok('a coordinator is told too', (await one(`select count(*)::int as n from notifications where user_id = $1 and href = $2`, [U.coordinator, `/platform/support/${tid}`])).n === 1);
ok('finance is not told', (await one(`select count(*)::int as n from notifications where user_id = $1`, [U.finance])).n === 0);
ok('a short subject is refused', refused(await as(U.couple, `select rpc_open_support_ticket('payment', 'Hi', 'Where can we download the receipt?')`)));
ok('an unknown topic is refused', refused(await as(U.couple, `select rpc_open_support_ticket('gossip', 'A real subject', 'Some details that are long enough')`)));
ok('staff cannot open requests', refused(await as(U.support, `select rpc_open_support_ticket('other', 'A real subject', 'Some details that are long enough')`)));
ok('nobody inserts directly', refused(await as(U.couple, `insert into support_tickets (code, account_id, role, topic, subject) values ('X', '${U.couple}', 'customer', 'other', 'Direct insert')`)));
const fopen = await as(U.freelancer, `select rpc_open_support_ticket('account', 'Change my payout number', 'Please send my next payouts to my new eSewa number.', 'high') as id`);
ok('a freelancer opens one marked Soon', !refused(fopen) && (await one(`select role, priority from support_tickets where id = $1`, [fopen[0]?.id])).priority === 'high');

// ─── Who reads what ─────────────────────────────────────────────────────────────
ok('the couple reads only their own request', (await as(U.couple, `select count(*)::int as n from support_tickets`))[0]?.n === 1);
ok('another couple reads none', (await as(U.other, `select count(*)::int as n from support_tickets`))[0]?.n === 0);
ok('support staff read every request', (await as(U.support, `select count(*)::int as n from support_tickets`))[0]?.n === 2);
ok('finance staff read none', (await as(U.finance, `select count(*)::int as n from support_tickets`))[0]?.n === 0);

// ─── Answering ──────────────────────────────────────────────────────────────────
ok('support adds an internal note', !refused(await as(U.support, `select rpc_reply_support_ticket($1, 'Receipt is under Payments; check the Khalti reference.', true)`, [tid])));
ok('the couple never sees the internal note', (await as(U.couple, `select count(*)::int as n from support_messages where internal`))[0]?.n === 0 && (await as(U.couple, `select rpc_my_support_tickets() as l`))[0]?.l?.[0]?.messages.every((m) => !m.internal));
ok('support sees it', (await as(U.support, `select count(*)::int as n from support_messages where internal`))[0]?.n === 1);
ok('another couple cannot reply', refused(await as(U.other, `select rpc_reply_support_ticket($1, 'Not mine')`, [tid])));
ok('finance cannot reply', refused(await as(U.finance, `select rpc_reply_support_ticket($1, 'Hello')`, [tid])));
ok('support replies to the couple', !refused(await as(U.support, `select rpc_reply_support_ticket($1, 'Namaste! It is in My Wedding → Payments.')`, [tid])));
const answered = await one(`select status, assigned_to from support_tickets where id = $1`, [tid]);
ok('the request now waits on the couple and is assigned to whoever answered', answered.status === 'waiting' && answered.assigned_to === U.support, JSON.stringify(answered));
ok('the couple is told, with a link to their request', (await one(`select count(*)::int as n from notifications where user_id = $1 and href = $2`, [U.couple, `/support/${tid}`])).n === 1);
ok('a couple’s reply reopens it', !refused(await as(U.couple, `select rpc_reply_support_ticket($1, 'Found it, thank you!')`, [tid])) && (await one(`select status from support_tickets where id = $1`, [tid])).status === 'open');
ok('the assignee is told about the reply', (await one(`select count(*)::int as n from notifications where user_id = $1 and title like 'New message on%'`, [U.support])).n === 1);

// ─── Status, assignment and rating ──────────────────────────────────────────────
ok('a couple cannot set a staff-only status', refused(await as(U.couple, `select rpc_set_support_ticket_status($1, 'in_progress')`, [tid])));
ok('a couple cannot rate before it is solved', refused(await as(U.couple, `select rpc_rate_support_ticket($1, 5)`, [tid])));
ok('the couple marks it solved', !refused(await as(U.couple, `select rpc_set_support_ticket_status($1, 'resolved')`, [tid])) && (await one(`select status, resolved_at from support_tickets where id = $1`, [tid])).resolved_at);
ok('and rates it 5', !refused(await as(U.couple, `select rpc_rate_support_ticket($1, 5, 'Quick and clear')`, [tid])) && (await one(`select rating from support_tickets where id = $1`, [tid])).rating === 5);
ok('a rating outside 1–5 is refused', refused(await as(U.couple, `select rpc_rate_support_ticket($1, 9)`, [tid])));
ok('another couple cannot rate it', refused(await as(U.other, `select rpc_rate_support_ticket($1, 1)`, [tid])));
const fid = fopen[0]?.id;
ok('finance cannot assign', refused(await as(U.finance, `select rpc_assign_support_ticket($1, $2)`, [fid, U.finance])));
ok('a couple cannot be assigned', refused(await as(U.support, `select rpc_assign_support_ticket($1, $2)`, [fid, U.couple])));
ok('support gives it to the coordinator as urgent', !refused(await as(U.support, `select rpc_assign_support_ticket($1, $2, 'urgent')`, [fid, U.coordinator])));
const assigned = await one(`select assigned_to, priority, status from support_tickets where id = $1`, [fid]);
ok('it is assigned, urgent and in progress', assigned.assigned_to === U.coordinator && assigned.priority === 'urgent' && assigned.status === 'in_progress', JSON.stringify(assigned));
ok('the coordinator is told it is theirs', (await one(`select count(*)::int as n from notifications where user_id = $1 and title like '% is yours'`, [U.coordinator])).n === 1);
ok('staff close it and the freelancer is told', !refused(await as(U.coordinator, `select rpc_set_support_ticket_status($1, 'closed')`, [fid])) && (await one(`select count(*)::int as n from notifications where user_id = $1 and href = $2`, [U.freelancer, `/freelancer/support/${fid}`])).n === 1);
ok('a closed request takes no more replies from its owner', refused(await as(U.freelancer, `select rpc_reply_support_ticket($1, 'One more thing')`, [fid])));
ok('every step is audited', (await one(`select count(*)::int as n from audit_logs where entity = 'support_ticket'`)).n >= 8);

// ─── Limits ─────────────────────────────────────────────────────────────────────
for (let i = 0; i < 5; i++) await as(U.other, `select rpc_open_support_ticket('other', 'Question number ${i + 1}', 'Some details that are long enough to send.')`);
ok('five open requests is the limit for one person', refused(await as(U.other, `select rpc_open_support_ticket('other', 'Question number six', 'Some details that are long enough to send.')`)));

await db.close();
reported = true;
const failed = results.filter((r) => !r.pass);
results.forEach((r) => console.log(`${r.pass ? 'pass' : 'FAIL'}  ${r.name}${!r.pass && r.detail ? `  (${r.detail})` : ''}`));
console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);
if (failed.length) process.exit(1);
