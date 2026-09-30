-- =============================================================================
-- Auth, media and notifications (P6; master plan §7.3, §7.4, §7.6).
--
--   auth    email OTP sign-in (Supabase Auth); rpc_me / rpc_complete_signup
--           create the profile and role rows; staff need a valid access code
--           and an admin's approval; the access-token hook puts role, staff
--           role and persona key into the JWT.
--   media   Cloudinary holds images and short video (signed uploads through
--           the media-sign Edge Function); Postgres keeps only the public id.
--           rpc_register_media records an upload in the owner's portfolio.
--   files   KYC documents, contracts and invoices live in a private Storage
--           bucket, one folder per owner, read through short-lived signed URLs.
--   notify  push tokens and per-user channel preferences; a new notification
--           row is fanned out to Expo push and Resend email by the
--           notify-fanout Edge Function (wired below when pg_net is available).
-- NOT DEPLOYED. Never apply without the owner's say-so (AGENTS.md §1).
-- =============================================================================

-- Profiles --------------------------------------------------------------------------

-- Channel preferences also carry the muted kinds; emergencies always ring.
alter table profiles alter column notification_prefs set default '{"push":true,"email":true,"sms":false,"whatsapp":false,"muted":[]}';

-- Staff sign-up: a shared access code (stored hashed) and an approval queue.
create table staff_access_codes (
  id          uuid primary key default gen_random_uuid(),
  code_hash   text not null,
  active      boolean not null default true,
  created_by  uuid references profiles (id),
  created_at  timestamptz not null default now()
);

create table staff_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles (id) on delete cascade,
  team         text not null,
  staff_role   text not null check (staff_role in ('coordinator', 'support', 'finance', 'admin', 'super_admin')),
  status       text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  decided_by   uuid references profiles (id),
  decided_at   timestamptz,
  created_at   timestamptz not null default now(),
  unique (user_id)
);

alter table staff_access_codes enable row level security;
alter table staff_requests enable row level security;
-- Nobody reads codes through the API; checks go through rpc_complete_signup.
create policy "staff requests: own or staff managers" on staff_requests for select using (user_id = auth.uid() or has_permission('staff.manage'));

-- The app's staff roles and the database roles they map to.
create or replace function vivah_staff_app_role(p_staff_role text) returns app_role
language sql immutable as $$
  select case p_staff_role
    when 'coordinator' then 'WEDDING_COORDINATOR'::app_role
    when 'support' then 'SUPPORT'::app_role
    when 'finance' then 'FINANCE'::app_role
    when 'admin' then 'PLATFORM_ADMIN'::app_role
    when 'super_admin' then 'SUPER_ADMIN'::app_role
  end
$$;

-- Who am I: the profile, roles and persona fields the app keeps on its Account.
create or replace function rpc_me() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when p.id is null then jsonb_build_object('signedUp', false, 'email', (select email from auth.users where id = auth.uid()))
  else jsonb_build_object(
    'signedUp', true,
    'id', p.id,
    'name', p.full_name,
    'phone', p.phone,
    'email', coalesce(p.email, (select email from auth.users where id = auth.uid())),
    'city', p.city,
    'suspended', p.suspended,
    'roles', coalesce((select jsonb_agg(role) from user_roles where user_id = p.id), '[]'),
    'staffTeam', p.staff_team,
    'staffRequest', (select jsonb_build_object('status', status, 'team', team, 'staffRole', staff_role) from staff_requests where user_id = p.id),
    'freelancer', (select jsonb_build_object('skills', coalesce((select jsonb_agg(skill) from freelancer_skills where freelancer_id = f.id), '[]'),
                                             'primarySkill', (select skill from freelancer_skills where freelancer_id = f.id and is_primary limit 1),
                                             'dayRate', f.day_rate / 100, 'eventRate', f.event_rate / 100, 'bio', f.bio, 'travelRadiusKm', f.travel_radius_km)
                   from freelancers f where f.id = p.id),
    'provider', (select jsonb_build_object('orgId', o.id, 'businessName', o.name, 'providerId', pr.id, 'businessForm', pr.business_form,
                                           'services', coalesce((select jsonb_agg(ps.category_id order by ps.is_primary desc) from provider_services ps where ps.provider_id = pr.id), '[]'))
                 from organization_members m join organizations o on o.id = m.org_id and o.kind = 'PROVIDER'
                 left join providers pr on pr.org_id = o.id
                 where m.user_id = p.id limit 1)
  ) end
  from (select auth.uid() as uid) me left join profiles p on p.id = me.uid
$$;

-- First sign-in after the OTP: creates the profile and the rows for the role.
-- Idempotent: calling it again returns rpc_me(). Staff get a pending request,
-- never a role; an admin approves it with rpc_decide_staff_request.
create or replace function rpc_complete_signup(p_role text, p_profile jsonb, p_access_code text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  org uuid;
  prov uuid;
  svc text;
  skill text;
  primary_service text;
  primary_skill text;
  staff_role text;
  base_slug text;
begin
  if me is null then perform vivah_fail('Sign in with the code we emailed you first', 'insufficient_privilege'); end if;
  if exists (select 1 from profiles where id = me) then return rpc_me(); end if;
  if coalesce(length(trim(p_profile->>'name')), 0) < 2 then perform vivah_fail('Enter your full name'); end if;
  if p_role not in ('customer', 'vendor', 'freelancer', 'platform') then perform vivah_fail('Pick how you will use Vivah'); end if;

  insert into profiles (id, full_name, phone, email, city)
  values (me, trim(p_profile->>'name'), nullif(p_profile->>'phone', ''), (select email from auth.users where id = me), nullif(p_profile->>'city', ''));

  if p_role = 'customer' then
    insert into user_roles (user_id, role) values (me, 'CUSTOMER');
    insert into customers (id, partner_name) values (me, nullif(p_profile->>'partnerName', ''));

  elsif p_role = 'vendor' then
    primary_service := coalesce(p_profile->>'primaryService', p_profile->'services'->>0);
    if not exists (select 1 from service_categories where id = primary_service) then perform vivah_fail('Pick your main service'); end if;
    insert into user_roles (user_id, role) values (me, 'SERVICE_PROVIDER');
    insert into organizations (kind, name, pan_vat_number, city)
    values ('PROVIDER', coalesce(nullif(trim(p_profile->>'businessName'), ''), trim(p_profile->>'name')), nullif(p_profile->>'panVat', ''), nullif(p_profile->>'city', ''))
    returning id into org;
    insert into organization_members (org_id, user_id, member_role) values (org, me, 'OWNER');
    base_slug := trim(both '-' from regexp_replace(lower(coalesce(p_profile->>'businessName', p_profile->>'name')), '[^a-z0-9]+', '-', 'g'));
    insert into providers (org_id, slug, kind, primary_category_id, business_form, team_size, trade_profile, is_active)
    values (org, base_slug || '-' || substr(md5(org::text), 1, 6), case when primary_service = 'venue' then 'VENUE' else 'SERVICE' end, primary_service,
            nullif(p_profile->>'businessForm', ''), nullif(p_profile->>'teamSize', '')::int, coalesce(p_profile->'tradeProfile', '{}'), false)
    returning id into prov;
    for svc in select jsonb_array_elements_text(coalesce(p_profile->'services', jsonb_build_array(primary_service))) loop
      insert into provider_services (provider_id, category_id, title, price_type, is_primary)
      select prov, id, name, 'CUSTOM_QUOTE', id = primary_service from service_categories where id = svc;
    end loop;

  elsif p_role = 'freelancer' then
    primary_skill := coalesce(p_profile->>'primarySkill', p_profile->'skills'->>0);
    if primary_skill is null then perform vivah_fail('Pick your main skill'); end if;
    insert into user_roles (user_id, role) values (me, 'FREELANCER');
    insert into freelancers (id, bio, day_rate, event_rate, travel_radius_km)
    values (me, nullif(p_profile->>'bio', ''), nullif(p_profile->>'dayRate', '')::bigint * 100, nullif(p_profile->>'eventRate', '')::bigint * 100, coalesce(nullif(p_profile->>'travelRadiusKm', '')::int, 25));
    for skill in select jsonb_array_elements_text(coalesce(p_profile->'skills', jsonb_build_array(primary_skill))) loop
      insert into freelancer_skills (freelancer_id, skill, is_primary) values (me, skill, skill = primary_skill) on conflict do nothing;
    end loop;

  else
    if p_access_code is null or not exists (select 1 from staff_access_codes where active and code_hash = crypt(upper(trim(p_access_code)), code_hash)) then
      perform vivah_fail('That team access code isn’t valid', 'insufficient_privilege');
    end if;
    staff_role := coalesce(p_profile->>'staffRole', 'coordinator');
    if staff_role in ('admin', 'super_admin') then staff_role := 'coordinator'; end if; -- admins are made by admins, not by sign-up
    update profiles set staff_team = nullif(p_profile->>'team', '') where id = me;
    insert into staff_requests (user_id, team, staff_role) values (me, coalesce(nullif(p_profile->>'team', ''), 'Wedding Coordination'), staff_role);
    perform vivah_notify(u.user_id, 'system', 'New staff sign-up to approve', trim(p_profile->>'name'), '/platform/users')
    from user_roles u where u.role in ('PLATFORM_ADMIN', 'SUPER_ADMIN');
  end if;

  perform vivah_audit('account.signup', 'profile', me, jsonb_build_object('role', p_role));
  return rpc_me();
end;
$$;

-- Admins approve staff (and pick the final role); super admins alone create admins.
create or replace function rpc_decide_staff_request(p_request uuid, p_approve boolean, p_staff_role text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  r staff_requests%rowtype;
  final_role text;
begin
  if not has_permission('staff.manage') then perform vivah_fail('Only admins can approve staff', 'insufficient_privilege'); end if;
  select * into r from staff_requests where id = p_request for update;
  if r.id is null then perform vivah_fail('This request no longer exists', 'no_data_found'); end if;
  if r.status <> 'PENDING' then return; end if;
  final_role := coalesce(p_staff_role, r.staff_role);
  if vivah_staff_app_role(final_role) is null then perform vivah_fail('Unknown staff role'); end if;
  if final_role in ('admin', 'super_admin') and not has_role('SUPER_ADMIN') then perform vivah_fail('Only a super admin can make admins', 'insufficient_privilege'); end if;
  update staff_requests set status = case when p_approve then 'APPROVED' else 'REJECTED' end, staff_role = final_role, decided_by = auth.uid(), decided_at = now() where id = p_request;
  if p_approve then
    insert into user_roles (user_id, role, granted_by) values (r.user_id, vivah_staff_app_role(final_role), auth.uid()) on conflict do nothing;
  end if;
  perform vivah_notify(r.user_id, 'system', case when p_approve then 'You’re in: welcome to the Vivah team' else 'Your staff sign-up wasn’t approved' end, null, '/platform');
  perform vivah_audit(case when p_approve then 'staff.approve' else 'staff.reject' end, 'profile', r.user_id, jsonb_build_object('role', final_role));
end;
$$;

-- Admins set the team access code; old codes stop working.
-- pgcrypto lives in the `extensions` schema on Supabase, hence the search path.
create or replace function rpc_set_staff_access_code(p_code text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not has_permission('staff.manage') then perform vivah_fail('Only admins can change the access code', 'insufficient_privilege'); end if;
  if length(trim(coalesce(p_code, ''))) < 8 then perform vivah_fail('Use at least 8 characters'); end if;
  update staff_access_codes set active = false where active;
  insert into staff_access_codes (code_hash, created_by) values (crypt(upper(trim(p_code)), gen_salt('bf')), auth.uid());
  perform vivah_audit('staff.access_code', 'staff_access_codes', null);
end;
$$;

-- Custom access token hook (Authentication → Hooks): role, staff role and the
-- persona key go into the JWT so RLS and the app read them without queries.
create or replace function custom_access_token_hook(event jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := (event->>'user_id')::uuid;
  claims jsonb := coalesce(event->'claims', '{}');
  roles jsonb;
  staff text;
  persona text;
begin
  select coalesce(jsonb_agg(role order by role), '[]') into roles from user_roles where user_id = uid;
  staff := case
    when roles ? 'SUPER_ADMIN' then 'super_admin' when roles ? 'PLATFORM_ADMIN' then 'admin' when roles ? 'FINANCE' then 'finance'
    when roles ? 'SUPPORT' then 'support' when roles ? 'WEDDING_COORDINATOR' then 'coordinator' end;
  persona := case
    when staff is not null then 'platform:' || staff
    when roles ? 'SERVICE_PROVIDER' then 'vendor:' || coalesce((select pr.primary_category_id from organization_members m join providers pr on pr.org_id = m.org_id where m.user_id = uid limit 1), '')
    when roles ? 'FREELANCER' then 'freelancer:' || coalesce((select skill from freelancer_skills where freelancer_id = uid and is_primary limit 1), '')
    when roles ? 'CUSTOMER' then 'customer'
    else 'new' end;
  claims := claims || jsonb_build_object('app_roles', roles, 'staff_role', staff, 'persona_key', persona);
  return jsonb_set(event, '{claims}', claims);
end;
$$;
grant execute on function custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function custom_access_token_hook(jsonb) from public, anon, authenticated;

-- Media (Cloudinary) ------------------------------------------------------------------

-- The signed upload puts files under vivah/<purpose>/<user id>/, so a public id
-- outside the caller's folder was not uploaded by them.
create or replace function rpc_register_media(p_purpose text, p_public_id text, p_kind text default 'IMAGE', p_caption text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  prov uuid;
  new_id uuid;
begin
  if me is null then perform vivah_fail('Sign in again to continue', 'insufficient_privilege'); end if;
  if p_purpose not in ('portfolio', 'gallery', 'avatar', 'idea') then perform vivah_fail('Unknown upload purpose'); end if;
  if p_public_id not like 'vivah/' || p_purpose || '/' || me::text || '/%' then perform vivah_fail('That file wasn’t uploaded from your account', 'insufficient_privilege'); end if;
  if p_kind not in ('IMAGE', 'VIDEO') then perform vivah_fail('Images and videos only'); end if;
  if p_purpose = 'avatar' then
    update profiles set avatar_url = p_public_id where id = me;
    return me;
  end if;
  if exists (select 1 from freelancers where id = me) then
    insert into freelancer_portfolio (freelancer_id, kind, url, caption, sort)
    values (me, p_kind, p_public_id, p_caption, coalesce((select max(sort) + 1 from freelancer_portfolio where freelancer_id = me), 0)) returning id into new_id;
    return new_id;
  end if;
  select pr.id into prov from organization_members m join providers pr on pr.org_id = m.org_id where m.user_id = me and m.member_role in ('OWNER', 'MANAGER', 'COORDINATOR') limit 1;
  if prov is null then perform vivah_fail('Only businesses and freelancers keep a portfolio', 'insufficient_privilege'); end if;
  insert into provider_media (provider_id, kind, storage, url, caption) values (prov, p_kind, 'CLOUDINARY', p_public_id, p_caption) returning id into new_id;
  return new_id;
end;
$$;

-- Private documents (Supabase Storage) --------------------------------------------------

insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict (id) do nothing;

-- <user id>/kyc/…, <user id>/…: the owner reads and writes; Vendor Success and
-- admins read KYC. projects/<project id>/…: whoever may read the project reads,
-- staff write (contracts, invoices).
create policy "documents: owner" on storage.objects for all to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "documents: kyc reviewers" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[2] = 'kyc' and has_permission('provider.verify'));
create policy "documents: project read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = 'projects' and can_read_project(((storage.foldername(name))[2])::uuid));
create policy "documents: project staff write" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = 'projects' and is_platform_staff());

-- Notifications ------------------------------------------------------------------------

create table push_tokens (
  token       text primary key,
  user_id     uuid not null references profiles (id) on delete cascade,
  platform    text not null check (platform in ('ios', 'android', 'web')),
  updated_at  timestamptz not null default now()
);
alter table push_tokens enable row level security;
create policy "push tokens: own" on push_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function rpc_register_push_token(p_token text, p_platform text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then perform vivah_fail('Sign in again to continue', 'insufficient_privilege'); end if;
  if p_token !~ '^Expo(nent)?PushToken\[.+\]$' then perform vivah_fail('Not an Expo push token'); end if;
  insert into push_tokens (token, user_id, platform) values (p_token, auth.uid(), p_platform)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

-- Preferences the app's Settings screen writes (only known keys are kept).
create or replace function rpc_set_notification_prefs(p_prefs jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  clean jsonb;
begin
  if auth.uid() is null then perform vivah_fail('Sign in again to continue', 'insufficient_privilege'); end if;
  clean := jsonb_build_object(
    'push', coalesce((p_prefs->>'push')::boolean, true), 'email', coalesce((p_prefs->>'email')::boolean, true),
    'sms', coalesce((p_prefs->>'sms')::boolean, false), 'whatsapp', coalesce((p_prefs->>'whatsapp')::boolean, false),
    'muted', coalesce((select jsonb_agg(k) from jsonb_array_elements_text(coalesce(p_prefs->'muted', '[]')) k where k <> 'emergency'), '[]'));
  update profiles set notification_prefs = clean where id = auth.uid();
  return clean;
end;
$$;

-- The notify-fanout Edge Function reads this: who to tell, on which channels.
create or replace function vivah_fanout_targets(p_notification uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', n.id, 'kind', n.kind, 'title', n.title, 'body', n.body, 'href', n.href,
    'email', (select email from auth.users where id = n.user_id), 'name', p.full_name,
    'prefs', coalesce(p.notification_prefs, '{}'),
    'tokens', coalesce((select jsonb_agg(token) from push_tokens where user_id = n.user_id), '[]'))
  from notifications n join profiles p on p.id = n.user_id
  where n.id = p_notification
$$;

-- Wiring: when pg_net and the Vault secrets exist (on Supabase: enable pg_net and
-- add the `functions_url` and `notify_webhook_secret` secrets), each new
-- notification row calls notify-fanout. Elsewhere (local checks) this is a no-op.
create or replace function vivah_fanout_notification() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  url text;
  secret text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_net') or to_regclass('vault.decrypted_secrets') is null then
    return new;
  end if;
  execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'functions_url'$q$ into url;
  execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'notify_webhook_secret'$q$ into secret;
  if url is null or secret is null then return new; end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3)'
    using url || '/notify-fanout', jsonb_build_object('notification_id', new.id), jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', secret);
  return new;
end;
$$;

create trigger notifications_fanout after insert on notifications for each row execute function vivah_fanout_notification();

revoke execute on function vivah_fanout_targets(uuid), vivah_fanout_notification(), vivah_staff_app_role(text) from public, anon, authenticated;
grant execute on function vivah_fanout_targets(uuid) to service_role;
revoke execute on function
  rpc_me(), rpc_complete_signup(text, jsonb, text), rpc_decide_staff_request(uuid, boolean, text), rpc_set_staff_access_code(text),
  rpc_register_media(text, text, text, text), rpc_register_push_token(text, text), rpc_set_notification_prefs(jsonb)
  from public, anon;
grant execute on function
  rpc_me(), rpc_complete_signup(text, jsonb, text), rpc_decide_staff_request(uuid, boolean, text), rpc_set_staff_access_code(text),
  rpc_register_media(text, text, text, text), rpc_register_push_token(text, text), rpc_set_notification_prefs(jsonb)
  to authenticated;
