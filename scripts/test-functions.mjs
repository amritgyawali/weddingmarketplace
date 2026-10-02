/**
 * Tests for the Edge Functions in supabase/functions, run in Node (24+ strips
 * the TypeScript). The shared modules are tested directly; each function's
 * handler is loaded with a stand-in for Deno (env + serve) and a fake fetch
 * that plays Supabase Auth, Upstash, Cloudinary, Expo and Resend. Nothing
 * leaves the machine.
 *
 *   npm run test:functions
 */
import { createHash, createHmac } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'functions');
const load = (rel) => import(pathToFileURL(path.join(root, rel)).href);
const createHmacB64 = (message, secret) => createHmac('sha256', secret).update(message).digest('base64');

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

// ─── Payments (P7): shared logic ────────────────────────────────────────────────
const pay = await load('_shared/payments.ts');
ok('eSewa amounts: whole rupees without decimals, half rupees kept', pay.rupeesString(4237500) === '42375' && pay.rupeesString(4237550) === '42375.5' && pay.toPaisa('42375.5') === 4237550);
// This exact form was accepted by eSewa's sandbox on 30 Sep 2026 (a message without the names was refused, ES104).
const esewaSig = await pay.hmacBase64(pay.esewaMessage({ total_amount: '100', transaction_uuid: '241028', product_code: 'EPAYTEST' }, 'total_amount,transaction_uuid,product_code'), '8gBm/:&EnhH.1/q');
ok('eSewa: HMAC-SHA256 over name=value pairs, base64', esewaSig === '1j74hEfOHLbqKdoVCXI3HHcClC0F3NwGLzoJjpItIuA=', esewaSig);
const cbFields = { transaction_code: '000AWEO', status: 'COMPLETE', total_amount: '42375', transaction_uuid: 'WP-1051-1', product_code: 'EPAYTEST', signed_field_names: 'transaction_code,status,total_amount,transaction_uuid,product_code,signed_field_names' };
const cbSigned = { ...cbFields, signature: await pay.hmacBase64(pay.esewaMessage(cbFields, cbFields.signed_field_names), '8gBm/:&EnhH.1/q') };
const cbData = Buffer.from(JSON.stringify(cbSigned)).toString('base64');
ok('eSewa: a signed callback decodes and verifies', (await pay.esewaDecode(cbData, '8gBm/:&EnhH.1/q'))?.valid === true);
const forged = Buffer.from(JSON.stringify({ ...cbSigned, total_amount: '10' })).toString('base64');
ok('eSewa: a tampered callback fails the signature', (await pay.esewaDecode(forged, '8gBm/:&EnhH.1/q'))?.valid === false);
ok('eSewa: garbage data is ignored', (await pay.esewaDecode('%%%', 'k')) === null);
ok('Khalti: only Completed is money', pay.khaltiOutcome('Completed') === 'COMPLETED' && pay.khaltiOutcome('Initiated') === 'PENDING' && pay.khaltiOutcome('User canceled') === 'CANCELLED' && pay.khaltiOutcome('Refunded') === 'FAILED' && pay.khaltiOutcome(undefined) === 'FAILED');
ok('eSewa: only COMPLETE is money; NOT_FOUND waits until the attempt expires', pay.esewaOutcome('COMPLETE', false) === 'COMPLETED' && pay.esewaOutcome('NOT_FOUND', false) === 'PENDING' && pay.esewaOutcome('NOT_FOUND', true) === 'EXPIRED' && pay.esewaOutcome('FULL_REFUND', false) === 'FAILED');
const app = 'https://vivah.com.np';
ok('return address: the app, Expo Go and our web are allowed', ['vivah://pay/result', 'exp://192.168.1.5:8081/--/pay/result', 'https://vivah.com.np/pay/result', 'http://localhost:8081/pay/result'].every((u) => pay.safeReturnTo(u, app) === u));
ok('return address: other sites and schemes are not (no open redirect)', ['https://evil.com/x', 'http://vivah.com.np/x', 'javascript:alert(1)', 'https://vivah.com.np.evil.com/', 42].every((u) => pay.safeReturnTo(u, app) === null));
ok('return address: extra hosts from PAYMENT_RETURN_HOSTS', pay.safeReturnTo('https://vivah-git-p7.vercel.app/pay/result', app, ['vivah-git-p7.vercel.app']) !== null);
ok('result is added to the return address', pay.withResult('vivah://pay/result', { intent: 'i', status: 'completed', receipt: undefined }) === 'vivah://pay/result?intent=i&status=completed' && pay.withResult('https://a.b/r?x=1#h', { s: '1' }) === 'https://a.b/r?x=1&s=1#h');
const INTENT = '11111111-2222-4333-8444-555555555555';
ok('verify path: gateway, intent and failure', JSON.stringify(pay.parseVerifyPath(`/functions/v1/payment-verify/esewa/${INTENT}/failure`)) === JSON.stringify({ gateway: 'esewa', intent: INTENT, failure: true }) && pay.parseVerifyPath('/payment-verify/paypal/x') === null);
ok('eSewa data is found even after a second ?', pay.esewaDataParam(`https://f.co/payment-verify/esewa/${INTENT}?a=1?data=abc%3D`) === 'abc=');
const kb = pay.khaltiInitiateBody({ intent: INTENT, orderRef: 'WP-1051-1', amount: 4237500, label: 'Booking advance · WP-1051', customer: { name: 'Aakriti', email: 'a@b.co', phone: '+977-9800000001' } }, 'https://r', 'https://w');
ok('Khalti body: paisa, order id, a clean Nepali mobile', kb.amount === 4237500 && kb.purchase_order_id === 'WP-1051-1' && kb.customer_info.phone === '9800000001');
ok('Khalti body: a bad phone is left out rather than failing the payment', pay.khaltiInitiateBody({ intent: INTENT, orderRef: 'o', amount: 1000, label: 'x', customer: { phone: '12345' } }, 'r', 'w').customer_info === undefined);

// ─── Payments (P7): handlers ─────────────────────────────────────────────────────
Object.assign(env, { KHALTI_SECRET_KEY: 'test_secret_key_x', KHALTI_BASE_URL: 'https://dev.khalti.com/api/v2' });
const payNet = { khaltiLookup: { status: 'Completed', total_amount: 4237500, transaction_id: 'KTXN1', pidx: 'PIDX-1' }, khaltiLookupStatus: 200, esewa: { product_code: 'EPAYTEST', transaction_uuid: 'WP-1051-1', total_amount: 42375.0, status: 'COMPLETE', ref_id: 'ESW-REF-9' }, gatewayDown: false };
let stored = { id: INTENT, method: 'KHALTI', amount: 4237500, orderRef: 'WP-1051-1', gatewayRef: 'PIDX-1', returnTo: 'vivah://pay/result', status: 'INITIATED', receiptNo: null, expiresAt: new Date(Date.now() + 3600e3).toISOString() };
const settleCalls = [];
const baseFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const args = init.body && typeof init.body === 'string' && init.body.startsWith('{') ? JSON.parse(init.body) : {};
  if (u.endsWith('/rest/v1/rpc/rpc_begin_payment')) {
    calls.push({ url: u, init });
    return new Response(JSON.stringify({ intent: INTENT, orderRef: 'WP-1051-1', amount: args.p_amount ?? 4237500, label: 'Booking advance · WP-1051', customer: { name: 'Aakriti Shrestha', email: 'aakriti@example.com', phone: '9800000001' } }));
  }
  if (u.endsWith('/rest/v1/rpc/rpc_payment_attach')) { calls.push({ url: u, init }); return new Response('', { status: 200 }); }
  if (u.endsWith('/rest/v1/rpc/vivah_payment_intent')) return new Response(JSON.stringify(stored));
  if (u.endsWith('/rest/v1/rpc/rpc_payment_status')) return new Response(authUser === 'user-7' ? JSON.stringify({ status: stored.status }) : 'null');
  if (u.endsWith('/rest/v1/rpc/rpc_settle_payment')) {
    settleCalls.push(args);
    const done = args.p_outcome === 'COMPLETED';
    return new Response(JSON.stringify({ status: done ? 'COMPLETED' : args.p_outcome, receiptNo: done ? 'RCPT-2026-0042' : null, amount: stored.amount }));
  }
  if (u.startsWith('https://dev.khalti.com/api/v2/epayment/initiate/')) { calls.push({ url: u, init }); return new Response(JSON.stringify({ pidx: 'PIDX-1', payment_url: 'https://test-pay.khalti.com/?pidx=PIDX-1', expires_in: 1800 })); }
  if (u.startsWith('https://dev.khalti.com/api/v2/epayment/lookup/')) {
    calls.push({ url: u, init });
    if (payNet.gatewayDown) throw new Error('down');
    return new Response(JSON.stringify(payNet.khaltiLookup), { status: payNet.khaltiLookupStatus });
  }
  if (u.startsWith('https://rc.esewa.com.np/api/epay/transaction/status/')) { calls.push({ url: u, init }); return new Response(JSON.stringify(payNet.esewa)); }
  return baseFetch(url, init);
};

await load('payment-initiate/index.ts');
const initiate = handler;
const bearer = { Authorization: 'Bearer user-jwt' };
authUser = null;
ok('payment-initiate: signed-out callers are refused', (await initiate(post({ milestoneId: INTENT, method: 'khalti' }, { Authorization: 'Bearer bad' }))).status === 401);
authUser = 'user-7';
ok('payment-initiate: only khalti and esewa', (await initiate(post({ milestoneId: INTENT, method: 'paypal' }, bearer))).status === 400);
calls.length = 0;
const kOut = await (await initiate(post({ milestoneId: INTENT, method: 'khalti', amount: 1500.5, returnTo: 'https://evil.com/steal' }, bearer))).json();
const beginCall = calls.find((c) => c.url.endsWith('rpc_begin_payment'));
const beginArgs = JSON.parse(beginCall.init.body);
ok('payment-initiate: the intent is made as the couple (their JWT), amount in paisa', beginCall.init.headers.Authorization === 'Bearer user-jwt' && beginArgs.p_amount === 150050 && beginArgs.p_method === 'KHALTI');
ok('payment-initiate: a foreign return address is replaced by our result page', beginArgs.p_return_to === 'https://vivah.com.np/pay/result');
const kInit = JSON.parse(calls.find((c) => c.url.includes('/epayment/initiate/')).init.body);
ok('payment-initiate: Khalti returns to payment-verify, not to the app', kInit.return_url === `https://proj.supabase.co/functions/v1/payment-verify/khalti/${INTENT}` && calls.find((c) => c.url.includes('/epayment/initiate/')).init.headers.Authorization === 'Key test_secret_key_x');
ok('payment-initiate: the pidx is kept with the service role; the app gets Khalti’s page', kOut.url === 'https://test-pay.khalti.com/?pidx=PIDX-1' && JSON.parse(calls.find((c) => c.url.endsWith('rpc_payment_attach')).init.body).p_gateway_ref === 'PIDX-1' && calls.find((c) => c.url.endsWith('rpc_payment_attach')).init.headers.Authorization === 'Bearer service');
const eOut = await (await initiate(post({ milestoneId: INTENT, method: 'esewa', returnTo: 'vivah://pay/result' }, bearer))).json();
const eMsg = `total_amount=${eOut.form.fields.total_amount},transaction_uuid=WP-1051-1,product_code=EPAYTEST`;
ok('payment-initiate: eSewa gets a signed form (sandbox secret by default) and our checkout page', eOut.form.fields.signature === createHmacB64(eMsg, '8gBm/:&EnhH.1/q') && eOut.url.startsWith('https://vivah.com.np/pay/esewa?') && eOut.form.fields.failure_url.endsWith('/failure'), JSON.stringify(eOut.form?.fields));
delete env.KHALTI_SECRET_KEY;
ok('payment-initiate: Khalti without keys says it isn’t set up', (await initiate(post({ milestoneId: INTENT, method: 'khalti' }, bearer))).status === 503);
env.KHALTI_SECRET_KEY = 'test_secret_key_x';

await load('payment-verify/index.ts');
const verifyFn = handler;
const get = (p) => verifyFn(new Request(`https://proj.supabase.co/functions/v1/payment-verify/${p}`, { method: 'GET' }));
calls.length = 0;
settleCalls.length = 0;
const kRes = await get(`khalti/${INTENT}?pidx=FORGED&status=Completed&total_amount=100`);
const lookupBody = JSON.parse(calls.find((c) => c.url.includes('/epayment/lookup/')).init.body);
ok('payment-verify: looks up the stored pidx, not the one in the URL', lookupBody.pidx === 'PIDX-1');
ok('payment-verify: a completed lookup settles with the gateway’s amount', settleCalls[0]?.p_outcome === 'COMPLETED' && settleCalls[0]?.p_amount === 4237500 && settleCalls[0]?.p_gateway_txn === 'KTXN1');
ok('payment-verify: sends the browser back to the app with the receipt', kRes.status === 302 && kRes.headers.get('Location') === `vivah://pay/result?intent=${INTENT}&status=completed&receipt=RCPT-2026-0042`, kRes.headers.get('Location'));
payNet.khaltiLookup = { status: 'User canceled', total_amount: 4237500, pidx: 'PIDX-1' };
payNet.khaltiLookupStatus = 400;
settleCalls.length = 0;
await get(`khalti/${INTENT}?pidx=PIDX-1&status=User%20canceled`);
ok('payment-verify: Khalti’s 400 "User canceled" is a cancel, not an error', settleCalls[0]?.p_outcome === 'CANCELLED');
payNet.gatewayDown = true;
const downRes = await get(`khalti/${INTENT}`);
ok('payment-verify: gateway down → back to the app to check again, nothing settled', downRes.headers.get('Location')?.endsWith('status=checking') && settleCalls.length === 1);
payNet.gatewayDown = false;

stored = { ...stored, method: 'ESEWA', gatewayRef: null };
settleCalls.length = 0;
const eRes = await get(`esewa/${INTENT}?data=${encodeURIComponent(Buffer.from(JSON.stringify({ ...cbSigned, transaction_uuid: 'WP-1051-1' })).toString('base64'))}`);
ok('payment-verify: eSewa is settled from the status API, with its ref id', settleCalls[0]?.p_outcome === 'COMPLETED' && settleCalls[0]?.p_gateway_ref === 'ESW-REF-9' && settleCalls[0]?.p_amount === 4237500 && eRes.status === 302);
const statusCall = calls.filter((c) => c.url.startsWith('https://rc.esewa.com.np')).pop();
ok('payment-verify: eSewa is asked about our transaction and our amount', statusCall.url.includes('transaction_uuid=WP-1051-1') && statusCall.url.includes('total_amount=42375'));
payNet.esewa = { ...payNet.esewa, status: 'NOT_FOUND', ref_id: null };
settleCalls.length = 0;
await get(`esewa/${INTENT}/failure`);
ok('payment-verify: back through eSewa’s failure URL with nothing paid is a cancel', settleCalls[0]?.p_outcome === 'CANCELLED');

stored = { ...stored, status: 'COMPLETED', receiptNo: 'RCPT-2026-0042' };
calls.length = 0;
settleCalls.length = 0;
const again = await get(`esewa/${INTENT}?data=x`);
ok('payment-verify: an already settled payment is not asked about or settled again', settleCalls.length === 0 && !calls.some((c) => c.url.includes('esewa.com.np')) && again.headers.get('Location').includes('receipt=RCPT-2026-0042'));
authUser = 'someone-else';
ok('payment-verify: the app can only check its own payment', (await verifyFn(post({ intent: INTENT }, bearer))).status === 404);
authUser = 'user-7';
const mineOut = await (await verifyFn(post({ intent: INTENT }, bearer))).json();
ok('payment-verify: the app’s check returns the status and receipt', mineOut.status === 'COMPLETED' && mineOut.receiptNo === 'RCPT-2026-0042');
const lost = await get('paypal/nope');
ok('payment-verify: unknown paths go to the result page, never elsewhere', lost.headers.get('Location') === 'https://vivah.com.np/pay/result?status=unknown');

// ─── Launch (P8): health and account deletion ───────────────────────────────────
const launchNet = { dbUp: true, deleteRefusal: null, files: { '10000000-0000-4000-8000-000000000001': [{ name: 'kyc', id: null }, { name: 'pan.pdf', id: 'f1' }], '10000000-0000-4000-8000-000000000001/kyc': [{ name: 'citizenship.jpg', id: 'f2' }] }, removed: [], authDeleted: [], rpcArgs: null };
const payFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.endsWith('/rest/v1/rpc/rpc_health')) {
    if (!launchNet.dbUp) throw new Error('paused');
    return new Response(JSON.stringify({ ok: true, at: 'now', schema: '0015' }));
  }
  if (u.endsWith('/rest/v1/rpc/rpc_delete_my_account')) {
    launchNet.rpcArgs = { args: JSON.parse(init.body), auth: init.headers.Authorization };
    return launchNet.deleteRefusal ? new Response(JSON.stringify({ message: launchNet.deleteRefusal }), { status: 400 }) : new Response(JSON.stringify({ deleted: true, files: 'someone-else' }));
  }
  if (u.endsWith('/storage/v1/object/list/documents')) {
    const { prefix } = JSON.parse(init.body);
    return new Response(JSON.stringify(launchNet.files[prefix] ?? []));
  }
  if (u.endsWith('/storage/v1/object/documents') && init.method === 'DELETE') { launchNet.removed.push(...JSON.parse(init.body).prefixes); return new Response('[]'); }
  if (u.includes('/auth/v1/admin/users/') && init.method === 'DELETE') { launchNet.authDeleted.push({ url: u, body: JSON.parse(init.body), auth: init.headers.Authorization }); return new Response('{}'); }
  return payFetch(url, init);
};

await load('health/index.ts');
const healthFn = handler;
const healthy = await healthFn(new Request('https://fn.test'));
ok('health: up when the database answers', healthy.status === 200 && (await healthy.json()).db === 'up' && healthy.headers.get('Cache-Control') === 'no-store');
launchNet.dbUp = false;
const down = await healthFn(new Request('https://fn.test'));
ok('health: 503 when the database is paused or down', down.status === 503 && (await down.json()).ok === false);
ok('health: only GET', (await healthFn(post({}))).status === 405);

await load('account-delete/index.ts');
const deleteFn = handler;
authUser = '10000000-0000-4000-8000-000000000001';
const me = { Authorization: 'Bearer couple-jwt' };
ok('account-delete: needs the word DELETE', (await deleteFn(post({ confirm: 'yes' }, me))).status === 400 && launchNet.rpcArgs === null);
authUser = null;
ok('account-delete: signed-out callers are refused', (await deleteFn(post({ confirm: 'DELETE' }, me))).status === 401);
authUser = '10000000-0000-4000-8000-000000000001';
launchNet.deleteRefusal = 'Your celebration WP-1021 is confirmed.';
const blocked = await deleteFn(post({ confirm: 'DELETE' }, me));
ok('account-delete: a refusal from the database reaches the app, nothing removed', blocked.status === 400 && (await blocked.json()).message.includes('WP-1021') && launchNet.removed.length === 0 && launchNet.authDeleted.length === 0);
ok('account-delete: the RPC runs as the user, not the service role', launchNet.rpcArgs?.auth === 'Bearer couple-jwt');
launchNet.deleteRefusal = null;
const closed = await deleteFn(post({ confirm: 'delete' }, me));
const closedBody = await closed.json();
ok('account-delete: removes the caller’s own files, sub-folders included', closed.status === 200 && closedBody.files === 2 && launchNet.removed.join(',') === '10000000-0000-4000-8000-000000000001/pan.pdf,10000000-0000-4000-8000-000000000001/kyc/citizenship.jpg', JSON.stringify(launchNet.removed));
ok('account-delete: soft-deletes the auth user with the service role', launchNet.authDeleted[0]?.url.endsWith('/auth/v1/admin/users/10000000-0000-4000-8000-000000000001') && launchNet.authDeleted[0]?.body.should_soft_delete === true && launchNet.authDeleted[0]?.auth === 'Bearer service');

// ─── Social hub: shared logic ──────────────────────────────────────────────────
const so = await load('_shared/social.ts');
const hexHmac = (message, secret) => createHmac('sha256', secret).update(message).digest('hex');

const st = await so.signState({ u: 'user-7', n: 'instagram', r: 'vivah://business/social', exp: Date.now() + 60_000 }, 'state-secret');
ok('social state: signed state reads back', (await so.readState(st, 'state-secret'))?.n === 'instagram');
const [stBody, stSig] = st.split('.');
const tampered = `${Buffer.from(JSON.stringify({ u: 'attacker', n: 'instagram', r: 'https://evil.com', exp: Date.now() + 60_000 })).toString('base64url')}.${stSig}`;
ok('social state: a tampered or wrongly signed state is refused', (await so.readState(tampered, 'state-secret')) === null && (await so.readState(st, 'other-secret')) === null && (await so.readState(`${stBody}`, 'state-secret')) === null);
ok('social state: an expired state is refused', (await so.readState(await so.signState({ u: 'u', n: 'facebook', r: 'x', exp: Date.now() - 1 }, 's'), 's')) === null);

const fbUrl = new URL(so.authorizeUrl('instagram', { metaAppId: 'app1', graphVersion: 'v21.0' }, 'https://fn/social-oauth', 'S'));
ok('social oauth: Instagram goes through Facebook Login with its publishing and messaging scopes', fbUrl.host === 'www.facebook.com' && fbUrl.searchParams.get('client_id') === 'app1' && fbUrl.searchParams.get('scope').includes('instagram_content_publish') && fbUrl.searchParams.get('state') === 'S');
const ttUrl = new URL(so.authorizeUrl('tiktok', { tiktokClientKey: 'ck' }, 'https://fn/social-oauth', 'S'));
ok('social oauth: TikTok uses its own consent page', ttUrl.host === 'www.tiktok.com' && ttUrl.searchParams.get('client_key') === 'ck' && ttUrl.searchParams.get('scope').includes('video.publish'));
ok('social oauth: no keys, no URL', so.authorizeUrl('facebook', {}, 'r', 's') === null && so.authorizeUrl('tiktok', {}, 'r', 's') === null);
ok('social oauth: the app and Expo Go may be returned to, other sites may not', so.allowedReturn('vivah://business/social', app) && so.allowedReturn('https://vivah.com.np/business/social', app) && !so.allowedReturn('https://evil.com/x', app) && !so.allowedReturn('javascript:alert(1)', app));
ok('social oauth: values are added to the return address', so.withQuery('vivah://business/social?tab=accounts', { connected: 'tiktok' }) === 'vivah://business/social?tab=accounts&connected=tiktok');

const raw = JSON.stringify({ object: 'page', entry: [] });
ok('meta webhook: the X-Hub-Signature-256 of the raw body verifies', await so.verifyMetaSignature(raw, `sha256=${hexHmac(raw, 'app-secret')}`, 'app-secret'));
ok('meta webhook: a wrong or missing signature does not', !(await so.verifyMetaSignature(raw, `sha256=${hexHmac(raw, 'nope')}`, 'app-secret')) && !(await so.verifyMetaSignature(raw, null, 'app-secret')));
const now = Math.floor(Date.now() / 1000);
ok('tiktok webhook: t.body signature verifies within five minutes', await so.verifyTikTokSignature(raw, `t=${now},s=${hexHmac(`${now}.${raw}`, 'tt-secret')}`, 'tt-secret', now));
ok('tiktok webhook: an old timestamp is refused (replay)', !(await so.verifyTikTokSignature(raw, `t=${now - 900},s=${hexHmac(`${now - 900}.${raw}`, 'tt-secret')}`, 'tt-secret', now)));

const pageEvents = so.parseMetaWebhook({
  object: 'page',
  entry: [
    {
      id: 'page-1',
      time: 1700000000,
      messaging: [
        { sender: { id: 'psid-1' }, recipient: { id: 'page-1' }, timestamp: 1700000000000, message: { mid: 'm_1', text: 'Rate kati ho?' } },
        { sender: { id: 'page-1' }, recipient: { id: 'psid-1' }, timestamp: 1700000001000, message: { mid: 'm_echo', text: 'Our reply', is_echo: true } },
        { sender: { id: 'psid-2' }, timestamp: 1700000002000, message: { mid: 'm_2', attachments: [{ type: 'image', payload: { url: 'https://cdn/x.jpg' } }] } },
        { sender: { id: 'psid-1' }, delivery: { mids: ['m_out_1'] } },
      ],
      changes: [
        { field: 'feed', value: { item: 'comment', verb: 'add', comment_id: 'c_1', post_id: 'page-1_77', message: 'Available in Poush?', from: { id: 'u-9', name: 'Sabina Lama' }, created_time: 1700000003 } },
        { field: 'feed', value: { item: 'comment', verb: 'add', comment_id: 'c_own', post_id: 'page-1_77', message: 'Thanks!', from: { id: 'page-1', name: 'Everest' } } },
      ],
    },
  ],
});
ok('meta webhook: a Messenger message, a photo and a page comment; our echo and our own comment are dropped', pageEvents.filter((e) => e.type === 'message').length === 2 && pageEvents.filter((e) => e.type === 'comment').length === 1 && !pageEvents.some((e) => e.id === 'm_echo' || e.id === 'c_own'), JSON.stringify(pageEvents));
ok('meta webhook: a photo with no text reads "Sent a photo" and keeps its URL', pageEvents.find((e) => e.id === 'm_2')?.text === 'Sent a photo' && pageEvents.find((e) => e.id === 'm_2')?.media[0].uri === 'https://cdn/x.jpg');
ok('meta webhook: delivery receipts become status events', pageEvents.some((e) => e.type === 'status' && e.id === 'm_out_1' && e.status === 'delivered'));
ok('meta webhook: timestamps in seconds or ms become ISO', pageEvents.find((e) => e.id === 'm_1').at === new Date(1700000000000).toISOString() && pageEvents.find((e) => e.id === 'c_1').at === new Date(1700000003000).toISOString());
const igEvents = so.parseMetaWebhook({ object: 'instagram', entry: [{ id: 'ig-1', time: 1700000000, changes: [{ field: 'comments', value: { id: 'igc_1', text: 'DM me the price', from: { id: 'u-2', username: 'rojina.mhrzn' }, media: { id: 'media-5' } } }] }] });
ok('meta webhook: Instagram comments carry the @handle and the media id', igEvents[0]?.contactHandle === '@rojina.mhrzn' && igEvents[0]?.postId === 'media-5' && igEvents[0]?.network === 'instagram');
const waEvents = so.parseMetaWebhook({
  object: 'whatsapp_business_account',
  entry: [{ id: 'waba-1', changes: [{ field: 'messages', value: { metadata: { phone_number_id: 'phone-1' }, contacts: [{ wa_id: '9779841556677', profile: { name: 'Nirmala Joshi' } }], messages: [{ from: '9779841556677', id: 'wamid.1', timestamp: '1700000000', type: 'text', text: { body: 'Garden for haldi?' } }], statuses: [{ id: 'wamid.out', status: 'read' }, { id: 'wamid.x', status: 'deleted' }] } }] }],
});
ok('meta webhook: WhatsApp messages with the customer’s name and Nepal number, plus read receipts', waEvents[0]?.contactName === 'Nirmala Joshi' && waEvents[0]?.contactPhone === '9841556677' && waEvents[0]?.account === 'phone-1' && waEvents.filter((e) => e.type === 'status').length === 1, JSON.stringify(waEvents));
ok('meta webhook: junk is ignored', so.parseMetaWebhook(null).length === 0 && so.parseMetaWebhook({ object: 'user' }).length === 0);
ok('tiktok webhook: publish results by publish id', JSON.stringify(so.parseTikTokWebhook({ event: 'post.publish.failed', content: JSON.stringify({ publish_id: 'p_1', reason: 'file_format_check_failed' }) })) === JSON.stringify([{ publishId: 'p_1', status: 'failed', error: 'file_format_check_failed' }]) && so.parseTikTokWebhook({ event: 'post.publish.complete', content: { publish_id: 'p_2' } })[0]?.status === 'published' && so.parseTikTokWebhook({ event: 'authorization.removed' }).length === 0);

const H = 3_600_000;
const t0 = Date.parse('2026-11-20T10:00:00Z');
const ago = (h) => new Date(t0 - h * H).toISOString();
ok('reply window: same rules as the app', so.replyWindowState('facebook', 'message', ago(2), t0) === 'open' && so.replyWindowState('facebook', 'message', ago(30), t0) === 'human_agent' && so.replyWindowState('instagram', 'message', ago(200), t0) === 'closed' && so.replyWindowState('whatsapp', 'message', ago(25), t0) === 'template' && so.replyWindowState('facebook', 'comment', ago(900), t0) === 'open');

const msgReq = so.replyRequest({ network: 'instagram', kind: 'message', accountExternalId: 'ig-1', contact: 'igsid-1', text: 'Namaste', token: 'pt', meta: { pageId: 'page-1' } });
ok('reply: Instagram DMs go through the page with RESPONSE', msgReq.url.endsWith('/page-1/messages') && JSON.parse(msgReq.body).messaging_type === 'RESPONSE' && JSON.parse(msgReq.body).recipient.id === 'igsid-1' && msgReq.headers.Authorization === 'Bearer pt');
const tagReq = JSON.parse(so.replyRequest({ network: 'facebook', kind: 'message', accountExternalId: 'page-1', contact: 'psid-1', text: 'Sorry for the wait', token: 'pt', humanAgent: true }).body);
ok('reply: after 24 hours Messenger replies carry the HUMAN_AGENT tag', tagReq.messaging_type === 'MESSAGE_TAG' && tagReq.tag === 'HUMAN_AGENT');
ok('reply: comment replies use each network’s endpoint', so.replyRequest({ network: 'facebook', kind: 'comment', accountExternalId: 'p', contact: 'u', commentId: 'c_1', text: 'Yes!', token: 't' }).url.endsWith('/c_1/comments') && so.replyRequest({ network: 'instagram', kind: 'comment', accountExternalId: 'p', contact: 'u', commentId: 'igc_1', text: 'Yes!', token: 't' }).url.endsWith('/igc_1/replies'));
const ttReply = so.replyRequest({ network: 'tiktok', kind: 'comment', accountExternalId: 'open-1', contact: 'u', commentId: 'tc_1', postId: 'v_1', text: 'Yes!', token: 'tt' });
ok('reply: TikTok comment replies use the API for Business with Access-Token', ttReply.url.includes('business-api.tiktok.com') && ttReply.headers['Access-Token'] === 'tt' && JSON.parse(ttReply.body).video_id === 'v_1');
const waTpl = JSON.parse(so.replyRequest({ network: 'whatsapp', kind: 'message', accountExternalId: 'phone-1', contact: '9779841556677', text: '', token: 'wt', template: { name: 'follow_up', language: 'en', params: ['Kabita'] } }).body);
ok('reply: a WhatsApp template names the template and fills {{1}}', waTpl.type === 'template' && waTpl.template.name === 'follow_up' && waTpl.template.components[0].parameters[0].text === 'Kabita');
ok('reply: the id each network gives back', so.replyId('whatsapp', { messages: [{ id: 'wamid.9' }] }) === 'wamid.9' && so.replyId('facebook', { message_id: 'm_9' }) === 'm_9' && so.replyId('tiktok', { data: { comment_id: 'tc_9' } }) === 'tc_9');
ok('reply: TikTok’s error code "ok" is success, Meta’s numeric code a refusal', !so.refusedBy({ ok: true }, { error: { code: 'ok' } }) && so.refusedBy({ ok: true }, { error: { code: 190, message: 'Token expired' } }) && so.refusedBy({ ok: false }, {}));

ok('media: Cloudinary ids become public URLs; local files are skipped', JSON.stringify(so.mediaUrls([{ kind: 'image', publicId: 'vivah/portfolio/u/a' }, { kind: 'video', uri: 'https://cdn/x.mp4' }, { kind: 'image', uri: 'file:///local.jpg' }], 'vivah')) === JSON.stringify([{ kind: 'image', url: 'https://res.cloudinary.com/vivah/image/upload/t_full/vivah/portfolio/u/a' }, { kind: 'video', url: 'https://cdn/x.mp4' }]));

/** A scripted network: answers by URL pattern and records every call. */
const scripted = (routes) => {
  const log = [];
  const http = async (url, init) => {
    log.push({ url, body: init.body ? JSON.parse(init.body) : null });
    const route = routes.find(([re]) => re.test(url));
    const [status, body] = route ? (typeof route[1] === 'function' ? route[1](url, init) : route[1]) : [404, { error: { code: 803, message: 'Unknown path' } }];
    return new Response(JSON.stringify(body), { status });
  };
  return { http, log };
};
const fbTarget = { network: 'facebook', accountExternalId: 'page-1', token: 'pt' };
const img1 = { kind: 'image', url: 'https://cdn/a.jpg' };
const img2 = { kind: 'image', url: 'https://cdn/b.jpg' };

const fb1 = scripted([[/\/page-1\/photos$/, [200, { id: 'ph_1', post_id: 'page-1_100' }]], [/\/comments$/, [200, { id: 'cm_1' }]]]);
const fbOne = await so.publishTo(fbTarget, { id: 'sp1', caption: 'Mandap lighting', media: [img1], firstComment: '#NepaliWedding' }, fb1.http);
ok('publish Facebook: one photo is a photo post, then the first comment', fbOne.status === 'published' && fbOne.externalId === 'page-1_100' && fb1.log[0].body.caption === 'Mandap lighting' && fb1.log[1].url.endsWith('/page-1_100/comments'), JSON.stringify(fbOne));
const fb2 = scripted([[/\/page-1\/photos$/, (u, init) => [200, { id: `ph_${JSON.parse(init.body).url.slice(-5, -4)}` }]], [/\/page-1\/feed$/, [200, { id: 'page-1_200' }]]]);
const fbMany = await so.publishTo(fbTarget, { id: 'sp2', caption: 'Two looks', media: [img1, img2] }, fb2.http);
ok('publish Facebook: several photos are uploaded unpublished, then one post with all of them', fbMany.status === 'published' && fb2.log.filter((c) => c.body?.published === false).length === 2 && fb2.log[2].body.attached_media.length === 2);
const fbText = scripted([[/\/page-1\/feed$/, [200, { id: 'page-1_300' }]]]);
ok('publish Facebook: text with a link', (await so.publishTo(fbTarget, { id: 'sp3', caption: 'Open dates', media: [], link: 'https://vivah.com.np/x' }, fbText.http)).status === 'published' && fbText.log[0].body.link === 'https://vivah.com.np/x');
const fbDenied = scripted([[/\/page-1\/feed$/, [400, { error: { code: 190, message: 'Error validating access token' } }]]]);
ok('publish Facebook: the network’s refusal comes back as the error', (await so.publishTo(fbTarget, { id: 'sp4', caption: 'x', media: [] }, fbDenied.http)).error === 'Error validating access token');

const igTarget = { network: 'instagram', accountExternalId: 'ig-1', token: 'pt' };
let child = 0;
const ig = scripted([
  [/\/ig-1\/media$/, (u, init) => [200, { id: JSON.parse(init.body).media_type === 'CAROUSEL' ? 'carousel_1' : `child_${++child}` }]],
  [/\/ig-1\/media_publish$/, [200, { id: 'media_9' }]],
  [/\/media_9\?fields=permalink$/, [200, { permalink: 'https://www.instagram.com/p/abc/' }]],
]);
const igOut = await so.publishTo(igTarget, { id: 'sp5', caption: 'Carousel', media: [img1, img2] }, ig.http);
ok('publish Instagram: a carousel is children, a container, then publish', igOut.status === 'published' && igOut.url === 'https://www.instagram.com/p/abc/' && ig.log.filter((c) => c.body?.is_carousel_item).length === 2 && ig.log.find((c) => c.body?.media_type === 'CAROUSEL').body.children === 'child_1,child_2', JSON.stringify(igOut));
let polls = 0;
const igVid = scripted([
  [/\/ig-1\/media$/, [200, { id: 'reel_1' }]],
  [/\/reel_1\?fields=status_code$/, () => [200, { status_code: ++polls < 3 ? 'IN_PROGRESS' : 'FINISHED' }]],
  [/\/ig-1\/media_publish$/, [200, { id: 'media_10' }]],
  [/permalink/, [200, {}]],
]);
const igReel = await so.publishTo(igTarget, { id: 'sp6', caption: 'Reel', media: [{ kind: 'video', url: 'https://cdn/v.mp4' }] }, igVid.http, { sleep: async () => {} });
ok('publish Instagram: a video becomes a reel, published once processing finishes', igReel.status === 'published' && polls === 3 && igVid.log[0].body.media_type === 'REELS');
ok('publish Instagram: no photo, no post', (await so.publishTo(igTarget, { id: 'sp7', caption: 'x', media: [] }, ig.http)).status === 'failed');

const tt = scripted([[/content\/init\/$/, [200, { data: { publish_id: 'p_77' }, error: { code: 'ok', message: '' } }]]]);
const ttOut = await so.publishTo({ network: 'tiktok', accountExternalId: 'open-1', token: 'tt' }, { id: 'sp8', caption: 'Mehendi night\nmore', media: [img1, img2] }, tt.http, { tiktokPrivacy: 'SELF_ONLY' });
ok('publish TikTok: a photo post TikTok pulls from our URLs, finished later by webhook', ttOut.status === 'publishing' && ttOut.externalId === 'p_77' && tt.log[0].body.media_type === 'PHOTO' && tt.log[0].body.source_info.photo_images.length === 2 && tt.log[0].body.post_info.privacy_level === 'SELF_ONLY' && tt.log[0].body.post_info.title === 'Mehendi night');
const ttBad = scripted([[/content\/init\/$/, [200, { error: { code: 'spam_risk_too_many_posts', message: 'Too many posts today' } }]]]);
ok('publish TikTok: a refusal with HTTP 200 is still a refusal', (await so.publishTo({ network: 'tiktok', accountExternalId: 'o', token: 't' }, { id: 'sp9', caption: 'x', media: [img1] }, ttBad.http)).error === 'Too many posts today');

const wa = scripted([[/\/phone-1\/messages$/, (u, init) => (JSON.parse(init.body).to === 'bad' ? [400, { error: { code: 131026, message: 'Message undeliverable' } }] : [200, { messages: [{ id: 'wamid.b' }] }])]]);
const waOut = await so.publishTo({ network: 'whatsapp', accountExternalId: 'phone-1', token: 'wt' }, { id: 'sp10', caption: 'Mangsir dates open', media: [img1] }, wa.http, { whatsappTemplate: 'vivah_update', whatsappContacts: ['9779841556677', 'bad', '9779851012345'] });
ok('publish WhatsApp: the approved template goes to each customer who opted in, with the photo as header', waOut.status === 'published' && waOut.externalId === 'broadcast:sp10:2' && wa.log[0].body.template.components[0].type === 'header');
ok('publish WhatsApp: no template or no opted-in customers is a clear failure', (await so.publishTo({ network: 'whatsapp', accountExternalId: 'p', token: 't' }, { id: 'x', caption: 'x', media: [] }, wa.http, { whatsappContacts: ['1'] })).error.includes('WHATSAPP_BROADCAST_TEMPLATE') && (await so.publishTo({ network: 'whatsapp', accountExternalId: 'p', token: 't' }, { id: 'x', caption: 'x', media: [] }, wa.http, { whatsappTemplate: 't', whatsappContacts: [] })).error.includes('agreed'));
ok('publish: a network that cannot be reached never throws', (await so.publishTo(fbTarget, { id: 'x', caption: 'x', media: [] }, async () => { throw new Error('offline'); })).status === 'failed');

// ─── Social hub: handlers ─────────────────────────────────────────────────────
Object.assign(env, { SOCIAL_STATE_SECRET: 'state-secret', META_APP_ID: 'app1', META_APP_SECRET: 'app-secret', META_VERIFY_TOKEN: 'verify-me', TIKTOK_CLIENT_KEY: 'ck', TIKTOK_CLIENT_SECRET: 'tt-secret', FUNCTIONS_URL: 'https://proj.supabase.co/functions/v1' });
const socialNet = { rpc: [] };
const prevFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.endsWith('/auth/v1/user')) return authUser ? new Response(JSON.stringify({ id: authUser })) : new Response('{}', { status: 401 });
  const rpcName = u.match(/\/rest\/v1\/rpc\/(\w+)$/)?.[1];
  if (rpcName) {
    socialNet.rpc.push({ name: rpcName, args: JSON.parse(init.body), auth: init.headers.Authorization });
    if (rpcName === 'vivah_social_ingest') return new Response(String(JSON.parse(init.body).p_events.filter((e) => e.type !== 'status').length));
    if (rpcName === 'vivah_social_send_context') return new Response(JSON.stringify(JSON.parse(init.body).p_thread === '00000000-0000-4000-8000-0000000000aa' ? { threadId: 'x', network: 'whatsapp', kind: 'message', accountStatus: 'connected', accountExternalId: 'phone-1', contact: '9779851012345', contactName: 'Kabita Tamang', commentId: null, postId: null, lastInboundAt: new Date(Date.now() - 30 * H).toISOString(), token: 'wt', meta: {} } : null));
    if (rpcName === 'vivah_social_record_out') return new Response(JSON.stringify('msg-1'));
    return new Response('null');
  }
  if (u.includes('graph.facebook.com')) return new Response(JSON.stringify({ messages: [{ id: 'wamid.reply' }] }));
  return new Response('not found', { status: 404 });
};

await load('social-webhook/index.ts');
const hook = handler;
ok('social-webhook: answers Meta’s subscription check with the challenge', (await (await hook(new Request('https://fn.test/?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=12345'))).text()) === '12345');
ok('social-webhook: a wrong verify token is refused', (await hook(new Request('https://fn.test/?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=1'))).status === 403);
const waRaw = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ id: 'waba-1', changes: [{ value: { metadata: { phone_number_id: 'phone-1' }, messages: [{ from: '9779841556677', id: 'wamid.7', type: 'text', text: { body: 'Hello' } }] } }] }] });
ok('social-webhook: unsigned and badly signed posts are refused', (await hook(new Request('https://fn.test', { method: 'POST', body: waRaw }))).status === 401 && (await hook(new Request('https://fn.test', { method: 'POST', body: waRaw, headers: { 'x-hub-signature-256': 'sha256=00' } }))).status === 401);
socialNet.rpc.length = 0;
const hooked = await (await hook(new Request('https://fn.test', { method: 'POST', body: waRaw, headers: { 'x-hub-signature-256': `sha256=${hexHmac(waRaw, 'app-secret')}` } }))).json();
ok('social-webhook: a signed Meta delivery is stored with the service role', hooked.stored === 1 && socialNet.rpc[0]?.name === 'vivah_social_ingest' && socialNet.rpc[0].auth === 'Bearer service' && socialNet.rpc[0].args.p_events[0].text === 'Hello');
const ttRaw = JSON.stringify({ event: 'post.publish.complete', content: JSON.stringify({ publish_id: 'p_77' }) });
const ts = Math.floor(Date.now() / 1000);
socialNet.rpc.length = 0;
await hook(new Request('https://fn.test', { method: 'POST', body: ttRaw, headers: { 'tiktok-signature': `t=${ts},s=${hexHmac(`${ts}.${ttRaw}`, 'tt-secret')}` } }));
ok('social-webhook: a signed TikTok result settles the post', socialNet.rpc[0]?.name === 'vivah_social_publish_update' && socialNet.rpc[0].args.p_external_id === 'p_77' && socialNet.rpc[0].args.p_status === 'published');

await load('social-oauth/index.ts');
const oauth = handler;
authUser = null;
ok('social-oauth: signed-out callers cannot start', (await oauth(post({ action: 'start', network: 'facebook', returnTo: 'vivah://business/social' }, { Authorization: 'Bearer bad' }))).status === 401);
authUser = 'user-7';
ok('social-oauth: a foreign return address is refused (no open redirect)', (await oauth(post({ action: 'start', network: 'facebook', returnTo: 'https://evil.com' }, { Authorization: 'Bearer good' }))).status === 400);
const started = await (await oauth(post({ action: 'start', network: 'facebook', returnTo: 'vivah://business/social' }, { Authorization: 'Bearer good' }))).json();
const startedUrl = new URL(started.url);
ok('social-oauth: start returns Facebook’s consent page with our callback and a signed state for this user', startedUrl.host === 'www.facebook.com' && startedUrl.searchParams.get('redirect_uri') === 'https://proj.supabase.co/functions/v1/social-oauth' && (await so.readState(startedUrl.searchParams.get('state'), 'state-secret'))?.u === 'user-7');
const cancelled = await oauth(new Request(`https://fn.test/?state=${encodeURIComponent(startedUrl.searchParams.get('state'))}&error=access_denied`));
ok('social-oauth: cancelling on the network goes back to the app with the reason', cancelled.status === 302 && cancelled.headers.get('location') === 'vivah://business/social?social_error=access_denied');
ok('social-oauth: a forged state is refused', (await oauth(new Request('https://fn.test/?state=abc.def&code=x'))).status === 400);

await load('social-send/index.ts');
const send = handler;
ok('social-send: a closed WhatsApp window needs a template', (await send(post({ threadId: '00000000-0000-4000-8000-0000000000aa', text: 'Hello again' }, { Authorization: 'Bearer good' }))).status === 409);
socialNet.rpc.length = 0;
const sentReply = await send(post({ threadId: '00000000-0000-4000-8000-0000000000aa', text: '', template: 'follow_up' }, { Authorization: 'Bearer good' }));
ok('social-send: the template goes out and is recorded with WhatsApp’s id', sentReply.status === 200 && socialNet.rpc.some((r) => r.name === 'vivah_social_record_out' && r.args.p_external_id === 'wamid.reply' && r.args.p_template === 'follow_up'));
ok('social-send: someone outside the business gets not found', (await send(post({ threadId: '00000000-0000-4000-8000-0000000000bb', text: 'x' }, { Authorization: 'Bearer good' }))).status === 404);
globalThis.fetch = prevFetch;

const failed = results.filter((r) => !r.pass);
results.forEach((r) => console.log(`${r.pass ? 'pass' : 'FAIL'}  ${r.name}${!r.pass && r.detail ? `  (${r.detail})` : ''}`));
console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);
if (failed.length) process.exit(1);
