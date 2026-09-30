/**
 * Creates (or updates) what the app expects in your Cloudinary account, from
 * the keys in .env.local:
 *
 *   - the signed upload presets vivah_portfolio, vivah_gallery, vivah_avatar
 *     and vivah_idea (formats, resize to at most 2,400 px on upload);
 *   - the named transformations t_thumb, t_card, t_hero and t_full.
 *
 *   node scripts/cloudinary-setup.mjs            show what would be sent
 *   node scripts/cloudinary-setup.mjs --apply    send it (Admin API)
 *
 * Afterwards, in Cloudinary → Settings → Security, turn on "Strict
 * transformations" so only the named ones can be requested (keeps credit use
 * predictable, master plan §10).
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = ['.env.local', '.env'].map((f) => path.join(root, f)).find(existsSync);
const vars = source
  ? Object.fromEntries(
      readFileSync(source, 'utf8')
        .split(/\r?\n/)
        .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
        .filter(Boolean)
        .map(([, k, v]) => [k, v.replace(/^(['"])(.*)\1$/, '$2')]),
    )
  : {};
const cloud = vars.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const key = vars.CLOUDINARY_API_KEY;
const secret = vars.CLOUDINARY_API_SECRET;
const apply = process.argv.includes('--apply');

const { PURPOSES, NAMED_TRANSFORMATIONS } = await import(pathToFileURL(path.join(root, 'supabase', 'functions', '_shared', 'cloudinary.ts')).href);

const requests = [
  ...Object.values(PURPOSES).map((p) => ({
    what: `upload preset ${p.preset}`,
    create: ['POST', '/upload_presets', { name: p.preset, unsigned: false, allowed_formats: p.formats.join(','), incoming_transformation: 'c_limit,w_2400,h_2400', unique_filename: true, overwrite: false, use_filename: false }],
    update: ['PUT', `/upload_presets/${p.preset}`, { unsigned: false, allowed_formats: p.formats.join(','), incoming_transformation: 'c_limit,w_2400,h_2400', unique_filename: true, overwrite: false }],
  })),
  ...Object.entries(NAMED_TRANSFORMATIONS).map(([name, t]) => ({
    what: `named transformation ${name}`,
    create: ['POST', `/transformations/${name.replace(/^t_/, '')}`, { transformation: t, allowed_for_strict: true }],
    update: ['PUT', `/transformations/${name.replace(/^t_/, '')}`, { unsafe_update: t, allowed_for_strict: true }],
  })),
];

if (!apply) {
  requests.forEach((r) => console.log(`${r.what}: ${r.create[0]} ${r.create[1]} ${JSON.stringify(r.create[2])}`));
  console.log(`\n${requests.length} changes. Run with --apply to send them${cloud ? ` to the "${cloud}" cloud` : ''}.`);
  process.exit(0);
}
if (!cloud || !key || !secret) {
  console.error('Set EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in .env.local first.');
  process.exit(1);
}

const auth = `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`;
const call = async ([method, route, body]) => {
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}${route}`, { method, headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { ok: res.ok, status: res.status, text: await res.text() };
};
let failures = 0;
for (const r of requests) {
  let res = await call(r.create);
  if (!res.ok && /already exists/i.test(res.text)) res = await call(r.update);
  console.log(`${res.ok ? 'ok  ' : 'FAIL'} ${r.what}${res.ok ? '' : ` (${res.status} ${res.text.slice(0, 160)})`}`);
  if (!res.ok) failures++;
}
if (failures) process.exit(1);
console.log('\nDone. Now turn on Strict transformations in Cloudinary → Settings → Security.');
