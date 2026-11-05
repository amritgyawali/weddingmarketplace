/**
 * Checks the feature switches (src/data/features.ts): each app has exactly 20
 * top features, every other fixed surface and tool is an extra that starts
 * off, the defaults and super admin overrides resolve as expected, and every
 * screen listed in FEATURE_ROUTES exists under src/app. Node 24+ strips the
 * TypeScript.
 *
 *   npm run test:features
 */
import './ts-loader.mjs';

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { importApp } from './ts-loader.mjs';

const f = await importApp('@/data/features');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const results = [];
const ok = (name, pass, detail = '') => results.push({ name, pass: !!pass, detail });

// Tool ids, read from the toolkit sources (they are .tsx with components, so not imported).
const toolIds = (dir) =>
  readdirSync(path.join(root, 'src/components/toolkit', dir))
    .filter((n) => n === 'index.ts')
    .flatMap((n) => [...readFileSync(path.join(root, 'src/components/toolkit', dir, n), 'utf8').matchAll(/\{ id: '([a-z]+\.[a-z]+)'/g)].map((m) => m[1]));
// The customer edition ships only the couple's app and toolkit.
const TOOLS = { customer: toolIds('couple') };
const ALL_TOOLS = new Set(Object.values(TOOLS).flat());
ok('toolkit ids read', ALL_TOOLS.size > 20, `${ALL_TOOLS.size} tools`);
ok('only the couple app is listed', Object.keys(f.TOP_FEATURES).join() === 'customer');
ok('no other role switches', f.FEATURES.every((x) => x.role === 'customer' || x.role === 'all'));

for (const [role, top] of Object.entries(f.TOP_FEATURES)) {
  const ids = top.map((x) => x.id);
  ok(`${role}: exactly 20 top features`, ids.length === 20, `${ids.length}`);
  ok(`${role}: top ids unique`, new Set(ids).size === ids.length);
  const unknown = ids.filter((id) => !(id.startsWith('core.') || (id.startsWith('tool:') ? TOOLS[role].includes(id.slice(5)) : f.FEATURE_BY_ID[id]?.role === role)));
  ok(`${role}: top ids exist in this app`, unknown.length === 0, unknown.join(', '));
  const offTop = ids.filter((id) => !id.startsWith('core.') && !f.featureOn({}, id));
  ok(`${role}: top features start on`, offTop.length === 0, offTop.join(', '));
  // Nothing outside the top 20 is on by default (home sections are layout, not features; basics aren't counted).
  const loose = f.FEATURES.filter((x) => x.role === role && x.group !== 'Home' && !f.BASIC_FEATURES.has(x.id) && !ids.includes(x.id) && f.featureOn({}, x.id)).map((x) => x.id);
  ok(`${role}: every other switch is an extra`, loose.length === 0, loose.join(', '));
  const onTools = TOOLS[role].filter((t) => f.featureOn({}, f.toolFeature(t)) && !ids.includes(f.toolFeature(t)));
  ok(`${role}: only top tools start on`, onTools.length === 0, onTools.join(', '));
  const visibleTools = TOOLS[role].filter((t) => f.featureOn({}, f.toolFeature(t))).length;
  ok(`${role}: tools hidden by default`, visibleTools < TOOLS[role].length, `${visibleTools} of ${TOOLS[role].length} on`);
}

// Defaults and overrides
ok('extra starts off', f.featureOn({}, 'couple.seating') === false);
ok('extra switched on by super admin', f.featureOn({ 'couple.seating': true }, 'couple.seating') === true);
ok('top feature switched off by super admin', f.featureOn({ 'couple.budget': false }, 'couple.budget') === false);
ok('top tool on', f.featureOn({}, 'tool:couple.sait') === true);
ok('other tool off', f.featureOn({}, 'tool:couple.janti') === false);
ok('other tool switched on', f.featureOn({ 'tool:couple.janti': true }, 'tool:couple.janti') === true);
ok('services stay on', f.featureOn({}, 'service:venue') === true);
ok('unknown ids stay on (bug reports, new switches)', f.featureOn({}, 'app.bug_report') === true && f.featureOn(undefined, 'x.y') === true);
ok('sign-in and content switches stay on', ['login.demo', 'app.announcements', 'app.notifications'].every((id) => f.featureOn({}, id)));

// Routes
ok('path → feature', f.featureForPath('/contracts') === 'couple.contracts' && f.featureForPath('/contract/c_1') === 'couple.contracts');
ok('query ignored', f.featureForPath('/seating?from=menu') === 'couple.seating');
ok('nested route', f.featureForPath('/inbox/t1') === 'couple.messages' && f.featureForPath('/genie-checkout/g1') === 'tab.customer.genie');
ok('unrelated paths have no feature', f.featureForPath('/') === undefined && f.featureForPath('/info/support') === undefined && f.featureForPath('/business') === undefined);
ok('object link filled in', f.linkOn({}, { pathname: '/info/[slug]', params: { slug: 'shop' } }) === false && f.linkOn({}, { pathname: '/info/[slug]', params: { slug: 'support' } }) === true);
ok('link follows the switch', f.linkOn({}, '/seating') === false && f.linkOn({ 'couple.seating': true }, '/seating') === true);
const unknownRouteIds = Object.keys(f.FEATURE_ROUTES).filter((id) => !f.FEATURE_BY_ID[id]);
ok('route features are registered', unknownRouteIds.length === 0, unknownRouteIds.join(', '));

// Every route pattern has a screen file: `*` matches any segment, a [param] matches any name; (group) folders are transparent.
const resolves = (dir, parts) => {
  if (!existsSync(dir)) return false;
  const entries = readdirSync(dir, { withFileTypes: true });
  const groups = entries.filter((e) => e.isDirectory() && /^\(.+\)$/.test(e.name)).some((e) => resolves(path.join(dir, e.name), parts));
  if (groups) return true;
  const [head, ...rest] = parts;
  const match = (name) => name === head || head === '*' || /^\[.+\]$/.test(name);
  if (rest.length === 0) {
    return entries.some((e) => (e.isFile() && match(e.name.replace(/\.tsx$/, ''))) || (e.isDirectory() && match(e.name) && existsSync(path.join(dir, e.name, 'index.tsx'))));
  }
  return entries.some((e) => e.isDirectory() && match(e.name) && resolves(path.join(dir, e.name), rest));
};
const missingScreens = Object.values(f.FEATURE_ROUTES)
  .flat()
  .filter((r) => !resolves(path.join(root, 'src/app'), r.split('/').filter(Boolean)));
ok('every feature route has a screen', missingScreens.length === 0, missingScreens.join(', '));

const failed = results.filter((r) => !r.pass);
for (const r of results) console.log(`${r.pass ? 'ok  ' : 'FAIL'} ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
