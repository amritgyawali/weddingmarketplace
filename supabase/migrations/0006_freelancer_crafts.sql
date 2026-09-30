-- =============================================================================
-- Freelancer crafts (P2; mirrors src/data/crafts.ts and the freelancer part of
-- src/services/experience.ts and src/store/db/{personas,gigs}.ts).
--
--   crew roles (freelancer_skills.skill) → craft → profile, rate, equipment
--
-- Crafts are read-only reference data. A freelancer's craft profile answers
-- live in freelancers.craft_profile. Applying for a gig needs the gig's crew
-- role in the freelancer's skills, unless the poster invited them.
-- NOT DEPLOYED. Never apply without the owner's say-so (AGENTS.md §1).
-- =============================================================================

create table crafts (
  id         text primary key check (id ~ '^[a-z_]+$'),
  label      text not null,
  rate       text not null check (rate in ('day', 'event', 'package')),
  equipment  text[] not null default '{}',
  sort       int not null default 0
);

create table craft_skills (
  craft_id  text not null references crafts (id) on delete cascade,
  skill     text primary key            -- a crew role belongs to exactly one craft
);

alter table crafts enable row level security;
alter table craft_skills enable row level security;
create policy "crafts: read" on crafts for select to authenticated using (true);
create policy "craft skills: read" on craft_skills for select to authenticated using (true);

alter table freelancers add column craft_profile jsonb not null default '{}';

-- Strict gig feed, enforced: no application for a role the freelancer doesn't
-- offer, unless invited. Runs as definer so the check can read skills under RLS.
create or replace function check_gig_application_skill() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.invited then
    return new;
  end if;
  if not exists (
    select 1 from gigs g join freelancer_skills fs on fs.skill = g.role
    where g.id = new.gig_id and fs.freelancer_id = new.freelancer_id
  ) then
    raise exception 'gig role is not one of the freelancer''s skills' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger gig_application_skill
  before insert on gig_applications
  for each row execute function check_gig_application_skill();

-- Seed -------------------------------------------------------------------------

insert into crafts (id, label, rate, equipment, sort) values
  ('photo', 'Photo and film', 'day', '{camera,lens,flash,drone,gimbal,light,audio}', 1),
  ('editor', 'Editing', 'package', '{kit,other}', 2),
  ('beauty', 'Makeup and mehendi', 'event', '{kit}', 3),
  ('music', 'Music and hosting', 'event', '{audio,light,other}', 4),
  ('decor', 'Decor and floral', 'day', '{kit,vehicle}', 5),
  ('food', 'Kitchen and service', 'day', '{}', 6),
  ('driver', 'Driving', 'day', '{vehicle}', 7),
  ('technician', 'Sound, light and AV', 'day', '{audio,light,other}', 8),
  ('rituals', 'Rituals', 'event', '{}', 9),
  ('crew', 'Event crew', 'day', '{}', 10);

insert into craft_skills (craft_id, skill) values
  ('photo', 'Photographer'), ('photo', 'Videographer'), ('photo', 'Assistant Photographer'), ('photo', 'Drone Operator'), ('photo', 'Booth Attendant'),
  ('editor', 'Editor'),
  ('beauty', 'Makeup Artist'), ('beauty', 'Hair Stylist'), ('beauty', 'Mehendi Artist'),
  ('music', 'DJ'), ('music', 'Musician'), ('music', 'MC'), ('music', 'Choreographer'),
  ('decor', 'Decorator'), ('decor', 'Florist'), ('decor', 'Decor Staff'), ('decor', 'Rigging Crew'),
  ('food', 'Chef'), ('food', 'Server'), ('food', 'Bartender'),
  ('driver', 'Driver'),
  ('technician', 'Sound Engineer'), ('technician', 'Lighting Technician'), ('technician', 'AV Technician'), ('technician', 'Streaming Technician'), ('technician', 'Technician'),
  ('rituals', 'Assistant Purohit'),
  ('crew', 'Coordinator'), ('crew', 'Event Staff');
