-- =============================================================================
-- Bug reports (shake to report).
--
--   bug_reports               what anyone using the app sends by shaking the
--                             phone (or Settings → Help → Report a problem):
--                             the description, a screenshot, the screen, the
--                             account, device and app details, recent screens
--                             and console errors. Mirrors BugReportRecord in
--                             types/platform.ts and store/db/support.ts.
--   rpc_submit_bug_report     signed in or signed out; rate limited.
--   rpc_list_bug_reports      super admins (admin.full): newest first, no screenshots.
--   rpc_get_bug_report        super admins: one report with its screenshot.
--   rpc_set_bug_report_status super admins: new / fixed / dismissed, audited.
--   rpc_delete_bug_reports    super admins, audited.
-- NOT DEPLOYED. Never apply without the owner's say-so (AGENTS.md §1).
-- =============================================================================

create table bug_reports (
  id             uuid primary key default gen_random_uuid(),
  reporter_id    uuid references profiles (id) on delete set null,
  description    text not null check (length(trim(description)) between 1 and 4000),
  -- A JPEG or PNG data URI, as the app captured it.
  screenshot     text check (screenshot is null or (length(screenshot) <= 3000000 and screenshot like 'data:image/%')),
  route          text not null default '/' check (length(route) <= 300),
  params         jsonb not null default '{}',
  -- What the app said about the account at the time (name, role, staff role).
  account        jsonb,
  device         jsonb not null default '{}',
  app            jsonb not null default '{}',
  recent_routes  jsonb not null default '[]',
  logs           jsonb not null default '[]',
  captured_at    timestamptz,
  status         text not null default 'new' check (status in ('new', 'fixed', 'dismissed')),
  note           text check (note is null or length(note) <= 500),
  resolved_by    uuid references profiles (id) on delete set null,
  resolved_at    timestamptz,
  created_at     timestamptz not null default now()
);
create index bug_reports_created on bug_reports (created_at desc);
create index bug_reports_reporter on bug_reports (reporter_id, created_at desc);

alter table bug_reports enable row level security;
-- Only super admins read them; everything else goes through the RPCs below.
create policy "bug reports: super admin read" on bug_reports for select using (has_permission('admin.full'));
revoke insert, update, delete on bug_reports from anon, authenticated;
revoke all on bug_reports from anon;

-- Anyone can report, signed in or not. Signed-in users may send 10 reports in
-- 10 minutes; all signed-out visitors together 30, so a script can't flood it.
create or replace function rpc_submit_bug_report(p_report jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  rid uuid;
  shot text := nullif(p_report->>'screenshot', '');
  admin uuid;
begin
  if length(trim(coalesce(p_report->>'description', ''))) = 0 then perform vivah_fail('Describe what went wrong'); end if;
  if me is not null and (select count(*) from bug_reports where reporter_id = me and created_at > now() - interval '10 minutes') >= 10 then
    perform vivah_fail('You have sent a lot of reports just now. Try again in a few minutes.', 'program_limit_exceeded');
  end if;
  if me is null and (select count(*) from bug_reports where reporter_id is null and created_at > now() - interval '10 minutes') >= 30 then
    perform vivah_fail('Too many reports just now. Try again in a few minutes.', 'program_limit_exceeded');
  end if;
  if shot is not null and (length(shot) > 3000000 or shot not like 'data:image/%') then shot := null; end if;

  insert into bug_reports (reporter_id, description, screenshot, route, params, account, device, app, recent_routes, logs, captured_at)
  values (
    me,
    left(trim(p_report->>'description'), 4000),
    shot,
    left(coalesce(p_report->>'route', '/'), 300),
    case when jsonb_typeof(p_report->'params') = 'object' then p_report->'params' else '{}' end,
    case when me is not null and jsonb_typeof(p_report->'account') = 'object' then p_report->'account' end,
    case when jsonb_typeof(p_report->'device') = 'object' then p_report->'device' else '{}' end,
    case when jsonb_typeof(p_report->'app') = 'object' then p_report->'app' else '{}' end,
    case when jsonb_typeof(p_report->'recentRoutes') = 'array' then p_report->'recentRoutes' else '[]' end,
    case when jsonb_typeof(p_report->'logs') = 'array' then p_report->'logs' else '[]' end,
    case when coalesce(p_report->>'capturedAt', '') ~ '^\d{4}-\d{2}-\d{2}T' then (p_report->>'capturedAt')::timestamptz end
  )
  returning id into rid;

  for admin in select r.user_id from user_roles r where r.role = 'SUPER_ADMIN' loop
    perform vivah_notify(admin, 'system', 'New bug report', left(trim(p_report->>'description'), 120), '/platform/admin/bug/' || rid);
  end loop;
  return rid;
end;
$$;

-- The report as the app's BugReportRecord (camelCase), with or without the screenshot.
create or replace function vivah_bug_report_json(b bug_reports, p_with_screenshot boolean) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', b.id,
    'description', b.description,
    'screenshot', case when p_with_screenshot then b.screenshot end,
    'route', b.route,
    'params', b.params,
    'account', b.account,
    'device', b.device,
    'app', b.app,
    'recentRoutes', b.recent_routes,
    'logs', b.logs,
    'capturedAt', coalesce(b.captured_at, b.created_at),
    'receivedAt', b.created_at,
    'status', b.status,
    'note', b.note,
    'resolvedBy', (select full_name from profiles where id = b.resolved_by),
    'resolvedAt', b.resolved_at
  )
$$;

create or replace function rpc_list_bug_reports(p_limit integer default 200) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_permission('admin.full') then perform vivah_fail('Only super admins can read bug reports', 'insufficient_privilege'); end if;
  return coalesce((
    select jsonb_agg(vivah_bug_report_json(b, false) order by b.created_at desc)
    from (select * from bug_reports order by created_at desc limit least(greatest(coalesce(p_limit, 200), 1), 500)) b
  ), '[]');
end;
$$;

create or replace function rpc_get_bug_report(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_permission('admin.full') then perform vivah_fail('Only super admins can read bug reports', 'insufficient_privilege'); end if;
  return (select vivah_bug_report_json(b, true) from bug_reports b where b.id = p_id);
end;
$$;

create or replace function rpc_set_bug_report_status(p_id uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_permission('admin.full') then perform vivah_fail('Only super admins can change bug reports', 'insufficient_privilege'); end if;
  if p_status not in ('new', 'fixed', 'dismissed') then perform vivah_fail('Pick new, fixed or dismissed'); end if;
  update bug_reports set
    status = p_status,
    note = coalesce(nullif(left(trim(p_note), 500), ''), note),
    resolved_by = case when p_status = 'new' then null else auth.uid() end,
    resolved_at = case when p_status = 'new' then null else now() end
  where id = p_id;
  if not found then perform vivah_fail('Bug report not found', 'no_data_found'); end if;
  perform vivah_audit('bug.' || p_status, 'bug_report', p_id, case when nullif(trim(p_note), '') is not null then jsonb_build_object('note', left(trim(p_note), 500)) end);
end;
$$;

create or replace function rpc_delete_bug_reports(p_ids uuid[]) returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer;
  rid uuid;
begin
  if not has_permission('admin.full') then perform vivah_fail('Only super admins can delete bug reports', 'insufficient_privilege'); end if;
  if coalesce(array_length(p_ids, 1), 0) = 0 then perform vivah_fail('Select something to delete'); end if;
  delete from bug_reports where id = any (p_ids);
  get diagnostics n = row_count;
  foreach rid in array p_ids loop perform vivah_audit('bug.delete', 'bug_report', rid, null); end loop;
  return n;
end;
$$;

-- Grants -------------------------------------------------------------------------

revoke execute on function
  rpc_submit_bug_report(jsonb), vivah_bug_report_json(bug_reports, boolean), rpc_list_bug_reports(integer),
  rpc_get_bug_report(uuid), rpc_set_bug_report_status(uuid, text, text), rpc_delete_bug_reports(uuid[])
  from public, anon, authenticated;
grant execute on function rpc_submit_bug_report(jsonb) to anon, authenticated;
grant execute on function rpc_list_bug_reports(integer), rpc_get_bug_report(uuid), rpc_set_bug_report_status(uuid, text, text), rpc_delete_bug_reports(uuid[]) to authenticated;
