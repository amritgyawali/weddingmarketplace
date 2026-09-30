/**
 * Writes `.env.vercel.local`, the file to import into Vercel, from the keys
 * you pasted into `.env.local` (or `.env`).
 *
 *   npm run env:vercel
 *
 * Vercel only builds the static web app (`npx expo export -p web`), and only
 * EXPO_PUBLIC_* variables reach that build, so only those are copied. Server
 * secrets stay out of Vercel on purpose: they belong in Supabase secrets,
 * GitHub Actions and EAS. Empty keys are skipped.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = ['.env.local', '.env'].map((f) => path.join(root, f)).find(existsSync);
if (!source) {
  console.error('No .env.local found. Copy .env.example to .env.local and paste your keys first.');
  process.exit(1);
}

const parse = (text) =>
  text
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
    .filter(Boolean)
    .map(([, key, raw]) => [key, raw.replace(/^(['"])(.*)\1$/, '$2')]);

const vars = parse(readFileSync(source, 'utf8'));
const pub = vars.filter(([key, value]) => key.startsWith('EXPO_PUBLIC_') && value !== '');
const skipped = vars.filter(([key, value]) => key.startsWith('EXPO_PUBLIC_') && value === '').map(([key]) => key);
const secrets = vars.filter(([key, value]) => !key.startsWith('EXPO_PUBLIC_') && value !== '').length;

const out = path.join(root, '.env.vercel.local');
writeFileSync(
  out,
  [
    '# Import into Vercel: Project → Settings → Environment Variables → Import .env',
    `# Generated from ${path.basename(source)} by \`npm run env:vercel\`. Public keys only; don't commit.`,
    ...pub.map(([key, value]) => `${key}=${/[\s#"']/.test(value) ? JSON.stringify(value) : value}`),
    '',
  ].join('\n'),
);

console.log(`Wrote ${pub.length} public keys to .env.vercel.local.`);
if (skipped.length) console.log(`Empty, not copied: ${skipped.join(', ')}`);
if (secrets) console.log(`${secrets} server secrets were left out on purpose (Supabase secrets, GitHub Actions, EAS).`);
