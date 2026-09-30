-- =============================================================================
-- Core-loop RPCs (P5). Each state-changing store action of the core loop
-- (AGENTS.md §5) becomes one Postgres function: security definer, permission
-- checked, idempotent where it matters, audited, and notifying the people it
-- affects. The TypeScript in src/services stays the reference implementation;
-- `npm run test:parity` runs both on the same fixtures and fails on any drift.
--
-- Money is paisa (bigint) in SQL and whole rupees in the app. The helpers
-- below round to whole rupees (multiples of 100 paisa) so both give the same
-- numbers.
--
--   store action (src/store/db)      RPC
--   submitPlan                       rpc_submit_plan
--   setProjectStatus                 rpc_set_project_status
--   assignCoordinator                rpc_assign_coordinator
--   sendQuote                        rpc_send_quote
--   reviseQuote                      rpc_revise_quote
--   respondToQuote                   rpc_respond_to_quote   (accept → order, milestones, bookings confirmed)
--   confirmBooking                   rpc_confirm_booking    (→ vivah_activate_booking)
--   cancelBooking                    rpc_cancel_booking
--   payMilestone                     rpc_record_payment     (cash: finance; gateways: Edge Functions, P7)
--   releasePayable                   rpc_release_payable
--   requestRefund / decideRefund     rpc_request_refund / rpc_decide_refund
--
-- NOT DEPLOYED. Never apply without the owner's say-so (AGENTS.md §1).
-- =============================================================================

-- Money helpers (pure) ----------------------------------------------------------

-- A paisa amount rounded to whole rupees, half away from zero (JavaScript's
-- Math.round for the positive amounts the app uses).
create or replace function vivah_rupees(p numeric) returns bigint
language sql immutable parallel safe as $$ select (round(p / 100) * 100)::bigint $$;

-- quoteTotals(): subtotal − discount (clamped to [0, subtotal]) + service fee
-- = taxable; tax = round(taxable × rate); total = taxable + tax. Items are
-- [{"qty": 2, "rate": 18000000}] with rates in paisa; lines round to rupees.
create or replace function vivah_quote_math(p_items jsonb, p_discount bigint, p_service_fee bigint, p_rate numeric) returns jsonb
language plpgsql immutable as $$
declare
  subtotal bigint := 0;
  discount bigint;
  fee bigint;
  taxable bigint;
  tax bigint;
  item jsonb;
begin
  for item in select * from jsonb_array_elements(coalesce(p_items, '[]')) loop
    subtotal := subtotal + vivah_rupees(greatest(0, (item->>'qty')::numeric) * greatest(0, (item->>'rate')::numeric));
  end loop;
  discount := least(greatest(0, coalesce(p_discount, 0)), subtotal);
  fee := greatest(0, coalesce(p_service_fee, 0));
  taxable := subtotal - discount + fee;
  tax := vivah_rupees(taxable * p_rate);
  return jsonb_build_object('subtotal', subtotal, 'discount', discount, 'serviceFee', fee, 'taxable', taxable, 'tax', tax, 'total', taxable + tax);
end;
$$;

-- splitBooking(): agreedPrice = providerPayable + platformFee. For LEAD_FEE the
-- rate is a flat fee in rupees; for the others it is a fraction.
create or replace function vivah_split_booking(p_model pricing_model, p_rate numeric, p_customer_price bigint, p_provider_cost bigint)
returns table (agreed_price bigint, provider_cost bigint, platform_fee bigint, provider_payable bigint)
language plpgsql immutable as $$
declare
  price bigint;
  cost bigint;
  fee bigint;
begin
  case p_model
    when 'MARKUP' then
      cost := vivah_rupees(coalesce(p_provider_cost, p_customer_price, 0));
      price := vivah_rupees(cost * (1 + p_rate));
      return query select price, cost, price - cost, cost;
    when 'LEAD_FEE' then
      price := vivah_rupees(coalesce(p_customer_price, p_provider_cost, 0));
      fee := least(price, vivah_rupees(p_rate * 100));
      return query select price, price, fee, price - fee;
    else
      price := vivah_rupees(coalesce(p_customer_price, p_provider_cost, 0));
      fee := vivah_rupees(price * p_rate);
      return query select price, price, fee, price - fee;
  end case;
end;
$$;

-- buildMilestones() amounts: each step rounds to rupees, the last absorbs the rest.
create or replace function vivah_milestone_amounts(p_total bigint, p_percents numeric[]) returns bigint[]
language plpgsql immutable as $$
declare
  out bigint[] := '{}';
  allocated bigint := 0;
  amount bigint;
  i int;
  n int := coalesce(array_length(p_percents, 1), 0);
begin
  for i in 1..n loop
    amount := case when i = n then p_total - allocated else vivah_rupees(p_total * p_percents[i] / 100) end;
    allocated := allocated + amount;
    out := out || amount;
  end loop;
  return out;
end;
$$;

-- payablesForBooking(): 40 % before the event, the rest after it.
create or replace function vivah_payable_split(p_provider_payable bigint) returns bigint[]
language sql immutable as $$
  select array[vivah_rupees(p_provider_payable * 0.4), p_provider_payable - vivah_rupees(p_provider_payable * 0.4)]
$$;

-- freelancerNet(): what the freelancer receives and the platform margin.
create or replace function vivah_freelancer_net(p_client_pay bigint, p_margin numeric default 0.2) returns bigint[]
language sql immutable as $$
  select array[vivah_rupees(p_client_pay * (1 - p_margin)), vivah_rupees(p_client_pay * p_margin)]
$$;

-- Plumbing ------------------------------------------------------------------------

create sequence if not exists receipt_number_seq start 101;

create or replace function vivah_audit(p_action text, p_entity text, p_entity_id uuid, p_after jsonb default null) returns void
language sql security definer set search_path = public as $$
  insert into audit_logs (actor_id, action, entity, entity_id, after) values (auth.uid(), p_action, p_entity, p_entity_id, p_after)
$$;

create or replace function vivah_notify(p_user uuid, p_kind text, p_title text, p_body text, p_href text) returns void
language sql security definer set search_path = public as $$
  insert into notifications (user_id, kind, title, body, href) select p_user, p_kind, p_title, p_body, p_href where p_user is not null
$$;

create or replace function vivah_fail(p_message text, p_code text default 'check_violation') returns void
language plpgsql as $$ begin raise exception '%', p_message using errcode = p_code; end $$;

-- First and last dated function of a project (or of a booking's functions).
create or replace function vivah_event_dates(p_project uuid, p_booking uuid default null) returns date[]
language sql stable security definer set search_path = public as $$
  select array[min(e.date), max(e.date)]
  from project_events e
  where e.project_id = p_project and e.date is not null and e.status <> 'CANCELLED'
    and (p_booking is null or exists (select 1 from booking_events be where be.booking_id = p_booking and be.event_id = e.id)
         or not exists (select 1 from booking_events be where be.booking_id = p_booking))
$$;

-- Projects ------------------------------------------------------------------------

-- submitPlan: one requirement per service, the functions, and a coordinator
-- when auto-assignment is on. Input mirrors PlanInput (dates per function).
create or replace function rpc_submit_plan(p_input jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  pid uuid;
  coordinator uuid;
  fn text;
  svc text;
begin
  if me is null or not exists (select 1 from customers where id = me) then
    perform vivah_fail('Sign in as a couple to plan a celebration', 'insufficient_privilege');
  end if;
  if jsonb_array_length(coalesce(p_input->'eventTypes', '[]')) = 0 then perform vivah_fail('Pick at least one function'); end if;
  if jsonb_array_length(coalesce(p_input->'services', '[]')) = 0 then perform vivah_fail('Pick at least one service'); end if;
  select user_id into coordinator from user_roles where role = 'WEDDING_COORDINATOR' order by granted_at limit 1;

  insert into wedding_projects (title, customer_id, coordinator_id, status, city_id, guest_count, budget_total, budget_mode, styles, customer_notes, occasion, honourees)
  values (
    coalesce(nullif(p_input->>'title', ''), 'Our celebration'), me, coordinator,
    case when coordinator is null then 'NEW'::project_status else 'REVIEWING'::project_status end,
    (select id from cities where lower(name) = lower(p_input->>'city') limit 1),
    nullif(p_input->>'guests', '')::int, nullif(p_input->>'budgetTotal', '')::bigint * 100,
    upper(coalesce(p_input->>'budgetMode', 'undecided')), coalesce(p_input->'styles', '{}'), p_input->>'notes',
    (select id from occasions where id = p_input->>'occasion'), p_input->'honourees'
  ) returning id into pid;

  for fn in select jsonb_array_elements_text(p_input->'eventTypes') loop
    insert into project_events (project_id, event_type, name, date, date_confirmed, guest_count)
    values (pid, fn::event_type, initcap(replace(lower(fn), '_', ' ')), nullif(p_input->'dates'->>fn, '')::date, (p_input->'dates'->>fn) is not null, nullif(p_input->>'guests', '')::int);
  end loop;
  for svc in select jsonb_array_elements_text(p_input->'services') loop
    insert into project_requirements (project_id, category_id) select pid, id from service_categories where id = svc;
  end loop;

  perform vivah_notify(coordinator, 'lead', 'New lead', coalesce(p_input->>'title', 'A new plan'), '/platform/project/' || pid);
  perform vivah_audit('project.submit', 'project', pid, p_input);
  return pid;
end;
$$;

create or replace function rpc_set_project_status(p_project uuid, p_status project_status, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  cur project_status;
  owner uuid;
begin
  select status, customer_id into cur, owner from wedding_projects where id = p_project;
  if cur is null then perform vivah_fail('This project no longer exists', 'no_data_found'); end if;
  if not can_manage_project(p_project) then perform vivah_fail('You can’t change this project’s status', 'insufficient_privilege'); end if;
  if cur = p_status then return; end if;
  update wedding_projects set status = p_status where id = p_project;
  update project_status_history set note = p_note
  where id = (select max(id) from project_status_history where project_id = p_project) and p_note is not null;
  perform vivah_notify(owner, 'system', 'Your plan was updated', coalesce(p_note, lower(replace(p_status::text, '_', ' '))), '/my-wedding');
  perform vivah_audit('project.status', 'project', p_project, jsonb_build_object('from', cur, 'to', p_status));
end;
$$;

create or replace function rpc_assign_coordinator(p_project uuid, p_coordinator uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from wedding_projects where id = p_project) then perform vivah_fail('This project no longer exists', 'no_data_found'); end if;
  if not can_manage_project(p_project) then perform vivah_fail('You can’t reassign this project', 'insufficient_privilege'); end if;
  if not exists (select 1 from user_roles where user_id = p_coordinator and role in ('WEDDING_COORDINATOR', 'PLATFORM_ADMIN', 'SUPER_ADMIN')) then
    perform vivah_fail('Pick a coordinator from the operations team');
  end if;
  update wedding_projects set coordinator_id = p_coordinator, status = case when status = 'NEW' then 'REVIEWING' else status end where id = p_project;
  perform vivah_notify(p_coordinator, 'lead', 'You now own a project', null, '/platform/project/' || p_project);
  perform vivah_audit('project.assign', 'project', p_project, jsonb_build_object('coordinator', p_coordinator));
end;
$$;

-- Quotes ----------------------------------------------------------------------------

create or replace function vivah_can_issue(p_quote uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from quotes q where q.id = p_quote and (
      (q.issuer_kind = 'PLATFORM' and has_permission('quote.send') and (q.project_id is null or can_manage_project(q.project_id)))
      or (q.issuer_kind = 'PROVIDER' and is_org_member(q.issuer_org_id))
    )
  )
$$;

-- sendQuote: totals are computed here from the items, never taken from the
-- client; the version is frozen by 0010's trigger as soon as sent_at is set.
create or replace function rpc_send_quote(p_quote uuid, p_change_summary text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  q quotes%rowtype;
  v quote_versions%rowtype;
  totals jsonb;
begin
  select * into q from quotes where id = p_quote for update;
  if q.id is null then perform vivah_fail('This quotation no longer exists', 'no_data_found'); end if;
  if not vivah_can_issue(p_quote) then perform vivah_fail('You can’t send this quotation', 'insufficient_privilege'); end if;
  select * into v from quote_versions where quote_id = p_quote and version = q.current_version;
  if v.id is null then perform vivah_fail('The quotation has no working version'); end if;
  if v.sent_at is not null then return jsonb_build_object('total', v.total, 'alreadySent', true); end if;
  if not exists (select 1 from quote_items where quote_version_id = v.id) then perform vivah_fail('Add at least one line before sending'); end if;

  totals := vivah_quote_math(
    (select jsonb_agg(jsonb_build_object('qty', qty, 'rate', unit_price)) from quote_items where quote_version_id = v.id),
    v.package_discount, v.service_fee, v.vat_rate);
  update quote_versions
  set subtotal = (totals->>'subtotal')::bigint, package_discount = (totals->>'discount')::bigint, service_fee = (totals->>'serviceFee')::bigint,
      vat_amount = (totals->>'tax')::bigint, total = (totals->>'total')::bigint, change_summary = coalesce(p_change_summary, change_summary),
      created_by = coalesce(created_by, auth.uid()), sent_at = now(),
      payment_schedule = case when payment_schedule = '[]'::jsonb then
        '[{"label":"Booking confirmation","percent":30,"rule":"ON_CONFIRMATION"},{"label":"15 days before event","percent":50,"rule":"DAYS_BEFORE_EVENT","days":15},{"label":"After completion","percent":20,"rule":"AFTER_COMPLETION","days":3}]'::jsonb
        else payment_schedule end
  where id = v.id;
  update quotes set status = 'SENT' where id = p_quote;
  if q.project_id is not null then
    update wedding_projects set status = 'QUOTE_SENT' where id = q.project_id and status <> 'QUOTE_SENT';
    update project_requirements r set status = 'QUOTED'
    where r.project_id = q.project_id and r.status <> 'CONFIRMED' and exists (select 1 from quote_items i where i.quote_version_id = v.id and i.requirement_id = r.id);
  end if;
  perform vivah_notify(q.customer_id, 'quote', case when q.current_version > 1 then 'Updated quotation (v' || q.current_version || ')' else 'Your quotation is ready' end, q.number, '/quote/' || p_quote);
  perform vivah_audit('quote.send', 'quote', p_quote, totals || jsonb_build_object('version', q.current_version));
  return totals;
end;
$$;

-- reviseQuote: a new working version (copy of the last), never an edit of a sent one.
create or replace function rpc_revise_quote(p_quote uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  q quotes%rowtype;
  old_v quote_versions%rowtype;
  new_id uuid;
begin
  select * into q from quotes where id = p_quote for update;
  if q.id is null then perform vivah_fail('This quotation no longer exists', 'no_data_found'); end if;
  if not vivah_can_issue(p_quote) then perform vivah_fail('You can’t revise this quotation', 'insufficient_privilege'); end if;
  if q.status = 'DRAFT' then return q.current_version; end if;
  if q.status in ('ACCEPTED', 'SUPERSEDED') then perform vivah_fail('An accepted quotation can’t be revised'); end if;
  select * into old_v from quote_versions where quote_id = p_quote and version = q.current_version;
  insert into quote_versions (quote_id, version, package_discount, service_fee, vat_rate, notes, terms, valid_until, payment_schedule, created_by)
  values (p_quote, q.current_version + 1, old_v.package_discount, old_v.service_fee, old_v.vat_rate, old_v.notes, old_v.terms, current_date + 10, old_v.payment_schedule, auth.uid())
  returning id into new_id;
  insert into quote_items (quote_version_id, requirement_id, category_id, provider_id, event_id, title, description, qty, unit, unit_price, provider_cost, pricing_model, commission_rate, sort)
  select new_id, requirement_id, category_id, provider_id, event_id, title, description, qty, unit, unit_price, provider_cost, pricing_model, commission_rate, sort
  from quote_items where quote_version_id = old_v.id;
  update quotes set current_version = q.current_version + 1, status = 'DRAFT' where id = p_quote;
  perform vivah_audit('quote.revise', 'quote', p_quote, jsonb_build_object('version', q.current_version + 1));
  return q.current_version + 1;
end;
$$;

-- Bookings ---------------------------------------------------------------------------

-- activateBooking (internal, idempotent): confirmed status, requirement
-- confirmed, exactly one pair of payables and one revenue entry per booking.
-- The calendar is blocked by the booking trigger.
create or replace function vivah_activate_booking(p_booking uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  b service_bookings%rowtype;
  dates date[];
  parts bigint[];
begin
  select * into b from service_bookings where id = p_booking for update;
  if b.id is null or b.status = 'CANCELLED' then return; end if;
  if b.status in ('PROPOSED', 'HELD') then
    update service_bookings set status = 'CONFIRMED', confirmed_at = now() where id = p_booking;
  end if;
  update project_requirements set status = 'CONFIRMED' where id = b.requirement_id;
  dates := vivah_event_dates(b.project_id, p_booking);
  if not exists (select 1 from provider_payables where booking_id = p_booking) then
    parts := vivah_payable_split(b.provider_payable);
    insert into provider_payables (project_id, booking_id, provider_id, label, amount, release_rule, due_date) values
      (b.project_id, p_booking, b.provider_id, 'Pre-event release (40%)', parts[1], 'BEFORE_EVENT', coalesce(dates[1], current_date + 120) - 7),
      (b.project_id, p_booking, b.provider_id, 'Final settlement (60%)', parts[2], 'AFTER_EVENT', coalesce(dates[1], current_date + 120) + 3);
  end if;
  if not exists (select 1 from platform_revenue where booking_id = p_booking and amount > 0) and b.platform_fee > 0 then
    insert into platform_revenue (project_id, booking_id, provider_id, kind, amount) values (b.project_id, p_booking, b.provider_id, b.pricing_model::text::revenue_kind, b.platform_fee);
  end if;
end;
$$;

create or replace function rpc_confirm_booking(p_booking uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  pid uuid;
begin
  select project_id into pid from service_bookings where id = p_booking;
  if pid is null then perform vivah_fail('This booking no longer exists', 'no_data_found'); end if;
  if not (can_manage_project(pid) or is_org_member(provider_org(booking_provider(p_booking)))) then
    perform vivah_fail('You can’t confirm this booking', 'insufficient_privilege');
  end if;
  perform vivah_activate_booking(p_booking);
  perform vivah_audit('booking.confirm', 'booking', p_booking);
end;
$$;

-- cancelBooking: open payables are cancelled and the platform's fee is reversed
-- with a negative revenue entry (the app's mock doesn't do this yet, §10).
create or replace function rpc_cancel_booking(p_booking uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  b service_bookings%rowtype;
begin
  select * into b from service_bookings where id = p_booking for update;
  if b.id is null then perform vivah_fail('This booking no longer exists', 'no_data_found'); end if;
  if not can_manage_project(b.project_id) then perform vivah_fail('You can’t cancel this booking', 'insufficient_privilege'); end if;
  if b.status = 'CANCELLED' then return; end if;
  if coalesce(trim(p_reason), '') = '' then perform vivah_fail('Give a reason for the cancellation'); end if;
  update service_bookings set status = 'CANCELLED', cancelled_at = now(), cancel_reason = p_reason where id = p_booking;
  update provider_payables set status = 'CANCELLED' where booking_id = p_booking and status <> 'PAID';
  insert into platform_revenue (project_id, booking_id, provider_id, kind, amount)
  select project_id, booking_id, provider_id, kind, -sum(amount) from platform_revenue where booking_id = p_booking
  group by project_id, booking_id, provider_id, kind having sum(amount) > 0;
  update project_requirements set status = 'OPEN' where id = b.requirement_id and status = 'CONFIRMED';
  perform vivah_audit('booking.cancel', 'booking', p_booking, jsonb_build_object('reason', p_reason));
end;
$$;

-- respondToQuote: the couple accepts, declines or asks for changes. Accepting
-- creates the order and the milestones (which sum exactly to the total) and
-- confirms the bookings the accepted version covers.
create or replace function rpc_respond_to_quote(p_quote uuid, p_action text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  q quotes%rowtype;
  v quote_versions%rowtype;
  order_id uuid;
  steps jsonb;
  pcts numeric[];
  amounts bigint[];
  dates date[];
  i int;
  step jsonb;
  due date;
  bid uuid;
begin
  select * into q from quotes where id = p_quote for update;
  if q.id is null then perform vivah_fail('This quotation no longer exists', 'no_data_found'); end if;
  if q.customer_id <> auth.uid() then perform vivah_fail('Only the couple can respond to this quotation', 'insufficient_privilege'); end if;
  if q.status not in ('SENT', 'VIEWED') then perform vivah_fail('This quotation is ' || lower(q.status::text) || ' and can’t be answered now'); end if;
  select * into v from quote_versions where quote_id = p_quote and version = q.current_version;
  if v.sent_at is null then perform vivah_fail('This version hasn’t been sent yet'); end if;
  update quote_versions set responded_at = now(), customer_note = p_note,
    response = case p_action when 'accept' then 'ACCEPTED' when 'decline' then 'REJECTED' else 'CHANGES_REQUESTED' end
  where id = v.id;

  if p_action = 'decline' then
    update quotes set status = 'REJECTED' where id = p_quote;
    if q.project_id is not null then update wedding_projects set status = 'QUOTE_REJECTED' where id = q.project_id; end if;
    perform vivah_audit('quote.decline', 'quote', p_quote);
    return jsonb_build_object('status', 'REJECTED');
  elsif p_action = 'revision' then
    update quotes set status = 'CHANGES_REQUESTED' where id = p_quote;
    if q.project_id is not null then update wedding_projects set status = 'CUSTOMER_NEGOTIATING' where id = q.project_id; end if;
    perform vivah_audit('quote.revision', 'quote', p_quote);
    return jsonb_build_object('status', 'CHANGES_REQUESTED');
  elsif p_action <> 'accept' then
    perform vivah_fail('Answer with accept, decline or revision');
  end if;

  update quotes set status = 'ACCEPTED', accepted_version = q.current_version where id = p_quote;
  if q.project_id is null then return jsonb_build_object('status', 'ACCEPTED'); end if;

  insert into orders (project_id, quote_version_id, total) values (q.project_id, v.id, v.total) returning id into order_id;
  steps := v.payment_schedule;
  select array_agg((s->>'percent')::numeric order by ord) into pcts from jsonb_array_elements(steps) with ordinality as t(s, ord);
  amounts := vivah_milestone_amounts(v.total, pcts);
  dates := vivah_event_dates(q.project_id);
  for i in 1..jsonb_array_length(steps) loop
    step := steps->(i - 1);
    due := case upper(step->>'rule')
      when 'ON_CONFIRMATION' then current_date + coalesce((step->>'days')::int, 3)
      when 'DAYS_BEFORE_EVENT' then greatest(coalesce(dates[1], current_date + 120) - coalesce((step->>'days')::int, 7), current_date + 3)
      when 'ON_EVENT_DAY' then coalesce(dates[1], current_date + 120)
      when 'AFTER_COMPLETION' then coalesce(dates[2], dates[1], current_date + 120) + coalesce((step->>'days')::int, 3)
      else coalesce(dates[1], current_date + 120) end;
    insert into payment_milestones (order_id, project_id, label, percent, amount, due_rule, due_days, due_date, sort)
    values (order_id, q.project_id, step->>'label', (step->>'percent')::numeric, amounts[i], upper(step->>'rule')::milestone_due_rule, (step->>'days')::int, due, i);
  end loop;

  for bid in
    select b.id from service_bookings b
    where b.project_id = q.project_id and b.status in ('PROPOSED', 'HELD')
      and exists (select 1 from quote_items qi where qi.quote_version_id = v.id and (qi.id = b.quote_item_id or (qi.requirement_id = b.requirement_id and qi.provider_id = b.provider_id)))
  loop
    perform vivah_activate_booking(bid);
  end loop;
  update wedding_projects set status = 'CONFIRMED', confirmed_at = now() where id = q.project_id;
  perform vivah_notify((select coordinator_id from wedding_projects where id = q.project_id), 'quote', 'Quotation accepted', q.number, '/platform/project/' || q.project_id);
  perform vivah_audit('quote.accept', 'quote', p_quote, jsonb_build_object('version', q.current_version, 'total', v.total, 'order', order_id));
  return jsonb_build_object('status', 'ACCEPTED', 'order', order_id, 'milestones', to_jsonb(amounts));
end;
$$;

-- Money ------------------------------------------------------------------------------

-- payMilestone: cash and bank transfers are recorded by finance staff; gateway
-- payments only by the Edge Function that verified them with the gateway
-- (service role, P7). Idempotent on the gateway reference; never above what is owed.
create or replace function rpc_record_payment(p_milestone uuid, p_amount bigint, p_method payment_method, p_gateway_ref text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  m payment_milestones%rowtype;
  existing uuid;
  pid uuid;
  customer uuid;
begin
  if p_method in ('CASH', 'BANK_TRANSFER') then
    if not has_permission('payment.record_cash') then perform vivah_fail('Only finance can record cash and bank payments', 'insufficient_privilege'); end if;
  elsif coalesce(auth.role(), '') <> 'service_role' then
    perform vivah_fail('Gateway payments are recorded after the gateway confirms them', 'insufficient_privilege');
  end if;
  if p_gateway_ref is not null then
    select id into existing from payments where method = p_method and gateway_ref = p_gateway_ref;
    if existing is not null then return existing; end if;
  end if;
  select * into m from payment_milestones where id = p_milestone for update;
  if m.id is null then perform vivah_fail('This milestone no longer exists', 'no_data_found'); end if;
  if m.status in ('PAID', 'WAIVED', 'CANCELLED') then perform vivah_fail('This milestone is ' || lower(m.status::text)); end if;
  if p_amount is null or p_amount <= 0 then perform vivah_fail('Enter an amount above zero'); end if;
  if p_amount > m.amount - m.paid_amount then perform vivah_fail('That is more than is owed on this milestone (NPR ' || ((m.amount - m.paid_amount) / 100) || ')'); end if;
  select customer_id into customer from wedding_projects where id = m.project_id;
  insert into payments (project_id, milestone_id, payer_id, amount, method, gateway_ref, status, receipt_no, paid_at)
  values (m.project_id, p_milestone, customer, p_amount, p_method, p_gateway_ref, 'SUCCEEDED',
          'RCPT-' || extract(year from now())::int || '-' || lpad(nextval('receipt_number_seq')::text, 4, '0'), now())
  returning id into pid;
  update payment_milestones set paid_amount = paid_amount + p_amount,
    status = case when paid_amount + p_amount >= amount then 'PAID'::milestone_status else 'PARTIALLY_PAID'::milestone_status end
  where id = p_milestone;
  update orders o set status = 'PAID' where o.id = m.order_id
    and not exists (select 1 from payment_milestones x where x.order_id = o.id and x.status not in ('PAID', 'WAIVED'));
  perform vivah_notify(customer, 'payment', 'Payment received', 'NPR ' || (p_amount / 100), '/my-wedding?tab=payments');
  perform vivah_audit('payment.record', 'payment', pid, jsonb_build_object('amount', p_amount, 'method', p_method));
  return pid;
end;
$$;

-- releasePayable: finance only; held, cancelled and paid payables never release.
create or replace function rpc_release_payable(p_kind text, p_payable uuid, p_reference text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  st payable_status;
begin
  if not has_permission('payout.release') then perform vivah_fail('Only finance can release payouts', 'insufficient_privilege'); end if;
  if p_kind = 'provider' then
    select status into st from provider_payables where id = p_payable for update;
  elsif p_kind = 'freelancer' then
    select status into st from freelancer_payables where id = p_payable for update;
  else
    perform vivah_fail('Kind must be provider or freelancer');
  end if;
  if st is null then perform vivah_fail('This payout no longer exists', 'no_data_found'); end if;
  if st in ('PAID', 'ON_HOLD', 'CANCELLED') then perform vivah_fail('This payout is ' || lower(replace(st::text, '_', ' ')) || ' and can’t be released'); end if;
  if p_kind = 'provider' then
    update provider_payables set status = 'PAID', paid_at = now(), payout_ref = coalesce(p_reference, 'BANK-' || substr(md5(p_payable::text), 1, 8)) where id = p_payable;
  else
    update freelancer_payables set status = 'PAID', paid_at = now() where id = p_payable;
  end if;
  perform vivah_audit('payable.release', p_kind || '_payable', p_payable, jsonb_build_object('reference', p_reference));
end;
$$;

create or replace function rpc_request_refund(p_payment uuid, p_amount bigint, p_reason text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  pid uuid;
  rid uuid;
begin
  select project_id into pid from payments where id = p_payment;
  if pid is null then perform vivah_fail('This payment no longer exists', 'no_data_found'); end if;
  if not (is_platform_staff() or exists (select 1 from wedding_projects where id = pid and customer_id = auth.uid())) then
    perform vivah_fail('You can’t ask for a refund on this payment', 'insufficient_privilege');
  end if;
  if p_amount is null or p_amount <= 0 then perform vivah_fail('Enter an amount above zero'); end if;
  if coalesce(trim(p_reason), '') = '' then perform vivah_fail('Give a reason for the refund'); end if;
  insert into refunds (payment_id, amount, reason, requested_by) values (p_payment, p_amount, p_reason, auth.uid()) returning id into rid;
  perform vivah_audit('refund.request', 'refund', rid, jsonb_build_object('amount', p_amount));
  return rid;
end;
$$;

create or replace function rpc_decide_refund(p_refund uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  r refunds%rowtype;
  refunded bigint;
  paid bigint;
begin
  if not has_permission('refund.approve') then perform vivah_fail('Only finance can decide refunds', 'insufficient_privilege'); end if;
  select * into r from refunds where id = p_refund for update;
  if r.id is null then perform vivah_fail('This refund request no longer exists', 'no_data_found'); end if;
  if r.status <> 'REQUESTED' then return; end if;
  update refunds set status = case when p_approve then 'PROCESSED'::refund_status else 'REJECTED'::refund_status end,
    approved_by = auth.uid(), processed_at = now() where id = p_refund;
  if p_approve then
    select coalesce(sum(amount), 0) into refunded from refunds where payment_id = r.payment_id and status = 'PROCESSED';
    select amount into paid from payments where id = r.payment_id;
    update payments set status = case when refunded >= paid then 'REFUNDED'::payment_status else 'PARTIALLY_REFUNDED'::payment_status end where id = r.payment_id;
  end if;
  perform vivah_audit(case when p_approve then 'refund.process' else 'refund.reject' end, 'refund', p_refund);
end;
$$;

-- Who may call what. Supabase lets every role execute new functions, and a
-- security definer function exposed through the API runs with its owner's
-- rights, so the internal helpers are closed to clients (otherwise anyone
-- could forge audit entries or notifications) and the RPCs are for signed-in
-- users only; each RPC checks its own rules.
revoke execute on function
  vivah_activate_booking(uuid), vivah_audit(text, text, uuid, jsonb), vivah_notify(uuid, text, text, text, text), vivah_fail(text, text)
  from public, anon, authenticated;
revoke execute on function
  rpc_submit_plan(jsonb), rpc_set_project_status(uuid, project_status, text), rpc_assign_coordinator(uuid, uuid),
  rpc_send_quote(uuid, text), rpc_revise_quote(uuid), rpc_respond_to_quote(uuid, text, text),
  rpc_confirm_booking(uuid), rpc_cancel_booking(uuid, text),
  rpc_record_payment(uuid, bigint, payment_method, text), rpc_release_payable(text, uuid, text),
  rpc_request_refund(uuid, bigint, text), rpc_decide_refund(uuid, boolean)
  from public, anon;
grant execute on function
  rpc_submit_plan(jsonb), rpc_set_project_status(uuid, project_status, text), rpc_assign_coordinator(uuid, uuid),
  rpc_send_quote(uuid, text), rpc_revise_quote(uuid), rpc_respond_to_quote(uuid, text, text),
  rpc_confirm_booking(uuid), rpc_cancel_booking(uuid, text),
  rpc_record_payment(uuid, bigint, payment_method, text), rpc_release_payable(text, uuid, text),
  rpc_request_refund(uuid, bigint, text), rpc_decide_refund(uuid, boolean)
  to authenticated, service_role;
