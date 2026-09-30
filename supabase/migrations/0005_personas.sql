-- =============================================================================
-- Personas (mirrors src/types/persona.ts, src/data/{capabilities,trades,
-- occasions,permissions}.ts and src/services/experience.ts).
--
--   taxonomy (what a user is) → capabilities (what they can do) → surfaces
--
-- Reference tables are read-only to signed-in users. Occasions are also
-- editable by holders of the 'occasion.manage' permission (super admins).
-- has_capability() and has_permission() are the helpers RLS policies and RPCs
-- use; both are stable security definer functions.
-- NOT DEPLOYED. Never apply without the owner's say-so (AGENTS.md §1).
-- =============================================================================

-- Reference data ---------------------------------------------------------------

create table capabilities (
  id      text primary key check (id ~ '^[a-z]+\.[a-z_]+$'),
  domain  text not null
);

create table trades (
  id            text primary key,
  label         text not null,
  services      text[] not null,
  default_form  text not null check (default_form in ('venue', 'studio', 'shop', 'solo'))
);

-- Service ids are the service_categories ids ('photography', 'venue', …).
create table service_capabilities (
  service_id  text not null references service_categories (id) on delete cascade,
  capability  text not null references capabilities (id) on delete cascade,
  primary key (service_id, capability)
);

create table permissions (
  id text primary key
);

create table staff_permissions (
  role        app_role not null,
  permission  text not null references permissions (id) on delete cascade,
  primary key (role, permission)
);

create table team_permissions (
  team        text not null,
  permission  text not null references permissions (id) on delete cascade,
  primary key (team, permission)
);

create table occasions (
  id                text primary key check (id ~ '^[a-z0-9_]{1,40}$'),
  label             text not null check (length(trim(label)) between 2 and 40),
  blurb             text not null default '',
  icon              text not null default 'calendar-outline',
  event_types       event_type[] not null check (cardinality(event_types) > 0),
  honourees         text not null check (honourees in ('couple', 'baby', 'person', 'org')),
  default_services  text[] not null default '{}',
  services          text[] not null check (cardinality(services) > 0),
  modules           text[] not null default '{}',
  ritual            boolean not null default false,
  vocab             jsonb not null default '{}',
  sort              int not null default 0,
  active            boolean not null default true,
  built_in          boolean not null default false,
  updated_at        timestamptz not null default now(),
  check (default_services <@ services)
);
create unique index occasions_label_idx on occasions (lower(label));
create trigger occasions_updated before update on occasions for each row execute function set_updated_at();

-- Persona columns (all optional; the app infers missing values) ------------------

alter table profiles add column caps_override text[] not null default '{}';
alter table profiles add column staff_team text;
alter table profiles add column persona_confirmed_at timestamptz;

alter table providers add column business_form text check (business_form in ('venue', 'studio', 'shop', 'solo'));
alter table providers add column team_size int check (team_size is null or team_size >= 0);
alter table providers add column trade_profile jsonb not null default '{}';

-- One primary service per provider, any number of add-ons.
alter table provider_services add column is_primary boolean not null default false;
create unique index provider_services_primary_idx on provider_services (provider_id) where is_primary;

-- One primary skill per freelancer.
alter table freelancer_skills add column is_primary boolean not null default false;
create unique index freelancer_skills_primary_idx on freelancer_skills (freelancer_id) where is_primary;

alter table wedding_projects add column occasion text references occasions (id) on delete restrict;
alter table wedding_projects add column honourees jsonb;
create index wedding_projects_occasion_idx on wedding_projects (occasion);

-- Checks ------------------------------------------------------------------------

create or replace function has_permission(p_perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_roles r join staff_permissions sp on sp.role = r.role
    where r.user_id = auth.uid() and sp.permission = p_perm
  ) or exists (
    select 1 from profiles p join team_permissions tp on tp.team = p.staff_team
    where p.id = auth.uid() and tp.permission = p_perm and is_platform_staff()
  )
$$;

-- Mirrors resolveExperience(): core capabilities for every provider and
-- freelancer, service capabilities from the services they offer (freelancers
-- through their crew roles), team capabilities for venue and studio businesses,
-- plus anything an admin granted in caps_override.
create or replace function has_capability(p_user uuid, p_cap text) returns boolean
language sql stable security definer set search_path = public as $$
  select
    exists (select 1 from profiles where id = p_user and p_cap = any (caps_override))
    or (p_cap like 'core.%' and exists (select 1 from user_roles where user_id = p_user and role in ('SERVICE_PROVIDER', 'FREELANCER')))
    or exists (
      select 1
      from organization_members m
      join providers pr on pr.org_id = m.org_id
      join provider_services ps on ps.provider_id = pr.id
      join service_capabilities sc on sc.service_id = ps.category_id
      where m.user_id = p_user and sc.capability = p_cap
    )
    or (p_cap in ('team.members', 'team.roster', 'team.hire_crew') and exists (
      select 1 from organization_members m join providers pr on pr.org_id = m.org_id
      where m.user_id = p_user and coalesce(pr.business_form, case when pr.kind = 'VENUE' then 'venue' else 'studio' end) in ('venue', 'studio')
    ))
    or exists (
      select 1
      from freelancer_skills fs
      join service_categories c on exists (select 1 from jsonb_array_elements(c.crew_roles) cr where cr->>'role' = fs.skill)
      join service_capabilities sc on sc.service_id = c.id
      where fs.freelancer_id = p_user and sc.capability = p_cap
    )
$$;

-- A project's planner module is on when its occasion lists it (weddings when unset).
create or replace function project_has_module(p_project uuid, p_module text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select p_module = any (o.modules)
    from wedding_projects wp join occasions o on o.id = coalesce(wp.occasion, 'wedding')
    where wp.id = p_project
  ), false)
$$;

-- RLS ---------------------------------------------------------------------------

alter table capabilities enable row level security;
alter table trades enable row level security;
alter table service_capabilities enable row level security;
alter table permissions enable row level security;
alter table staff_permissions enable row level security;
alter table team_permissions enable row level security;
alter table occasions enable row level security;

create policy "capabilities: read" on capabilities for select to authenticated using (true);
create policy "trades: read" on trades for select to authenticated using (true);
create policy "service capabilities: read" on service_capabilities for select to authenticated using (true);
create policy "permissions: read" on permissions for select to authenticated using (true);
create policy "staff permissions: read" on staff_permissions for select to authenticated using (true);
create policy "team permissions: read" on team_permissions for select to authenticated using (true);

-- Everyone (including signed-out visitors on public pages) reads active occasions;
-- staff read all of them; only occasion managers write. Built-ins are seeded here,
-- never inserted by the app; wedding and other are the fallbacks and stay.
create policy "occasions: read active" on occasions for select using (active or is_platform_staff());
create policy "occasions: manage insert" on occasions for insert with check (has_permission('occasion.manage') and not built_in);
create policy "occasions: manage update" on occasions for update using (has_permission('occasion.manage')) with check (has_permission('occasion.manage') and (active or id not in ('wedding', 'other')));
create policy "occasions: manage delete" on occasions for delete using (has_permission('occasion.manage') and id not in ('wedding', 'other'));

-- Seed (generated from the TypeScript registries; keep them in step) --------------

insert into permissions (id) values
  ('project.view_all'),
  ('project.manage'),
  ('quote.send'),
  ('incident.manage'),
  ('emergency.start'),
  ('provider.verify'),
  ('payment.record_cash'),
  ('refund.approve'),
  ('payout.release'),
  ('payout.batch'),
  ('settings.edit'),
  ('user.suspend'),
  ('staff.manage'),
  ('broadcast.send'),
  ('audit.view'),
  ('demo.reset'),
  ('occasion.manage');

insert into capabilities (id, domain) values
  ('core.leads', 'core'),
  ('core.quotes', 'core'),
  ('core.bookings', 'core'),
  ('core.calendar', 'core'),
  ('core.finance', 'core'),
  ('core.reviews', 'core'),
  ('core.portfolio', 'core'),
  ('team.members', 'team'),
  ('team.roster', 'team'),
  ('team.hire_crew', 'team'),
  ('space.halls', 'space'),
  ('space.capacity', 'space'),
  ('space.site_visits', 'space'),
  ('space.in_house_catering', 'space'),
  ('media.camera', 'media'),
  ('media.deliverables', 'media'),
  ('media.gallery', 'media'),
  ('media.card_backup', 'media'),
  ('media.shot_list', 'media'),
  ('media.editing_queue', 'media'),
  ('beauty.trials', 'beauty'),
  ('beauty.product_kit', 'beauty'),
  ('beauty.looks', 'beauty'),
  ('decor.themes', 'decor'),
  ('decor.rental_inventory', 'decor'),
  ('decor.setup_teardown', 'decor'),
  ('decor.suppliers', 'decor'),
  ('food.menu', 'food'),
  ('food.per_plate', 'food'),
  ('food.tastings', 'food'),
  ('food.final_headcount', 'food'),
  ('music.gear', 'music'),
  ('music.requests', 'music'),
  ('music.setlist', 'music'),
  ('av.gear', 'av'),
  ('av.power_load', 'av'),
  ('fashion.catalogue', 'fashion'),
  ('fashion.fittings', 'fashion'),
  ('fashion.rentals', 'fashion'),
  ('rituals.muhurta', 'rituals'),
  ('rituals.samagri', 'rituals'),
  ('logistics.fleet', 'logistics'),
  ('logistics.routes', 'logistics'),
  ('logistics.rooms', 'logistics'),
  ('stationery.proofs', 'stationery'),
  ('stationery.print_runs', 'stationery'),
  ('plan.guests', 'plan'),
  ('plan.seating', 'plan'),
  ('plan.website', 'plan'),
  ('plan.registry', 'plan'),
  ('plan.invitations', 'plan'),
  ('plan.janti', 'plan'),
  ('plan.honeymoon', 'plan'),
  ('plan.outfits', 'plan'),
  ('plan.sait', 'plan'),
  ('plan.samagri', 'plan'),
  ('plan.tips', 'plan'),
  ('plan.duties', 'plan'),
  ('plan.keepsakes', 'plan'),
  ('plan.surprise', 'plan'),
  ('plan.games', 'plan'),
  ('plan.agenda', 'plan');

insert into trades (id, label, services, default_form) values
  ('venue', 'Venue', array['venue']::text[], 'venue'),
  ('photo', 'Photo and film', array['photography', 'videography', 'drone', 'pre-wedding', 'live-streaming', 'photo-booth', 'album']::text[], 'studio'),
  ('beauty', 'Beauty', array['makeup', 'mehendi']::text[], 'solo'),
  ('decor', 'Decor and floral', array['decoration', 'florist', 'lighting', 'tent-stage', 'furniture-rental']::text[], 'studio'),
  ('food', 'Catering and cake', array['catering', 'cake', 'bartending']::text[], 'studio'),
  ('music', 'Music and entertainment', array['dj', 'panche-baja', 'live-band', 'mc', 'choreographer']::text[], 'solo'),
  ('av', 'Sound, light and AV', array['sound', 'led-screen', 'generator']::text[], 'studio'),
  ('fashion', 'Fashion', array['bridal-wear', 'groom-wear', 'jewellery']::text[], 'shop'),
  ('rituals', 'Rituals', array['pandit']::text[], 'solo'),
  ('transport', 'Transport and stay', array['transport', 'accommodation', 'security']::text[], 'studio'),
  ('stationery', 'Stationery and gifts', array['invitation', 'gifts']::text[], 'shop'),
  ('planning', 'Planning', array['planner']::text[], 'studio');

-- The service catalogue ids the capabilities hang off (idempotent: the catalogue may already be loaded).
insert into service_categories (id, name) values
  ('venue', 'Party Palace / Venue'),
  ('catering', 'Catering'),
  ('cake', 'Cake & Desserts'),
  ('bartending', 'Bar & Bartending'),
  ('photography', 'Photography'),
  ('videography', 'Videography'),
  ('drone', 'Drone Coverage'),
  ('pre-wedding', 'Pre-wedding Shoot'),
  ('live-streaming', 'Live Streaming'),
  ('photo-booth', 'Photo Booth'),
  ('album', 'Albums & Prints'),
  ('decoration', 'Decoration'),
  ('florist', 'Florist'),
  ('lighting', 'Lighting'),
  ('tent-stage', 'Tent & Stage'),
  ('planner', 'Wedding Planner / Coordinator'),
  ('makeup', 'Bridal Makeup'),
  ('mehendi', 'Mehendi Artist'),
  ('dj', 'DJ'),
  ('panche-baja', 'Panche Baja'),
  ('live-band', 'Live Band & Singers'),
  ('mc', 'MC / Host'),
  ('choreographer', 'Choreographer'),
  ('sound', 'Sound System'),
  ('led-screen', 'LED Screens'),
  ('bridal-wear', 'Bridal Wear'),
  ('groom-wear', 'Groom Wear'),
  ('jewellery', 'Jewellery'),
  ('pandit', 'Pandit / Purohit'),
  ('transport', 'Wedding Cars & Transport'),
  ('accommodation', 'Guest Accommodation'),
  ('security', 'Security & Event Staff'),
  ('generator', 'Generator & Power Backup'),
  ('furniture-rental', 'Furniture & Rentals'),
  ('invitation', 'Invitation Cards'),
  ('gifts', 'Gifts & Favours')
on conflict (id) do nothing;

insert into service_capabilities (service_id, capability) values
  ('venue', 'space.halls'),
  ('venue', 'space.capacity'),
  ('venue', 'space.site_visits'),
  ('venue', 'space.in_house_catering'),
  ('catering', 'food.menu'),
  ('catering', 'food.per_plate'),
  ('catering', 'food.tastings'),
  ('catering', 'food.final_headcount'),
  ('cake', 'food.menu'),
  ('cake', 'food.tastings'),
  ('bartending', 'food.menu'),
  ('bartending', 'food.per_plate'),
  ('photography', 'media.camera'),
  ('photography', 'media.deliverables'),
  ('photography', 'media.gallery'),
  ('photography', 'media.card_backup'),
  ('photography', 'media.shot_list'),
  ('photography', 'media.editing_queue'),
  ('videography', 'media.camera'),
  ('videography', 'media.deliverables'),
  ('videography', 'media.gallery'),
  ('videography', 'media.card_backup'),
  ('videography', 'media.shot_list'),
  ('videography', 'media.editing_queue'),
  ('drone', 'media.camera'),
  ('drone', 'media.deliverables'),
  ('drone', 'media.card_backup'),
  ('pre-wedding', 'media.camera'),
  ('pre-wedding', 'media.deliverables'),
  ('pre-wedding', 'media.gallery'),
  ('pre-wedding', 'media.card_backup'),
  ('pre-wedding', 'media.shot_list'),
  ('pre-wedding', 'media.editing_queue'),
  ('live-streaming', 'media.camera'),
  ('live-streaming', 'av.gear'),
  ('live-streaming', 'av.power_load'),
  ('photo-booth', 'media.camera'),
  ('photo-booth', 'media.gallery'),
  ('photo-booth', 'av.power_load'),
  ('album', 'media.deliverables'),
  ('album', 'media.editing_queue'),
  ('album', 'stationery.proofs'),
  ('decoration', 'decor.themes'),
  ('decoration', 'decor.rental_inventory'),
  ('decoration', 'decor.setup_teardown'),
  ('decoration', 'decor.suppliers'),
  ('florist', 'decor.themes'),
  ('florist', 'decor.setup_teardown'),
  ('florist', 'decor.suppliers'),
  ('lighting', 'decor.rental_inventory'),
  ('lighting', 'decor.setup_teardown'),
  ('lighting', 'av.gear'),
  ('lighting', 'av.power_load'),
  ('tent-stage', 'decor.rental_inventory'),
  ('tent-stage', 'decor.setup_teardown'),
  ('tent-stage', 'decor.suppliers'),
  ('furniture-rental', 'decor.rental_inventory'),
  ('furniture-rental', 'decor.setup_teardown'),
  ('planner', 'decor.themes'),
  ('planner', 'decor.suppliers'),
  ('makeup', 'beauty.trials'),
  ('makeup', 'beauty.product_kit'),
  ('makeup', 'beauty.looks'),
  ('mehendi', 'beauty.trials'),
  ('mehendi', 'beauty.product_kit'),
  ('mehendi', 'beauty.looks'),
  ('dj', 'music.gear'),
  ('dj', 'music.requests'),
  ('dj', 'music.setlist'),
  ('dj', 'av.power_load'),
  ('panche-baja', 'music.gear'),
  ('panche-baja', 'music.setlist'),
  ('live-band', 'music.gear'),
  ('live-band', 'music.requests'),
  ('live-band', 'music.setlist'),
  ('live-band', 'av.power_load'),
  ('mc', 'music.requests'),
  ('mc', 'music.setlist'),
  ('choreographer', 'music.setlist'),
  ('sound', 'av.gear'),
  ('sound', 'av.power_load'),
  ('led-screen', 'av.gear'),
  ('led-screen', 'av.power_load'),
  ('generator', 'av.gear'),
  ('generator', 'av.power_load'),
  ('bridal-wear', 'fashion.catalogue'),
  ('bridal-wear', 'fashion.fittings'),
  ('bridal-wear', 'fashion.rentals'),
  ('groom-wear', 'fashion.catalogue'),
  ('groom-wear', 'fashion.fittings'),
  ('groom-wear', 'fashion.rentals'),
  ('jewellery', 'fashion.catalogue'),
  ('jewellery', 'fashion.rentals'),
  ('pandit', 'rituals.muhurta'),
  ('pandit', 'rituals.samagri'),
  ('transport', 'logistics.fleet'),
  ('transport', 'logistics.routes'),
  ('accommodation', 'logistics.rooms'),
  ('security', 'logistics.routes'),
  ('invitation', 'stationery.proofs'),
  ('invitation', 'stationery.print_runs'),
  ('gifts', 'stationery.proofs'),
  ('gifts', 'stationery.print_runs');

insert into occasions (id, label, blurb, icon, event_types, honourees, default_services, services, modules, ritual, vocab, sort, active, built_in) values
  ('wedding', 'Wedding', 'Every function, from tilak to reception', 'heart-outline', array['WEDDING', 'MEHENDI', 'HALDI', 'SANGEET', 'RECEPTION', 'ENGAGEMENT', 'PRE_WEDDING', 'POST_WEDDING']::event_type[], 'couple', array['venue', 'catering', 'photography', 'videography', 'decoration', 'makeup', 'pandit', 'panche-baja']::text[], array['venue', 'catering', 'cake', 'bartending', 'photography', 'videography', 'drone', 'pre-wedding', 'live-streaming', 'photo-booth', 'album', 'decoration', 'florist', 'lighting', 'tent-stage', 'planner', 'makeup', 'mehendi', 'dj', 'panche-baja', 'live-band', 'mc', 'choreographer', 'sound', 'led-screen', 'bridal-wear', 'groom-wear', 'jewellery', 'pandit', 'transport', 'accommodation', 'security', 'generator', 'furniture-rental', 'invitation', 'gifts']::text[], array['guests', 'seating', 'website', 'registry', 'invitations', 'janti', 'honeymoon', 'outfits', 'sait', 'samagri', 'tips', 'duties']::text[], true, '{"eventDay":"Wedding day","hosts":"couple","planTitle":"My wedding","noun":"wedding"}'::jsonb, 1, true, true),
  ('engagement', 'Engagement', 'Sagai and ring ceremony', 'diamond-outline', array['ENGAGEMENT']::event_type[], 'couple', array['venue', 'catering', 'photography', 'decoration', 'makeup']::text[], array['venue', 'catering', 'cake', 'photography', 'videography', 'photo-booth', 'decoration', 'florist', 'lighting', 'makeup', 'mehendi', 'dj', 'sound', 'live-band', 'mc', 'pandit', 'bridal-wear', 'groom-wear', 'jewellery', 'invitation', 'gifts', 'transport', 'planner']::text[], array['guests', 'invitations', 'website', 'outfits', 'sait', 'samagri', 'tips', 'duties']::text[], true, '{"eventDay":"Engagement day","hosts":"couple","planTitle":"Our engagement","noun":"engagement"}'::jsonb, 2, true, true),
  ('anniversary', 'Anniversary', 'First, silver or golden, big or small', 'heart-circle-outline', array['ANNIVERSARY']::event_type[], 'couple', array['venue', 'catering', 'photography', 'cake', 'dj']::text[], array['venue', 'catering', 'cake', 'bartending', 'photography', 'videography', 'photo-booth', 'decoration', 'florist', 'lighting', 'dj', 'live-band', 'sound', 'mc', 'invitation', 'gifts', 'accommodation', 'transport', 'planner']::text[], array['guests', 'seating', 'website', 'invitations', 'honeymoon', 'surprise']::text[], false, '{"eventDay":"Anniversary","hosts":"couple","planTitle":"Our anniversary","noun":"celebration"}'::jsonb, 3, true, true),
  ('baby_shower', 'Baby shower', 'Godh bharai with family and friends', 'balloon-outline', array['BABY_SHOWER']::event_type[], 'couple', array['decoration', 'cake', 'photography', 'catering']::text[], array['venue', 'decoration', 'florist', 'cake', 'catering', 'photography', 'photo-booth', 'makeup', 'mehendi', 'mc', 'invitation', 'gifts', 'planner']::text[], array['guests', 'invitations', 'registry', 'games']::text[], false, '{"eventDay":"Baby shower","hosts":"family","planTitle":"Baby shower plan","noun":"celebration"}'::jsonb, 4, true, true),
  ('newborn', 'Newborn ceremony', 'Nwaran and pasni for the little one', 'happy-outline', array['PASNI', 'RELIGIOUS_CEREMONY']::event_type[], 'baby', array['pandit', 'photography', 'catering', 'decoration', 'cake']::text[], array['pandit', 'venue', 'catering', 'cake', 'photography', 'videography', 'decoration', 'tent-stage', 'sound', 'invitation', 'gifts']::text[], array['guests', 'invitations', 'sait', 'samagri', 'tips', 'duties', 'keepsakes']::text[], true, '{"eventDay":"Pasni day","hosts":"family","planTitle":"Pasni plan","noun":"celebration"}'::jsonb, 5, true, true),
  ('bratabandha', 'Bratabandha', 'Sacred thread ceremony', 'bonfire-outline', array['BRATABANDHA']::event_type[], 'person', array['pandit', 'venue', 'catering', 'photography', 'panche-baja']::text[], array['pandit', 'venue', 'catering', 'photography', 'videography', 'panche-baja', 'decoration', 'tent-stage', 'sound', 'generator', 'invitation', 'transport', 'gifts']::text[], array['guests', 'invitations', 'sait', 'samagri', 'tips', 'duties']::text[], true, '{"eventDay":"Bratabandha day","hosts":"family","planTitle":"Bratabandha plan","noun":"celebration"}'::jsonb, 6, true, true),
  ('birthday', 'Birthday', 'Kids’ parties to milestone birthdays', 'gift-outline', array['BIRTHDAY']::event_type[], 'person', array['venue', 'cake', 'decoration', 'photography', 'dj']::text[], array['venue', 'cake', 'catering', 'bartending', 'decoration', 'lighting', 'photography', 'photo-booth', 'dj', 'live-band', 'sound', 'mc', 'invitation', 'gifts']::text[], array['guests', 'invitations', 'games']::text[], false, '{"eventDay":"Birthday","hosts":"family","planTitle":"Birthday plan","noun":"party"}'::jsonb, 7, true, true),
  ('corporate', 'Corporate event', 'Launches, dinners and conferences', 'briefcase-outline', array['CORPORATE_EVENT']::event_type[], 'org', array['venue', 'catering', 'sound', 'led-screen', 'photography']::text[], array['venue', 'catering', 'bartending', 'sound', 'led-screen', 'lighting', 'generator', 'photography', 'videography', 'live-streaming', 'mc', 'transport', 'accommodation', 'security', 'tent-stage', 'furniture-rental', 'invitation', 'gifts', 'planner']::text[], array['guests', 'seating', 'invitations', 'agenda']::text[], false, '{"eventDay":"Event day","hosts":"team","planTitle":"Event plan","noun":"event"}'::jsonb, 8, true, true),
  ('other', 'Something else', 'Tell us what it is and pick your services', 'add-circle-outline', array['OTHER']::event_type[], 'person', array['venue', 'catering', 'photography']::text[], array['venue', 'catering', 'cake', 'bartending', 'photography', 'videography', 'drone', 'pre-wedding', 'live-streaming', 'photo-booth', 'album', 'decoration', 'florist', 'lighting', 'tent-stage', 'planner', 'makeup', 'mehendi', 'dj', 'panche-baja', 'live-band', 'mc', 'choreographer', 'sound', 'led-screen', 'bridal-wear', 'groom-wear', 'jewellery', 'pandit', 'transport', 'accommodation', 'security', 'generator', 'furniture-rental', 'invitation', 'gifts']::text[], array['guests', 'seating', 'website', 'registry', 'invitations', 'janti', 'honeymoon', 'outfits', 'sait', 'samagri', 'tips', 'duties', 'keepsakes', 'surprise', 'games', 'agenda']::text[], false, '{"eventDay":"Event day","hosts":"family","planTitle":"My celebration","noun":"celebration"}'::jsonb, 9, true, true);

insert into staff_permissions (role, permission) values
  ('WEDDING_COORDINATOR', 'project.view_all'),
  ('WEDDING_COORDINATOR', 'project.manage'),
  ('WEDDING_COORDINATOR', 'quote.send'),
  ('WEDDING_COORDINATOR', 'incident.manage'),
  ('WEDDING_COORDINATOR', 'emergency.start'),
  ('SUPPORT', 'project.view_all'),
  ('SUPPORT', 'incident.manage'),
  ('SUPPORT', 'emergency.start'),
  ('SUPPORT', 'broadcast.send'),
  ('FINANCE', 'project.view_all'),
  ('FINANCE', 'payment.record_cash'),
  ('FINANCE', 'refund.approve'),
  ('FINANCE', 'payout.release'),
  ('FINANCE', 'payout.batch'),
  ('FINANCE', 'audit.view'),
  ('PLATFORM_ADMIN', 'project.view_all'),
  ('PLATFORM_ADMIN', 'project.manage'),
  ('PLATFORM_ADMIN', 'quote.send'),
  ('PLATFORM_ADMIN', 'incident.manage'),
  ('PLATFORM_ADMIN', 'emergency.start'),
  ('PLATFORM_ADMIN', 'provider.verify'),
  ('PLATFORM_ADMIN', 'payment.record_cash'),
  ('PLATFORM_ADMIN', 'refund.approve'),
  ('PLATFORM_ADMIN', 'settings.edit'),
  ('PLATFORM_ADMIN', 'user.suspend'),
  ('PLATFORM_ADMIN', 'staff.manage'),
  ('PLATFORM_ADMIN', 'broadcast.send'),
  ('PLATFORM_ADMIN', 'audit.view'),
  ('PLATFORM_ADMIN', 'demo.reset'),
  ('SUPER_ADMIN', 'project.view_all'),
  ('SUPER_ADMIN', 'project.manage'),
  ('SUPER_ADMIN', 'quote.send'),
  ('SUPER_ADMIN', 'incident.manage'),
  ('SUPER_ADMIN', 'emergency.start'),
  ('SUPER_ADMIN', 'provider.verify'),
  ('SUPER_ADMIN', 'payment.record_cash'),
  ('SUPER_ADMIN', 'refund.approve'),
  ('SUPER_ADMIN', 'payout.release'),
  ('SUPER_ADMIN', 'payout.batch'),
  ('SUPER_ADMIN', 'settings.edit'),
  ('SUPER_ADMIN', 'user.suspend'),
  ('SUPER_ADMIN', 'staff.manage'),
  ('SUPER_ADMIN', 'broadcast.send'),
  ('SUPER_ADMIN', 'audit.view'),
  ('SUPER_ADMIN', 'demo.reset'),
  ('SUPER_ADMIN', 'occasion.manage');

insert into team_permissions (team, permission) values
  ('Vendor Success', 'provider.verify');
