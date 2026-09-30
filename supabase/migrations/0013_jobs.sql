-- =============================================================================
-- Scheduled jobs (P6; master plan §7.6). Plain functions, scheduled with
-- pg_cron when it is enabled (free inside Supabase). Each job is idempotent,
-- so running it twice, or late, does no harm. `npm run db:test` calls them
-- directly.
--
--   every 15 min  job_milestone_sweep      UPCOMING → DUE (≤ 7 days) → OVERDUE
--   every 15 min  job_payable_readiness    ACCRUED → READY (event − 7 days / after the events)
--   every 15 min  job_lead_sla             new leads with no coordinator after 2 hours
--   daily 08:00   job_payment_reminders    couples with a milestone due in 7 days (once each)
--   daily 03:00   job_cleanup              old read notifications, 300 per user, stale push tokens
-- NOT DEPLOYED. Never apply without the owner's say-so (AGENTS.md §1).
-- =============================================================================

-- milestoneStatus(): due within 7 days → DUE, past due → OVERDUE.
create or replace function job_milestone_sweep() returns int
language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  update payment_milestones set status = case
      when due_date < current_date then 'OVERDUE'::milestone_status
      when paid_amount > 0 then 'PARTIALLY_PAID'::milestone_status
      when due_date <= current_date + 7 then 'DUE'::milestone_status
      else 'UPCOMING'::milestone_status end
  where status in ('UPCOMING', 'DUE', 'OVERDUE', 'PARTIALLY_PAID') and paid_amount < amount and due_date is not null
    and status is distinct from (case
      when due_date < current_date then 'OVERDUE'::milestone_status
      when paid_amount > 0 then 'PARTIALLY_PAID'::milestone_status
      when due_date <= current_date + 7 then 'DUE'::milestone_status
      else 'UPCOMING'::milestone_status end);
  get diagnostics n = row_count;
  return n;
end;
$$;

-- releasable(): the pre-event 40 % on its due date; the 60 % once every
-- function is done or past and its due date has come. Held payables stay held.
create or replace function job_payable_readiness() returns int
language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  update provider_payables p set status = 'READY'
  where p.status = 'ACCRUED' and p.due_date <= current_date
    and (p.release_rule <> 'AFTER_EVENT' or not exists (
      select 1 from project_events e where e.project_id = p.project_id and e.status not in ('DONE', 'CANCELLED') and (e.date is null or e.date >= current_date)));
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Lead SLA: platform-managed projects still without a coordinator after 2 hours.
create or replace function job_lead_sla() returns int
language plpgsql security definer set search_path = public as $$
declare
  n int := 0;
  p record;
begin
  for p in
    select w.id, w.code, w.title from wedding_projects w
    where w.coordinator_id is null and w.status in ('NEW', 'REVIEWING') and w.created_at < now() - interval '2 hours'
      and not exists (select 1 from notifications x where x.kind = 'lead_sla' and x.href = '/platform/project/' || w.id)
  loop
    perform vivah_notify(u.user_id, 'lead_sla', 'Lead waiting over 2 hours', p.code || ' · ' || p.title, '/platform/project/' || p.id)
    from user_roles u where u.role in ('WEDDING_COORDINATOR', 'PLATFORM_ADMIN');
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- One reminder per milestone, 7 days before it is due.
create or replace function job_payment_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare
  n int := 0;
  m record;
begin
  for m in
    select pm.id, pm.label, pm.amount - pm.paid_amount as owed, pm.due_date, w.customer_id from payment_milestones pm join wedding_projects w on w.id = pm.project_id
    where pm.due_date = current_date + 7 and pm.status not in ('PAID', 'WAIVED', 'CANCELLED')
      and not exists (select 1 from notifications x where x.kind = 'payment_reminder' and x.href = '/my-wedding?tab=payments&milestone=' || pm.id)
  loop
    perform vivah_notify(m.customer_id, 'payment_reminder', 'Payment due in 7 days', m.label || ' · NPR ' || (m.owed / 100), '/my-wedding?tab=payments&milestone=' || m.id);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Keeps the free-tier database small (master plan §10): read notifications
-- older than 90 days go, each user keeps their latest 300, and push tokens not
-- refreshed for 6 months are dropped.
create or replace function job_cleanup() returns int
language plpgsql security definer set search_path = public as $$
declare
  a int;
  b int;
  c int;
begin
  delete from notifications where read_at is not null and created_at < now() - interval '90 days';
  get diagnostics a = row_count;
  delete from notifications n using (
    select id from (select id, row_number() over (partition by user_id order by created_at desc) as rn from notifications) ranked where rn > 300
  ) old where n.id = old.id;
  get diagnostics b = row_count;
  delete from push_tokens where updated_at < now() - interval '180 days';
  get diagnostics c = row_count;
  return a + b + c;
end;
$$;

revoke execute on function job_milestone_sweep(), job_payable_readiness(), job_lead_sla(), job_payment_reminders(), job_cleanup() from public, anon, authenticated;

-- Schedules (Supabase: Database → Extensions → pg_cron). Re-running replaces them.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('vivah-milestones', '*/15 * * * *', 'select job_milestone_sweep()');
    perform cron.schedule('vivah-payables', '*/15 * * * *', 'select job_payable_readiness()');
    perform cron.schedule('vivah-lead-sla', '*/15 * * * *', 'select job_lead_sla()');
    perform cron.schedule('vivah-reminders', '15 2 * * *', 'select job_payment_reminders()');  -- 08:00 in Kathmandu (UTC+5:45)
    perform cron.schedule('vivah-cleanup', '15 21 * * *', 'select job_cleanup()');             -- 03:00 in Kathmandu
  end if;
end $$;
