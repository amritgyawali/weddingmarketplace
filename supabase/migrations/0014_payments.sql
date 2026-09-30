-- =============================================================================
-- Gateway payments (P7; master plan §7.5): Khalti ePayment and eSewa ePay v2.
--
--   app ── payment-initiate ──► rpc_begin_payment (as the couple)
--                                 → a payment intent with the amount worked out
--                                   here, from the milestone, never trusted from
--                                   the client
--        ◄── gateway URL ───────  (Khalti pidx attached by rpc_payment_attach)
--   couple pays on the gateway
--   gateway ── redirect ──► payment-verify ── lookup / status API (secret key)
--                                 → rpc_settle_payment (service role only)
--                                   → rpc_record_payment (0011), idempotent
--
-- Duplicate callbacks, a refresh of the return page and the app's "check
-- again" all land on rpc_settle_payment, which locks the intent and returns the
-- first result, so a payment is recorded once. Money the gateway took that the
-- milestone can no longer accept (paid meanwhile by another intent or in cash)
-- is kept as REFUND_DUE and finance is told, never silently dropped.
--
-- NOT DEPLOYED. Never apply without the owner's say-so (AGENTS.md §1).
-- =============================================================================

create type payment_intent_status as enum ('INITIATED', 'PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUND_DUE');

create table payment_intents (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references wedding_projects (id) on delete cascade,
  milestone_id  uuid not null references payment_milestones (id) on delete cascade,
  customer_id   uuid not null references profiles (id),     -- who started it (the couple or a collaborator)
  method        payment_method not null check (method in ('KHALTI', 'ESEWA')),
  amount        bigint not null check (amount >= 1000),     -- paisa; the gateways' minimum is NPR 10
  order_ref     text not null unique,                       -- Khalti purchase_order_id / eSewa transaction_uuid
  gateway_ref   text,                                       -- Khalti pidx / eSewa ref_id
  gateway_txn   text,                                       -- Khalti transaction_id / eSewa transaction_code
  return_to     text,                                       -- where payment-verify sends the browser back
  status        payment_intent_status not null default 'INITIATED',
  payment_id    uuid references payments (id),
  checks        int not null default 0,                     -- gateway lookups made
  last_response jsonb,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '1 hour',
  settled_at    timestamptz,
  unique (method, gateway_ref)
);

create index payment_intents_milestone on payment_intents (milestone_id);
create index payment_intents_customer on payment_intents (customer_id, created_at desc);
create index payment_intents_open on payment_intents (status, created_at) where status in ('INITIATED', 'PENDING');

alter table payment_intents enable row level security;

-- Couples see their own attempts; finance sees all. Nobody writes directly:
-- every change goes through the functions below.
create policy "payment intents read" on payment_intents for select
  using (customer_id = auth.uid() or is_project_customer(project_id) or has_permission('payment.record_cash') or has_permission('refund.approve'));

-- rpc_begin_payment: the couple (or an accepted collaborator) starts paying a
-- milestone. The amount is the outstanding balance unless a smaller part
-- payment is asked for. Earlier unfinished attempts for the same milestone are
-- cancelled here; if one of them is paid after all, settle still records it.
create or replace function rpc_begin_payment(p_milestone uuid, p_method payment_method, p_amount bigint default null, p_return_to text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  m payment_milestones%rowtype;
  proj wedding_projects%rowtype;
  owed bigint;
  pay bigint;
  ref text;
  iid uuid;
  who profiles%rowtype;
  mail text;
begin
  if auth.uid() is null then perform vivah_fail('Sign in to pay', 'insufficient_privilege'); end if;
  if p_method not in ('KHALTI', 'ESEWA') then perform vivah_fail('Pay online with Khalti or eSewa'); end if;
  select * into m from payment_milestones where id = p_milestone for update;
  if m.id is null then perform vivah_fail('This milestone no longer exists', 'no_data_found'); end if;
  if not is_project_customer(m.project_id) then perform vivah_fail('Only the couple can pay this milestone', 'insufficient_privilege'); end if;
  if m.status in ('PAID', 'WAIVED', 'CANCELLED') then perform vivah_fail('This milestone is ' || lower(m.status::text)); end if;
  owed := m.amount - m.paid_amount;
  pay := coalesce(p_amount, owed);
  if pay < 1000 then perform vivah_fail('The smallest online payment is NPR 10'); end if;
  if pay > owed then perform vivah_fail('That is more than is owed on this milestone (NPR ' || (owed / 100) || ')'); end if;
  if p_return_to is not null and length(p_return_to) > 500 then perform vivah_fail('Return address is too long'); end if;

  update payment_intents set status = 'CANCELLED'
  where milestone_id = p_milestone and status in ('INITIATED', 'PENDING');

  select * into proj from wedding_projects where id = m.project_id;
  select * into who from profiles where id = auth.uid();
  select email into mail from auth.users where id = auth.uid();
  -- Unique, readable at the gateway, and only letters, digits and hyphens (eSewa's rule).
  ref := proj.code || '-' || to_char(now() at time zone 'Asia/Kathmandu', 'YYMMDDHH24MISS') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  insert into payment_intents (project_id, milestone_id, customer_id, method, amount, order_ref, return_to)
  values (m.project_id, p_milestone, auth.uid(), p_method, pay, ref, p_return_to)
  returning id into iid;
  perform vivah_audit('payment.begin', 'payment_intent', iid, jsonb_build_object('amount', pay, 'method', p_method, 'milestone', p_milestone));
  return jsonb_build_object(
    'intent', iid, 'orderRef', ref, 'amount', pay, 'method', p_method,
    'label', m.label || ' · ' || proj.code, 'projectId', m.project_id,
    'customer', jsonb_build_object('name', who.full_name, 'email', mail, 'phone', who.phone));
end;
$$;

-- The intent as payment-verify needs it (service role only).
create or replace function vivah_payment_intent(p_intent uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', i.id, 'method', i.method, 'amount', i.amount, 'orderRef', i.order_ref, 'gatewayRef', i.gateway_ref,
    'returnTo', i.return_to, 'status', i.status, 'customerId', i.customer_id, 'projectId', i.project_id,
    'receiptNo', p.receipt_no, 'paymentId', i.payment_id, 'expiresAt', i.expires_at)
  from payment_intents i left join payments p on p.id = i.payment_id
  where i.id = p_intent
$$;

-- Khalti answers initiate with a pidx; keep it so lookups use our copy, not the URL's.
create or replace function rpc_payment_attach(p_intent uuid, p_gateway_ref text, p_response jsonb default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then perform vivah_fail('Only the payment service can do this', 'insufficient_privilege'); end if;
  update payment_intents set gateway_ref = p_gateway_ref, last_response = coalesce(p_response, last_response)
  where id = p_intent and status in ('INITIATED', 'PENDING');
end;
$$;

-- rpc_settle_payment: payment-verify reports what the gateway's own lookup
-- said. Only COMPLETED with the exact amount records money. Idempotent: a
-- settled intent returns its first result.
create or replace function rpc_settle_payment(p_intent uuid, p_outcome text, p_amount bigint, p_gateway_ref text default null, p_gateway_txn text default null, p_response jsonb default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  i payment_intents%rowtype;
  pid uuid;
  receipt text;
  problem text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then perform vivah_fail('Gateway payments are recorded after the gateway confirms them', 'insufficient_privilege'); end if;
  if p_outcome not in ('COMPLETED', 'PENDING', 'FAILED', 'CANCELLED', 'EXPIRED') then perform vivah_fail('Unknown outcome ' || p_outcome); end if;
  select * into i from payment_intents where id = p_intent for update;
  if i.id is null then perform vivah_fail('This payment attempt no longer exists', 'no_data_found'); end if;

  if i.status in ('COMPLETED', 'REFUND_DUE') then
    select receipt_no into receipt from payments where id = i.payment_id;
    return jsonb_build_object('status', i.status, 'paymentId', i.payment_id, 'receiptNo', receipt, 'amount', i.amount, 'duplicate', true);
  end if;

  if p_outcome <> 'COMPLETED' then
    -- A late "failed" never overrides a cancel we made; a pending stays open.
    update payment_intents set
      status = case when p_outcome = 'PENDING' then 'PENDING'::payment_intent_status
                    when status = 'CANCELLED' then status else p_outcome::payment_intent_status end,
      checks = checks + 1, last_response = coalesce(p_response, last_response),
      gateway_ref = coalesce(gateway_ref, p_gateway_ref)
    where id = p_intent returning * into i;
    return jsonb_build_object('status', i.status, 'amount', i.amount, 'duplicate', false);
  end if;

  if p_amount is distinct from i.amount then
    problem := 'The gateway reported NPR ' || (coalesce(p_amount, 0) / 100.0) || ' instead of NPR ' || (i.amount / 100.0);
  else
    begin
      pid := rpc_record_payment(i.milestone_id, i.amount, i.method, coalesce(i.gateway_ref, p_gateway_ref, i.order_ref));
    exception when others then
      problem := sqlerrm;
    end;
  end if;

  if problem is not null then
    update payment_intents set status = 'REFUND_DUE', settled_at = now(), checks = checks + 1,
      gateway_ref = coalesce(gateway_ref, p_gateway_ref), gateway_txn = p_gateway_txn,
      last_response = coalesce(p_response, '{}'::jsonb) || jsonb_build_object('problem', problem)
    where id = p_intent;
    perform vivah_notify(r.user_id, 'payment', 'Gateway payment needs a refund', i.order_ref || ': ' || problem, '/platform/finance')
    from user_roles r where r.role in ('FINANCE', 'SUPER_ADMIN');
    perform vivah_notify(i.customer_id, 'payment', 'We received your payment', 'It couldn’t be applied to the milestone, so our finance team will refund or apply it within 2 working days.', '/my-wedding?tab=payments');
    perform vivah_audit('payment.refund_due', 'payment_intent', p_intent, jsonb_build_object('problem', problem, 'amount', p_amount));
    return jsonb_build_object('status', 'REFUND_DUE', 'amount', i.amount, 'problem', problem, 'duplicate', false);
  end if;

  update payments set raw_response = p_response where id = pid;
  update payment_intents set status = 'COMPLETED', payment_id = pid, settled_at = now(), checks = checks + 1,
    gateway_ref = coalesce(gateway_ref, p_gateway_ref), gateway_txn = p_gateway_txn, last_response = p_response
  where id = p_intent;
  select receipt_no into receipt from payments where id = pid;
  return jsonb_build_object('status', 'COMPLETED', 'paymentId', pid, 'receiptNo', receipt, 'amount', i.amount, 'duplicate', false);
end;
$$;

-- What the couple's app polls after returning from the gateway.
create or replace function rpc_payment_status(p_intent uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('status', i.status, 'amount', i.amount, 'method', i.method, 'receiptNo', p.receipt_no, 'paymentId', i.payment_id)
  from payment_intents i left join payments p on p.id = i.payment_id
  where i.id = p_intent and (i.customer_id = auth.uid() or is_project_customer(i.project_id) or has_permission('payment.record_cash'))
$$;

-- Everything a receipt shows, for the couple and finance (master plan §7.5).
create or replace function rpc_payment_receipt(p_payment uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  out jsonb;
begin
  select jsonb_build_object(
    'receiptNo', p.receipt_no, 'amount', p.amount, 'method', p.method, 'reference', p.gateway_ref, 'status', p.status,
    'paidAt', p.paid_at, 'milestone', m.label, 'projectCode', w.code, 'projectTitle', w.title,
    'payer', pr.full_name, 'refunded', coalesce((select sum(r.amount) from refunds r where r.payment_id = p.id and r.status = 'PROCESSED'), 0))
  into out
  from payments p
  join wedding_projects w on w.id = p.project_id
  left join payment_milestones m on m.id = p.milestone_id
  left join profiles pr on pr.id = p.payer_id
  where p.id = p_payment and (is_project_customer(p.project_id) or is_platform_staff());
  if out is null then perform vivah_fail('This receipt isn’t available to you', 'insufficient_privilege'); end if;
  return out;
end;
$$;

-- Job: attempts nobody finished are closed after a day (Khalti links expire
-- in an hour, eSewa sessions sooner). A late gateway callback can still settle
-- them, because settle accepts any intent that isn't already settled.
create or replace function job_payment_intents() returns int
language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  update payment_intents set status = 'EXPIRED'
  where status in ('INITIATED', 'PENDING') and created_at < now() - interval '1 day';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function
  rpc_begin_payment(uuid, payment_method, bigint, text), rpc_payment_status(uuid), rpc_payment_receipt(uuid),
  vivah_payment_intent(uuid), rpc_payment_attach(uuid, text, jsonb), rpc_settle_payment(uuid, text, bigint, text, text, jsonb),
  job_payment_intents()
  from public, anon;
revoke execute on function vivah_payment_intent(uuid), rpc_payment_attach(uuid, text, jsonb), rpc_settle_payment(uuid, text, bigint, text, text, jsonb), job_payment_intents() from authenticated;
grant execute on function rpc_begin_payment(uuid, payment_method, bigint, text), rpc_payment_status(uuid), rpc_payment_receipt(uuid) to authenticated;
grant execute on function vivah_payment_intent(uuid), rpc_payment_attach(uuid, text, jsonb), rpc_settle_payment(uuid, text, bigint, text, text, jsonb) to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('vivah-payment-intents', '30 * * * *', 'select job_payment_intents()');
  end if;
end $$;
