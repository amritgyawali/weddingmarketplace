-- 0023 Security hardening (November 2026 audit).
--
-- Every hole below was reproduced against the migrations with RLS on, as an
-- ordinary signed-in user or as nobody, and each fix has a check in
-- scripts/db/security.mjs (npm run db:test):
--
--   critical  staff could edit their own profile's staff_team and pick up
--             another team's permissions (e.g. provider.verify); any user could
--             grant themselves capabilities through caps_override
--   high      vendors could rewrite reviews about them (stars, text, status),
--             not just reply
--   high      freelancers could mark themselves VERIFIED and set their own
--             rating and reliability; vendors could set their own rating,
--             reliability, platform priority, featured and sponsored flags,
--             and mark their organisation verified
--   high      a chat member could move their membership row into any other
--             conversation (and read it), or change their member role
--   medium    any vendor team member (not just the owner) could change where
--             payouts go, with nothing in the audit log
--   medium    published wedding websites exposed their password hash
--   medium    anyone could read freelancers' exact coordinates and internal
--             reliability signals (no-shows, late arrivals, cancellations)
--   medium    anyone could add registry contributions to any item, with any
--             amount (negative too), a forged payment or a "thanked" date
--   low       operations_today, recompute_reliability and vivah_event_dates
--             were callable by anyone signed out
--   low       audit_row (security definer) had no fixed search_path
--
-- The approach is additive: no table, column, policy name or RPC the app uses
-- changes meaning. Writes the app makes through security definer RPCs and
-- jobs are unaffected, because those run as the table owner, not as the
-- anon/authenticated roles the guards check.

-- -----------------------------------------------------------------------------
-- 1. Column guards for direct writes from the app
-- -----------------------------------------------------------------------------

-- vivah_guard_columns(mode, bypass, col, col, …), a BEFORE UPDATE trigger.
--   mode   'deny'  : the listed columns may not change
--          'allow' : only the listed columns may change
--   bypass 'none' | 'staff' (is_platform_staff()) | 'perm:<permission>'
-- Only direct client writes are checked (current_user anon or authenticated);
-- security definer RPCs and jobs run as the owner and are trusted to do their
-- own checks. Trigger names start with "aa_guard" so they fire before the
-- updated_at triggers.
create or replace function vivah_guard_columns() returns trigger
language plpgsql set search_path = public as $$
declare
  v_mode   text := tg_argv[0];
  v_bypass text := tg_argv[1];
  v_cols   text[] := tg_argv[2:];
  v_old    jsonb := to_jsonb(old);
  v_new    jsonb := to_jsonb(new);
  k        text;
begin
  if current_user not in ('anon', 'authenticated') then return new; end if;
  if v_bypass = 'staff' and is_platform_staff() then return new; end if;
  if v_bypass like 'perm:%' and has_permission(substr(v_bypass, 6)) then return new; end if;

  if v_mode = 'allow' then
    for k in select jsonb_object_keys(v_new) loop
      if not (k = any (v_cols)) and (v_new -> k) is distinct from (v_old -> k) then
        raise exception 'you can''t change % on %', k, tg_table_name using errcode = 'insufficient_privilege';
      end if;
    end loop;
  else
    foreach k in array v_cols loop
      if (v_new -> k) is distinct from (v_old -> k) then
        raise exception 'you can''t change % on %', k, tg_table_name using errcode = 'insufficient_privilege';
      end if;
    end loop;
  end if;
  return new;
end $$;
revoke execute on function vivah_guard_columns() from public, anon, authenticated;

-- Profiles: permissions, capabilities and sign-in identifiers are set by the
-- server (rpc_complete_signup, the auth hook, account deletion) or a super admin.
create trigger aa_guard_profiles before update on profiles for each row
  execute function vivah_guard_columns('deny', 'perm:admin.full', 'caps_override', 'staff_team', 'deleted_at', 'phone', 'email', 'created_at');

-- Freelancers: verification is Vendor Success's call; ratings and reliability
-- come from completed work (recompute_reliability, reviews).
create trigger aa_guard_freelancers_verification before update on freelancers for each row
  execute function vivah_guard_columns('deny', 'perm:provider.verify', 'verification_status');
create trigger aa_guard_freelancers_signals before update on freelancers for each row
  execute function vivah_guard_columns('deny', 'staff', 'rating_avg', 'rating_count', 'completed_gigs', 'cancellation_rate',
                                       'response_rate', 'late_arrivals', 'no_shows', 'reliability_score', 'created_at');

-- Providers: marketplace signals and paid placement are the platform's.
create trigger aa_guard_providers_signals before update on providers for each row
  execute function vivah_guard_columns('deny', 'staff', 'org_id', 'rating_avg', 'rating_count', 'completed_projects', 'response_rate',
                                       'avg_response_minutes', 'completion_rate', 'cancellation_rate', 'reliability_score',
                                       'platform_priority', 'is_featured', 'is_sponsored', 'created_at');

-- Organisations: verification is Vendor Success's call.
create trigger aa_guard_organizations_verification before update on organizations for each row
  execute function vivah_guard_columns('deny', 'perm:provider.verify', 'verification_status', 'verified_at');
create trigger aa_guard_organizations_kind before update on organizations for each row
  execute function vivah_guard_columns('deny', 'staff', 'kind', 'created_at');

-- Reviews: the business may reply; stars, text and moderation stay as they are.
create trigger aa_guard_reviews before update on reviews for each row
  execute function vivah_guard_columns('allow', 'staff', 'vendor_reply', 'replied_at');

-- Conversation members: your own read/mute/archive/block settings only.
create trigger aa_guard_conversation_members before update on conversation_members for each row
  execute function vivah_guard_columns('allow', 'none', 'last_read_at', 'muted', 'archived', 'blocked');

-- -----------------------------------------------------------------------------
-- 2. Payout details: owner only, always audited
-- -----------------------------------------------------------------------------
-- The check runs as the caller (like vivah_guard_columns); the audit entry is
-- written by a separate security definer trigger, so clients never get a way
-- to write audit rows themselves.
create or replace function vivah_guard_payout_details() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user not in ('anon', 'authenticated') then return new; end if;
  if new.bank_account is not distinct from old.bank_account
     and new.pan_vat_number is not distinct from old.pan_vat_number
     and new.legal_name is not distinct from old.legal_name
     and new.registration_number is not distinct from old.registration_number then
    return new;
  end if;
  if not is_platform_staff()
     and not exists (select 1 from organization_members m where m.org_id = new.id and m.user_id = auth.uid() and m.member_role = 'OWNER') then
    raise exception 'only the business owner can change payout and tax details' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

create or replace function vivah_audit_payout_details() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.bank_account is distinct from old.bank_account or new.pan_vat_number is distinct from old.pan_vat_number
     or new.legal_name is distinct from old.legal_name or new.registration_number is distinct from old.registration_number then
    -- Which details changed, never the account number itself.
    insert into audit_logs (actor_id, action, entity, entity_id, after)
    values (auth.uid(), 'organization.payout_details', 'organizations', new.id,
            jsonb_build_object('bank_account', new.bank_account is distinct from old.bank_account,
                               'pan_vat_number', new.pan_vat_number is distinct from old.pan_vat_number,
                               'legal_name', new.legal_name is distinct from old.legal_name,
                               'registration_number', new.registration_number is distinct from old.registration_number));
  end if;
  return new;
end $$;
revoke execute on function vivah_guard_payout_details(), vivah_audit_payout_details() from public, anon, authenticated;
create trigger aa_guard_organizations_payout before update on organizations for each row
  execute function vivah_guard_payout_details();
create trigger audit_organizations_payout after update on organizations for each row
  execute function vivah_audit_payout_details();

-- -----------------------------------------------------------------------------
-- 3. Columns nobody outside the server reads
-- -----------------------------------------------------------------------------

-- Website passwords: the hash stays on the server.
revoke select on wedding_websites from anon, authenticated;
grant select (project_id, slug, template, theme, content, is_published, is_indexed, custom_domain, updated_at)
  on wedding_websites to anon, authenticated;

-- Freelancers: no exact coordinates or internal reliability signals in public
-- (staff and matching read them through security definer functions).
revoke select on freelancers from anon, authenticated;
grant select (id, headline, bio, city_id, travel_radius_km, experience_years, hourly_rate, day_rate, event_rate, languages,
              own_vehicle, preferred_roles, verification_status, is_available, rating_avg, rating_count, completed_gigs,
              created_at, updated_at, craft_profile)
  on freelancers to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Registry gifts from the public website
-- -----------------------------------------------------------------------------
drop policy if exists "registry contribute" on registry_contributions;
create policy "registry contribute" on registry_contributions for insert with check (
  -- The couple and staff record gifts as before.
  is_platform_staff() or is_project_customer((select project_id from registry_items where id = item_id))
  -- Guests give through a published website, and only say who they are and what they give.
  or (
    exists (select 1 from registry_items i join wedding_websites w on w.project_id = i.project_id
            where i.id = item_id and w.is_published)
    and payment_id is null and thanked_at is null and guest_id is null
    and length(trim(contributor_name)) between 1 and 80
    and (message is null or length(message) <= 1000)
    and (amount is null or amount between 1 and 1000000000)
    and (quantity is null or quantity between 1 and 100)
  )
);
alter table registry_contributions add constraint registry_contributions_amount_positive check (amount is null or amount > 0) not valid;
alter table registry_contributions add constraint registry_contributions_quantity_positive check (quantity is null or quantity > 0) not valid;

-- -----------------------------------------------------------------------------
-- 5. Functions that were open to everyone
-- -----------------------------------------------------------------------------

-- The ops dashboard summary is for staff.
create or replace function operations_today(p_day date default current_date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not is_platform_staff() then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  return jsonb_build_object(
    'weddings',              (select count(distinct project_id) from project_events where date = p_day and status <> 'CANCELLED'),
    'assignments',           (select count(*) from booking_assignments a join project_events e on e.id = a.event_id where e.date = p_day and a.status not in ('CANCELLED', 'EMERGENCY_REPLACEMENT')),
    'pending_confirmations', (select count(*) from service_bookings where status in ('PROPOSED', 'HELD')),
    'payments_overdue',      (select count(*) from payment_milestones where due_date < p_day and status in ('DUE', 'OVERDUE', 'PARTIALLY_PAID')),
    'high_risk',             (select count(distinct project_id) from project_risks where severity = 'HIGH'),
    'gigs_unfilled',         (select count(*) from gigs where status = 'OPEN' and date <= p_day + 7)
  );
end $$;
revoke execute on function operations_today(date) from public, anon;
grant execute on function operations_today(date) to authenticated, service_role;

-- Internal helpers: only other server functions and jobs call these.
revoke execute on function recompute_reliability(text, uuid) from public, anon, authenticated;
revoke execute on function vivah_event_dates(uuid, uuid) from public, anon, authenticated;
grant execute on function recompute_reliability(text, uuid), vivah_event_dates(uuid, uuid) to service_role;

-- A security definer function must never resolve names through the caller's search_path.
alter function audit_row() set search_path = public;
