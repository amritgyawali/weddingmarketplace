-- =============================================================================
-- SQL defect fixes (P5; AGENTS.md §10 and TEST_REPORT.md). Checked on a local
-- in-process Postgres by `npm run db:test` (scripts/db).
--
--   high    trigger functions that write under RLS were not security definer
--   medium  couples could update any column of their project and quote
--   medium  VIEWER collaborators could write
--   medium  the quote freeze could be bypassed (un-send, delete, VAT, notes, validity)
--   medium  refunds were not capped at the payment
-- NOT DEPLOYED. Never apply without the owner's say-so (AGENTS.md §1).
-- =============================================================================

-- 1. Trigger functions that write to (or read from) RLS-protected tables run as
--    their owner. Under RLS, clients could not create projects, change status
--    or let vendors assign freelancers; the item freeze could be skipped when
--    the version row was hidden from the caller.
alter function log_project_status() security definer set search_path = public;
alter function block_calendar_for_assignment() security definer set search_path = public;
alter function block_calendar_for_booking() security definer set search_path = public;
alter function prevent_sent_item_changes() security definer set search_path = public;
alter function freeze_sent_quote_version() security definer set search_path = public;

-- 2. Couples change only the planning fields of their project. Status,
--    coordinator, money and ownership move through RPCs and staff screens.
--    The guard runs as the caller (security invoker): a direct client update
--    runs as `authenticated` and is checked, while the RPCs in 0011 run as
--    their owner and pass, so the RPC's own rules decide there.
create or replace function guard_customer_project_update() returns trigger
language plpgsql security invoker set search_path = public as $$
declare
  allowed constant text[] := array['title', 'area', 'venue_selected', 'guest_band', 'guest_count', 'budget_total', 'budget_mode',
                                    'styles', 'priorities', 'customer_notes', 'honourees', 'updated_at'];
begin
  if current_user not in ('authenticated', 'anon') or auth.uid() is null or is_platform_staff() then
    return new;
  end if;
  if (to_jsonb(new) - allowed) is distinct from (to_jsonb(old) - allowed) then
    raise exception 'couples can change the plan details only; status, coordinator and money go through the Vivah team'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger wedding_projects_customer_guard before update on wedding_projects
  for each row execute function guard_customer_project_update();

-- Couples no longer update quotes directly: accepting, declining or asking for
-- changes goes through rpc_respond_to_quote (0011), which checks the state.
drop policy if exists "quotes customer respond" on quotes;

-- 3. VIEWER collaborators read but don't write.
create or replace function can_edit_project(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_platform_staff()
      or exists (select 1 from wedding_projects where id = p_project and customer_id = auth.uid())
      or exists (select 1 from project_collaborators where project_id = p_project and user_id = auth.uid()
                 and accepted_at is not null and permission in ('OWNER', 'EDITOR'))
$$;

-- Only the couple (or an OWNER collaborator) manages who else is on the plan.
create or replace function can_own_project(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_platform_staff()
      or exists (select 1 from wedding_projects where id = p_project and customer_id = auth.uid())
      or exists (select 1 from project_collaborators where project_id = p_project and user_id = auth.uid()
                 and accepted_at is not null and permission = 'OWNER')
$$;

drop policy if exists "collaborators" on project_collaborators;
create policy "collaborators read" on project_collaborators for select using (is_platform_staff() or is_project_customer(project_id));
create policy "collaborators manage" on project_collaborators for all using (can_own_project(project_id)) with check (can_own_project(project_id));

drop policy if exists "events write" on project_events;
create policy "events write" on project_events for all using (can_edit_project(project_id)) with check (can_edit_project(project_id));

drop policy if exists "requirements write" on project_requirements;
create policy "requirements write" on project_requirements for all using (can_edit_project(project_id)) with check (can_edit_project(project_id));

drop policy if exists "requirement_events" on requirement_events;
create policy "requirement_events read" on requirement_events for select using (is_platform_staff() or is_project_customer((select project_id from project_requirements where id = requirement_id)));
create policy "requirement_events write" on requirement_events for all using (can_edit_project((select project_id from project_requirements where id = requirement_id)));

drop policy if exists "households" on guest_households;
create policy "households read" on guest_households for select using (is_platform_staff() or is_project_customer(project_id));
create policy "households write" on guest_households for all using (can_edit_project(project_id)) with check (can_edit_project(project_id));

drop policy if exists "guests" on guests;
create policy "guests read" on guests for select using (is_platform_staff() or is_project_customer(project_id));
create policy "guests write" on guests for all using (can_edit_project(project_id)) with check (can_edit_project(project_id));

drop policy if exists "guest invitations" on guest_invitations;
create policy "guest invitations read" on guest_invitations for select using (is_platform_staff() or is_project_customer(guest_project(guest_id)));
create policy "guest invitations write" on guest_invitations for all using (can_edit_project(guest_project(guest_id)));

drop policy if exists "rsvp questions" on rsvp_questions;
create policy "rsvp questions read" on rsvp_questions for select using (is_platform_staff() or is_project_customer(project_id));
create policy "rsvp questions write" on rsvp_questions for all using (can_edit_project(project_id)) with check (can_edit_project(project_id));

drop policy if exists "budget" on budget_items;
create policy "budget read" on budget_items for select using (is_platform_staff() or is_project_customer(project_id));
create policy "budget write" on budget_items for all using (can_edit_project(project_id)) with check (can_edit_project(project_id));

drop policy if exists "website owner" on wedding_websites;
create policy "website owner read" on wedding_websites for select using (is_platform_staff() or is_project_customer(project_id));
create policy "website owner write" on wedding_websites for all using (can_edit_project(project_id)) with check (can_edit_project(project_id));

drop policy if exists "invitation designs" on invitation_designs;
create policy "invitation designs read" on invitation_designs for select using (is_platform_staff() or is_project_customer(project_id));
create policy "invitation designs write" on invitation_designs for all using (can_edit_project(project_id)) with check (can_edit_project(project_id));

drop policy if exists "registry owner" on registry_items;
create policy "registry owner read" on registry_items for select using (is_platform_staff() or is_project_customer(project_id));
create policy "registry owner write" on registry_items for all using (can_edit_project(project_id)) with check (can_edit_project(project_id));

drop policy if exists "shortlists" on shortlists;
create policy "shortlists read" on shortlists for select using (is_platform_staff() or is_project_customer(project_id));
create policy "shortlists write" on shortlists for all using (can_edit_project(project_id)) with check (can_edit_project(project_id));

drop policy if exists "boards" on inspiration_boards;
create policy "boards read" on inspiration_boards for select using (is_platform_staff() or is_project_customer(project_id));
create policy "boards write" on inspiration_boards for all using (can_edit_project(project_id)) with check (can_edit_project(project_id));

-- 4. A sent quote version is frozen in full: amounts, VAT, notes, terms,
--    validity, schedule and the fact that it was sent. Only the customer's
--    response fields still change. Sent versions and quotes can't be deleted.
create or replace function freeze_sent_quote_version() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  response_fields constant text[] := array['viewed_at', 'responded_at', 'response', 'customer_note'];
begin
  if tg_op = 'DELETE' then
    if old.sent_at is not null then
      raise exception 'Quote version % was sent and cannot be deleted', old.version using errcode = 'check_violation';
    end if;
    return old;
  end if;
  if old.sent_at is not null and (to_jsonb(new) - response_fields) is distinct from (to_jsonb(old) - response_fields) then
    raise exception 'Quote version % is already sent; create a new version instead', old.version using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists quote_versions_freeze on quote_versions;
create trigger quote_versions_freeze before update or delete on quote_versions for each row execute function freeze_sent_quote_version();

create or replace function guard_quote_changes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'DRAFT' or exists (select 1 from quote_versions where quote_id = old.id and sent_at is not null) then
      raise exception 'A sent quotation cannot be deleted' using errcode = 'check_violation';
    end if;
    return old;
  end if;
  -- Back to draft only by starting a new version (revise), never by un-sending.
  if new.status = 'DRAFT' and old.status <> 'DRAFT' and new.current_version <= old.current_version then
    raise exception 'Revise the quotation to edit it; version % stays as sent', old.current_version using errcode = 'check_violation';
  end if;
  if new.current_version < old.current_version then
    raise exception 'Quote versions only go up' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger quotes_guard before update or delete on quotes for each row execute function guard_quote_changes();

-- 5. Refunds never exceed what was paid: open and processed refunds of a
--    payment together stay within its amount (this also stops the same
--    request being refunded twice).
create or replace function cap_refunds() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  paid bigint;
  taken bigint;
begin
  if new.status = 'REJECTED' then
    return new;
  end if;
  select amount into paid from payments where id = new.payment_id and status in ('SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED');
  if paid is null then
    raise exception 'Only a successful payment can be refunded' using errcode = 'check_violation';
  end if;
  select coalesce(sum(amount), 0) into taken from refunds
  where payment_id = new.payment_id and status <> 'REJECTED' and id <> new.id;
  if taken + new.amount > paid then
    raise exception 'Refunds would exceed the payment: % already refunded or requested of %', taken / 100, paid / 100
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger refunds_cap before insert or update of amount, status on refunds for each row execute function cap_refunds();
