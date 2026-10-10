-- =============================================================================
-- App content edited by a super admin (Content studio), and the one call that
-- carries the whole console configuration to every device.
--
--   app_content              one row: replacement photos, listing edits, the
--                            order and headings of the couple's home, home
--                            banners and brand details, as the app's
--                            AppContent (types/content.ts), plus the revision
--                            every device compares against.
--   rpc_app_config           everyone, signed in or not: the content, the text
--                            overrides and the feature switches (0016) in one
--                            answer; with p_known equal to the current revision
--                            it answers with the revision only.
--   rpc_save_app_content     super admins (admin.full), audited.
--   rpc_save_text_overrides  super admins: replaces every text override.
--   rpc_save_feature_flags   super admins: replaces every feature switch.
--
-- Each save moves the revision on, so phones that ask again pick the change up
-- (hooks/useContentSync.ts asks when the app opens, returns to the foreground
-- and every 45 seconds while it is open).
-- NOT DEPLOYED. Never apply without the owner's say-so (AGENTS.md §1).
-- =============================================================================

create table app_content (
  id          text primary key default 'live' check (id = 'live'),
  content     jsonb not null default '{}' check (jsonb_typeof(content) = 'object'),
  revision    bigint not null default 0,
  updated_by  uuid references profiles (id) on delete set null,
  updated_at  timestamptz not null default now()
);
insert into app_content (id) values ('live');

alter table app_content enable row level security;
-- Every client reads it (signed-out visitors too: the welcome screen shows the photos).
create policy "app content: read" on app_content for select using (true);
-- Writes go through the RPCs below only.
revoke insert, update, delete on app_content from anon, authenticated;

-- Moves the revision on; every save calls it.
create or replace function vivah_bump_app_revision() returns bigint
language sql security definer set search_path = public as $$
  insert into app_content (id, revision, updated_by) values ('live', 1, auth.uid())
  on conflict (id) do update set revision = app_content.revision + 1, updated_by = auth.uid(), updated_at = now()
  returning revision
$$;

create or replace function rpc_app_config(p_known bigint default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  rev bigint;
  body jsonb;
begin
  select revision, content into rev, body from app_content where id = 'live';
  rev := coalesce(rev, 0);
  if p_known is not null and p_known = rev then return jsonb_build_object('revision', rev); end if;
  return jsonb_build_object(
    'revision', rev,
    'content', coalesce(body, '{}'),
    'texts', coalesce((select jsonb_object_agg(source, jsonb_strip_nulls(jsonb_build_object('en', text_en, 'ne', text_ne))) from text_overrides), '{}'),
    'flags', coalesce((select jsonb_object_agg(id, enabled) from feature_flags), '{}')
  );
end;
$$;

create or replace function rpc_save_app_content(p_content jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
begin
  if not has_permission('admin.full') then perform vivah_fail('Only super admins can change the app’s content', 'insufficient_privilege'); end if;
  if p_content is null or jsonb_typeof(p_content) <> 'object' then perform vivah_fail('The content must be an object'); end if;
  if length(p_content::text) > 2000000 then perform vivah_fail('That is too much content to save at once. Use links for large photos.', 'program_limit_exceeded'); end if;
  insert into app_content (id, content) values ('live', p_content)
  on conflict (id) do update set content = excluded.content;
  perform vivah_audit('content.publish', 'app_content', null, jsonb_build_object('bytes', length(p_content::text)));
  return vivah_bump_app_revision();
end;
$$;

create or replace function rpc_save_text_overrides(p_texts jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  if not has_permission('admin.full') then perform vivah_fail('Only super admins can change the app’s text', 'insufficient_privilege'); end if;
  if p_texts is null or jsonb_typeof(p_texts) <> 'object' then perform vivah_fail('The text changes must be an object'); end if;
  delete from text_overrides where true;
  insert into text_overrides (source, text_en, text_ne, updated_by)
  select trim(t.key), nullif(left(trim(t.value->>'en'), 500), ''), nullif(left(trim(t.value->>'ne'), 500), ''), auth.uid()
  from jsonb_each(p_texts) t
  where jsonb_typeof(t.value) = 'object'
    and length(trim(t.key)) between 1 and 500
    and (nullif(trim(t.value->>'en'), '') is not null or nullif(trim(t.value->>'ne'), '') is not null)
  on conflict (source) do update set text_en = excluded.text_en, text_ne = excluded.text_ne, updated_by = excluded.updated_by;
  get diagnostics n = row_count;
  perform vivah_audit('text.publish', 'text_overrides', null, jsonb_build_object('count', n));
  return vivah_bump_app_revision();
end;
$$;

create or replace function rpc_save_feature_flags(p_flags jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  if not has_permission('admin.full') then perform vivah_fail('Only super admins can switch features', 'insufficient_privilege'); end if;
  if p_flags is null or jsonb_typeof(p_flags) <> 'object' then perform vivah_fail('The feature switches must be an object'); end if;
  delete from feature_flags where true;
  insert into feature_flags (id, enabled, updated_by)
  select f.key, (f.value)::text::boolean, auth.uid()
  from jsonb_each(p_flags) f
  where jsonb_typeof(f.value) = 'boolean' and length(f.key) between 3 and 120
  on conflict (id) do update set enabled = excluded.enabled, updated_by = excluded.updated_by;
  get diagnostics n = row_count;
  perform vivah_audit('feature.publish', 'feature_flags', null, jsonb_build_object('count', n));
  return vivah_bump_app_revision();
end;
$$;

-- Grants -------------------------------------------------------------------------

revoke execute on function
  vivah_bump_app_revision(), rpc_app_config(bigint), rpc_save_app_content(jsonb),
  rpc_save_text_overrides(jsonb), rpc_save_feature_flags(jsonb)
  from public, anon, authenticated;
grant execute on function rpc_app_config(bigint) to anon, authenticated;
grant execute on function rpc_save_app_content(jsonb), rpc_save_text_overrides(jsonb), rpc_save_feature_flags(jsonb) to authenticated;
