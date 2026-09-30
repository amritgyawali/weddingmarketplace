/**
 * Checks what the app sends to PostHog and Sentry (src/backend/telemetryPayloads.ts):
 * stack parsing for Hermes and JavaScriptCore, route names without ids,
 * PostHog batches and $exception events, Sentry DSNs and envelopes, and that
 * no contact details slip into a payload. Node 24+ strips the TypeScript.
 *
 *   npm run test:telemetry
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const t = await import(pathToFileURL(path.join(root, 'src', 'backend', 'telemetryPayloads.ts')).href);

const results = [];
const ok = (name, pass, detail = '') => results.push({ name, pass: !!pass, detail });

// ─── Stacks ─────────────────────────────────────────────────────────────────────
const hermes = `TypeError: Cannot read property 'total' of undefined
    at quoteTotals (http://localhost:8081/index.bundle//&platform=android:1234:56)
    at QuoteScreen (http://localhost:8081/index.bundle//&platform=android:2000:10)
    at renderWithHooks (http://localhost:8081/node_modules/react/cjs/react.js:99:1)`;
const frames = t.parseStack(hermes);
ok('stack: Hermes/V8 frames parsed, oldest call first', frames.length === 3 && frames[2].function === 'quoteTotals' && frames[2].lineno === 1234 && frames[2].colno === 56 && frames[0].function === 'renderWithHooks', JSON.stringify(frames));
ok('stack: library frames are not "in app"', frames[0].in_app === false && frames[2].in_app === true);
const jsc = t.parseStack('sendQuote@http://x/bundle.js:10:5\nglobal code@http://x/bundle.js:1:1');
ok('stack: JavaScriptCore frames parsed', jsc.length === 2 && jsc[1].function === 'sendQuote' && jsc[1].lineno === 10);
ok('stack: missing stacks give no frames', t.parseStack(undefined).length === 0);

const err = t.describeError(new RangeError('Milestones do not sum'));
ok('errors: type and message kept', err.type === 'RangeError' && err.message === 'Milestones do not sum');
ok('errors: strings and objects are described', t.describeError('boom').message === 'boom' && t.describeError({ code: 7 }).message === '{"code":7}');
const circular = {};
circular.self = circular;
ok('errors: circular values do not throw', t.describeError(circular).message === 'Unknown error');

// ─── Routes ─────────────────────────────────────────────────────────────────────
ok('routes: patterns, not ids or RSVP codes', t.routeName(['rsvp', '[code]']) === '/rsvp/[code]' && t.routeName(['quote', '[id]']) === '/quote/[id]');
ok('routes: groups are dropped', t.routeName(['business', '(tabs)', 'leads']) === '/business/leads' && t.routeName([]) === '/');

// ─── PostHog ────────────────────────────────────────────────────────────────────
const at = new Date('2026-10-01T06:00:00Z');
const e = t.posthogEvent('$screen', 'acct-1', { $screen_name: '/plan', role: 'customer', trade: undefined, staff_role: null }, at);
ok('posthog: event carries the distinct id and time', e.properties.distinct_id === 'acct-1' && e.timestamp === '2026-10-01T06:00:00.000Z');
ok('posthog: empty properties are dropped', !('trade' in e.properties) && !('staff_role' in e.properties));
const ex = t.posthogException(new Error('Quote failed'), 'acct-1', { where: 'render' }, true, at);
ok('posthog: errors go as $exception with a stack list', ex.event === '$exception' && ex.properties.$exception_list[0].value === 'Quote failed' && ex.properties.$exception_list[0].mechanism.handled === true);
const batch = t.posthogBatch('phc_test', [e, ex]);
ok('posthog: batch body has the project key and events', batch.api_key === 'phc_test' && batch.batch.length === 2);

// ─── Sentry ─────────────────────────────────────────────────────────────────────
const dsn = 'https://abc123@o450000.ingest.sentry.io/4500000000000001';
const parsed = t.parseDsn(dsn);
ok('sentry: DSN parsed', parsed?.key === 'abc123' && parsed.host === 'o450000.ingest.sentry.io' && parsed.projectId === '4500000000000001');
ok('sentry: junk is not a DSN', t.parseDsn('not a dsn') === null && t.parseDsn(undefined) === null);
const env = t.sentryEnvelope(dsn, new TypeError('x is undefined'), { release: 'vivah@1.0.0', environment: 'production', platform: 'android', userId: 'acct-1', fatal: true, tags: { role: 'vendor', where: undefined } }, at, () => 0.5);
const [header, item, eventLine, trailing] = env.body.split('\n');
const event = JSON.parse(eventLine);
ok('sentry: envelope goes to the project’s envelope endpoint', env.url === 'https://o450000.ingest.sentry.io/api/4500000000000001/envelope/?sentry_key=abc123&sentry_version=7');
ok('sentry: header, item header, event, newline', JSON.parse(header).event_id === event.event_id && JSON.parse(item).type === 'event' && trailing === '');
ok('sentry: event id is 32 hex characters', /^[0-9a-f]{32}$/.test(event.event_id));
ok('sentry: fatal errors are level fatal, with release and environment', event.level === 'fatal' && event.release === 'vivah@1.0.0' && event.environment === 'production');
ok('sentry: exception type and message', event.exception.values[0].type === 'TypeError' && event.exception.values[0].value === 'x is undefined');
ok('sentry: empty tags are dropped', event.tags.role === 'vendor' && !('where' in event.tags) && event.tags.os === 'android');
ok('sentry: no DSN, no envelope', t.sentryEnvelope('', new Error('x'), { release: 'r', environment: 'e', platform: 'web' }) === null);

// ─── Privacy ────────────────────────────────────────────────────────────────────
const everything = JSON.stringify([e, ex, batch, event]);
ok('privacy: no emails or phone numbers in any payload', !/@example|98\d{8}|\+977/.test(everything));

const failed = results.filter((r) => !r.pass);
results.forEach((r) => console.log(`${r.pass ? 'pass' : 'FAIL'}  ${r.name}${!r.pass && r.detail ? `  (${r.detail})` : ''}`));
console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);
if (failed.length) process.exit(1);
