-- =============================================================================
-- Edit profile and Help and support.
--
--   rpc_update_my_profile          the signed-in user edits their own name,
--                                  city, photo and, by role, business name,
--                                  headline, bio, experience and languages
--                                  (same rules as services/profile.ts). Email
--                                  and phone are how people sign in, so staff
--                                  change those.
--   support_tickets                help requests from couples, businesses and
--   support_messages               freelancers, and the conversation on each
--                                  (internal notes are staff-only). Mirrors
--                                  SupportTicket in types/platform.ts and the
--                                  actions in store/db/support.ts.
--   rpc_open_support_ticket        the owner opens one (max 5 open), the team
--                                  is told.
--   rpc_reply_support_ticket       the owner or staff with support.manage;
--                                  staff may add internal notes.
--   rpc_set_support_ticket_status  owners: solved, closed or reopen; staff: any.
--   rpc_assign_support_ticket      staff: owner on the team and priority.
--   rpc_rate_support_ticket        the owner, once solved (1–5).
--   rpc_my_support_tickets         the caller's requests (staff: every one),
--                                  as the app's SupportTicket JSON.
-- NOT DEPLOYED. Never apply without the owner's say-so (AGENTS.md §1).
-- =============================================================================

-- Permission ---------------------------------------------------------------------

insert into permissions (id) values ('support.manage') on conflict (id) do nothing;
insert into staff_permissions (role, permission) values
  ('SUPPORT', 'support.manage'),
  ('WEDDING_COORDINATOR', 'support.manage'),
  ('PLATFORM_ADMIN', 'support.manage'),
  ('SUPER_ADMIN', 'support.manage')
on conflict do nothing;

-- Profile ------------------------------------------------------------------------

create or replace function rpc_update_my_profile(p_patch jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v_name text := nullif(regexp_replace(trim(coalesce(p_patch->>'name', '')), '\s+', ' ', 'g'), '');
  v_city text := nullif(trim(coalesce(p_patch->>'city', '')), '');
  v_business text := nullif(regexp_replace(trim(coalesce(p_patch->>'businessName', '')), '\s+', ' ', 'g'), '');
  v_years integer;
begin
  if me is null then perform vivah_fail('Sign in to edit your profile', 'insufficient_privilege'); end if;
  if p_patch ? 'name' then
    if v_name is null or length(v_name) < 2 then perform vivah_fail('Enter your name'); end if;
    if length(v_name) > 60 then perform vivah_fail('Keep your name under 60 characters'); end if;
    update profiles set full_name = v_name where id = me;
  end if;
  if p_patch ? 'city' then
    if v_city is null or length(v_city) > 60 then perform vivah_fail('Pick a city in Nepal'); end if;
    update profiles set city = v_city where id = me;
  end if;
  if p_patch ? 'photo' then
    if p_patch->>'photo' is not null and p_patch->>'photo' !~ '^https://' then perform vivah_fail('That photo can’t be used'); end if;
    update profiles set avatar_url = nullif(p_patch->>'photo', '') where id = me;
  end if;
  if p_patch ? 'businessName' then
    if v_business is null or length(v_business) < 2 then perform vivah_fail('Enter your business name'); end if;
    update organizations o set name = left(v_business, 80)
    from organization_members m
    where m.org_id = o.id and m.user_id = me and m.member_role = 'OWNER' and o.kind = 'PROVIDER';
  end if;
  if exists (select 1 from freelancers where id = me) then
    if p_patch ? 'headline' then update freelancers set headline = nullif(left(trim(p_patch->>'headline'), 80), '') where id = me; end if;
    if p_patch ? 'bio' then update freelancers set bio = nullif(left(trim(p_patch->>'bio'), 600), '') where id = me; end if;
    if p_patch ? 'experienceYears' then
      v_years := round((p_patch->>'experienceYears')::numeric);
      if v_years is null or v_years < 0 or v_years > 60 then perform vivah_fail('Enter your years of experience (0 to 60)'); end if;
      update freelancers set experience_years = v_years where id = me;
    end if;
    if jsonb_typeof(p_patch->'languages') = 'array' then
      update freelancers set languages = (select coalesce(array_agg(distinct trim(l)) filter (where trim(l) <> ''), '{}') from jsonb_array_elements_text(p_patch->'languages') l) where id = me;
    end if;
  end if;
  perform vivah_audit('profile.update', 'profile', me, p_patch - 'photo');
end;
$$;

-- Help requests -----------------------------------------------------------------

create table support_tickets (
  id           uuid primary key default gen_random_uuid(),
  code         text unique not null,
  account_id   uuid not null references profiles (id) on delete cascade,
  role         text not null check (role in ('customer', 'vendor', 'freelancer')),
  topic        text not null check (topic in ('booking', 'payment', 'account', 'vendor', 'technical', 'feedback', 'other')),
  subject      text not null check (length(trim(subject)) between 4 and 120),
  priority     text not null default 'normal' check (priority in ('normal', 'high', 'urgent')),
  status       text not null default 'open' check (status in ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
  project_id   uuid references wedding_projects (id) on delete set null,
  assigned_to  uuid references profiles (id) on delete set null,
  resolved_at  timestamptz,
  rating       smallint check (rating between 1 and 5),
  rating_note  text check (rating_note is null or length(rating_note) <= 300),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index support_tickets_account on support_tickets (account_id, updated_at desc);
create index support_tickets_queue on support_tickets (status, priority, updated_at);

create table support_messages (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references support_tickets (id) on delete cascade,
  author_id   uuid references profiles (id) on delete set null,
  author_name text not null,
  author_role text not null check (author_role in ('customer', 'vendor', 'freelancer', 'platform')),
  body        text not null check (length(trim(body)) between 1 and 4000),
  internal    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index support_messages_ticket on support_messages (ticket_id, created_at);

alter table support_tickets enable row level security;
alter table support_messages enable row level security;
-- Owners read their own requests and the public messages on them; staff who answer help requests read everything.
create policy "support tickets: owner or desk read" on support_tickets for select
  using (account_id = auth.uid() or has_permission('support.manage'));
create policy "support messages: owner public or desk read" on support_messages for select
  using (
    has_permission('support.manage')
    or (not internal and exists (select 1 from support_tickets t where t.id = ticket_id and t.account_id = auth.uid()))
  );
-- Every change goes through the RPCs below.
revoke insert, update, delete on support_tickets, support_messages from anon, authenticated;
revoke all on support_tickets, support_messages from anon;

-- The app's name for the caller's role.
create or replace function vivah_app_role(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from user_roles where user_id = p_user and role in ('SUPER_ADMIN', 'PLATFORM_ADMIN', 'FINANCE', 'SUPPORT', 'WEDDING_COORDINATOR')) then 'platform'
    when exists (select 1 from user_roles where user_id = p_user and role = 'SERVICE_PROVIDER') then 'vendor'
    when exists (select 1 from user_roles where user_id = p_user and role = 'FREELANCER') then 'freelancer'
    else 'customer'
  end
$$;

-- Tells everyone who answers help requests.
create or replace function vivah_notify_support_desk(p_title text, p_body text, p_href text) returns void
language plpgsql security definer set search_path = public as $$
declare
  staff uuid;
begin
  for staff in
    select distinct r.user_id from user_roles r join staff_permissions sp on sp.role = r.role
    join profiles p on p.id = r.user_id
    where sp.permission = 'support.manage' and not p.suspended
  loop
    perform vivah_notify(staff, 'message', p_title, p_body, p_href);
  end loop;
end;
$$;

-- Where each role reads its own request.
create or replace function vivah_support_href(p_role text, p_id uuid) returns text
language sql immutable as $$
  select case p_role when 'vendor' then '/business/support/' when 'freelancer' then '/freelancer/support/' else '/support/' end || p_id
$$;

create or replace function rpc_open_support_ticket(p_topic text, p_subject text, p_body text, p_priority text default 'normal', p_project uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  my_role text;
  my_name text;
  tid uuid;
  v_code text;
  v_subject text := regexp_replace(trim(coalesce(p_subject, '')), '\s+', ' ', 'g');
  v_body text := trim(coalesce(p_body, ''));
  v_priority text := case when p_priority in ('high', 'urgent') then p_priority else 'normal' end;
begin
  if me is null then perform vivah_fail('Sign in to ask for help', 'insufficient_privilege'); end if;
  my_role := vivah_app_role(me);
  if my_role = 'platform' then perform vivah_fail('Staff answer help requests at Help desk'); end if;
  if p_topic not in ('booking', 'payment', 'account', 'vendor', 'technical', 'feedback', 'other') then perform vivah_fail('Pick what it is about'); end if;
  if length(v_subject) < 4 then perform vivah_fail('Add a short subject'); end if;
  if length(v_body) < 10 then perform vivah_fail('Tell us a little more (at least 10 characters)'); end if;
  if p_project is not null and not exists (
    select 1 from wedding_projects w where w.id = p_project
      and (w.customer_id = me or exists (select 1 from project_collaborators c where c.project_id = w.id and c.user_id = me))
  ) then perform vivah_fail('That celebration isn’t yours'); end if;
  if (select count(*) from support_tickets where account_id = me and status in ('open', 'in_progress', 'waiting')) >= 5 then
    perform vivah_fail('You already have 5 open requests. Add to one of them, or mark one solved.', 'program_limit_exceeded');
  end if;
  select full_name into my_name from profiles where id = me;
  v_code := 'SUP-' || extract(year from now())::int || '-' || lpad((coalesce((select max(split_part(code, '-', 3)::int) from support_tickets), 100) + 1)::text, 4, '0');
  insert into support_tickets (code, account_id, role, topic, subject, priority, project_id)
  values (v_code, me, my_role, p_topic, left(v_subject, 120), v_priority, p_project)
  returning id into tid;
  insert into support_messages (ticket_id, author_id, author_name, author_role, body) values (tid, me, coalesce(my_name, 'Vivah user'), my_role, left(v_body, 4000));
  insert into support_messages (ticket_id, author_id, author_name, author_role, body)
  values (tid, null, 'Vivah support', 'platform', case when v_priority = 'urgent'
    then 'Thank you, we have your urgent request and someone will call you shortly. For anything on the day of a function, you can also call us any time.'
    else 'Thank you, we have your request. The team replies within two working hours, 9am to 7pm.' end);
  perform vivah_notify_support_desk('Help request ' || v_code, coalesce(my_name, 'Someone') || ': ' || left(v_subject, 90), '/platform/support/' || tid);
  perform vivah_audit('support.open', 'support_ticket', tid, jsonb_build_object('topic', p_topic, 'priority', v_priority));
  return tid;
end;
$$;

create or replace function rpc_reply_support_ticket(p_id uuid, p_body text, p_internal boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  t support_tickets;
  staff boolean := has_permission('support.manage');
  my_name text;
  v_body text := trim(coalesce(p_body, ''));
  internal boolean;
begin
  select * into t from support_tickets where id = p_id for update;
  if not found then perform vivah_fail('Help request not found', 'no_data_found'); end if;
  if not staff and t.account_id is distinct from me then perform vivah_fail('This request isn’t yours', 'insufficient_privilege'); end if;
  if length(v_body) = 0 then perform vivah_fail('Write a message first'); end if;
  if not staff and t.status = 'closed' then perform vivah_fail('This request is closed. Open a new one and we’ll pick it up.'); end if;
  internal := staff and coalesce(p_internal, false);
  select full_name into my_name from profiles where id = me;
  insert into support_messages (ticket_id, author_id, author_name, author_role, body, internal)
  values (p_id, me, coalesce(my_name, 'Vivah team'), case when staff then 'platform' else t.role end, left(v_body, 4000), internal);
  if internal then
    update support_tickets set updated_at = now() where id = p_id;
    return;
  end if;
  update support_tickets set
    status = case when staff then (case when t.status = 'closed' then 'closed' else 'waiting' end) else 'open' end,
    resolved_at = case when staff then resolved_at else null end,
    assigned_to = case when staff and assigned_to is null then me else assigned_to end,
    updated_at = now()
  where id = p_id;
  if staff then
    perform vivah_notify(t.account_id, 'message', 'Reply to ' || t.code, coalesce(my_name, 'Vivah') || ': ' || left(v_body, 90), vivah_support_href(t.role, p_id));
  elsif t.assigned_to is not null then
    perform vivah_notify(t.assigned_to, 'message', 'New message on ' || t.code, coalesce(my_name, 'Someone') || ': ' || left(v_body, 90), '/platform/support/' || p_id);
  else
    perform vivah_notify_support_desk('New message on ' || t.code, coalesce(my_name, 'Someone') || ': ' || left(v_body, 90), '/platform/support/' || p_id);
  end if;
  perform vivah_audit('support.reply', 'support_ticket', p_id, null);
end;
$$;

create or replace function rpc_set_support_ticket_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  t support_tickets;
  staff boolean := has_permission('support.manage');
  my_name text;
begin
  if p_status not in ('open', 'in_progress', 'waiting', 'resolved', 'closed') then perform vivah_fail('Unknown status'); end if;
  select * into t from support_tickets where id = p_id for update;
  if not found then perform vivah_fail('Help request not found', 'no_data_found'); end if;
  if not staff then
    if t.account_id is distinct from me then perform vivah_fail('This request isn’t yours', 'insufficient_privilege'); end if;
    if p_status not in ('open', 'resolved', 'closed') then perform vivah_fail('Only the Vivah team can change that', 'insufficient_privilege'); end if;
  end if;
  if t.status = p_status then return; end if;
  update support_tickets set status = p_status, updated_at = now(), resolved_at = case when p_status in ('resolved', 'closed') then now() end where id = p_id;
  if not staff then
    select full_name into my_name from profiles where id = me;
    insert into support_messages (ticket_id, author_id, author_name, author_role, body)
    values (p_id, me, coalesce(my_name, 'Vivah user'), t.role, case when p_status = 'open' then 'I still need help with this.' else 'Marked as solved. Thank you!' end);
    if p_status = 'open' then
      if t.assigned_to is not null then perform vivah_notify(t.assigned_to, 'message', t.code || ' reopened', t.subject, '/platform/support/' || p_id);
      else perform vivah_notify_support_desk(t.code || ' reopened', t.subject, '/platform/support/' || p_id); end if;
    end if;
  elsif p_status in ('resolved', 'closed') then
    perform vivah_notify(t.account_id, 'message', t.code || ' is ' || p_status, case when p_status = 'resolved' then 'Tell us how we did, or reply if you still need help.' else t.subject end, vivah_support_href(t.role, p_id));
  end if;
  perform vivah_audit('support.' || p_status, 'support_ticket', p_id, null);
end;
$$;

create or replace function rpc_assign_support_ticket(p_id uuid, p_staff uuid, p_priority text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  t support_tickets;
begin
  if not has_permission('support.manage') then perform vivah_fail('You don’t have permission to answer help requests. Ask an admin if you need it.', 'insufficient_privilege'); end if;
  if p_priority is not null and p_priority not in ('normal', 'high', 'urgent') then perform vivah_fail('Unknown priority'); end if;
  if p_staff is not null and vivah_app_role(p_staff) <> 'platform' then perform vivah_fail('Pick someone on the Vivah team'); end if;
  select * into t from support_tickets where id = p_id for update;
  if not found then perform vivah_fail('Help request not found', 'no_data_found'); end if;
  update support_tickets set
    assigned_to = p_staff,
    priority = coalesce(p_priority, priority),
    status = case when status = 'open' and p_staff is not null then 'in_progress' else status end,
    updated_at = now()
  where id = p_id;
  if p_staff is not null and p_staff is distinct from auth.uid() then
    perform vivah_notify(p_staff, 'message', t.code || ' is yours', t.subject, '/platform/support/' || p_id);
  end if;
  perform vivah_audit('support.assign', 'support_ticket', p_id, jsonb_build_object('assignedTo', p_staff, 'priority', p_priority));
end;
$$;

create or replace function rpc_rate_support_ticket(p_id uuid, p_rating integer, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  t support_tickets;
begin
  select * into t from support_tickets where id = p_id for update;
  if not found or t.account_id is distinct from auth.uid() then perform vivah_fail('Help request not found', 'no_data_found'); end if;
  if t.status not in ('resolved', 'closed') then perform vivah_fail('You can rate the help once it is solved'); end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then perform vivah_fail('Pick one to five stars'); end if;
  update support_tickets set rating = p_rating, rating_note = nullif(left(trim(coalesce(p_note, '')), 300), '') where id = p_id;
  if t.assigned_to is not null then
    perform vivah_notify(t.assigned_to, 'review', t.code || ' rated ' || p_rating || ' of 5', t.subject, '/platform/support/' || p_id);
  end if;
  perform vivah_audit('support.rate', 'support_ticket', p_id, jsonb_build_object('rating', p_rating));
end;
$$;

-- The caller's requests (staff with support.manage: every request) as the app's SupportTicket JSON, newest activity first.
create or replace function rpc_my_support_tickets() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  staff boolean := has_permission('support.manage');
begin
  if auth.uid() is null then perform vivah_fail('Sign in first', 'insufficient_privilege'); end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id, 'code', t.code, 'accountId', t.account_id,
      'accountName', (select full_name from profiles where id = t.account_id),
      'role', t.role, 'topic', t.topic, 'subject', t.subject, 'priority', t.priority, 'status', t.status,
      'projectId', t.project_id, 'assignedTo', t.assigned_to,
      'assignedName', (select full_name from profiles where id = t.assigned_to),
      'resolvedAt', t.resolved_at, 'rating', t.rating, 'ratingNote', t.rating_note,
      'createdAt', t.created_at, 'updatedAt', t.updated_at,
      'messages', coalesce((
        select jsonb_agg(jsonb_build_object('id', m.id, 'at', m.created_at, 'authorId', coalesce(m.author_id::text, 'system'), 'authorName', m.author_name, 'authorRole', m.author_role, 'body', m.body, 'internal', m.internal) order by m.created_at)
        from support_messages m where m.ticket_id = t.id and (staff or not m.internal)
      ), '[]')
    ) order by t.updated_at desc)
    from support_tickets t
    where staff or t.account_id = auth.uid()
  ), '[]');
end;
$$;

-- Grants -------------------------------------------------------------------------

revoke execute on function
  rpc_update_my_profile(jsonb), vivah_app_role(uuid), vivah_notify_support_desk(text, text, text), vivah_support_href(text, uuid),
  rpc_open_support_ticket(text, text, text, text, uuid), rpc_reply_support_ticket(uuid, text, boolean),
  rpc_set_support_ticket_status(uuid, text), rpc_assign_support_ticket(uuid, uuid, text),
  rpc_rate_support_ticket(uuid, integer, text), rpc_my_support_tickets()
  from public, anon, authenticated;
grant execute on function
  rpc_update_my_profile(jsonb), rpc_open_support_ticket(text, text, text, text, uuid), rpc_reply_support_ticket(uuid, text, boolean),
  rpc_set_support_ticket_status(uuid, text), rpc_assign_support_ticket(uuid, uuid, text),
  rpc_rate_support_ticket(uuid, integer, text), rpc_my_support_tickets()
  to authenticated;
