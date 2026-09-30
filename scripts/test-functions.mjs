/**
 * Tests for the Edge Functions in supabase/functions, run in Node (24+ strips
 * the TypeScript). The shared modules are tested directly; each function's
 * handler is loaded with a stand-in for Deno (env + serve) and a fake fetch
 * that plays Supabase Auth, Upstash, Cloudinary, Expo and Resend. Nothing
 * leaves the machine.
 *
 *   npm run test:functions
 */
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'functions');
const load = (rel) => import(pathToFileURL(path.join(root, rel)).href);

const results = [];
const ok = (name, pass, detail = '') => results.push({ name, pass: !!pass, detail });

// ─── Shared modules ─────────────────────────────────────────────────────────────
const cloud = await load('_shared/cloudinary.ts');
const docString = 'eager=w_400,h_300,c_pad|w_260,h_200,c_crop&public_id=sample_image&timestamp=1315060510';
ok('Cloudinary: parameters are sorted into the string to sign', cloud.toSign({ timestamp: 1315060510, public_id: 'sample_image', eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop' }) === docString);
const sig = await cloud.sign({ timestamp: 1315060510, public_id: 'sample_image', eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop' }, 'abcd');
ok('Cloudinary: the signature is SHA-1 of the string plus the secret', sig === createHash('sha1').update(`${docString}abcd`).digest('hex'), sig);
ok('Cloudinary: matches the example in Cloudinary’s docs', sig === 'bfd09f95f331f558cbd1320e67aa8d488770583e', sig);
const params = cloud.uploadParams('portfolio', 'user-1', 1700000000);
ok('uploads are pinned to the owner’s folder and preset', params.folder === 'vivah/portfolio/user-1' && params.upload_preset === 'vivah_portfolio');
ok('unknown purposes are refused', !cloud.isPurpose('kyc') && cloud.isPurpose('avatar'));

const rl = await load('_shared/ratelimit.ts');
const store = new Map();
const fakeRedis = async (_url, init) => {
  const [[, key]] = JSON.parse(init.body);
  store.set(key, (store.get(key) ?? 0) + 1);
  return new Response(JSON.stringify([{ result: store.get(key) }, { result: 1 }]));
};
const redis = { url: 'https://redis.test', token: 't' };
const rule = { limit: 3, windowSeconds: 600 };
const verdicts = [];
for (let i = 0; i < 4; i++) verdicts.push(await rl.rateLimit(redis, 'otp:email:a@b.co', rule, 1_000_000_000, fakeRedis));
ok('rate limit: three allowed, the fourth refused', verdicts.slice(0, 3).every((v) => v.allowed) && !verdicts[3].allowed);
ok('rate limit: a new window starts fresh', (await rl.rateLimit(redis, 'otp:email:a@b.co', rule, 1_000_000_000 + 601_000, fakeRedis)).allowed);
ok('rate limit: without Upstash it allows and says so', (await rl.rateLimit(null, 'x', rule)).configured === false);
ok('rate limit: Upstash down fails open', (await rl.rateLimit(redis, 'x', rule, Date.now(), async () => new Response('boom', { status: 500 }))).allowed);

const fan = await load('_shared/fanout.ts');
const base = { id: 'n1', kind: 'payment', title: 'Payment received', body: 'NPR 42,375', href: '/my-wedding', email: 'a@b.co', name: 'Aakriti Shrestha', prefs: { push: true, email: true, muted: [] }, tokens: ['ExponentPushToken[aaa]', 'ExponentPushToken[aaa]', 'junk'] };
const p1 = fan.planFanout(base, 'https://vivah.com.np');
ok('fan-out: push to each valid token once, email for payments', p1.push.flat().length === 1 && p1.email?.to === 'a@b.co' && p1.email.html.includes('https://vivah.com.np/my-wedding'));
ok('fan-out: muted kinds send nothing', fan.planFanout({ ...base, prefs: { ...base.prefs, muted: ['payment'] } }, 'x').push.length === 0);
const em = fan.planFanout({ ...base, kind: 'emergency', prefs: { push: false, email: false, muted: ['emergency'] } }, 'x');
ok('fan-out: emergencies always ring, high priority', em.push.flat()[0]?.priority === 'high' && !!em.email);
ok('fan-out: chat stays off email', fan.planFanout({ ...base, kind: 'chat' }, 'x').email === null);
ok('fan-out: email is escaped', fan.planFanout({ ...base, title: '<script>x</script>' }, 'x').email.html.includes('&lt;script&gt;'));
const many = fan.planFanout({ ...base, tokens: Array.from({ length: 250 }, (_, i) => `ExponentPushToken[t${i}]`) }, 'x');
ok('fan-out: push goes in batches of 100', many.push.length === 3 && many.push[2].length === 50);

// ─── Handlers, with a stand-in Deno and a fake network ─────────────────────────
const env = {
  SUPABASE_URL: 'https://proj.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  CLOUDINARY_CLOUD_NAME: 'vivah',
  CLOUDINARY_API_KEY: '1234',
  CLOUDINARY_API_SECRET: 'secret',
  NOTIFY_WEBHOOK_SECRET: 'hook-secret',
  RESEND_API_KEY: 're_key',
  APP_URL: 'https://vivah.com.np',
};
let handler = null;
globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { handler = h; } };
const calls = [];
let authUser = 'user-7';
globalThis.fetch = async (url, init = {}) => {
  calls.push({ url: String(url), init });
  const u = String(url);
  if (u.endsWith('/auth/v1/otp')) return new Response('{}', { status: 200 });
  if (u.endsWith('/auth/v1/user')) return authUser ? new Response(JSON.stringify({ id: authUser })) : new Response('{}', { status: 401 });
  if (u.endsWith('/rest/v1/rpc/vivah_fanout_targets')) return new Response(JSON.stringify({ ...base, tokens: ['ExponentPushToken[aaa]'] }));
  if (u.startsWith('https://exp.host')) return new Response('{"data":[]}');
  if (u.startsWith('https://api.resend.com')) return new Response('{"id":"e1"}');
  return new Response('not found', { status: 404 });
};
const post = (body, headers = {}) => new Request('https://fn.test', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

await load('send-otp/index.ts');
const sendOtp = handler;
ok('send-otp: refuses a bad email', (await sendOtp(post({ email: 'not-an-email' }))).status === 400);
calls.length = 0;
const sent = await sendOtp(post({ email: ' Aakriti@Example.com ' }));
const otpCall = calls.find((c) => c.url.endsWith('/auth/v1/otp'));
ok('send-otp: asks Supabase Auth to email a code, lower-cased', sent.status === 200 && JSON.parse(otpCall.init.body).email === 'aakriti@example.com' && JSON.parse(otpCall.init.body).create_user === true);
ok('send-otp: answers CORS preflight', (await sendOtp(new Request('https://fn.test', { method: 'OPTIONS' }))).status === 200);

await load('media-sign/index.ts');
const mediaSign = handler;
authUser = null;
ok('media-sign: signed-out callers are refused', (await mediaSign(post({ purpose: 'portfolio' }, { Authorization: 'Bearer bad' }))).status === 401);
authUser = 'user-7';
ok('media-sign: unknown purposes are refused', (await mediaSign(post({ purpose: 'kyc' }, { Authorization: 'Bearer good' }))).status === 400);
const signed = await (await mediaSign(post({ purpose: 'portfolio' }, { Authorization: 'Bearer good' }))).json();
const expected = createHash('sha1').update(`allowed_formats=${signed.allowedFormats}&folder=vivah/portfolio/user-7&timestamp=${signed.timestamp}&upload_preset=vivah_portfolio${env.CLOUDINARY_API_SECRET}`).digest('hex');
ok('media-sign: a valid signature for the caller’s folder, no secret returned', signed.folder === 'vivah/portfolio/user-7' && signed.signature === expected && !JSON.stringify(signed).includes('secret'), JSON.stringify(signed));

await load('notify-fanout/index.ts');
const fanout = handler;
ok('notify-fanout: refuses a wrong webhook secret', (await fanout(post({ notification_id: '00000000-0000-4000-8000-000000000001' }, { 'x-webhook-secret': 'nope' }))).status === 403);
calls.length = 0;
const out = await (await fanout(post({ notification_id: '00000000-0000-4000-8000-000000000001' }, { 'x-webhook-secret': 'hook-secret' }))).json();
ok('notify-fanout: sends one push and one email', out.push === 1 && out.email === true && calls.some((c) => c.url.startsWith('https://exp.host')) && calls.some((c) => c.url.startsWith('https://api.resend.com')), JSON.stringify(out));
const rpcCall = calls.find((c) => c.url.includes('vivah_fanout_targets'));
ok('notify-fanout: reads targets with the service role', rpcCall?.init.headers.Authorization === 'Bearer service');

const failed = results.filter((r) => !r.pass);
results.forEach((r) => console.log(`${r.pass ? 'pass' : 'FAIL'}  ${r.name}${!r.pass && r.detail ? `  (${r.detail})` : ''}`));
console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);
if (failed.length) process.exit(1);
