-- =============================================================================
-- Matching engine, reliability scoring and risk detection.
-- The app's TypeScript engine (src/services/matching.ts) uses the same weights,
-- so recommendations match whether computed on-device or in the database.
-- =============================================================================

-- Great-circle distance in km.
create or replace function distance_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select case when lat1 is null or lat2 is null then null else
    6371 * 2 * asin(sqrt(power(sin(radians(lat2 - lat1) / 2), 2) + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
  end
$$;

-- -----------------------------------------------------------------------------
-- Provider matching
--   availability 30 · location 15 · budget 15 · category experience 10 · rating 10
--   completion 5 · response speed 5 · previous work quality 5 · platform priority 3
--   repeat-provider 2
-- Booked / unavailable providers are excluded, not just down-ranked.
-- -----------------------------------------------------------------------------
create or replace function match_providers(p_requirement uuid, p_limit int default 10)
returns table (provider_id uuid, name text, score numeric, breakdown jsonb)
language plpgsql stable security definer set search_path = public as $$
declare
  r        project_requirements;
  p        wedding_projects;
  v_dates  date[];
  v_city   cities;
begin
  select * into r from project_requirements where id = p_requirement;
  select * into p from wedding_projects where id = r.project_id;
  if not (is_platform_staff() or p.customer_id = auth.uid()) then
    raise exception 'not allowed';
  end if;
  select coalesce(array_agg(e.date) filter (where e.date is not null), '{}') into v_dates
    from requirement_events re join project_events e on e.id = re.event_id where re.requirement_id = r.id;
  select * into v_city from cities where id = p.city_id;

  return query
  with base as (
    select pr.*, o.name as org_name, o.lat, o.lng, o.service_areas, o.service_radius_km,
      (select count(*) from availability a
         where a.owner_kind = 'PROVIDER' and a.owner_id = pr.id and a.date = any (v_dates)
           and a.status in ('BOOKED', 'UNAVAILABLE')) as blocked_days,
      (select count(*) from availability a
         where a.owner_kind = 'PROVIDER' and a.owner_id = pr.id and a.date = any (v_dates)
           and a.status in ('TENTATIVE', 'HELD')) as soft_days,
      (select count(*) from service_bookings b join wedding_projects wp on wp.id = b.project_id
         where b.provider_id = pr.id and wp.customer_id = p.customer_id and b.status = 'COMPLETED') as repeat_count,
      (select avg(rv.overall) from reviews rv
         where rv.target_kind = 'PROVIDER' and rv.target_id = pr.id and rv.status = 'PUBLISHED'
           and rv.created_at > now() - interval '18 months') as recent_quality
    from providers pr join organizations o on o.id = pr.org_id
    where pr.is_active and pr.primary_category_id = r.category_id
  ), scored as (
    select b.*,
      -- availability (30): fully free = 1, tentative/held days halve it
      case when cardinality(v_dates) = 0 then 0.8
           else greatest(0, 1 - (b.soft_days::numeric * 0.5) / cardinality(v_dates)) end as s_availability,
      -- location (15): same city 1, serves the city 0.8, within radius by distance, else 0
      case when b.city_id = p.city_id then 1
           when p.city_id = any (b.service_areas) then 0.8
           when distance_km(b.lat, b.lng, v_city.lat, v_city.lng) <= b.service_radius_km then 0.6
           else 0.1 end as s_location,
      -- budget (15): 1 inside the band, decays with distance outside it
      case when r.budget_max is null or b.starting_price is null then 0.6
           when b.starting_price between coalesce(r.budget_min, 0) and r.budget_max then 1
           when b.starting_price < coalesce(r.budget_min, 0) then 0.75
           else greatest(0, 1 - (b.starting_price - r.budget_max)::numeric / nullif(r.budget_max, 0)) end as s_budget,
      least(1, b.completed_projects::numeric / 60) as s_experience,
      case when b.rating_count = 0 then 0.6 else b.rating_avg / 5 end as s_rating,
      b.completion_rate as s_completion,
      greatest(0, 1 - b.avg_response_minutes::numeric / 1440) as s_response,
      coalesce(b.recent_quality / 5, b.rating_avg / 5, 0.6) as s_quality,
      b.platform_priority as s_priority,
      least(1, b.repeat_count::numeric) as s_repeat
    from base b
    where b.blocked_days = 0
  )
  select s.id, s.org_name,
    round(s.s_availability * 30 + s.s_location * 15 + s.s_budget * 15 + s.s_experience * 10 + s.s_rating * 10
        + s.s_completion * 5 + s.s_response * 5 + s.s_quality * 5 + s.s_priority * 3 + s.s_repeat * 2, 1) as score,
    jsonb_build_object(
      'availability', round(s.s_availability * 30, 1), 'location', round(s.s_location * 15, 1),
      'budget', round(s.s_budget * 15, 1), 'experience', round(s.s_experience * 10, 1),
      'rating', round(s.s_rating * 10, 1), 'completion', round(s.s_completion * 5, 1),
      'response', round(s.s_response * 5, 1), 'quality', round(s.s_quality * 5, 1),
      'priority', round(s.s_priority * 3, 1), 'repeat', round(s.s_repeat * 2, 1)) as breakdown
  from scored s
  order by score desc
  limit p_limit;
end $$;

-- Store the latest scores for coordinator review (does not award the job).
create or replace function refresh_match_candidates(p_requirement uuid) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_platform_staff() then raise exception 'not allowed'; end if;
  insert into match_candidates (requirement_id, candidate_kind, candidate_id, score, breakdown)
  select p_requirement, 'PROVIDER', m.provider_id, m.score, m.breakdown from match_providers(p_requirement, 20) m
  on conflict (requirement_id, candidate_kind, candidate_id)
  do update set score = excluded.score, breakdown = excluded.breakdown, computed_at = now();
  get diagnostics n = row_count;
  update project_requirements set status = 'MATCHING' where id = p_requirement and status = 'OPEN';
  return n;
end $$;

-- -----------------------------------------------------------------------------
-- Freelancer matching (gigs and emergency replacement)
-- -----------------------------------------------------------------------------
create or replace function match_freelancers(p_gig uuid, p_limit int default 20)
returns table (freelancer_id uuid, name text, score numeric, distance numeric, breakdown jsonb)
language plpgsql stable security definer set search_path = public as $$
declare g gigs;
begin
  select * into g from gigs where id = p_gig;
  if not (is_platform_staff() or is_org_member(g.posted_by_org_id)) then raise exception 'not allowed'; end if;
  return query
  with base as (
    select f.*, pf.full_name,
      distance_km(f.lat, f.lng, g.lat, g.lng) as km,
      (select count(*) from unnest(g.equipment) req
         where exists (select 1 from freelancer_equipment e where e.freelancer_id = f.id and e.name ilike '%' || req || '%')) as equipment_hits,
      coalesce(cardinality(g.equipment), 0) as equipment_needed
    from freelancers f join profiles pf on pf.id = f.id
    where f.is_available
      and f.verification_status = 'VERIFIED'
      and exists (select 1 from freelancer_skills s where s.freelancer_id = f.id and s.skill = g.role)
      and not exists (select 1 from availability a where a.owner_kind = 'FREELANCER' and a.owner_id = f.id and a.date = g.date and a.status in ('BOOKED', 'UNAVAILABLE'))
      and not exists (select 1 from gig_applications ga where ga.gig_id = g.id and ga.freelancer_id = f.id and ga.status in ('DECLINED', 'WITHDRAWN'))
  )
  select b.id, b.full_name,
    round(
      30                                                                                   -- available (filtered above)
      + 20 * case when b.km is null then 0.5 when b.km <= b.travel_radius_km then 1 - b.km / greatest(b.travel_radius_km, 1) * 0.5 else 0 end
      + 15 * case when b.equipment_needed = 0 then 1 else b.equipment_hits::numeric / b.equipment_needed end
      + 15 * b.reliability_score / 100
      + 10 * case when b.rating_count = 0 then 0.6 else b.rating_avg / 5 end
      + 5  * least(1, b.completed_gigs::numeric / 40)
      + 5  * case when b.day_rate is null or g.pay >= b.day_rate then 1 else g.pay::numeric / b.day_rate end
    , 1),
    round(coalesce(b.km, 0)::numeric, 1),
    jsonb_build_object('distance_km', round(coalesce(b.km, 0)::numeric, 1), 'equipment_hits', b.equipment_hits, 'reliability', b.reliability_score)
  from base b
  where b.km is null or b.km <= b.travel_radius_km * (case when g.is_emergency then 1.5 else 1 end)
  order by 3 desc
  limit p_limit;
end $$;

-- Mark an assignment for emergency replacement and open an urgent gig.
create or replace function start_emergency_replacement(p_assignment uuid, p_reason text, p_pay bigint default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare a booking_assignments; b service_bookings; e project_events; v_gig uuid;
begin
  if not is_platform_staff() then raise exception 'not allowed'; end if;
  select * into a from booking_assignments where id = p_assignment for update;
  select * into b from service_bookings where id = a.booking_id;
  select * into e from project_events where id = a.event_id;
  update booking_assignments set status = 'EMERGENCY_REPLACEMENT', notes = coalesce(notes || E'\n', '') || p_reason where id = a.id;
  insert into reliability_events (subject_kind, subject_id, kind, project_id, weight)
    values ('FREELANCER', a.freelancer_id, 'CANCELLED', b.project_id, 2);
  insert into gigs (project_id, booking_id, crew_requirement_id, posted_by_org_id, title, role, description, city_id, date,
                    start_time, end_time, pay, slots, is_emergency, status)
  values (b.project_id, b.id, a.crew_requirement_id, (select id from organizations where kind = 'PLATFORM' limit 1),
          'EMERGENCY: ' || a.role || ' needed today', a.role, p_reason, e.city_id, coalesce(e.date, current_date),
          (a.start_at at time zone 'Asia/Kathmandu')::time, (a.end_at at time zone 'Asia/Kathmandu')::time,
          coalesce(p_pay, (a.agreed_pay * 1.25)::bigint), 1, true, 'OPEN')
  returning id into v_gig;
  return v_gig;
end $$;

-- -----------------------------------------------------------------------------
-- Reliability score (0–100): recomputed nightly and after each event.
-- -----------------------------------------------------------------------------
create or replace function recompute_reliability(p_kind text, p_subject uuid) returns numeric
language plpgsql security definer set search_path = public as $$
declare
  v_completed numeric; v_cancel numeric; v_late numeric; v_noshow numeric; v_dispute numeric; v_repeat numeric;
  v_total numeric; v_rating numeric; v_response numeric; v_score numeric;
begin
  select coalesce(sum(weight) filter (where kind = 'COMPLETED'), 0), coalesce(sum(weight) filter (where kind = 'CANCELLED'), 0),
         coalesce(sum(weight) filter (where kind = 'LATE_ARRIVAL'), 0), coalesce(sum(weight) filter (where kind = 'NO_SHOW'), 0),
         coalesce(sum(weight) filter (where kind = 'DISPUTE'), 0), coalesce(sum(weight) filter (where kind = 'REPEAT_BOOKING'), 0)
    into v_completed, v_cancel, v_late, v_noshow, v_dispute, v_repeat
  from reliability_events where subject_kind = p_kind and subject_id = p_subject and at > now() - interval '24 months';

  v_total := greatest(1, v_completed + v_cancel + v_noshow);
  if p_kind = 'PROVIDER' then
    select rating_avg, response_rate into v_rating, v_response from providers where id = p_subject;
  else
    select rating_avg, response_rate into v_rating, v_response from freelancers where id = p_subject;
  end if;

  v_score := 40 * (v_completed / v_total)                         -- completion rate
           + 20 * coalesce(nullif(v_rating, 0) / 5, 0.6)            -- ratings
           + 10 * coalesce(v_response, 1)                           -- response rate
           + 10 * least(1, v_repeat / 5)                             -- repeat bookings
           + 20                                                      -- start at full conduct points…
           - least(20, v_late * 2 + v_noshow * 10 + v_dispute * 5 + v_cancel * 4);  -- …minus penalties
  v_score := greatest(0, least(100, v_score));

  if p_kind = 'PROVIDER' then
    update providers set reliability_score = v_score, cancellation_rate = v_cancel / v_total, completion_rate = v_completed / v_total where id = p_subject;
  else
    update freelancers set reliability_score = v_score, cancellation_rate = v_cancel / v_total, no_shows = v_noshow::int, late_arrivals = v_late::int where id = p_subject;
  end if;
  return v_score;
end $$;

-- -----------------------------------------------------------------------------
-- Risk detection for the coordinator dashboard.
-- -----------------------------------------------------------------------------
create or replace view project_risks as
  -- provider hasn't confirmed and the first event is within 30 days
  select b.project_id, 'PROVIDER_UNCONFIRMED'::text as kind, 'HIGH'::text as severity,
         'Provider has not confirmed ' || sc.name as message, b.id as ref_id
  from service_bookings b
  join project_requirements r on r.id = b.requirement_id
  join service_categories sc on sc.id = r.category_id
  where b.status in ('PROPOSED', 'HELD')
    and exists (select 1 from booking_events be join project_events e on e.id = be.event_id
                where be.booking_id = b.id and e.date <= current_date + 30)
  union all
  -- crew requirement not fully assigned
  select b.project_id, 'CREW_UNFILLED', case when min(e.date) <= current_date + 3 then 'HIGH' else 'MEDIUM' end,
         c.role || ': ' || (c.count - count(a.id)) || ' still unassigned', c.id
  from crew_requirements c
  join service_bookings b on b.id = c.booking_id
  left join project_events e on e.id = c.event_id
  left join booking_assignments a on a.crew_requirement_id = c.id and a.status in ('ASSIGNED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED')
  where b.status <> 'CANCELLED'
  group by b.project_id, c.id, c.role, c.count
  having count(a.id) < c.count
  union all
  select project_id, 'PAYMENT_OVERDUE', 'HIGH', label || ' is overdue', id
  from payment_milestones where status in ('DUE', 'OVERDUE', 'PARTIALLY_PAID') and due_date < current_date
  union all
  select e.project_id, 'EVENT_WITHIN_48H', 'MEDIUM', e.name || ' starts within 48 hours', e.id
  from project_events e where e.date between current_date and current_date + 2 and e.status = 'PLANNED'
  union all
  select r.project_id, 'SERVICE_UNFILLED', case when min(e.date) <= current_date + 14 then 'HIGH' else 'MEDIUM' end,
         sc.name || ' is still unfilled', r.id
  from project_requirements r
  join service_categories sc on sc.id = r.category_id
  left join requirement_events re on re.requirement_id = r.id
  left join project_events e on e.id = re.event_id
  where r.status not in ('CONFIRMED', 'CANCELLED')
  group by r.project_id, r.id, sc.name
  union all
  select b.project_id, 'PROVIDER_CANCELLATION_HISTORY', 'MEDIUM', o.name || ' has a high cancellation rate', b.id
  from service_bookings b join providers p on p.id = b.provider_id join organizations o on o.id = p.org_id
  where b.status in ('PROPOSED', 'HELD', 'CONFIRMED') and p.cancellation_rate >= 0.15
  union all
  select project_id, 'DELIVERABLE_OVERDUE', 'MEDIUM', title || ' is overdue', id
  from deliverables where due_date < current_date and status not in ('APPROVED', 'DELIVERED');

-- Daily operations summary for "TODAY" on the coordinator dashboard.
create or replace function operations_today(p_day date default current_date)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'weddings',              (select count(distinct project_id) from project_events where date = p_day and status <> 'CANCELLED'),
    'assignments',           (select count(*) from booking_assignments a join project_events e on e.id = a.event_id where e.date = p_day and a.status not in ('CANCELLED', 'EMERGENCY_REPLACEMENT')),
    'pending_confirmations', (select count(*) from service_bookings where status in ('PROPOSED', 'HELD')),
    'payments_overdue',      (select count(*) from payment_milestones where due_date < p_day and status in ('DUE', 'OVERDUE', 'PARTIALLY_PAID')),
    'high_risk',             (select count(distinct project_id) from project_risks where severity = 'HIGH'),
    'gigs_unfilled',         (select count(*) from gigs where status = 'OPEN' and date <= p_day + 7)
  )
$$;
