/**
 * Social hub checks on a real Postgres with RLS on (PGlite, in-process):
 * connecting a network (service role only, one business per network
 * account), tokens nobody but the service can read, webhook messages stored
 * once however often a network retries, receipts that only move forward,
 * triage limited to the triage columns, notes but no forged replies, drafts
 * that can't be marked published by a client, scheduling, the scheduled run,
 * the post status following its networks, and "create lead".
 *
 *   npm run db:test   (runs this after launch.mjs)
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
  owner: '40000000-0000-4000-8000-000000000001',
  staff: '40000000-0000-4000-8000-000000000002',
  other: '40000000-0000-4000-8000-000000000003',
  service: '40000000-0000-4000-8000-0000000000ff',
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
const service = (sql, params = []) => as(U.service, sql, params, 'service_role');
const refused = (r) => r && !Array.isArray(r) && typeof r.error === 'string';
const one = async (sql, params) => (await db.query(sql, params)).rows[0];

await db.exec(`
insert into cities (id, name, province, grp) values ('kathmandu', 'Kathmandu', 'Bagmati', 'VALLEY') on conflict do nothing;
insert into auth.users (id, email) values ('${U.owner}', 'owner@example.com'), ('${U.staff}', 'staff@example.com'), ('${U.other}', 'other@example.com');
`);
ok('the owner signs up a business', !refused(await as(U.owner, `select rpc_complete_signup('vendor', $1::jsonb)`, [JSON.stringify({ name: 'Rajesh Pradhan', businessName: 'Everest Grand', primaryService: 'venue', services: ['venue', 'catering'] })])));
ok('another business signs up', !refused(await as(U.other, `select rpc_complete_signup('vendor', $1::jsonb)`, [JSON.stringify({ name: 'Sunita Maharjan', businessName: 'Phoolbari Decor', primaryService: 'decoration', services: ['decoration'] })])));
const org = (await one(`select org_id from organization_members where user_id = $1`, [U.owner])).org_id;
await db.exec(`
insert into profiles (id, full_name) values ('${U.staff}', 'Hari Staff') on conflict (id) do nothing;
insert into organization_members (org_id, user_id, member_role) values ('${org}', '${U.staff}', 'STAFF');
`);

// ─── Connecting ────────────────────────────────────────────────────────────────
const save = (user, network, external, handle) =>
  service(`select vivah_social_save_account($1, $2, $3, $4, $4, 1200, array['pages_messaging'], 'tok-${network}', null, now() + interval '60 days', '{"pageToken":"pt"}'::jsonb) as id`, [user, network, external, handle]);
ok('a member cannot call the connect helper themselves', refused(await as(U.owner, `select vivah_social_save_account($1, 'facebook', 'p1', 'x', 'x', 0, '{}', 't')`, [U.owner])));
const fb = await save(U.owner, 'facebook', 'page-1', 'Everest Grand');
ok('the service connects the owner’s Facebook page', !refused(fb) && fb[0]?.id, fb.error);
const wa = await save(U.owner, 'whatsapp', 'phone-1', '+977 9801234567');
ok('and the WhatsApp number', !refused(wa), wa.error);
ok('staff cannot connect a network', refused(await save(U.staff, 'instagram', 'ig-1', '@everest')));
ok('the same page cannot be connected to a second business', refused(await save(U.other, 'facebook', 'page-1', 'Everest Grand')));
const again = await save(U.owner, 'facebook', 'page-1', 'Everest Grand Party Palace');
ok('connecting again renews the same account', !refused(again) && again[0]?.id === fb[0]?.id);
ok('members see their accounts', (await as(U.staff, `select * from social_accounts`)).length === 2);
ok('other businesses see none', (await as(U.other, `select * from social_accounts`)).length === 0);
ok('nobody but the service reads tokens', (await as(U.owner, `select * from social_account_secrets`)).length === 0 || refused(await as(U.owner, `select * from social_account_secrets`)));
ok('members cannot edit an account row', refused(await as(U.owner, `update social_accounts set external_id = 'hijack'`)) || (await one(`select count(*)::int as n from social_accounts where external_id = 'hijack'`)).n === 0);

// ─── Webhook ───────────────────────────────────────────────────────────────────
const events = [
  { type: 'message', network: 'facebook', account: 'page-1', id: 'm_1', contact: 'psid-1', contactName: 'Rohan Shrestha', text: 'Rate kati ho per plate?', at: new Date(Date.now() - 3_600_000).toISOString() },
  { type: 'message', network: 'whatsapp', account: 'phone-1', id: 'wamid.1', contact: '9779841556677', contactName: 'Nirmala Joshi', contactPhone: '9841556677', text: 'Garden for haldi?' },
  { type: 'comment', network: 'facebook', account: 'page-1', id: 'c_1', commentId: 'c_1', contact: 'u-9', contactName: 'Sabina Lama', postId: 'post-77', postCaption: 'Mandap lighting', text: 'Available in Poush?' },
  { type: 'message', network: 'facebook', account: 'unknown-page', id: 'm_x', contact: 'psid-x', text: 'Lost' },
];
const n1 = await service(`select vivah_social_ingest($1::jsonb) as n`, [JSON.stringify(events)]);
ok('three messages stored, the unknown page ignored', n1[0]?.n === 3, JSON.stringify(n1));
const n2 = await service(`select vivah_social_ingest($1::jsonb) as n`, [JSON.stringify(events)]);
ok('a webhook retry stores nothing twice', n2[0]?.n === 0 && (await one(`select count(*)::int as n from social_messages`)).n === 3);
await service(`select vivah_social_ingest($1::jsonb)`, [JSON.stringify([{ type: 'message', network: 'facebook', account: 'page-1', id: 'm_2', contact: 'psid-1', contactName: 'Rohan Shrestha', text: '500 guests on Falgun 5' }])]);
const rohan = await one(`select * from social_threads where contact_external_id = 'psid-1'`);
ok('a second message joins the same thread and counts as unread', rohan.unread === 2 && rohan.status === 'open');
ok('owners and managers are told', (await one(`select count(*)::int as n from notifications where user_id = $1 and kind = 'message'`, [U.owner])).n === 4);
ok('the inbox is private to the business', (await as(U.other, `select * from social_threads`)).length === 0 && (await as(U.staff, `select * from social_threads`)).length === 3);
ok('only the service can ingest', refused(await as(U.owner, `select vivah_social_ingest('[]'::jsonb)`)));

// ─── Triage and notes ──────────────────────────────────────────────────────────
ok('staff can triage: done, star, labels', !refused(await as(U.staff, `update social_threads set status = 'done', starred = true, labels = array['Price asked'], unread = 0 where id = $1`, [rohan.id])) && (await one(`select status, starred from social_threads where id = $1`, [rohan.id])).starred === true);
ok('but cannot rewrite who wrote', refused(await as(U.staff, `update social_threads set contact_name = 'Someone else' where id = $1`, [rohan.id])));
ok('staff add an internal note', !refused(await as(U.staff, `insert into social_messages (thread_id, org_id, direction, body, author_id) values ($1, $2, 'note', 'Call him after 5', $3)`, [rohan.id, org, U.staff])));
ok('a reply cannot be forged from the app', refused(await as(U.staff, `insert into social_messages (thread_id, org_id, direction, body, author_id) values ($1, $2, 'out', 'fake', $3)`, [rohan.id, org, U.staff])));
ok('another business cannot add notes', refused(await as(U.other, `insert into social_messages (thread_id, org_id, direction, body, author_id) values ($1, $2, 'note', 'x', $3)`, [rohan.id, org, U.other])));

// ─── Replies (social-send) ────────────────────────────────────────────────────
const ctx = await service(`select vivah_social_send_context($1, $2) as c`, [U.staff, rohan.id]);
ok('the send context carries the page, token and customer', ctx[0]?.c?.token === 'tok-facebook' && ctx[0]?.c?.contact === 'psid-1' && ctx[0]?.c?.accountExternalId === 'page-1');
ok('no context for someone outside the business', (await service(`select vivah_social_send_context($1, $2) as c`, [U.other, rohan.id]))[0]?.c === null);
await service(`select vivah_social_record_out($1, $2, 'Namaste! NPR 1,250 per plate.', 'm_out_1')`, [U.staff, rohan.id]);
const after = await one(`select * from social_threads where id = $1`, [rohan.id]);
ok('a reply clears unread, waits on the customer and times the first response', after.unread === 0 && after.status === 'pending' && after.first_response_mins >= 1);
await service(`select vivah_social_ingest($1::jsonb)`, [JSON.stringify([{ type: 'status', id: 'm_out_1', status: 'read' }, { type: 'status', id: 'm_out_1', status: 'delivered' }])]);
ok('receipts only move forward (read stays read)', (await one(`select status from social_messages where external_id = 'm_out_1'`)).status === 'read');

// ─── Posts ─────────────────────────────────────────────────────────────────────
const draft = await as(U.staff, `insert into social_posts (org_id, caption, networks, created_by) values ($1, 'Mangsir dates open', array['facebook', 'whatsapp'], $2) returning id`, [org, U.staff]);
ok('members write drafts', !refused(draft), draft.error);
const postId = draft[0]?.id;
ok('a client cannot add a post as published', refused(await as(U.staff, `insert into social_posts (org_id, caption, networks, status, created_by) values ($1, 'x', array['facebook'], 'published', $2)`, [org, U.staff])));
ok('or mark a draft published', refused(await as(U.staff, `update social_posts set status = 'published' where id = $1`, [postId])) || (await one(`select status from social_posts where id = $1`, [postId])).status === 'draft');
ok('unknown networks are refused', refused(await as(U.staff, `insert into social_posts (org_id, caption, networks, created_by) values ($1, 'x', array['myspace'], $2)`, [org, U.staff])));
ok('a network that is not connected cannot be scheduled', refused(await as(U.staff, `insert into social_posts (org_id, caption, networks, created_by) values ($1, 'x', array['tiktok'], $2) returning id`, [org, U.staff]).then((r) => as(U.staff, `select rpc_social_schedule($1, now() + interval '1 day')`, [r[0].id]))));
ok('a time in the past cannot be scheduled', refused(await as(U.staff, `select rpc_social_schedule($1, now() - interval '1 hour')`, [postId])));
ok('another business cannot schedule it', refused(await as(U.other, `select rpc_social_schedule($1, now() + interval '1 day')`, [postId])));
ok('members schedule a draft', !refused(await as(U.staff, `select rpc_social_schedule($1, now() + interval '2 hours')`, [postId])) && (await one(`select count(*)::int as n from social_post_targets where post_id = $1 and status = 'queued'`, [postId])).n === 2);

await db.query(`update social_posts set scheduled_at = now() - interval '1 minute' where id = $1`, [postId]);
await db.query(`update social_threads set status = 'pending', snoozed_until = now() - interval '1 minute' where contact_external_id = '9779841556677'`);
const claimed = await service(`select vivah_social_claim_due(10) as ids`);
ok('the scheduled run claims the due post once', claimed[0]?.ids?.length === 1 && (await service(`select vivah_social_claim_due(10) as ids`))[0]?.ids?.length === 0);
ok('and wakes snoozed threads', (await one(`select status from social_threads where contact_external_id = '9779841556677'`)).status === 'open');
const ctxPost = await service(`select vivah_social_publish_context($1) as c`, [postId]);
ok('the publish context has each network’s token', ctxPost[0]?.c?.targets?.length === 2 && ctxPost[0].c.targets.every((t) => t.token));
const s1 = await service(`select vivah_social_target_result($1, 'facebook', 'published', 'fb_post_1', 'https://facebook.com/p/1') as s`, [postId]);
ok('the post stays publishing until every network answers', s1[0]?.s === 'publishing');
const s2 = await service(`select vivah_social_target_result($1, 'whatsapp', 'failed', null, null, 'Template not approved') as s`, [postId]);
ok('one published and one failed makes it partly published', s2[0]?.s === 'partial' && (await one(`select published_at from social_posts where id = $1`, [postId])).published_at);
ok('members see how each network took it', (await as(U.staff, `select * from social_post_targets where post_id = $1`, [postId])).length === 2 && (await as(U.other, `select * from social_post_targets`)).length === 0);
ok('a published post can’t be edited from the app', refused(await as(U.staff, `update social_posts set caption = 'changed' where id = $1`, [postId])) || (await one(`select caption from social_posts where id = $1`, [postId])).caption === 'Mangsir dates open');

// ─── Leads ─────────────────────────────────────────────────────────────────────
const lead = await as(U.staff, `select rpc_social_lead($1, (current_date + 120), 500, array['Wedding', 'Reception'], 550000, '9851098765') as id`, [rohan.id]);
ok('a conversation becomes a lead for the listing', !refused(lead) && lead[0]?.id, lead.error);
const row = await one(`select l.source::text as source, l.payload, p.org_id from leads l join providers p on p.id = l.provider_id where l.id = $1`, [lead[0]?.id]);
ok('with source social and what the customer said', row?.source === 'SOCIAL' && row.org_id === org && row.payload.guests === 500 && row.payload.customerName === 'Rohan Shrestha');
ok('only once per conversation', refused(await as(U.staff, `select rpc_social_lead($1, current_date + 120, 500, array['Wedding'])`, [rohan.id])));
ok('not by another business', refused(await as(U.other, `select rpc_social_lead($1, current_date + 120, 500, array['Wedding'])`, [(await one(`select id from social_threads where contact_external_id = '9779841556677'`)).id])));

// ─── The app's RPCs ────────────────────────────────────────────────────────────
const inbox = await as(U.staff, `select rpc_social_inbox() as d`);
const d = inbox[0]?.d;
ok('the inbox RPC returns the business’s accounts, threads, messages and posts', d?.accounts?.length === 2 && d.threads.length === 3 && d.messages.length >= 5 && d.posts.some((p) => p.targets.length === 2), inbox.error);
ok('without the tokens', !JSON.stringify(d).includes('tok-facebook'));
ok('another business gets only its own (empty) hub', (await as(U.other, `select rpc_social_inbox() as d`))[0]?.d?.threads?.length === 0);
ok('a signed-out caller gets nothing', refused(await as(U.service, `select rpc_social_inbox()`, [], 'anon')));
const saved = await as(U.staff, `select rpc_social_save_post($1::jsonb) as id`, [JSON.stringify({ caption: 'Poush offer', networks: ['facebook'], media: [], firstComment: '#NepaliWedding' })]);
ok('the composer saves a draft through the RPC', !refused(saved) && (await one(`select status, first_comment from social_posts where id = $1`, [saved[0]?.id])).first_comment === '#NepaliWedding', saved.error);
ok('and updates it by id', !refused(await as(U.staff, `select rpc_social_save_post($1::jsonb)`, [JSON.stringify({ id: saved[0]?.id, caption: 'Poush offer, 10% off', networks: ['facebook', 'whatsapp'] })])) && (await one(`select caption from social_posts where id = $1`, [saved[0]?.id])).caption === 'Poush offer, 10% off');
ok('but not a published one', refused(await as(U.staff, `select rpc_social_save_post($1::jsonb)`, [JSON.stringify({ id: postId, caption: 'x', networks: ['facebook'] })])));
const sabina = (await one(`select id from social_threads where contact_external_id = 'u-9'`)).id;
ok('triage through the RPC: snooze and labels', !refused(await as(U.staff, `select rpc_social_triage($1, $2::jsonb)`, [sabina, JSON.stringify({ status: 'pending', snoozedUntil: new Date(Date.now() + 3_600_000).toISOString(), labels: ['Date check'], read: true })])) && (await one(`select status, unread, labels from social_threads where id = $1`, [sabina])).unread === 0);
ok('not on another business’s thread', refused(await as(U.other, `select rpc_social_triage($1, '{"status":"done"}'::jsonb)`, [sabina])));
ok('notes through the RPC', !refused(await as(U.staff, `select rpc_social_note($1, 'Send the Poush menu')`, [sabina])));
ok('staff cannot change the automation', refused(await as(U.staff, `select rpc_social_save_settings('{"savedReplies":[]}'::jsonb)`)));
ok('the owner can', !refused(await as(U.owner, `select rpc_social_save_settings($1::jsonb)`, [JSON.stringify({ savedReplies: [{ id: 'sr', title: 'Price', text: 'From NPR 1,250' }], rules: [], away: { active: true, from: '21:00', to: '08:00', text: 'Away' }, signature: '— Rajesh' })])) && (await as(U.staff, `select rpc_social_inbox() as d`))[0]?.d?.settings?.signature === '— Rajesh');
await service(`select vivah_social_target_result($1, 'facebook', 'publishing', 'tt_pub_1') as s`, [saved[0]?.id]);
ok('a network’s later answer (TikTok-style publish id) settles the target', (await service(`select vivah_social_publish_update('facebook', 'tt_pub_1', 'published', 'https://x/1') as s`))[0]?.s === 'published');

// ─── 0020: assignment, WhatsApp consent, insights ─────────────────────────────
const nirmala = (await one(`select id from social_threads where contact_external_id = '9779841556677'`)).id;
ok('triage assigns a team member by name', !refused(await as(U.staff, `select rpc_social_triage($1, '{"assignee":"Hari Staff"}'::jsonb)`, [nirmala])) && (await one(`select assignee_name from social_threads where id = $1`, [nirmala])).assignee_name === 'Hari Staff');
const waFollowers = async () => (await one(`select followers from social_accounts where network = 'whatsapp' and status <> 'disconnected'`)).followers;
await service(`select vivah_social_ingest($1::jsonb)`, [JSON.stringify([{ type: 'message', network: 'whatsapp', account: 'phone-1', id: 'wamid.start', contact: '9779841556677', contactName: 'Nirmala Joshi', text: 'START' }])]);
ok('a customer who writes START joins the broadcast list', (await service(`select vivah_social_broadcast_list($1) as l`, [org]))[0]?.l?.join() === '9779841556677');
ok('and the WhatsApp audience counts them', (await waFollowers()) === 1);
ok('the inbox shows who agreed and who handles it', (await as(U.staff, `select rpc_social_inbox() as d`))[0]?.d?.threads?.some((t) => t.id === nirmala && t.opted_in === true && t.assignee_name === 'Hari Staff'));
await service(`select vivah_social_ingest($1::jsonb)`, [JSON.stringify([{ type: 'message', network: 'whatsapp', account: 'phone-1', id: 'wamid.stop', contact: '9779841556677', contactName: 'Nirmala Joshi', text: 'Stop.' }])]);
ok('STOP takes them off at once', (await service(`select vivah_social_broadcast_list($1) as l`, [org]))[0]?.l?.length === 0 && (await waFollowers()) === 0);
ok('a member records consent given in person', !refused(await as(U.staff, `select rpc_social_optin($1, true)`, [nirmala])) && (await waFollowers()) === 1);
ok('consent is only for WhatsApp customers', refused(await as(U.staff, `select rpc_social_optin($1, true)`, [rohan.id])));
ok('another business cannot record consent', refused(await as(U.other, `select rpc_social_optin($1, true)`, [nirmala])));
ok('the app cannot edit the broadcast list directly', refused(await as(U.staff, `insert into social_contacts (org_id, external_id, opted_in_at) values ($1, '977000', now())`, [org])) || (await one(`select count(*)::int as n from social_contacts where external_id = '977000'`)).n === 0);

await db.exec(`set session_replication_role = replica; update social_post_targets set published_at = now() - interval '2 days', updated_at = now() - interval '6 hours' where network = 'facebook' and external_id = 'fb_post_1'; set session_replication_role = origin;`);
const metricTargets = (await service(`select vivah_social_metric_targets(10) as t`))[0]?.t ?? [];
ok('insights: published posts whose numbers are old are read back, with the page token', metricTargets.length === 1 && metricTargets[0].externalId === 'fb_post_1' && metricTargets[0].token === 'tok-facebook', JSON.stringify(metricTargets));
await service(`select vivah_social_record_metrics($1, 'facebook', 1200, 80, 9, 4, null)`, [postId]);
const fbTarget = await one(`select reach, likes, comments, shares, saves from social_post_targets where post_id = $1 and network = 'facebook'`, [postId]);
ok('insights: the numbers are stored and not read again for five hours', fbTarget.reach === 1200 && fbTarget.likes === 80 && fbTarget.saves === null && (await service(`select vivah_social_metric_targets(10) as t`))[0]?.t?.length === 0);
ok('insights: only the service reads tokens for them', refused(await as(U.owner, `select vivah_social_metric_targets(10)`)));

// ─── Disconnect ────────────────────────────────────────────────────────────────
const waId = (await one(`select id from social_accounts where network = 'whatsapp'`)).id;
ok('staff cannot disconnect', refused(await as(U.staff, `select rpc_social_disconnect($1)`, [waId])));
ok('the owner disconnects; the token is deleted, messages stay', !refused(await as(U.owner, `select rpc_social_disconnect($1)`, [waId])) && (await one(`select count(*)::int as n from social_account_secrets where account_id = $1`, [waId])).n === 0 && (await one(`select count(*)::int as n from social_threads where account_id = $1`, [waId])).n === 1);
ok('a disconnected number receives nothing', (await service(`select vivah_social_ingest($1::jsonb) as n`, [JSON.stringify([{ type: 'message', network: 'whatsapp', account: 'phone-1', id: 'wamid.9', contact: '977980', text: 'hello?' }])]))[0]?.n === 0);
ok('every step is audited', (await one(`select count(*)::int as n from audit_logs where action like 'social.%'`)).n >= 5);

await db.close();
reported = true;
const failed = results.filter((r) => !r.pass);
results.forEach((r) => console.log(`${r.pass ? 'pass' : 'FAIL'}  ${r.name}${!r.pass && r.detail ? `  (${r.detail})` : ''}`));
console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);
if (failed.length) process.exit(1);
