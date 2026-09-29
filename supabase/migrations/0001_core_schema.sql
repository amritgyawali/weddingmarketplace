-- =============================================================================
-- Vivah — wedding-services orchestration marketplace (Nepal)
-- Core schema for Postgres / Supabase.
--
-- One customer request becomes a WEDDING PROJECT. A project contains events
-- (functions), service requirements, provider bookings and crew assignments,
-- versioned quotations, payment milestones, payables, tasks, deliverables,
-- conversations and files.
--
--   customer ─┬─ wedding_projects ─┬─ project_events
--             │                    ├─ project_requirements ── service_bookings ── booking_assignments ── freelancer / staff
--             │                    ├─ quotes ── quote_versions ── quote_items
--             │                    ├─ payment_milestones ── payments
--             │                    ├─ provider_payables / freelancer_payables / platform_revenue
--             │                    ├─ tasks, project_timeline, deliverables
--             │                    └─ conversations ── messages   (internal_notes are separate)
--
-- Money is stored in paisa (bigint, 1 NPR = 100 paisa) to avoid float errors.
-- Every table has RLS enabled; see 0002_rls.sql.
-- =============================================================================

create extension if not exists pgcrypto;
create extension if not exists btree_gist;
create extension if not exists pg_trgm;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

create type app_role as enum (
  'CUSTOMER', 'PLATFORM_ADMIN', 'WEDDING_COORDINATOR', 'SERVICE_PROVIDER', 'FREELANCER',
  'PROVIDER_STAFF', 'SUPPORT', 'FINANCE', 'SUPER_ADMIN'
);

create type event_type as enum (
  'WEDDING', 'ENGAGEMENT', 'PRE_WEDDING', 'POST_WEDDING', 'PASNI', 'BRATABANDHA', 'ANNIVERSARY',
  'RECEPTION', 'MEHENDI', 'HALDI', 'SANGEET', 'BACHELOR_PARTY', 'BRIDAL_SHOWER', 'WELCOME_DINNER',
  'AFTER_PARTY', 'RELIGIOUS_CEREMONY', 'BABY_SHOWER', 'BIRTHDAY', 'CORPORATE_EVENT', 'OTHER'
);

create type project_status as enum (
  'NEW', 'REVIEWING', 'NEEDS_CLARIFICATION', 'MATCHING_PROVIDERS', 'QUOTE_PREPARED', 'QUOTE_SENT',
  'CUSTOMER_NEGOTIATING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'QUOTE_REJECTED', 'CANCELLED'
);

create type lead_source as enum ('PLAN_WIZARD', 'PROVIDER_ENQUIRY', 'CONCIERGE', 'ASSISTANT', 'PHONE', 'WALK_IN', 'REFERRAL');
create type requirement_status as enum ('OPEN', 'MATCHING', 'SHORTLISTED', 'QUOTED', 'CONFIRMED', 'CANCELLED');
create type candidate_status as enum ('SUGGESTED', 'SHORTLISTED', 'CONTACTED', 'AVAILABLE', 'DECLINED', 'SELECTED');
create type booking_status as enum ('PROPOSED', 'HELD', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
create type assignment_status as enum (
  'INVITED', 'ASSIGNED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW', 'CANCELLED', 'EMERGENCY_REPLACEMENT'
);
create type worker_kind as enum ('FREELANCER', 'STAFF');
create type gig_status as enum ('DRAFT', 'OPEN', 'FILLED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
create type gig_application_status as enum (
  'INVITED', 'APPLIED', 'SHORTLISTED', 'ASSIGNED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED',
  'DECLINED', 'WITHDRAWN', 'CANCELLED', 'NO_SHOW'
);
create type availability_status as enum ('AVAILABLE', 'TENTATIVE', 'HELD', 'BOOKED', 'UNAVAILABLE');
create type day_part as enum ('FULL_DAY', 'MORNING', 'AFTERNOON', 'EVENING');
create type availability_owner as enum ('PROVIDER', 'FREELANCER', 'STAFF');
create type task_status as enum ('TODO', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'CANCELLED');
create type task_priority as enum ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
create type visibility as enum ('CUSTOMER', 'PROVIDER', 'INTERNAL');
create type quote_status as enum ('DRAFT', 'SENT', 'VIEWED', 'CHANGES_REQUESTED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'SUPERSEDED');
create type pricing_model as enum ('COMMISSION', 'MARKUP', 'LEAD_FEE', 'FREELANCER_MARGIN');
create type milestone_due_rule as enum ('ON_CONFIRMATION', 'DAYS_BEFORE_EVENT', 'ON_EVENT_DAY', 'AFTER_COMPLETION', 'FIXED_DATE');
create type milestone_status as enum ('UPCOMING', 'DUE', 'OVERDUE', 'PARTIALLY_PAID', 'PAID', 'WAIVED', 'CANCELLED');
create type payment_method as enum ('ESEWA', 'KHALTI', 'FONEPAY_QR', 'CONNECT_IPS', 'IME_PAY', 'BANK_TRANSFER', 'CARD', 'CASH');
create type payment_status as enum ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');
create type payable_status as enum ('ACCRUED', 'ON_HOLD', 'READY', 'PAID', 'CANCELLED');
create type revenue_kind as enum ('COMMISSION', 'MARKUP', 'LEAD_FEE', 'FREELANCER_MARGIN', 'SERVICE_FEE', 'SUBSCRIPTION', 'FEATURED_LISTING', 'EMERGENCY_FEE');
create type refund_status as enum ('REQUESTED', 'APPROVED', 'PROCESSED', 'REJECTED');
create type deliverable_status as enum ('NOT_STARTED', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'REVISION_REQUESTED', 'APPROVED', 'DELIVERED');
create type verification_status as enum ('UNVERIFIED', 'DOCUMENT_SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'SUSPENDED');
create type check_result as enum ('PENDING', 'PASSED', 'FAILED');
create type dispute_status as enum ('OPEN', 'INVESTIGATING', 'RESOLVED', 'REJECTED');
create type conversation_kind as enum ('PROJECT', 'SERVICE', 'DIRECT', 'GIG', 'SUPPORT');
create type message_kind as enum ('TEXT', 'IMAGE', 'VIDEO', 'FILE', 'VOICE', 'QUOTE', 'PACKAGE', 'LOCATION', 'MEETING', 'SYSTEM');
create type contract_status as enum ('DRAFT', 'SENT', 'PARTIALLY_SIGNED', 'SIGNED', 'VOID');
create type rsvp_status as enum ('PENDING', 'YES', 'NO', 'MAYBE');
create type guest_side as enum ('BRIDE', 'GROOM', 'BOTH');
create type seating_element_kind as enum ('TABLE_ROUND', 'TABLE_RECT', 'TABLE_SQUARE', 'STAGE', 'DANCE_FLOOR', 'DJ', 'BUFFET', 'ENTRANCE', 'BAR');
create type registry_kind as enum ('GIFT', 'CASH_FUND', 'HONEYMOON_FUND', 'EXPERIENCE_FUND', 'CHARITY', 'EXTERNAL');
create type review_status as enum ('PENDING', 'PUBLISHED', 'FLAGGED', 'REMOVED');
create type file_storage as enum ('SUPABASE', 'CLOUDINARY', 'GOOGLE_DRIVE', 'EXTERNAL');
create type deal_kind as enum ('SEASONAL', 'LAST_MINUTE', 'EARLY_BOOKING', 'BUNDLE', 'REFERRAL', 'PROMO_CODE');

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- Identity
-- -----------------------------------------------------------------------------

create table profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  full_name         text not null,
  phone             text unique,
  email             text,
  avatar_url        text,
  city              text,
  language          text not null default 'ne',
  currency          char(3) not null default 'NPR',
  time_zone         text not null default 'Asia/Kathmandu',
  notification_prefs jsonb not null default '{"push":true,"email":true,"sms":true,"whatsapp":false}',
  privacy           jsonb not null default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create trigger profiles_updated before update on profiles for each row execute function set_updated_at();

-- A person can hold several roles (a photographer can be a freelancer and own a studio).
create table user_roles (
  user_id    uuid references profiles (id) on delete cascade,
  role       app_role not null,
  granted_by uuid references profiles (id),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table customers (
  id              uuid primary key references profiles (id) on delete cascade,
  partner_name    text,
  wedding_date    date,
  wedding_city    text,
  referral_code   text unique,
  referred_by     uuid references customers (id),
  created_at      timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Organisations (provider businesses and the platform brand itself)
-- -----------------------------------------------------------------------------

create table organizations (
  id                   uuid primary key default gen_random_uuid(),
  kind                 text not null check (kind in ('PROVIDER', 'PLATFORM')),
  name                 text not null,
  legal_name           text,
  pan_vat_number       text,
  registration_number  text,
  address              text,
  city                 text,
  lat                  double precision,
  lng                  double precision,
  service_radius_km    int default 50,
  service_areas        text[] not null default '{}',
  verification_status  verification_status not null default 'UNVERIFIED',
  verified_at          timestamptz,
  logo_url             text,
  cover_url            text,
  description          text,
  years_experience     int,
  languages            text[] not null default '{Nepali,English}',
  website              text,
  socials              jsonb not null default '{}',
  working_hours        jsonb not null default '{}',
  bank_account         jsonb,                        -- encrypted at rest by the payout service
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create trigger organizations_updated before update on organizations for each row execute function set_updated_at();

create table organization_members (
  org_id      uuid references organizations (id) on delete cascade,
  user_id     uuid references profiles (id) on delete cascade,
  member_role text not null check (member_role in ('OWNER', 'MANAGER', 'COORDINATOR', 'STAFF', 'FINANCE')),
  permissions jsonb not null default '{}',
  title       text,
  joined_at   timestamptz not null default now(),
  primary key (org_id, user_id)
);

-- -----------------------------------------------------------------------------
-- Catalogue
-- -----------------------------------------------------------------------------

create table service_categories (
  id                  text primary key,               -- 'photography', 'venue', 'catering', …
  parent_id           text references service_categories (id),
  name                text not null,
  icon                text,
  crew_roles          jsonb not null default '[]',    -- [{"role":"Photographer","default":2}]
  review_criteria     text[] not null default '{}',   -- {"Photo quality","Punctuality",…}
  requirement_schema  jsonb not null default '{}',    -- JSON schema for project_requirements.details
  style_options       text[] not null default '{}',
  sort                int not null default 0
);

create table cities (
  id        text primary key,
  name      text not null,
  province  text,
  grp       text not null check (grp in ('VALLEY', 'CITY', 'PROVINCE', 'DESTINATION')),
  lat       double precision,
  lng       double precision
);

create table providers (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references organizations (id) on delete cascade,
  slug                 text unique not null,
  kind                 text not null check (kind in ('VENUE', 'SERVICE')),
  primary_category_id  text not null references service_categories (id),
  city_id              text references cities (id),
  locality             text,
  starting_price       bigint,
  price_unit           text,
  capacity_min         int,
  capacity_max         int,
  team_size            int,
  amenities            text[] not null default '{}',
  equipment            jsonb not null default '[]',
  -- public reputation
  rating_avg           numeric(3,2) not null default 0,
  rating_count         int not null default 0,
  completed_projects   int not null default 0,
  -- internal marketplace signals (never exposed to customers)
  response_rate        numeric(4,3) not null default 1,
  avg_response_minutes int not null default 120,
  completion_rate      numeric(4,3) not null default 1,
  cancellation_rate    numeric(4,3) not null default 0,
  reliability_score    numeric(5,2) not null default 70,
  platform_priority    numeric(4,3) not null default 0.5,
  -- merchandising
  is_featured          boolean not null default false,
  is_sponsored         boolean not null default false,
  is_instant_bookable  boolean not null default false,
  is_active            boolean not null default true,
  search_vector        tsvector,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index providers_category_city on providers (primary_category_id, city_id) where is_active;
create index providers_search on providers using gin (search_vector);
create trigger providers_updated before update on providers for each row execute function set_updated_at();

create table provider_services (
  id                      uuid primary key default gen_random_uuid(),
  provider_id             uuid not null references providers (id) on delete cascade,
  category_id             text not null references service_categories (id),
  title                   text not null,
  description             text,
  price_type              text not null check (price_type in ('FIXED', 'RANGE', 'PER_UNIT', 'CUSTOM_QUOTE')),
  price_min               bigint,
  price_max               bigint,
  unit                    text,                        -- 'per plate', 'per day', 'per event'
  event_types             event_type[] not null default '{}',
  add_ons                 jsonb not null default '[]',
  deliverables            jsonb not null default '[]',
  staff_requirements      jsonb not null default '[]',
  equipment_requirements  jsonb not null default '[]',
  duration_hours          numeric(5,2),
  is_active               boolean not null default true
);

create table provider_packages (
  id              uuid primary key default gen_random_uuid(),
  provider_id     uuid not null references providers (id) on delete cascade,
  category_id     text not null references service_categories (id),
  title           text not null,
  description     text,
  price           bigint not null,
  price_unit      text,
  included        text[] not null default '{}',
  excluded        text[] not null default '{}',
  crew            jsonb not null default '{}',          -- {"Photographer":2,"Videographer":2,"Drone Operator":1}
  deliverables    jsonb not null default '[]',          -- [{"title":"Edited photos","qty":300}]
  duration_hours  numeric(5,2),
  delivery_days   int,
  add_ons         jsonb not null default '[]',
  discount_pct    numeric(5,2) not null default 0,
  limited_slots   int,
  is_active       boolean not null default true,
  sort            int not null default 0
);

create table provider_media (
  id           uuid primary key default gen_random_uuid(),
  provider_id  uuid not null references providers (id) on delete cascade,
  kind         text not null check (kind in ('IMAGE', 'VIDEO')),
  storage      file_storage not null default 'CLOUDINARY',
  url          text not null,                           -- Cloudinary public id or URL
  caption      text,
  category_id  text references service_categories (id),
  event_type   event_type,
  venue_name   text,
  tags         text[] not null default '{}',
  credits      jsonb not null default '[]',
  is_cover     boolean not null default false,
  is_featured  boolean not null default false,
  project_id   uuid,
  sort         int not null default 0,
  created_at   timestamptz not null default now()
);

create table provider_faqs (
  id           uuid primary key default gen_random_uuid(),
  provider_id  uuid not null references providers (id) on delete cascade,
  question     text not null,
  answer       text not null,
  sort         int not null default 0
);

-- -----------------------------------------------------------------------------
-- Freelancers
-- -----------------------------------------------------------------------------

create table freelancers (
  id                   uuid primary key references profiles (id) on delete cascade,
  headline             text,
  bio                  text,
  city_id              text references cities (id),
  lat                  double precision,
  lng                  double precision,
  travel_radius_km     int not null default 25,
  experience_years     int not null default 0,
  hourly_rate          bigint,
  day_rate             bigint,
  event_rate           bigint,
  languages            text[] not null default '{Nepali}',
  own_vehicle          boolean not null default false,
  preferred_roles      text[] not null default '{}',
  verification_status  verification_status not null default 'UNVERIFIED',
  is_available         boolean not null default true,
  rating_avg           numeric(3,2) not null default 0,
  rating_count         int not null default 0,
  completed_gigs       int not null default 0,
  cancellation_rate    numeric(4,3) not null default 0,
  response_rate        numeric(4,3) not null default 1,
  late_arrivals        int not null default 0,
  no_shows             int not null default 0,
  reliability_score    numeric(5,2) not null default 70,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create trigger freelancers_updated before update on freelancers for each row execute function set_updated_at();

create table freelancer_skills (
  freelancer_id  uuid references freelancers (id) on delete cascade,
  skill          text not null,                         -- 'Photographer', 'Drone Operator', 'Editor', …
  level          text not null default 'PRO' check (level in ('ASSISTANT', 'PRO', 'LEAD')),
  years          int,
  primary key (freelancer_id, skill)
);

create table freelancer_equipment (
  id             uuid primary key default gen_random_uuid(),
  freelancer_id  uuid not null references freelancers (id) on delete cascade,
  kind           text not null check (kind in ('CAMERA', 'LENS', 'FLASH', 'DRONE', 'GIMBAL', 'LIGHT', 'AUDIO', 'VEHICLE', 'KIT', 'OTHER')),
  name           text not null,
  notes          text
);

create table freelancer_portfolio (
  id             uuid primary key default gen_random_uuid(),
  freelancer_id  uuid not null references freelancers (id) on delete cascade,
  kind           text not null check (kind in ('IMAGE', 'VIDEO', 'LINK')),
  url            text not null,
  caption        text,
  sort           int not null default 0
);

-- -----------------------------------------------------------------------------
-- Availability
-- -----------------------------------------------------------------------------

create table availability (
  id               uuid primary key default gen_random_uuid(),
  owner_kind       availability_owner not null,
  owner_id         uuid not null,                       -- providers.id / freelancers.id / profiles.id
  date             date not null,
  part             day_part not null default 'FULL_DAY',
  status           availability_status not null,
  source           text not null default 'MANUAL' check (source in ('MANUAL', 'RECURRING', 'BOOKING', 'ASSIGNMENT', 'HOLD', 'SYNC')),
  ref_table        text,
  ref_id           uuid,
  hold_expires_at  timestamptz,
  note             text,
  unique (owner_kind, owner_id, date, part)
);
create index availability_lookup on availability (owner_kind, date, status);

create table availability_rules (
  id          uuid primary key default gen_random_uuid(),
  owner_kind  availability_owner not null,
  owner_id    uuid not null,
  weekday     smallint not null check (weekday between 0 and 6),
  part        day_part not null default 'FULL_DAY',
  status      availability_status not null default 'UNAVAILABLE',
  valid_from  date,
  valid_to    date
);

create table calendar_connections (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles (id) on delete cascade,
  provider      text not null check (provider in ('GOOGLE', 'APPLE', 'ICS')),
  external_id   text,
  sync_token    text,
  last_synced   timestamptz
);

-- -----------------------------------------------------------------------------
-- Wedding projects
-- -----------------------------------------------------------------------------

create sequence wedding_project_code_seq start 1001;

create table wedding_projects (
  id                uuid primary key default gen_random_uuid(),
  code              text unique not null default ('WP-' || nextval('wedding_project_code_seq')),
  title             text not null,
  customer_id       uuid not null references customers (id),
  coordinator_id    uuid references profiles (id),
  status            project_status not null default 'NEW',
  source            lead_source not null default 'PLAN_WIZARD',
  city_id           text references cities (id),
  area              text,
  venue_selected    text,
  guest_band        text,                               -- '<100', '100-300', …
  guest_count       int,
  budget_total      bigint,
  budget_mode       text not null default 'OVERALL' check (budget_mode in ('OVERALL', 'PER_SERVICE', 'UNDECIDED')),
  styles            jsonb not null default '{}',        -- {"photography":["Candid","Cinematic"]}
  priorities        text[] not null default '{}',
  customer_notes    text,
  managed_by        text not null default 'PLATFORM' check (managed_by in ('PLATFORM', 'SELF')),
  drive_folder_url  text,
  confirmed_at      timestamptz,
  completed_at      timestamptz,
  closed_at         timestamptz,
  cancelled_reason  text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index wedding_projects_customer on wedding_projects (customer_id);
create index wedding_projects_coordinator on wedding_projects (coordinator_id, status);
create trigger wedding_projects_updated before update on wedding_projects for each row execute function set_updated_at();

create table project_status_history (
  id          bigserial primary key,
  project_id  uuid not null references wedding_projects (id) on delete cascade,
  from_status project_status,
  to_status   project_status not null,
  changed_by  uuid references profiles (id),
  note        text,
  changed_at  timestamptz not null default now()
);

create or replace function log_project_status() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into project_status_history (project_id, from_status, to_status, changed_by)
    values (new.id, case when tg_op = 'UPDATE' then old.status end, new.status, auth.uid());
  end if;
  return new;
end $$;
create trigger wedding_projects_status after insert or update of status on wedding_projects
  for each row execute function log_project_status();

create table project_collaborators (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references wedding_projects (id) on delete cascade,
  user_id      uuid references profiles (id),
  name         text not null,
  phone        text,
  relation     text,                                    -- 'Partner', 'Mother', 'Brother', …
  permission   text not null default 'EDITOR' check (permission in ('OWNER', 'EDITOR', 'VIEWER')),
  invite_code  text unique,
  accepted_at  timestamptz,
  created_at   timestamptz not null default now()
);

create table project_events (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references wedding_projects (id) on delete cascade,
  event_type          event_type not null,
  name                text not null,
  date                date,
  date_confirmed      boolean not null default false,
  start_time          time,
  end_time            time,
  venue_name          text,
  venue_provider_id   uuid references providers (id),
  city_id             text references cities (id),
  guest_count         int,
  budget              bigint,
  status              text not null default 'PLANNED' check (status in ('PLANNED', 'LIVE', 'DONE', 'CANCELLED')),
  is_private          boolean not null default false,
  notes               text,
  sort                int not null default 0
);
create index project_events_date on project_events (date);

create table run_sheet_items (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references project_events (id) on delete cascade,
  at_time     time not null,
  title       text not null,
  owner_label text,
  status      text not null default 'PENDING' check (status in ('PENDING', 'IN_PROGRESS', 'DONE', 'DELAYED')),
  note        text,
  sort        int not null default 0
);

create table project_requirements (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references wedding_projects (id) on delete cascade,
  category_id    text not null references service_categories (id),
  details        jsonb not null default '{}',           -- {"photographers":2,"drone":true,"coverage_hours":12,"style":"cinematic"}
  budget_min     bigint,
  budget_max     bigint,
  styles         text[] not null default '{}',
  status         requirement_status not null default 'OPEN',
  priority       task_priority not null default 'MEDIUM',
  notes          text,
  created_at     timestamptz not null default now()
);
create index project_requirements_project on project_requirements (project_id, status);

create table requirement_events (
  requirement_id uuid references project_requirements (id) on delete cascade,
  event_id       uuid references project_events (id) on delete cascade,
  primary key (requirement_id, event_id)
);

-- Scored candidates produced by the matching engine; the coordinator decides.
create table match_candidates (
  id              uuid primary key default gen_random_uuid(),
  requirement_id  uuid not null references project_requirements (id) on delete cascade,
  candidate_kind  text not null check (candidate_kind in ('PROVIDER', 'FREELANCER')),
  candidate_id    uuid not null,
  score           numeric(5,2) not null,
  breakdown       jsonb not null,                        -- {"availability":30,"location":12.5,…}
  status          candidate_status not null default 'SUGGESTED',
  note            text,
  computed_at     timestamptz not null default now(),
  decided_by      uuid references profiles (id),
  unique (requirement_id, candidate_kind, candidate_id)
);

create table leads (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid references wedding_projects (id) on delete set null,
  customer_id    uuid references customers (id),
  provider_id    uuid references providers (id),         -- set for direct provider enquiries
  source         lead_source not null,
  status         text not null default 'NEW' check (status in ('NEW', 'CONTACTED', 'RESPONDED', 'QUOTE_SENT', 'NEGOTIATING', 'MEETING_SCHEDULED', 'WON', 'LOST', 'ARCHIVED')),
  priority       task_priority not null default 'MEDIUM',
  value_estimate bigint,
  follow_up_at   timestamptz,
  labels         text[] not null default '{}',
  assigned_to    uuid references profiles (id),
  payload        jsonb not null default '{}',
  created_at     timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Quotations (versioned, never overwritten)
-- -----------------------------------------------------------------------------

create sequence quote_number_seq start 1;

create table quotes (
  id                uuid primary key default gen_random_uuid(),
  number            text unique not null default ('QT-' || extract(year from now())::int || '-' || lpad(nextval('quote_number_seq')::text, 4, '0')),
  project_id        uuid references wedding_projects (id) on delete cascade,
  lead_id           uuid references leads (id),
  customer_id       uuid not null references customers (id),
  issuer_kind       text not null check (issuer_kind in ('PLATFORM', 'PROVIDER')),
  issuer_org_id     uuid not null references organizations (id),
  title             text not null,
  status            quote_status not null default 'DRAFT',
  current_version   int not null default 1,
  accepted_version  int,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger quotes_updated before update on quotes for each row execute function set_updated_at();

create table quote_versions (
  id                uuid primary key default gen_random_uuid(),
  quote_id          uuid not null references quotes (id) on delete cascade,
  version           int not null,
  subtotal          bigint not null default 0,
  package_discount  bigint not null default 0,
  service_fee       bigint not null default 0,
  vat_rate          numeric(5,4) not null default 0.13,
  vat_amount        bigint not null default 0,
  total             bigint not null default 0,
  notes             text,
  terms             text,
  valid_until       date,
  payment_schedule  jsonb not null default '[]',   -- [{"label":"Booking advance","percent":30,"rule":"ON_CONFIRMATION"}]
  change_summary    text,
  created_by        uuid references profiles (id),
  created_at        timestamptz not null default now(),
  sent_at           timestamptz,
  viewed_at         timestamptz,
  responded_at      timestamptz,
  response          text check (response in ('ACCEPTED', 'CHANGES_REQUESTED', 'REJECTED')),
  customer_note     text,
  unique (quote_id, version)
);

-- A version is immutable once it has been sent to the customer.
create or replace function freeze_sent_quote_version() returns trigger language plpgsql as $$
begin
  if old.sent_at is not null and (
       new.subtotal is distinct from old.subtotal or new.package_discount is distinct from old.package_discount
    or new.service_fee is distinct from old.service_fee or new.total is distinct from old.total
    or new.terms is distinct from old.terms or new.payment_schedule is distinct from old.payment_schedule) then
    raise exception 'Quote version % is already sent; create a new version instead', old.version;
  end if;
  return new;
end $$;
create trigger quote_versions_freeze before update on quote_versions for each row execute function freeze_sent_quote_version();

create table quote_items (
  id                uuid primary key default gen_random_uuid(),
  quote_version_id  uuid not null references quote_versions (id) on delete cascade,
  requirement_id    uuid references project_requirements (id),
  category_id       text references service_categories (id),
  provider_id       uuid references providers (id),
  event_id          uuid references project_events (id),
  title             text not null,
  description       text,
  qty               numeric(10,2) not null default 1,
  unit              text,
  unit_price        bigint not null,                     -- customer price
  line_total        bigint generated always as ((qty * unit_price)::bigint) stored,
  -- internal economics (hidden from customers through the view below)
  provider_cost     bigint,
  pricing_model     pricing_model not null default 'COMMISSION',
  commission_rate   numeric(5,4),
  sort              int not null default 0
);

create or replace function prevent_sent_item_changes() returns trigger language plpgsql as $$
declare v_sent timestamptz;
begin
  select sent_at into v_sent from quote_versions where id = coalesce(new.quote_version_id, old.quote_version_id);
  if v_sent is not null then
    raise exception 'Items of a sent quote version cannot change';
  end if;
  return coalesce(new, old);
end $$;
create trigger quote_items_freeze before insert or update or delete on quote_items
  for each row execute function prevent_sent_item_changes();

-- -----------------------------------------------------------------------------
-- Bookings, crew and gigs
-- -----------------------------------------------------------------------------

create table service_bookings (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references wedding_projects (id) on delete cascade,
  requirement_id    uuid references project_requirements (id),
  provider_id       uuid not null references providers (id),
  package_id        uuid references provider_packages (id),
  quote_item_id     uuid references quote_items (id),
  agreed_price      bigint not null,                     -- what the customer pays for this service
  provider_cost     bigint not null,                     -- what the provider quoted the platform
  platform_fee      bigint not null,
  provider_payable  bigint not null,
  pricing_model     pricing_model not null default 'COMMISSION',
  commission_rate   numeric(5,4),
  status            booking_status not null default 'PROPOSED',
  held_until        timestamptz,
  confirmed_at      timestamptz,
  cancelled_at      timestamptz,
  cancel_reason     text,
  cancellation_policy text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (provider_payable + platform_fee = agreed_price or pricing_model = 'LEAD_FEE')
);
create index service_bookings_project on service_bookings (project_id);
create index service_bookings_provider on service_bookings (provider_id, status);
create trigger service_bookings_updated before update on service_bookings for each row execute function set_updated_at();

create table booking_events (
  booking_id uuid references service_bookings (id) on delete cascade,
  event_id   uuid references project_events (id) on delete cascade,
  primary key (booking_id, event_id)
);

create table crew_requirements (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references service_bookings (id) on delete cascade,
  role         text not null,                           -- 'Photographer', 'Drone Operator', 'Editor'
  count        int not null default 1 check (count > 0),
  event_id     uuid references project_events (id),
  start_at     timestamptz,
  end_at       timestamptz,
  pay_rate     bigint,
  skills       text[] not null default '{}',
  equipment    text[] not null default '{}'
);

create table gigs (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid references wedding_projects (id) on delete set null,
  booking_id            uuid references service_bookings (id) on delete set null,
  crew_requirement_id   uuid references crew_requirements (id) on delete set null,
  posted_by_org_id      uuid not null references organizations (id),
  title                 text not null,
  role                  text not null,
  description           text,
  city_id               text references cities (id),
  location              text,
  lat                   double precision,
  lng                   double precision,
  date                  date not null,
  start_time            time,
  end_time              time,
  pay                   bigint not null,
  pay_unit              text not null default 'PER_EVENT' check (pay_unit in ('PER_HOUR', 'PER_DAY', 'PER_EVENT')),
  slots                 int not null default 1,
  skills                text[] not null default '{}',
  equipment             text[] not null default '{}',
  requirements          text[] not null default '{}',
  application_deadline  timestamptz,
  is_emergency          boolean not null default false,
  status                gig_status not null default 'OPEN',
  created_at            timestamptz not null default now()
);
create index gigs_open on gigs (status, date, city_id) where status = 'OPEN';

create table gig_applications (
  id             uuid primary key default gen_random_uuid(),
  gig_id         uuid not null references gigs (id) on delete cascade,
  freelancer_id  uuid not null references freelancers (id),
  status         gig_application_status not null default 'APPLIED',
  message        text,
  expected_pay   bigint,
  invited        boolean not null default false,
  applied_at     timestamptz not null default now(),
  decided_at     timestamptz,
  decided_by     uuid references profiles (id),
  unique (gig_id, freelancer_id)
);

create table gig_questions (
  id             uuid primary key default gen_random_uuid(),
  gig_id         uuid not null references gigs (id) on delete cascade,
  freelancer_id  uuid not null references freelancers (id),
  question       text not null,
  answer         text,
  answered_by    uuid references profiles (id),
  created_at     timestamptz not null default now()
);

create table booking_assignments (
  id                      uuid primary key default gen_random_uuid(),
  booking_id              uuid not null references service_bookings (id) on delete cascade,
  crew_requirement_id     uuid references crew_requirements (id),
  worker_kind             worker_kind not null,
  freelancer_id           uuid references freelancers (id),
  staff_user_id           uuid references profiles (id),
  role                    text not null,
  event_id                uuid references project_events (id),
  start_at                timestamptz not null,
  end_at                  timestamptz not null,
  agreed_pay              bigint not null default 0,
  platform_margin         bigint not null default 0,
  status                  assignment_status not null default 'ASSIGNED',
  gig_id                  uuid references gigs (id),
  replaced_assignment_id  uuid references booking_assignments (id),
  checked_in_at           timestamptz,
  checked_out_at          timestamptz,
  check_in_lat            double precision,
  check_in_lng            double precision,
  completion_proof_url    text,
  notes                   text,
  check (end_at > start_at),
  check ((worker_kind = 'FREELANCER' and freelancer_id is not null) or (worker_kind = 'STAFF' and staff_user_id is not null))
);

-- A freelancer can never be double-booked for overlapping, active assignments.
alter table booking_assignments add constraint no_freelancer_double_booking
  exclude using gist (freelancer_id with =, tstzrange(start_at, end_at) with &&)
  where (freelancer_id is not null and status not in ('CANCELLED', 'NO_SHOW', 'EMERGENCY_REPLACEMENT'));

-- Confirmed bookings/assignments block the calendar automatically.
create or replace function block_calendar_for_assignment() returns trigger language plpgsql as $$
begin
  if new.freelancer_id is not null and new.status in ('ASSIGNED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS') then
    insert into availability (owner_kind, owner_id, date, part, status, source, ref_table, ref_id)
    values ('FREELANCER', new.freelancer_id, (new.start_at at time zone 'Asia/Kathmandu')::date, 'FULL_DAY', 'BOOKED', 'ASSIGNMENT', 'booking_assignments', new.id)
    on conflict (owner_kind, owner_id, date, part) do update set status = 'BOOKED', source = 'ASSIGNMENT', ref_table = excluded.ref_table, ref_id = excluded.ref_id;
  elsif new.freelancer_id is not null and new.status in ('CANCELLED', 'EMERGENCY_REPLACEMENT', 'NO_SHOW') then
    delete from availability where ref_table = 'booking_assignments' and ref_id = new.id;
  end if;
  return new;
end $$;
create trigger booking_assignments_calendar after insert or update of status on booking_assignments
  for each row execute function block_calendar_for_assignment();

create or replace function block_calendar_for_booking() returns trigger language plpgsql as $$
begin
  if new.status in ('HELD', 'CONFIRMED') then
    insert into availability (owner_kind, owner_id, date, part, status, source, ref_table, ref_id, hold_expires_at)
    select 'PROVIDER', new.provider_id, e.date, 'FULL_DAY',
           case when new.status = 'HELD' then 'HELD'::availability_status else 'BOOKED'::availability_status end,
           case when new.status = 'HELD' then 'HOLD' else 'BOOKING' end, 'service_bookings', new.id, new.held_until
    from booking_events be join project_events e on e.id = be.event_id
    where be.booking_id = new.id and e.date is not null
    on conflict (owner_kind, owner_id, date, part) do update
      set status = excluded.status, source = excluded.source, ref_table = excluded.ref_table, ref_id = excluded.ref_id, hold_expires_at = excluded.hold_expires_at;
  elsif new.status = 'CANCELLED' then
    delete from availability where ref_table = 'service_bookings' and ref_id = new.id;
  end if;
  return new;
end $$;
create trigger service_bookings_calendar after update of status on service_bookings
  for each row execute function block_calendar_for_booking();

-- -----------------------------------------------------------------------------
-- Project management
-- -----------------------------------------------------------------------------

create table tasks (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references wedding_projects (id) on delete cascade,
  event_id          uuid references project_events (id) on delete set null,
  booking_id        uuid references service_bookings (id) on delete set null,
  title             text not null,
  description       text,
  category          text,
  assignee_kind     text not null check (assignee_kind in ('CUSTOMER', 'PARTNER', 'FAMILY', 'COORDINATOR', 'PROVIDER', 'FREELANCER')),
  assignee_user_id  uuid references profiles (id),
  assignee_name     text,
  due_date          date,
  remind_at         timestamptz,
  status            task_status not null default 'TODO',
  priority          task_priority not null default 'MEDIUM',
  visibility        visibility not null default 'CUSTOMER',
  created_by        uuid references profiles (id),
  completed_at      timestamptz,
  created_at        timestamptz not null default now()
);
create index tasks_project on tasks (project_id, status, due_date);

create table project_timeline (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references wedding_projects (id) on delete cascade,
  date                 date not null,
  title                text not null,
  kind                 text not null check (kind in ('MILESTONE', 'BOOKING', 'PAYMENT', 'MEETING', 'EVENT', 'DELIVERY', 'TASK')),
  ref_table            text,
  ref_id               uuid,
  visible_to_customer  boolean not null default true,
  done                 boolean not null default false
);

create table deliverables (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references wedding_projects (id) on delete cascade,
  booking_id       uuid not null references service_bookings (id) on delete cascade,
  title            text not null,
  kind             text not null check (kind in ('PHOTOS', 'FILM', 'HIGHLIGHT', 'TEASER', 'ALBUM', 'RAW', 'DESIGN', 'OTHER')),
  quantity         int,
  unit             text,
  due_date         date,
  status           deliverable_status not null default 'NOT_STARTED',
  progress         numeric(4,3) not null default 0 check (progress between 0 and 1),
  delivery_url     text,                                -- Drive / delivery platform link (not Cloudinary)
  preview_url      text,
  revision_count   int not null default 0,
  revision_limit   int not null default 2,
  approved_at      timestamptz,
  delivered_at     timestamptz
);

create table deliverable_history (
  id              bigserial primary key,
  deliverable_id  uuid not null references deliverables (id) on delete cascade,
  status          deliverable_status not null,
  note            text,
  actor_id        uuid references profiles (id),
  at              timestamptz not null default now()
);

create table contracts (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references wedding_projects (id) on delete cascade,
  booking_id        uuid references service_bookings (id),
  quote_version_id  uuid references quote_versions (id),
  version           int not null default 1,
  title             text not null,
  body              jsonb not null,                     -- scope, deliverables, payment terms, cancellation, revisions
  status            contract_status not null default 'DRAFT',
  pdf_url           text,
  created_at        timestamptz not null default now()
);

create table contract_signatures (
  id            uuid primary key default gen_random_uuid(),
  contract_id   uuid not null references contracts (id) on delete cascade,
  party         text not null check (party in ('CUSTOMER', 'PROVIDER', 'PLATFORM')),
  signer_id     uuid references profiles (id),
  signer_name   text not null,
  signature_svg text,
  signed_at     timestamptz not null default now(),
  ip            inet,
  unique (contract_id, party)
);

-- -----------------------------------------------------------------------------
-- Money (customer payments are never mixed with payouts)
-- -----------------------------------------------------------------------------

create table orders (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references wedding_projects (id) on delete cascade,
  quote_version_id  uuid references quote_versions (id),
  total             bigint not null,
  currency          char(3) not null default 'NPR',
  status            text not null default 'OPEN' check (status in ('OPEN', 'PAID', 'CANCELLED', 'REFUNDED')),
  created_at        timestamptz not null default now()
);

create table payment_milestones (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders (id) on delete cascade,
  project_id   uuid not null references wedding_projects (id) on delete cascade,
  label        text not null,
  percent      numeric(5,2),
  amount       bigint not null,
  due_rule     milestone_due_rule not null,
  due_days     int,
  due_date     date,
  status       milestone_status not null default 'UPCOMING',
  paid_amount  bigint not null default 0,
  sort         int not null default 0
);

create table payments (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references wedding_projects (id),
  milestone_id   uuid references payment_milestones (id),
  payer_id       uuid references profiles (id),
  amount         bigint not null check (amount > 0),
  method         payment_method not null,
  gateway_ref    text,                                  -- eSewa refId / Khalti pidx / bank UTR
  status         payment_status not null default 'PENDING',
  receipt_no     text unique,
  paid_at        timestamptz,
  raw_response   jsonb,
  created_at     timestamptz not null default now()
);

create table refunds (
  id            uuid primary key default gen_random_uuid(),
  payment_id    uuid not null references payments (id),
  amount        bigint not null check (amount > 0),
  reason        text not null,
  status        refund_status not null default 'REQUESTED',
  requested_by  uuid references profiles (id),
  approved_by   uuid references profiles (id),
  processed_at  timestamptz,
  created_at    timestamptz not null default now()
);

create table invoices (
  id           uuid primary key default gen_random_uuid(),
  number       text unique not null,
  project_id   uuid not null references wedding_projects (id),
  milestone_id uuid references payment_milestones (id),
  kind         text not null check (kind in ('DEPOSIT', 'INSTALMENT', 'BALANCE', 'TAX', 'CREDIT_NOTE')),
  amount       bigint not null,
  vat_amount   bigint not null default 0,
  pdf_url      text,
  issued_at    timestamptz not null default now()
);

create table provider_payables (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references wedding_projects (id),
  booking_id    uuid not null references service_bookings (id),
  provider_id   uuid not null references providers (id),
  label         text not null,
  amount        bigint not null,
  status        payable_status not null default 'ACCRUED',
  release_rule  text not null default 'AFTER_EVENT' check (release_rule in ('ON_CONFIRMATION', 'BEFORE_EVENT', 'AFTER_EVENT', 'ON_DELIVERY')),
  due_date      date,
  hold_reason   text,
  paid_at       timestamptz,
  payout_ref    text,
  created_at    timestamptz not null default now()
);

create table freelancer_payables (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid references wedding_projects (id),
  assignment_id  uuid references booking_assignments (id),
  gig_id         uuid references gigs (id),
  freelancer_id  uuid not null references freelancers (id),
  label          text not null,
  amount         bigint not null,
  status         payable_status not null default 'ACCRUED',
  due_date       date,
  paid_at        timestamptz,
  payout_ref     text,
  created_at     timestamptz not null default now()
);

create table platform_revenue (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid references wedding_projects (id),
  booking_id     uuid references service_bookings (id),
  assignment_id  uuid references booking_assignments (id),
  provider_id    uuid references providers (id),
  kind           revenue_kind not null,
  amount         bigint not null,
  recognized_at  timestamptz not null default now()
);

create table disputes (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references wedding_projects (id),
  booking_id    uuid references service_bookings (id),
  assignment_id uuid references booking_assignments (id),
  raised_by     uuid not null references profiles (id),
  against_kind  text check (against_kind in ('PROVIDER', 'FREELANCER', 'CUSTOMER', 'PLATFORM')),
  reason        text not null,
  amount        bigint,
  status        dispute_status not null default 'OPEN',
  resolution    text,
  payment_frozen boolean not null default false,
  assigned_to   uuid references profiles (id),
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

-- -----------------------------------------------------------------------------
-- Reviews, reliability, verification
-- -----------------------------------------------------------------------------

create table reviews (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid references wedding_projects (id),
  booking_id        uuid references service_bookings (id),
  assignment_id     uuid references booking_assignments (id),
  reviewer_id       uuid not null references profiles (id),
  reviewer_role     text not null check (reviewer_role in ('CUSTOMER', 'PROVIDER', 'PLATFORM')),
  target_kind       text not null check (target_kind in ('PROVIDER', 'FREELANCER', 'PLATFORM')),
  target_id         uuid not null,
  overall           numeric(2,1) not null check (overall between 1 and 5),
  criteria          jsonb not null default '{}',        -- {"Photo quality":5,"Punctuality":4}
  body              text,
  media             text[] not null default '{}',
  verified_booking  boolean not null default false,
  status            review_status not null default 'PUBLISHED',
  vendor_reply      text,
  replied_at        timestamptz,
  helpful_count     int not null default 0,
  created_at        timestamptz not null default now()
);
create index reviews_target on reviews (target_kind, target_id, status);

create table reliability_events (
  id           bigserial primary key,
  subject_kind text not null check (subject_kind in ('PROVIDER', 'FREELANCER')),
  subject_id   uuid not null,
  kind         text not null check (kind in ('COMPLETED', 'CANCELLED', 'LATE_ARRIVAL', 'NO_SHOW', 'DISPUTE', 'SLOW_RESPONSE', 'REPEAT_BOOKING')),
  project_id   uuid references wedding_projects (id),
  weight       numeric(4,2) not null default 1,
  at           timestamptz not null default now()
);

create table verification_cases (
  id               uuid primary key default gen_random_uuid(),
  subject_kind     text not null check (subject_kind in ('PROVIDER', 'FREELANCER')),
  subject_id       uuid not null,
  status           verification_status not null default 'DOCUMENT_SUBMITTED',
  check_business   check_result not null default 'PENDING',
  check_identity   check_result not null default 'PENDING',
  check_phone      check_result not null default 'PENDING',
  check_bank       check_result not null default 'PENDING',
  check_portfolio  check_result not null default 'PENDING',
  reviewer_id      uuid references profiles (id),
  notes            text,
  expires_at       date,
  submitted_at     timestamptz not null default now(),
  decided_at       timestamptz
);

create table verification_documents (
  id        uuid primary key default gen_random_uuid(),
  case_id   uuid not null references verification_cases (id) on delete cascade,
  kind      text not null check (kind in ('PAN_VAT', 'COMPANY_REGISTRATION', 'CITIZENSHIP', 'PASSPORT', 'BANK_CHEQUE', 'PORTFOLIO', 'OTHER')),
  file_url  text not null,
  status    check_result not null default 'PENDING'
);

-- -----------------------------------------------------------------------------
-- Communication
-- -----------------------------------------------------------------------------

create table conversations (
  id               uuid primary key default gen_random_uuid(),
  kind             conversation_kind not null,
  project_id       uuid references wedding_projects (id) on delete cascade,
  booking_id       uuid references service_bookings (id) on delete cascade,
  gig_id           uuid references gigs (id) on delete cascade,
  title            text,
  created_at       timestamptz not null default now(),
  last_message_at  timestamptz
);

create table conversation_members (
  conversation_id  uuid references conversations (id) on delete cascade,
  user_id          uuid references profiles (id) on delete cascade,
  member_role      text not null,
  last_read_at     timestamptz,
  muted            boolean not null default false,
  archived         boolean not null default false,
  blocked          boolean not null default false,
  primary key (conversation_id, user_id)
);

create table messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references conversations (id) on delete cascade,
  sender_id        uuid references profiles (id),
  kind             message_kind not null default 'TEXT',
  body             text,
  payload          jsonb not null default '{}',          -- attachment / quote id / location / meeting
  created_at       timestamptz not null default now(),
  edited_at        timestamptz,
  deleted_at       timestamptz
);
create index messages_conversation on messages (conversation_id, created_at desc);

-- Staff-only notes. Deliberately a separate table so no customer query can reach it.
create table internal_notes (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references wedding_projects (id) on delete cascade,
  author_id   uuid not null references profiles (id),
  body        text not null,
  pinned      boolean not null default false,
  created_at  timestamptz not null default now()
);

create table files (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid references wedding_projects (id) on delete cascade,
  owner_id       uuid references profiles (id),
  folder         text,                                  -- '01-Contract', '05-Quotation', …
  name           text not null,
  mime           text,
  size_bytes     bigint,
  storage        file_storage not null,
  url            text,
  drive_file_id  text,
  visibility     visibility not null default 'CUSTOMER',
  created_at     timestamptz not null default now()
);

create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles (id) on delete cascade,
  kind        text not null,
  title       text not null,
  body        text,
  href        text,
  channels    text[] not null default '{PUSH}',
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user on notifications (user_id, created_at desc);

create table audit_logs (
  id          bigserial primary key,
  actor_id    uuid,
  action      text not null,
  entity      text not null,
  entity_id   uuid,
  before      jsonb,
  after       jsonb,
  at          timestamptz not null default now()
);

create or replace function audit_row() returns trigger language plpgsql security definer as $$
begin
  insert into audit_logs (actor_id, action, entity, entity_id, before, after)
  values (auth.uid(), tg_op, tg_table_name, coalesce(new.id, old.id),
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

create trigger audit_wedding_projects after insert or update or delete on wedding_projects for each row execute function audit_row();
create trigger audit_service_bookings after insert or update or delete on service_bookings for each row execute function audit_row();
create trigger audit_booking_assignments after insert or update or delete on booking_assignments for each row execute function audit_row();
create trigger audit_payments after insert or update or delete on payments for each row execute function audit_row();
create trigger audit_provider_payables after insert or update or delete on provider_payables for each row execute function audit_row();
create trigger audit_freelancer_payables after insert or update or delete on freelancer_payables for each row execute function audit_row();
create trigger audit_refunds after insert or update or delete on refunds for each row execute function audit_row();

-- -----------------------------------------------------------------------------
-- Couple planning tools
-- -----------------------------------------------------------------------------

create table guest_households (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references wedding_projects (id) on delete cascade,
  name        text not null,
  address     text
);

create table guests (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references wedding_projects (id) on delete cascade,
  household_id         uuid references guest_households (id) on delete set null,
  name                 text not null,
  side                 guest_side not null default 'BOTH',
  category             text,                             -- 'Family', 'Friends', 'Work', 'Neighbours'
  is_vip               boolean not null default false,
  phone                text,
  email                text,
  address              text,
  plus_ones_allowed    int not null default 0,
  children             int not null default 0,
  dietary              text[] not null default '{}',
  needs_accommodation  boolean not null default false,
  needs_transport      boolean not null default false,
  gift_note            text,
  notes                text,
  created_at           timestamptz not null default now()
);
create index guests_project on guests (project_id);

create table guest_invitations (
  guest_id          uuid references guests (id) on delete cascade,
  event_id          uuid references project_events (id) on delete cascade,
  rsvp              rsvp_status not null default 'PENDING',
  attending_count   int not null default 0,
  meal_choice       text,
  answers           jsonb not null default '{}',
  sent_at           timestamptz,
  delivered_at      timestamptz,
  opened_at         timestamptz,
  responded_at      timestamptz,
  checked_in_at     timestamptz,
  primary key (guest_id, event_id)
);

create table rsvp_questions (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references wedding_projects (id) on delete cascade,
  event_id    uuid references project_events (id) on delete cascade,
  question    text not null,
  kind        text not null check (kind in ('TEXT', 'CHOICE', 'YES_NO', 'SONG')),
  options     text[] not null default '{}',
  required    boolean not null default false,
  sort        int not null default 0
);

create table seating_layouts (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null unique references project_events (id) on delete cascade,
  width      int not null default 1000,
  height     int not null default 700
);

create table seating_elements (
  id         uuid primary key default gen_random_uuid(),
  layout_id  uuid not null references seating_layouts (id) on delete cascade,
  kind       seating_element_kind not null,
  label      text,
  capacity   int not null default 0,
  x          int not null,
  y          int not null,
  w          int not null default 80,
  h          int not null default 80,
  rotation   int not null default 0,
  is_vip     boolean not null default false
);

create table seat_assignments (
  element_id  uuid references seating_elements (id) on delete cascade,
  guest_id    uuid references guests (id) on delete cascade,
  seat_no     int,
  primary key (element_id, guest_id)
);

create table budget_items (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references wedding_projects (id) on delete cascade,
  event_id     uuid references project_events (id) on delete set null,
  category_id  text references service_categories (id),
  label        text not null,
  estimated    bigint not null default 0,
  actual       bigint,
  paid         bigint not null default 0,
  due_date     date,
  booking_id   uuid references service_bookings (id) on delete set null,
  notes        text
);

create table wedding_websites (
  project_id     uuid primary key references wedding_projects (id) on delete cascade,
  slug           text unique not null,
  template       text not null default 'classic',
  theme          jsonb not null default '{}',             -- colours, fonts
  content        jsonb not null default '{}',             -- story, schedule, travel, FAQ, dress code
  password_hash  text,
  is_published   boolean not null default false,
  is_indexed     boolean not null default false,
  custom_domain  text unique,
  updated_at     timestamptz not null default now()
);

create table invitation_designs (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references wedding_projects (id) on delete cascade,
  kind        text not null check (kind in ('SAVE_THE_DATE', 'INVITATION', 'RSVP_CARD', 'THANK_YOU')),
  template    text not null,
  event_ids   uuid[] not null default '{}',
  content     jsonb not null default '{}',
  is_digital  boolean not null default true,
  created_at  timestamptz not null default now()
);

create table registry_items (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references wedding_projects (id) on delete cascade,
  kind           registry_kind not null,
  title          text not null,
  url            text,
  image_url      text,
  price          bigint,
  target_amount  bigint,
  quantity       int not null default 1,
  sort           int not null default 0
);

create table registry_contributions (
  id                uuid primary key default gen_random_uuid(),
  item_id           uuid not null references registry_items (id) on delete cascade,
  contributor_name  text not null,
  guest_id          uuid references guests (id),
  amount            bigint,
  quantity          int,
  message           text,
  payment_id        uuid references payments (id),
  thanked_at        timestamptz,
  created_at        timestamptz not null default now()
);

create table shortlists (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references wedding_projects (id) on delete cascade,
  provider_id  uuid not null references providers (id) on delete cascade,
  status       text not null default 'SAVED' check (status in ('SAVED', 'CONTACTED', 'QUOTE_RECEIVED', 'NEGOTIATING', 'BOOKED', 'REJECTED')),
  notes        text,
  tags         text[] not null default '{}',
  added_by     uuid references profiles (id),
  created_at   timestamptz not null default now(),
  unique (project_id, provider_id)
);

create table inspiration_boards (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references wedding_projects (id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);

create table inspiration_items (
  board_id     uuid references inspiration_boards (id) on delete cascade,
  media_url    text not null,
  provider_id  uuid references providers (id),
  note         text,
  added_at     timestamptz not null default now(),
  primary key (board_id, media_url)
);

-- -----------------------------------------------------------------------------
-- Growth & monetisation
-- -----------------------------------------------------------------------------

create table deals (
  id              uuid primary key default gen_random_uuid(),
  provider_id     uuid references providers (id) on delete cascade,  -- null = platform campaign
  kind            deal_kind not null,
  title           text not null,
  description     text,
  discount_pct    numeric(5,2),
  discount_amount bigint,
  promo_code      text unique,
  max_redemptions int,
  redemptions     int not null default 0,
  starts_at       timestamptz not null default now(),
  ends_at         timestamptz,
  is_featured     boolean not null default false
);

create table provider_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations (id) on delete cascade,
  plan         text not null check (plan in ('FREE', 'PRO', 'PREMIUM_VERIFIED')),
  price        bigint not null default 0,
  starts_at    date not null,
  ends_at      date
);

create table featured_placements (
  id           uuid primary key default gen_random_uuid(),
  provider_id  uuid not null references providers (id) on delete cascade,
  slot         text not null check (slot in ('HOME', 'CATEGORY', 'SEARCH_BOOST', 'SPONSORED_RESULT')),
  category_id  text references service_categories (id),
  city_id      text references cities (id),
  starts_at    date not null,
  ends_at      date not null,
  price        bigint not null
);

create table provider_metrics_daily (
  provider_id     uuid references providers (id) on delete cascade,
  day             date not null,
  impressions     int not null default 0,
  profile_views   int not null default 0,
  saves           int not null default 0,
  contact_clicks  int not null default 0,
  phone_views     int not null default 0,
  leads           int not null default 0,
  quotes_sent     int not null default 0,
  bookings        int not null default 0,
  revenue         bigint not null default 0,
  primary key (provider_id, day)
);
