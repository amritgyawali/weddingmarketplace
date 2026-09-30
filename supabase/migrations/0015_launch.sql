-- =============================================================================
-- Launch (P8; master plan §10.2, §11, §15): what production needs from the
-- database before real people sign up.
--
--   health    rpc_health: a cheap, public "is the database up" for the daily
--             keep-alive (free projects pause after 7 idle days) and the
--             Better Stack monitor behind the health Edge Function.
--   consent   legal_acceptances: which Terms and Privacy policy version each
--             user accepted, and when (rpc_accept_legal, rpc_me.legal).
--   export    rpc_export_my_data: everything Vivah holds about the caller, as
--             one JSON document (Settings → Download my data).
--   delete    rpc_delete_my_account: closes the caller's account. Personal
--             data is removed or anonymised; bookings, payments, invoices and
--             contracts stay (tax and accounting records) but no longer name
--             the person. Refused while money or a booked date is still open.
--             The account-delete Edge Function then removes their private files
--             and soft-deletes the auth user, so the email can't sign in.
-- NOT DEPLOYED. Never apply without the owner's say-so (AGENTS.md §1).
-- =============================================================================

-- Health -------------------------------------------------------------------------

create or replace function rpc_health() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ok', true, 'at', now(), 'schema', '0015')
$$;
revoke execute on function rpc_health() from public;
grant execute on function rpc_health() to anon, authenticated, service_role;

-- Consent ------------------------------------------------------------------------

create table legal_acceptances (
  user_id      uuid not null references profiles (id) on delete cascade,
  document     text not null check (document in ('terms', 'privacy')),
  version      text not null,
  accepted_at  timestamptz not null default now(),
  primary key (user_id, document, version)
);
alter table legal_acceptances enable row level security;
create policy "legal: own read" on legal_acceptances for select using (user_id = auth.uid() or is_platform_staff());
-- Rows are written only through rpc_accept_legal.
revoke insert, update, delete on legal_acceptances from anon, authenticated;

-- Versions are the documents' dates (src/data/legal.ts LEGAL_VERSION). Accepting
-- the same version again keeps the first time.
create or replace function rpc_accept_legal(p_version text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (select 1 from profiles where id = auth.uid()) then
    perform vivah_fail('Sign in again to continue', 'insufficient_privilege');
  end if;
  if p_version !~ '^\d{4}-\d{2}-\d{2}$' then perform vivah_fail('Unknown policy version'); end if;
  insert into legal_acceptances (user_id, document, version)
  values (auth.uid(), 'terms', p_version), (auth.uid(), 'privacy', p_version)
  on conflict do nothing;
end;
$$;

-- rpc_me also says which version the user last accepted, so the app can ask
-- again when the documents change.
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
                 where m.user_id = p.id limit 1),
    'legal', (select max(version) from legal_acceptances where user_id = p.id and document = 'terms')
  ) end
  from (select auth.uid() as uid) me left join profiles p on p.id = me.uid and p.deleted_at is null
$$;

-- Export -------------------------------------------------------------------------

-- What Vivah holds about the caller. Projects they own come whole (the couple's
-- own plan); other people's records appear only where they are the author.
create or replace function rpc_export_my_data() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null or not exists (select 1 from profiles where id = me and deleted_at is null) then
    perform vivah_fail('Sign in again to continue', 'insufficient_privilege');
  end if;
  return jsonb_build_object(
    'exportedAt', now(),
    'profile', (select to_jsonb(p) - 'privacy' from profiles p where p.id = me),
    'roles', coalesce((select jsonb_agg(role) from user_roles where user_id = me), '[]'),
    'customer', (select to_jsonb(c) from customers c where c.id = me),
    'freelancer', (select to_jsonb(f) from freelancers f where f.id = me),
    'business', (select jsonb_agg(to_jsonb(o)) from organizations o join organization_members m on m.org_id = o.id where m.user_id = me),
    'projects', coalesce((select jsonb_agg(jsonb_build_object(
        'project', to_jsonb(w),
        'events', (select jsonb_agg(to_jsonb(e) order by e.date) from project_events e where e.project_id = w.id),
        'payments', (select jsonb_agg(to_jsonb(pay) - 'raw_response' order by pay.created_at) from payments pay where pay.project_id = w.id),
        'guests', (select count(*) from guests g where g.project_id = w.id)
      ) order by w.created_at) from wedding_projects w where w.customer_id = me), '[]'),
    'collaborations', coalesce((select jsonb_agg(jsonb_build_object('project', w.code, 'relation', pc.relation, 'permission', pc.permission))
                                from project_collaborators pc join wedding_projects w on w.id = pc.project_id where pc.user_id = me), '[]'),
    'gigApplications', coalesce((select jsonb_agg(to_jsonb(a) order by a.applied_at) from gig_applications a where a.freelancer_id = me), '[]'),
    'reviewsWritten', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at) from reviews r where r.reviewer_id = me), '[]'),
    'messagesSent', coalesce((select jsonb_agg(jsonb_build_object('at', m.created_at, 'body', m.body) order by m.created_at) from messages m where m.sender_id = me and m.deleted_at is null), '[]'),
    'notifications', coalesce((select jsonb_agg(jsonb_build_object('at', n.created_at, 'kind', n.kind, 'title', n.title, 'body', n.body) order by n.created_at) from notifications n where n.user_id = me), '[]'),
    'devices', (select count(*) from push_tokens where user_id = me),
    'legal', coalesce((select jsonb_agg(to_jsonb(l) - 'user_id' order by l.accepted_at) from legal_acceptances l where l.user_id = me), '[]')
  );
end;
$$;

-- Delete -------------------------------------------------------------------------

-- Why the caller can't close their account yet (null when they can).
create or replace function vivah_deletion_blocker(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select 'Your celebration ' || w.code || ' is confirmed. Ask your coordinator to cancel it, or close your account after it is completed.'
       from wedding_projects w where w.customer_id = p_user and w.status in ('CONFIRMED', 'IN_PROGRESS') limit 1),
    (select 'A refund on your payments is still being processed. You can close your account once it is paid out.'
       from refunds r join payments pay on pay.id = r.payment_id join wedding_projects w on w.id = pay.project_id
       where w.customer_id = p_user and r.status in ('REQUESTED', 'APPROVED') limit 1),
    (select 'Your business has confirmed bookings. Finish or hand them over before closing your account.'
       from service_bookings b join providers pr on pr.id = b.provider_id join organization_members m on m.org_id = pr.org_id
       where m.user_id = p_user and m.member_role = 'OWNER' and b.status in ('HELD', 'CONFIRMED', 'IN_PROGRESS') limit 1),
    (select 'Payouts are still due to your business. Close your account after they are paid.'
       from provider_payables pp join providers pr on pr.id = pp.provider_id join organization_members m on m.org_id = pr.org_id
       where m.user_id = p_user and m.member_role = 'OWNER' and pp.status in ('ACCRUED', 'ON_HOLD', 'READY') limit 1),
    (select 'You are booked on upcoming gigs. Withdraw from them before closing your account.'
       from booking_assignments a where a.freelancer_id = p_user and a.status in ('ASSIGNED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS') and a.end_at > now() limit 1),
    (select 'Payouts are still due to you. Close your account after they are paid.'
       from freelancer_payables fp where fp.freelancer_id = p_user and fp.status in ('ACCRUED', 'ON_HOLD', 'READY') limit 1),
    (select 'You are the only super admin. Make someone else super admin first.'
       where exists (select 1 from user_roles where user_id = p_user and role = 'SUPER_ADMIN')
         and not exists (select 1 from user_roles where role = 'SUPER_ADMIN' and user_id <> p_user))
  )
$$;
revoke execute on function vivah_deletion_blocker(uuid) from public, anon, authenticated;

-- Closes the caller's account. p_confirm must be the word DELETE, so a stray
-- call can't do it. Idempotent: a closed account answers deleted again.
create or replace function rpc_delete_my_account(p_confirm text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  blocker text;
begin
  if me is null then perform vivah_fail('Sign in again to continue', 'insufficient_privilege'); end if;
  if upper(trim(coalesce(p_confirm, ''))) <> 'DELETE' then perform vivah_fail('Type DELETE to confirm'); end if;
  if not exists (select 1 from profiles where id = me) then return jsonb_build_object('deleted', true, 'files', me::text); end if;
  if exists (select 1 from profiles where id = me and deleted_at is not null) then return jsonb_build_object('deleted', true, 'files', me::text); end if;

  blocker := vivah_deletion_blocker(me);
  if blocker is not null then perform vivah_fail(blocker); end if;

  -- Listings of businesses they alone own go offline.
  update providers set is_active = false
  where org_id in (select org_id from organization_members m where m.user_id = me and m.member_role = 'OWNER'
                   and not exists (select 1 from organization_members o where o.org_id = m.org_id and o.user_id <> me and o.member_role = 'OWNER'));
  delete from organization_members where user_id = me;

  update freelancers set is_available = false, headline = null, bio = null, lat = null, lng = null where id = me;
  update customers set partner_name = null where id = me;
  update project_collaborators set name = 'Former member', phone = null where user_id = me;
  delete from push_tokens where user_id = me;
  delete from notifications where user_id = me;
  delete from staff_requests where user_id = me;
  delete from user_roles where user_id = me;
  update profiles set full_name = 'Deleted user', phone = null, email = null, avatar_url = null, city = null,
                      privacy = '{}', staff_team = null, deleted_at = now()
  where id = me;

  perform vivah_audit('account.delete', 'profile', me, null);
  return jsonb_build_object('deleted', true, 'files', me::text);
end;
$$;
