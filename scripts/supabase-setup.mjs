/**
 * Sets up the Supabase project named in .env.local, end to end, so nobody has
 * to click through docs/SETUP_SUPABASE.md §2–§3 by hand. It uses the
 * Management API with SUPABASE_ACCESS_TOKEN, so it needs no database password
 * and no Docker:
 *
 *   1. checks the project is up and reads its publishable key into .env.local;
 *   2. turns on pg_cron and pg_net (so 0013/0014 schedule their jobs);
 *   3. applies supabase/migrations that aren't applied yet, recording each in
 *      supabase_migrations.schema_migrations like `supabase db push` does;
 *   4. stores the Vault secrets functions_url and notify_webhook_secret;
 *   5. configures Auth: 6-digit email codes, the OTP template, the custom
 *      access token hook, and Resend as SMTP;
 *   6. sets the Edge Function secrets and deploys every function
 *      (Supabase CLI with --use-api, so no Docker);
 *   7. calls the health function, and on success switches the app to
 *      EXPO_PUBLIC_BACKEND=supabase.
 *
 *   npm run setup:supabase                       show what would happen (reads only)
 *   npm run setup:supabase -- --apply            do it (safe to re-run)
 *   npm run setup:supabase -- --apply --staff-code VIVAH-OPS-XXXX
 *                                                also add a staff access code (stored hashed)
 *   npm run setup:supabase -- --super-admin you@example.com
 *                                                after signing up as staff: approve yourself as super admin
 *
 * Secrets are read from .env.local and never printed.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(root, '.env.local');
if (!existsSync(envFile)) {
  console.error('No .env.local found. Copy .env.example to .env.local and paste your keys first.');
  process.exit(1);
}
const vars = Object.fromEntries(
  readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
    .filter(Boolean)
    .map(([, k, v]) => [k, v.replace(/^(['"])(.*)\1$/, '$2')]),
);

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const argValue = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const staffCode = argValue('--staff-code');
const superAdmin = argValue('--super-admin');

const token = vars.SUPABASE_ACCESS_TOKEN;
const ref = vars.SUPABASE_PROJECT_REF || (vars.EXPO_PUBLIC_SUPABASE_URL ?? '').match(/^https:\/\/([a-z0-9]{20})\.supabase\.co/)?.[1];
if (!token || !ref) {
  console.error('Set SUPABASE_ACCESS_TOKEN (supabase.com → Account → Access tokens) and SUPABASE_PROJECT_REF in .env.local.');
  process.exit(1);
}
const projectUrl = `https://${ref}.supabase.co`;

/** Rewrites one KEY=value line in .env.local (adds it if missing). */
const setEnv = (key, value) => {
  let text = readFileSync(envFile, 'utf8');
  const line = new RegExp(`^${key}=.*$`, 'm');
  text = line.test(text) ? text.replace(line, () => `${key}=${value}`) : `${text.replace(/\s*$/, '\n')}${key}=${value}\n`;
  writeFileSync(envFile, text);
  vars[key] = value;
};

const api = async (method, route, body) => {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}${route}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) throw new Error(`${method} ${route} → ${res.status} ${typeof data === 'string' ? data : (data?.message ?? JSON.stringify(data))}`.slice(0, 600));
  return data;
};
const sql = (query) => api('POST', '/database/query', { query });
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

const step = (n, what) => console.log(`\n${n}. ${what}`);
let failures = 0;
const attempt = async (what, fn) => {
  try {
    const note = await fn();
    console.log(`   ok    ${what}${note ? ` (${note})` : ''}`);
    return true;
  } catch (e) {
    failures += 1;
    console.log(`   FAIL  ${what}: ${e.message}`);
    return false;
  }
};

console.log(`Supabase project ${ref}${apply ? '' : ' (dry run: nothing is changed; add --apply)'}`);

// 1. Project and publishable key ----------------------------------------------
step(1, 'Project and publishable key');
const project = await api('GET', '').catch((e) => {
  console.error(`   Can't reach the project: ${e.message}`);
  console.error('   Check SUPABASE_ACCESS_TOKEN belongs to the account that owns this project.');
  process.exit(1);
});
console.log(`   ${project.name} · ${project.region} · ${project.status}`);
if (project.status !== 'ACTIVE_HEALTHY') {
  console.error('   The project is not running (free projects pause after a week idle). Restore it in the dashboard, then re-run.');
  process.exit(1);
}
const keys = await api('GET', '/api-keys?reveal=false');
const publishable =
  keys.find((k) => k.type === 'publishable' && !k.disabled && /^sb_publishable_\w+$/.test(k.api_key ?? '')) ??
  keys.find((k) => k.name === 'anon' && !k.disabled && /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(k.api_key ?? ''));
if (!publishable?.api_key) {
  failures += 1;
  console.log('   FAIL  no enabled publishable or anon key; create one in Project settings → API keys');
} else if (vars.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY === publishable.api_key) {
  console.log('   ok    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY already set');
} else if (apply) {
  setEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', publishable.api_key);
  setEnv('EXPO_PUBLIC_SUPABASE_URL', projectUrl);
  console.log(`   ok    wrote the ${publishable.type === 'publishable' ? 'publishable' : 'anon'} key and URL to .env.local`);
} else {
  console.log(`   would write the ${publishable.type === 'publishable' ? 'publishable' : 'anon'} key to .env.local`);
}

// 2. Extensions ---------------------------------------------------------------
step(2, 'Extensions pg_cron and pg_net');
const installed = new Set((await sql(`select extname from pg_extension`)).map((r) => r.extname));
for (const [ext, ddl] of [
  ['pg_cron', 'create extension if not exists pg_cron'],
  ['pg_net', 'create extension if not exists pg_net with schema extensions'],
]) {
  if (installed.has(ext)) console.log(`   ok    ${ext} already on`);
  else if (apply) await attempt(`turned on ${ext}`, () => sql(ddl));
  else console.log(`   would turn on ${ext}`);
}

// 3. Migrations ---------------------------------------------------------------
step(3, 'Migrations');
const files = readdirSync(path.join(root, 'supabase', 'migrations')).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
const tracked = await sql(`select to_regclass('supabase_migrations.schema_migrations') is not null as ok`);
const applied = new Set(tracked[0]?.ok ? (await sql(`select version from supabase_migrations.schema_migrations`)).map((r) => r.version) : []);
const pending = files.filter((f) => !applied.has(f.split('_')[0]));
console.log(`   ${files.length - pending.length} applied, ${pending.length} to apply${pending.length ? `: ${pending.join(', ')}` : ''}`);
if (pending.length && !tracked[0]?.ok && applied.size === 0) {
  const existing = await sql(`select count(*)::int as n from information_schema.tables where table_schema = 'public'`);
  if (existing[0].n > 0) {
    console.error(`   The public schema already has ${existing[0].n} tables but no migration history. This script won't apply the`);
    console.error('   schema on top of unknown tables; use an empty project, or record the history with `supabase migration repair`.');
    process.exit(1);
  }
}
if (apply && pending.length) {
  await sql(`create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text)`);
  for (const f of pending) {
    const [version, ...rest] = f.replace(/\.sql$/, '').split('_');
    const body = readFileSync(path.join(root, 'supabase', 'migrations', f), 'utf8');
    // One request is one implicit transaction: the file and its history row land together or not at all.
    const ok = await attempt(`applied ${f}`, () =>
      sql(`${body}\n;\ninsert into supabase_migrations.schema_migrations (version, name, statements) values (${lit(version)}, ${lit(rest.join('_'))}, array[]::text[]);`),
    );
    if (!ok) {
      console.log('   Stopped: later migrations depend on this one. Fix it and re-run; applied ones are skipped.');
      process.exit(1);
    }
  }
}

// 4. Vault secrets ------------------------------------------------------------
step(4, 'Vault secrets for notifications');
if (!vars.NOTIFY_WEBHOOK_SECRET) {
  failures += 1;
  console.log('   FAIL  NOTIFY_WEBHOOK_SECRET is empty in .env.local (any long random string)');
} else if (apply) {
  for (const [name, value] of [
    ['functions_url', `${projectUrl}/functions/v1`],
    ['notify_webhook_secret', vars.NOTIFY_WEBHOOK_SECRET],
  ]) {
    await attempt(`vault secret ${name}`, () =>
      sql(`do $$ begin
        if exists (select 1 from vault.secrets where name = ${lit(name)}) then
          perform vault.update_secret((select id from vault.secrets where name = ${lit(name)}), ${lit(value)});
        else
          perform vault.create_secret(${lit(value)}, ${lit(name)});
        end if;
      end $$`),
    );
  }
} else {
  console.log('   would store functions_url and notify_webhook_secret');
}

// 5. Auth ---------------------------------------------------------------------
step(5, 'Auth: email codes, template, token hook, SMTP');
const template = readFileSync(path.join(root, 'supabase', 'templates', 'otp.html'), 'utf8');
const from = (vars.RESEND_FROM ?? '').match(/^\s*(.*?)\s*<([^>]+)>\s*$/) ?? [null, 'Vivah', (vars.RESEND_FROM ?? '').trim()];
const appUrl = vars.EXPO_PUBLIC_APP_URL || 'https://vivah.com.np';
const auth = {
  site_url: appUrl,
  uri_allow_list: ['vivah://**', 'http://localhost:8081/**', 'http://localhost:8082/**', `${appUrl}/**`].join(','),
  jwt_exp: 3600,
  refresh_token_rotation_enabled: true,
  external_email_enabled: true,
  external_phone_enabled: false,
  disable_signup: false,
  mailer_autoconfirm: true,
  mailer_otp_length: 6,
  mailer_otp_exp: 600,
  mailer_subjects_magic_link: 'Your Vivah sign-in code',
  mailer_templates_magic_link_content: template,
  // A brand-new address can get the confirmation email instead; it carries the same code.
  mailer_subjects_confirmation: 'Your Vivah sign-in code',
  mailer_templates_confirmation_content: template,
  hook_custom_access_token_enabled: true,
  hook_custom_access_token_uri: 'pg-functions://postgres/public/custom_access_token_hook',
};
if (vars.RESEND_API_KEY && from[2]) {
  Object.assign(auth, {
    smtp_host: 'smtp.resend.com',
    smtp_port: '465',
    smtp_user: 'resend',
    smtp_pass: vars.RESEND_API_KEY,
    smtp_admin_email: from[2],
    smtp_sender_name: from[1] || 'Vivah',
    smtp_max_frequency: 30,
    rate_limit_email_sent: 100,
  });
} else {
  console.log('   note  RESEND_API_KEY or RESEND_FROM is empty: Supabase keeps its built-in email (a few an hour, team addresses only)');
}
if (apply) await attempt('auth settings', () => api('PATCH', '/config/auth', auth));
else console.log(`   would set ${Object.keys(auth).filter((k) => k !== 'smtp_pass').join(', ')}`);
if (/@resend\.dev$/.test(from[2] ?? '')) {
  console.log('   note  RESEND_FROM is onboarding@resend.dev: codes reach only your Resend account email until you verify a domain');
}

// 6. Edge Functions -----------------------------------------------------------
step(6, 'Edge Function secrets and deploy');
const cli = (cliArgs) => {
  const r = spawnSync('npx', ['-y', 'supabase@latest', ...cliArgs, '--project-ref', ref], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: token },
  });
  if (r.status !== 0) throw new Error(`supabase ${cliArgs.slice(0, 2).join(' ')} exited with ${r.status}`);
};
const functions = readdirSync(path.join(root, 'supabase', 'functions')).filter((d) => !d.startsWith('_') && existsSync(path.join(root, 'supabase', 'functions', d, 'index.ts')));
if (apply) {
  await attempt('wrote supabase/.env.functions.local', () => {
    const r = spawnSync(process.execPath, [path.join(root, 'scripts', 'env-functions.mjs')], { cwd: root, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(r.stderr.trim());
  });
  // The CLI prints only the names of the secrets it sets.
  await attempt('function secrets', () => cli(['secrets', 'set', '--env-file', 'supabase/.env.functions.local']));
  // Each function's verify_jwt comes from supabase/config.toml.
  await attempt(`deployed ${functions.join(', ')}`, () => cli(['functions', 'deploy', '--use-api']));
} else {
  console.log(`   would set the function secrets and deploy ${functions.join(', ')}`);
}

// 7. Staff code and first super admin -----------------------------------------
if (staffCode) {
  step(7, 'Staff access code');
  if (staffCode.trim().length < 10) {
    failures += 1;
    console.log('   FAIL  use a code of at least 10 characters');
  } else if (apply) {
    await attempt('added (stored hashed; codes are not case-sensitive)', () =>
      // pgcrypto lives in the extensions schema on Supabase.
      sql(`insert into staff_access_codes (code_hash) values (extensions.crypt(upper(trim(${lit(staffCode)})), extensions.gen_salt('bf')))`),
    );
  } else console.log('   would add it, hashed');
}
if (superAdmin) {
  step(staffCode ? 8 : 7, `Super admin ${superAdmin}`);
  const email = lit(superAdmin.trim().toLowerCase());
  const found = await sql(`select id from auth.users where lower(email) = ${email}`);
  if (!found.length) {
    failures += 1;
    console.log('   FAIL  no account with that email yet: sign up in the app as staff first');
  } else {
    await attempt('approved as super admin', () =>
      sql(`update staff_requests set status = 'APPROVED', staff_role = 'super_admin' where user_id = (select id from auth.users where lower(email) = ${email});
        insert into user_roles (user_id, role) select id, 'SUPER_ADMIN' from auth.users where lower(email) = ${email} on conflict do nothing;`),
    );
  }
}

// 8. Health and switch-over ---------------------------------------------------
step('✓', 'Health');
const health = await fetch(`${projectUrl}/functions/v1/health`).then(
  async (r) => `${r.status} ${await r.text()}`,
  (e) => `unreachable (${e.message})`,
);
console.log(`   GET /functions/v1/health → ${health}`);
const healthy = health.startsWith('200');
if (apply && healthy && failures === 0 && vars.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
  if (vars.EXPO_PUBLIC_BACKEND !== 'supabase') {
    setEnv('EXPO_PUBLIC_BACKEND', 'supabase');
    console.log('   switched .env.local to EXPO_PUBLIC_BACKEND=supabase; restart `npx expo start --clear`');
  }
}
if (!vars.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME) console.log('\nStill to do: EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME is empty, so uploads will fail. Paste it, re-run with --apply, then `node scripts/cloudinary-setup.mjs --apply`.');
console.log(failures ? `\n${failures} step(s) failed; fix and re-run (finished steps are skipped or harmless to repeat).` : apply ? '\nDone.' : '\nDry run finished. Run again with --apply.');
process.exit(failures ? 1 : 0);
