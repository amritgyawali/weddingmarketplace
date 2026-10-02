-- =============================================================================
-- Super admin console and the vehicles trade.
--
--   admin.full        a permission only super admins hold: edit or delete any
--                     record, switch features, rewrite text (Platform → More →
--                     Super admin console). Mirrors data/permissions.ts.
--   feature_flags     switches for tabs, tools, services and sections; a row
--                     with enabled = false hides the feature for everyone.
--   text_overrides    replacement wording for any English source string, in
--                     English and/or Nepali (the app's translation layer).
--   announcements     notices pinned to the top of a role's home screen.
--   vehicles trade    wedding cars, luxury/SUV hire, janti buses, jeeps and
--                     baggi/doli, with their capabilities. Mirrors
--                     data/services.ts and data/trades.ts.
-- NOT DEPLOYED. Never apply without the owner's say-so (AGENTS.md §1).
-- =============================================================================

-- Permission ---------------------------------------------------------------------

insert into permissions (id) values ('admin.full') on conflict (id) do nothing;
insert into staff_permissions (role, permission) values ('SUPER_ADMIN', 'admin.full') on conflict do nothing;

-- Feature switches ---------------------------------------------------------------

create table feature_flags (
  id          text primary key check (length(id) between 3 and 120),
  enabled     boolean not null default true,
  updated_by  uuid references profiles (id) on delete set null,
  updated_at  timestamptz not null default now()
);
create trigger feature_flags_updated before update on feature_flags for each row execute function set_updated_at();

alter table feature_flags enable row level security;
-- Every client reads the switches (signed-out visitors too: sign-up paths are switched here).
create policy "feature flags: read" on feature_flags for select using (true);
create policy "feature flags: super admin insert" on feature_flags for insert with check (has_permission('admin.full'));
create policy "feature flags: super admin update" on feature_flags for update using (has_permission('admin.full')) with check (has_permission('admin.full'));
create policy "feature flags: super admin delete" on feature_flags for delete using (has_permission('admin.full'));

-- Text overrides -----------------------------------------------------------------

create table text_overrides (
  source      text primary key check (length(trim(source)) between 1 and 500),
  text_en     text check (text_en is null or length(text_en) <= 500),
  text_ne     text check (text_ne is null or length(text_ne) <= 500),
  updated_by  uuid references profiles (id) on delete set null,
  updated_at  timestamptz not null default now(),
  check (text_en is not null or text_ne is not null)
);
create trigger text_overrides_updated before update on text_overrides for each row execute function set_updated_at();

alter table text_overrides enable row level security;
create policy "text overrides: read" on text_overrides for select using (true);
create policy "text overrides: super admin insert" on text_overrides for insert with check (has_permission('admin.full'));
create policy "text overrides: super admin update" on text_overrides for update using (has_permission('admin.full')) with check (has_permission('admin.full'));
create policy "text overrides: super admin delete" on text_overrides for delete using (has_permission('admin.full'));

-- Announcements ------------------------------------------------------------------

create table announcements (
  id          uuid primary key default gen_random_uuid(),
  audience    text not null check (audience in ('all', 'customer', 'vendor', 'freelancer', 'platform')),
  title       text not null check (length(trim(title)) between 3 and 90),
  body        text check (body is null or length(body) <= 300),
  tone        text not null default 'info' check (tone in ('info', 'success', 'warning')),
  active      boolean not null default true,
  created_by  uuid references profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table announcements enable row level security;
create policy "announcements: read live" on announcements for select to authenticated using (active or has_permission('admin.full'));
create policy "announcements: super admin insert" on announcements for insert with check (has_permission('admin.full'));
create policy "announcements: super admin update" on announcements for update using (has_permission('admin.full')) with check (has_permission('admin.full'));
create policy "announcements: super admin delete" on announcements for delete using (has_permission('admin.full'));

-- Vehicles trade -----------------------------------------------------------------

insert into service_categories (id, name) values
  ('wedding-car', 'Decorated Wedding Car'),
  ('luxury-car', 'Luxury Car & SUV Hire'),
  ('bus-hire', 'Bus & Coach Hire (Janti)'),
  ('jeep-hire', 'Jeep & 4x4 Hire'),
  ('baggi', 'Baggi, Doli & Vintage Car')
on conflict (id) do nothing;

insert into trades (id, label, services, default_form) values
  ('vehicles', 'Vehicles', array['wedding-car', 'luxury-car', 'bus-hire', 'jeep-hire', 'baggi']::text[], 'studio')
on conflict (id) do nothing;

insert into service_capabilities (service_id, capability) values
  ('wedding-car', 'logistics.fleet'), ('wedding-car', 'logistics.routes'), ('wedding-car', 'decor.themes'),
  ('luxury-car', 'logistics.fleet'), ('luxury-car', 'logistics.routes'),
  ('bus-hire', 'logistics.fleet'), ('bus-hire', 'logistics.routes'),
  ('jeep-hire', 'logistics.fleet'), ('jeep-hire', 'logistics.routes'),
  ('baggi', 'logistics.fleet'), ('baggi', 'logistics.routes'), ('baggi', 'decor.themes')
on conflict do nothing;

-- Built-in occasions that list vehicles (weddings and "something else" list every service).
update occasions set services = services || array['wedding-car', 'luxury-car', 'bus-hire', 'jeep-hire', 'baggi']::text[]
  where id in ('wedding', 'other') and not services @> array['wedding-car']::text[];
update occasions set services = services || array['wedding-car', 'luxury-car']::text[]
  where id in ('engagement', 'anniversary') and not services @> array['wedding-car']::text[];
update occasions set services = services || array['bus-hire', 'jeep-hire', 'baggi']::text[]
  where id = 'bratabandha' and not services @> array['bus-hire']::text[];
update occasions set services = services || array['bus-hire', 'luxury-car', 'jeep-hire']::text[]
  where id = 'corporate' and not services @> array['bus-hire']::text[];
