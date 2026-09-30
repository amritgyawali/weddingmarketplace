-- =============================================================================
-- Platform RBAC (P4; mirrors src/data/permissions.ts, PLATFORM_ROUTE_RULES in
-- src/data/access.ts and staffDenied()/staffOnly() in src/store/db/personas.ts).
--
-- The role-name checks in 0002 (has_role('FINANCE') …) become permission
-- checks against the matrix seeded in 0005, so a change to the matrix changes
-- what the database allows too. A coordinator's project rights are limited to
-- the projects they own (or that nobody owns yet).
-- NOT DEPLOYED. Never apply without the owner's say-so (AGENTS.md §1).
-- =============================================================================

-- A staff member may manage this project: holds project.manage and, if the
-- right is scoped to their own records (coordinators), owns it or it is unowned.
create or replace function can_manage_project(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select has_permission('project.manage') and (
    not has_role('WEDDING_COORDINATOR')
    or has_role('PLATFORM_ADMIN') or has_role('SUPER_ADMIN')
    or exists (select 1 from wedding_projects p where p.id = p_project and (p.coordinator_id is null or p.coordinator_id = auth.uid()))
  )
$$;

-- Projects: staff updates need project.manage in scope. The couple's own
-- update right stays until P5 narrows it to specific columns (AGENTS.md §10).
drop policy if exists "projects staff update" on wedding_projects;
create policy "projects staff update" on wedding_projects for update using (can_manage_project(id) or customer_id = auth.uid());

-- Money: permission-based instead of role-based.
drop policy if exists "payments finance" on payments;
create policy "payments finance" on payments for all using (has_permission('payment.record_cash') or has_permission('refund.approve'));

drop policy if exists "refunds finance" on refunds;
create policy "refunds finance" on refunds for all using (has_permission('refund.approve'));

drop policy if exists "provider payables finance" on provider_payables;
create policy "provider payables finance" on provider_payables for all using (has_permission('payout.release'));

drop policy if exists "freelancer payables finance" on freelancer_payables;
create policy "freelancer payables finance" on freelancer_payables for all using (has_permission('payout.release'));

drop policy if exists "disputes staff" on disputes;
create policy "disputes staff" on disputes for update using (has_permission('refund.approve') or has_permission('incident.manage'));

-- Verification: every staff member can read the queue; deciding needs provider.verify.
drop policy if exists "verification staff" on verification_cases;
create policy "verification staff read" on verification_cases for select using (is_platform_staff());
create policy "verification staff decide" on verification_cases for all using (has_permission('provider.verify'));

-- Audit log: readers by permission (finance, admins).
drop policy if exists "audit staff" on audit_logs;
create policy "audit staff" on audit_logs for select using (has_permission('audit.view'));

-- Broadcasts: sending needs broadcast.send.
drop policy if exists "broadcasts: staff send" on broadcasts;
create policy "broadcasts: staff send" on broadcasts for insert with check (has_permission('broadcast.send') and sent_by = auth.uid());

-- Suspension (setAccountSuspended): a flag only user.suspend holders can set.
alter table profiles add column if not exists suspended boolean not null default false;

create or replace function guard_profile_suspension() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.suspended is distinct from old.suspended and not has_permission('user.suspend') then
    raise exception 'only staff with user.suspend can change suspension' using errcode = 'insufficient_privilege';
  end if;
  if new.suspended and new.id = auth.uid() then
    raise exception 'you cannot suspend your own account' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger profiles_suspension before update of suspended on profiles
  for each row execute function guard_profile_suspension();

create policy "profiles: staff suspend" on profiles for update using (has_permission('user.suspend'));
