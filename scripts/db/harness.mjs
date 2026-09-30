/**
 * A throwaway Postgres for checking the SQL without a Supabase project:
 * PGlite (Postgres compiled to WebAssembly) in this Node process, with a
 * small shim for what Supabase provides (the auth schema, auth.uid(), the
 * anon/authenticated/service_role/supabase_auth_admin roles, their default
 * grants, and the storage schema's buckets, objects and foldername()).
 *
 * Nothing here touches a real database. Used by db-check.mjs and parity.mjs.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const MIGRATIONS = path.join(root, 'supabase', 'migrations');

const SHIM = `
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text, phone text, raw_user_meta_data jsonb not null default '{}', created_at timestamptz not null default now());
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
do $$ begin create role supabase_auth_admin nologin; exception when duplicate_object then null; end $$;
grant usage on schema public to supabase_auth_admin;

-- Supabase Storage, just enough for bucket rows and object policies.
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text not null, public boolean not null default false, file_size_limit bigint, allowed_mime_types text[], created_at timestamptz not null default now());
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text not null, owner uuid, metadata jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (bucket_id, name));
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)]
$$;
grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.objects to authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;
`;

/** The migration files in order. */
export const migrationFiles = () => readdirSync(MIGRATIONS).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();

/** A fresh database with the shim and every migration applied. Throws with the file name on the first failure. */
export async function freshDb({ upTo } = {}) {
  const db = await PGlite.create({ extensions: { btree_gist, pg_trgm, pgcrypto } });
  await db.exec(SHIM);
  for (const file of migrationFiles()) {
    if (upTo && file > upTo) break;
    try {
      await db.exec(readFileSync(path.join(MIGRATIONS, file), 'utf8'));
    } catch (e) {
      const err = new Error(`${file}: ${e.message}`);
      err.file = file;
      err.detail = e;
      throw err;
    }
  }
  return db;
}

/** Runs a callback as a signed-in user (RLS applies), then switches back to the superuser. */
export async function asUser(db, userId, fn, role = 'authenticated') {
  await db.exec(`set request.jwt.claim.sub = '${userId}'; set request.jwt.claim.role = '${role}'; set role ${role};`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; reset request.jwt.claim.sub; reset request.jwt.claim.role;`);
  }
}
