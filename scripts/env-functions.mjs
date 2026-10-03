/**
 * Writes supabase/.env.functions.local, the Edge Function secrets, from the
 * keys you pasted into .env.local. Then push them with:
 *
 *   npm run env:functions
 *   npx supabase secrets set --env-file supabase/.env.functions.local
 *
 * Supabase sets SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY
 * for every function itself, so they are not copied. The file is git-ignored.
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

const vars = Object.fromEntries(
  readFileSync(source, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
    .filter(Boolean)
    .map(([, k, v]) => [k, v.replace(/^(['"])(.*)\1$/, '$2')]),
);

/** Function secret ← .env.local key. */
const MAP = {
  APP_URL: 'EXPO_PUBLIC_APP_URL',
  CLOUDINARY_CLOUD_NAME: 'EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME',
  CLOUDINARY_API_KEY: 'CLOUDINARY_API_KEY',
  CLOUDINARY_API_SECRET: 'CLOUDINARY_API_SECRET',
  UPSTASH_REDIS_REST_URL: 'UPSTASH_REDIS_REST_URL',
  UPSTASH_REDIS_REST_TOKEN: 'UPSTASH_REDIS_REST_TOKEN',
  RESEND_API_KEY: 'RESEND_API_KEY',
  RESEND_FROM: 'RESEND_FROM',
  EXPO_ACCESS_TOKEN: 'EXPO_ACCESS_TOKEN',
  NOTIFY_WEBHOOK_SECRET: 'NOTIFY_WEBHOOK_SECRET',
  KHALTI_SECRET_KEY: 'KHALTI_SECRET_KEY',
  KHALTI_BASE_URL: 'KHALTI_BASE_URL',
  ESEWA_PRODUCT_CODE: 'ESEWA_PRODUCT_CODE',
  ESEWA_SECRET_KEY: 'ESEWA_SECRET_KEY',
  ESEWA_BASE_URL: 'ESEWA_BASE_URL',
  PAYMENT_RETURN_HOSTS: 'PAYMENT_RETURN_HOSTS',
  SOCIAL_STATE_SECRET: 'SOCIAL_STATE_SECRET',
  META_APP_ID: 'META_APP_ID',
  META_APP_SECRET: 'META_APP_SECRET',
  META_VERIFY_TOKEN: 'META_VERIFY_TOKEN',
  META_WHATSAPP_CONFIG_ID: 'META_WHATSAPP_CONFIG_ID',
  META_GRAPH_VERSION: 'META_GRAPH_VERSION',
  TIKTOK_CLIENT_KEY: 'TIKTOK_CLIENT_KEY',
  TIKTOK_CLIENT_SECRET: 'TIKTOK_CLIENT_SECRET',
  TIKTOK_PRIVACY_LEVEL: 'TIKTOK_PRIVACY_LEVEL',
  WHATSAPP_BROADCAST_TEMPLATE: 'WHATSAPP_BROADCAST_TEMPLATE',
  WHATSAPP_TEMPLATE_LANGUAGE: 'WHATSAPP_TEMPLATE_LANGUAGE',
};

const lines = [];
const missing = [];
for (const [secret, key] of Object.entries(MAP)) {
  const v = vars[key];
  if (v) lines.push(`${secret}=${/[\s#"']/.test(v) ? JSON.stringify(v) : v}`);
  else missing.push(key);
}
const out = path.join(root, 'supabase', '.env.functions.local');
writeFileSync(out, `# Edge Function secrets, generated from ${path.basename(source)} by \`npm run env:functions\`. Don't commit.\n${lines.join('\n')}\n`);
console.log(`Wrote ${lines.length} secrets to supabase/.env.functions.local.`);
if (missing.length) console.log(`Empty in ${path.basename(source)}, not copied: ${missing.join(', ')}`);
console.log('Next: npx supabase secrets set --env-file supabase/.env.functions.local');
