-- =============================================================================
-- Row-level security.
--
-- Principles
--   * Customers see only their own projects (and projects they collaborate on).
--   * Providers see projects where they hold a booking, but never other
--     providers' prices, internal notes or platform margins.
--   * Freelancers see gigs, their own applications/assignments/payables.
--   * Platform staff (admin, coordinator, support, finance) see everything they
--     need; internal_notes are staff-only.
-- =============================================================================

create or replace function has_role(r app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = auth.uid() and role = r)
$$;

create or replace function is_platform_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid()
      and role in ('PLATFORM_ADMIN', 'WEDDING_COORDINATOR', 'SUPPORT', 'FINANCE', 'SUPER_ADMIN')
  )
$$;

create or replace function is_org_member(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from organization_members where org_id = p_org and user_id = auth.uid())
$$;

create or replace function provider_org(p_provider uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from providers where id = p_provider
$$;

-- Lookups used inside policies. They are security definer so a policy on one
-- table never depends on the caller's RLS visibility of another table.
create or replace function booking_project(p_booking uuid) returns uuid
language sql stable security definer set search_path = public as $$ select project_id from service_bookings where id = p_booking $$;
create or replace function booking_provider(p_booking uuid) returns uuid
language sql stable security definer set search_path = public as $$ select provider_id from service_bookings where id = p_booking $$;
create or replace function event_project(p_event uuid) returns uuid
language sql stable security definer set search_path = public as $$ select project_id from project_events where id = p_event $$;
create or replace function gig_org(p_gig uuid) returns uuid
language sql stable security definer set search_path = public as $$ select posted_by_org_id from gigs where id = p_gig $$;
create or replace function guest_project(p_guest uuid) returns uuid
language sql stable security definer set search_path = public as $$ select project_id from guests where id = p_guest $$;

create or replace function is_project_customer(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from wedding_projects where id = p_project and customer_id = auth.uid())
      or exists (select 1 from project_collaborators where project_id = p_project and user_id = auth.uid() and accepted_at is not null)
$$;

create or replace function is_project_provider(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from service_bookings b join organization_members m on m.org_id = provider_org(b.provider_id)
    where b.project_id = p_project and m.user_id = auth.uid() and b.status <> 'CANCELLED'
  )
$$;

create or replace function is_project_freelancer(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from booking_assignments a join service_bookings b on b.id = a.booking_id
    where b.project_id = p_project and a.freelancer_id = auth.uid() and a.status not in ('CANCELLED', 'NO_SHOW')
  )
$$;

create or replace function is_conversation_member(p_conversation uuid) returns boolean
language sql stable security definer set search_path = public as $$
  -- security definer avoids RLS recursion on conversation_members
  select exists (select 1 from conversation_members where conversation_id = p_conversation and user_id = auth.uid() and not blocked)
$$;

create or replace function can_read_project(p_project uuid) returns boolean
language sql stable as $$
  select is_platform_staff() or is_project_customer(p_project) or is_project_provider(p_project) or is_project_freelancer(p_project)
$$;

-- Enable RLS everywhere ---------------------------------------------------------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Identity --------------------------------------------------------------------------
create policy "profiles: self or staff read" on profiles for select using (id = auth.uid() or is_platform_staff());
create policy "profiles: self update" on profiles for update using (id = auth.uid());
create policy "user_roles: self read" on user_roles for select using (user_id = auth.uid() or is_platform_staff());
create policy "user_roles: admin manage" on user_roles for all using (has_role('SUPER_ADMIN') or has_role('PLATFORM_ADMIN'));
create policy "customers: self" on customers for all using (id = auth.uid() or is_platform_staff());

-- Public catalogue (read by everyone, written by owners / staff) ---------------------
create policy "catalogue read" on service_categories for select using (true);
create policy "cities read" on cities for select using (true);
create policy "organizations read" on organizations for select using (true);
create policy "organizations write" on organizations for update using (is_org_member(id) or is_platform_staff());
create policy "org members read" on organization_members for select using (user_id = auth.uid() or is_org_member(org_id) or is_platform_staff());

create policy "providers public read" on providers for select using (is_active or is_org_member(org_id) or is_platform_staff());
create policy "providers owner write" on providers for update using (is_org_member(org_id) or is_platform_staff());
-- Internal marketplace signals (reliability, priority, response/cancellation
-- rates) are not granted to client roles; staff read them through the
-- service role or security definer RPCs such as match_providers().
revoke select on providers from anon, authenticated;
grant select (id, org_id, slug, kind, primary_category_id, city_id, locality, starting_price, price_unit, capacity_min, capacity_max,
              team_size, amenities, equipment, rating_avg, rating_count, completed_projects, is_featured, is_sponsored,
              is_instant_bookable, is_active, created_at)
  on providers to anon, authenticated;

create policy "provider_services read" on provider_services for select using (true);
create policy "provider_services write" on provider_services for all using (is_org_member(provider_org(provider_id)) or is_platform_staff());
create policy "provider_packages read" on provider_packages for select using (is_active or is_org_member(provider_org(provider_id)));
create policy "provider_packages write" on provider_packages for all using (is_org_member(provider_org(provider_id)) or is_platform_staff());
create policy "provider_media read" on provider_media for select using (true);
create policy "provider_media write" on provider_media for all using (is_org_member(provider_org(provider_id)) or is_platform_staff());
create policy "provider_faqs read" on provider_faqs for select using (true);
create policy "provider_faqs write" on provider_faqs for all using (is_org_member(provider_org(provider_id)));

-- Freelancers ----------------------------------------------------------------------
create policy "freelancers read" on freelancers for select using (true);
create policy "freelancers self write" on freelancers for update using (id = auth.uid() or is_platform_staff());
create policy "freelancer_skills read" on freelancer_skills for select using (true);
create policy "freelancer_skills write" on freelancer_skills for all using (freelancer_id = auth.uid());
create policy "freelancer_equipment read" on freelancer_equipment for select using (true);
create policy "freelancer_equipment write" on freelancer_equipment for all using (freelancer_id = auth.uid());
create policy "freelancer_portfolio read" on freelancer_portfolio for select using (true);
create policy "freelancer_portfolio write" on freelancer_portfolio for all using (freelancer_id = auth.uid());

-- Availability: owners manage, staff read, others only see busy/free via RPC.
create policy "availability owner" on availability for all using (
  (owner_kind = 'FREELANCER' and owner_id = auth.uid())
  or (owner_kind = 'PROVIDER' and is_org_member(provider_org(owner_id)))
  or is_platform_staff()
);
create policy "availability_rules owner" on availability_rules for all using (
  (owner_kind = 'FREELANCER' and owner_id = auth.uid())
  or (owner_kind = 'PROVIDER' and is_org_member(provider_org(owner_id)))
  or is_platform_staff()
);
create policy "calendar_connections self" on calendar_connections for all using (user_id = auth.uid());

-- Projects -------------------------------------------------------------------------
create policy "projects read" on wedding_projects for select using (can_read_project(id));
create policy "projects customer create" on wedding_projects for insert with check (customer_id = auth.uid() or is_platform_staff());
create policy "projects staff update" on wedding_projects for update using (is_platform_staff() or customer_id = auth.uid());
create policy "project history read" on project_status_history for select using (is_platform_staff() or is_project_customer(project_id));
create policy "collaborators" on project_collaborators for all using (is_platform_staff() or is_project_customer(project_id));
create policy "events read" on project_events for select using (can_read_project(project_id) and (not is_private or is_platform_staff() or is_project_customer(project_id)));
create policy "events write" on project_events for all using (is_platform_staff() or is_project_customer(project_id));
create policy "run sheet read" on run_sheet_items for select using (can_read_project(event_project(event_id)));
create policy "run sheet write" on run_sheet_items for all using (is_platform_staff() or is_project_provider(event_project(event_id)));
create policy "requirements read" on project_requirements for select using (is_platform_staff() or is_project_customer(project_id));
create policy "requirements write" on project_requirements for all using (is_platform_staff() or is_project_customer(project_id));
create policy "requirement_events" on requirement_events for all using (is_platform_staff() or is_project_customer((select project_id from project_requirements where id = requirement_id)));
create policy "match candidates staff" on match_candidates for all using (is_platform_staff());
create policy "leads" on leads for all using (is_platform_staff() or customer_id = auth.uid() or (provider_id is not null and is_org_member(provider_org(provider_id))));

-- Quotes: customers read sent versions of their quotes; issuers manage their own.
create policy "quotes read" on quotes for select using (
  is_platform_staff() or customer_id = auth.uid() or is_org_member(issuer_org_id)
);
create policy "quotes write" on quotes for all using (is_platform_staff() or is_org_member(issuer_org_id));
create policy "quotes customer respond" on quotes for update using (customer_id = auth.uid());
create policy "quote_versions read" on quote_versions for select using (
  exists (select 1 from quotes q where q.id = quote_id and (
    is_platform_staff() or is_org_member(q.issuer_org_id) or (q.customer_id = auth.uid() and sent_at is not null)))
);
create policy "quote_versions write" on quote_versions for all using (
  exists (select 1 from quotes q where q.id = quote_id and (is_platform_staff() or is_org_member(q.issuer_org_id)))
);
create policy "quote_items issuer" on quote_items for all using (
  exists (select 1 from quote_versions v join quotes q on q.id = v.quote_id
          where v.id = quote_version_id and (is_platform_staff() or is_org_member(q.issuer_org_id)))
);
-- Customers read line items through this owner-rights view, which applies its
-- own row filter and leaves out provider_cost / pricing_model / commission_rate.
create view quote_items_public as
  select i.id, i.quote_version_id, i.requirement_id, i.category_id, i.provider_id, i.event_id, i.title, i.description,
         i.qty, i.unit, i.unit_price, i.line_total, i.sort
  from quote_items i
  join quote_versions v on v.id = i.quote_version_id
  join quotes q on q.id = v.quote_id
  where is_platform_staff() or is_org_member(q.issuer_org_id) or (q.customer_id = auth.uid() and v.sent_at is not null);
grant select on quote_items_public to authenticated;

-- Bookings: providers see their own booking economics; customers only see the
-- agreed price through service_bookings_customer.
create policy "bookings read" on service_bookings for select using (is_platform_staff() or is_org_member(provider_org(provider_id)));
create policy "bookings staff write" on service_bookings for all using (is_platform_staff());
create policy "bookings provider update" on service_bookings for update using (is_org_member(provider_org(provider_id)));
create view service_bookings_customer as
  select id, project_id, requirement_id, provider_id, package_id, agreed_price, status, confirmed_at, cancellation_policy
  from service_bookings
  where is_platform_staff() or is_project_customer(project_id);
grant select on service_bookings_customer to authenticated;
create policy "booking_events read" on booking_events for select using (can_read_project(booking_project(booking_id)));
create policy "crew read" on crew_requirements for select using (
  is_platform_staff() or is_org_member(provider_org(booking_provider(booking_id)))
);
create policy "crew write" on crew_requirements for all using (
  is_platform_staff() or is_org_member(provider_org(booking_provider(booking_id)))
);

create policy "assignments read" on booking_assignments for select using (
  is_platform_staff() or freelancer_id = auth.uid() or staff_user_id = auth.uid()
  or is_org_member(provider_org(booking_provider(booking_id)))
  or is_project_customer(booking_project(booking_id))
);
create policy "assignments manage" on booking_assignments for all using (
  is_platform_staff() or is_org_member(provider_org(booking_provider(booking_id)))
);
create policy "assignments self check-in" on booking_assignments for update using (freelancer_id = auth.uid() or staff_user_id = auth.uid());

-- Gigs are visible to all freelancers while open.
create policy "gigs read" on gigs for select using (status = 'OPEN' or is_platform_staff() or is_org_member(posted_by_org_id)
  or exists (select 1 from gig_applications a where a.gig_id = gigs.id and a.freelancer_id = auth.uid()));
create policy "gigs write" on gigs for all using (is_platform_staff() or is_org_member(posted_by_org_id));
create policy "applications freelancer" on gig_applications for all using (freelancer_id = auth.uid());
create policy "applications poster" on gig_applications for all using (
  is_platform_staff() or is_org_member(gig_org(gig_id))
);
create policy "gig questions" on gig_questions for all using (
  freelancer_id = auth.uid() or is_platform_staff() or is_org_member(gig_org(gig_id))
);

-- Project management ----------------------------------------------------------------
create policy "tasks read" on tasks for select using (
  is_platform_staff()
  or (visibility = 'CUSTOMER' and is_project_customer(project_id))
  or (visibility in ('CUSTOMER', 'PROVIDER') and is_project_provider(project_id))
  or assignee_user_id = auth.uid()
);
create policy "tasks write" on tasks for all using (is_platform_staff() or (visibility = 'CUSTOMER' and is_project_customer(project_id)) or assignee_user_id = auth.uid());
create policy "timeline read" on project_timeline for select using (is_platform_staff() or (visible_to_customer and can_read_project(project_id)));
create policy "timeline write" on project_timeline for all using (is_platform_staff());
create policy "deliverables read" on deliverables for select using (can_read_project(project_id));
create policy "deliverables provider" on deliverables for all using (is_platform_staff() or is_org_member(provider_org(booking_provider(booking_id))));
create policy "deliverables customer review" on deliverables for update using (is_project_customer(project_id));
create policy "deliverable history" on deliverable_history for select using (can_read_project((select project_id from deliverables where id = deliverable_id)));
create policy "contracts read" on contracts for select using (can_read_project(project_id));
create policy "contracts write" on contracts for all using (is_platform_staff());
create policy "signatures" on contract_signatures for all using (signer_id = auth.uid() or is_platform_staff());

-- Money -----------------------------------------------------------------------------
create policy "orders read" on orders for select using (is_platform_staff() or is_project_customer(project_id));
create policy "milestones read" on payment_milestones for select using (is_platform_staff() or is_project_customer(project_id));
create policy "milestones staff" on payment_milestones for all using (has_role('FINANCE') or has_role('PLATFORM_ADMIN') or has_role('WEDDING_COORDINATOR'));
create policy "payments read" on payments for select using (is_platform_staff() or payer_id = auth.uid() or is_project_customer(project_id));
create policy "payments finance" on payments for all using (has_role('FINANCE') or has_role('PLATFORM_ADMIN'));
create policy "refunds" on refunds for select using (is_platform_staff() or requested_by = auth.uid());
create policy "refunds finance" on refunds for all using (has_role('FINANCE') or has_role('PLATFORM_ADMIN'));
create policy "invoices" on invoices for select using (is_platform_staff() or is_project_customer(project_id));
create policy "provider payables" on provider_payables for select using (is_platform_staff() or is_org_member(provider_org(provider_id)));
create policy "provider payables finance" on provider_payables for all using (has_role('FINANCE') or has_role('PLATFORM_ADMIN'));
create policy "freelancer payables" on freelancer_payables for select using (is_platform_staff() or freelancer_id = auth.uid());
create policy "freelancer payables finance" on freelancer_payables for all using (has_role('FINANCE') or has_role('PLATFORM_ADMIN'));
create policy "platform revenue staff" on platform_revenue for select using (has_role('FINANCE') or has_role('PLATFORM_ADMIN') or has_role('SUPER_ADMIN'));
create policy "disputes" on disputes for select using (is_platform_staff() or raised_by = auth.uid() or is_project_customer(project_id) or is_project_provider(project_id));
create policy "disputes raise" on disputes for insert with check (raised_by = auth.uid());
create policy "disputes staff" on disputes for update using (is_platform_staff());

-- Reputation & verification ------------------------------------------------------------
create policy "reviews read" on reviews for select using (status = 'PUBLISHED' or reviewer_id = auth.uid() or is_platform_staff());
create policy "reviews write" on reviews for insert with check (reviewer_id = auth.uid());
create policy "reviews reply" on reviews for update using (
  is_platform_staff() or (target_kind = 'PROVIDER' and is_org_member(provider_org(target_id)))
);
create policy "reliability staff" on reliability_events for all using (is_platform_staff());
create policy "verification own" on verification_cases for select using (
  is_platform_staff() or (subject_kind = 'FREELANCER' and subject_id = auth.uid())
  or (subject_kind = 'PROVIDER' and is_org_member(provider_org(subject_id)))
);
create policy "verification staff" on verification_cases for all using (is_platform_staff());
create policy "verification docs" on verification_documents for all using (
  is_platform_staff() or exists (select 1 from verification_cases c where c.id = case_id and (
    (c.subject_kind = 'FREELANCER' and c.subject_id = auth.uid()) or (c.subject_kind = 'PROVIDER' and is_org_member(provider_org(c.subject_id)))))
);

-- Communication ------------------------------------------------------------------------
create policy "conversations members" on conversations for select using (is_platform_staff() or is_conversation_member(id));
create policy "conversation members read" on conversation_members for select using (
  user_id = auth.uid() or is_platform_staff() or is_conversation_member(conversation_id)
);
create policy "conversation members self update" on conversation_members for update using (user_id = auth.uid());
create policy "messages read" on messages for select using (is_platform_staff() or is_conversation_member(conversation_id));
create policy "messages send" on messages for insert with check (sender_id = auth.uid() and is_conversation_member(conversation_id));

create policy "internal notes staff only" on internal_notes for all using (is_platform_staff());

create policy "files read" on files for select using (
  is_platform_staff()
  or (visibility = 'CUSTOMER' and can_read_project(project_id))
  or (visibility = 'PROVIDER' and is_project_provider(project_id))
  or owner_id = auth.uid()
);
create policy "files write" on files for insert with check (owner_id = auth.uid());
create policy "notifications self" on notifications for all using (user_id = auth.uid());
create policy "audit staff" on audit_logs for select using (has_role('SUPER_ADMIN') or has_role('PLATFORM_ADMIN'));

-- Couple tools: customer + collaborators + staff ---------------------------------------
create policy "households" on guest_households for all using (is_platform_staff() or is_project_customer(project_id));
create policy "guests" on guests for all using (is_platform_staff() or is_project_customer(project_id));
create policy "guest invitations" on guest_invitations for all using (is_platform_staff() or is_project_customer(guest_project(guest_id)));
create policy "rsvp questions" on rsvp_questions for all using (is_platform_staff() or is_project_customer(project_id));
create policy "seating layouts" on seating_layouts for all using (
  is_platform_staff() or is_project_customer(event_project(event_id))
  or is_project_provider(event_project(event_id))
);
create policy "seating elements" on seating_elements for all using (
  exists (select 1 from seating_layouts l join project_events e on e.id = l.event_id where l.id = layout_id and (is_platform_staff() or is_project_customer(e.project_id)))
);
create policy "seat assignments" on seat_assignments for all using (
  exists (select 1 from guests g where g.id = guest_id and (is_platform_staff() or is_project_customer(g.project_id)))
);
create policy "budget" on budget_items for all using (is_platform_staff() or is_project_customer(project_id));
create policy "website owner" on wedding_websites for all using (is_platform_staff() or is_project_customer(project_id));
create policy "website public" on wedding_websites for select using (is_published);
create policy "invitation designs" on invitation_designs for all using (is_platform_staff() or is_project_customer(project_id));
create policy "registry owner" on registry_items for all using (is_platform_staff() or is_project_customer(project_id));
create policy "registry public" on registry_items for select using (exists (select 1 from wedding_websites w where w.project_id = registry_items.project_id and w.is_published));
create policy "registry contributions" on registry_contributions for select using (
  is_platform_staff() or is_project_customer((select project_id from registry_items where id = item_id))
);
create policy "registry contribute" on registry_contributions for insert with check (true);
create policy "shortlists" on shortlists for all using (is_platform_staff() or is_project_customer(project_id));
create policy "boards" on inspiration_boards for all using (is_platform_staff() or is_project_customer(project_id));
create policy "board items" on inspiration_items for all using (
  exists (select 1 from inspiration_boards b where b.id = board_id and (is_platform_staff() or is_project_customer(b.project_id)))
);

-- Growth ------------------------------------------------------------------------------
create policy "deals read" on deals for select using (true);
create policy "deals write" on deals for all using (is_platform_staff() or (provider_id is not null and is_org_member(provider_org(provider_id))));
create policy "subscriptions" on provider_subscriptions for select using (is_platform_staff() or is_org_member(org_id));
create policy "featured read" on featured_placements for select using (true);
create policy "featured staff" on featured_placements for all using (is_platform_staff());
create policy "metrics" on provider_metrics_daily for select using (is_platform_staff() or is_org_member(provider_org(provider_id)));
