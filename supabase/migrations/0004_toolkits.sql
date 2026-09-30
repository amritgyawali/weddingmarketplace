-- =============================================================================
-- Role toolkits (mirrors src/types/toolkit.ts and src/store/db/toolkit.ts).
--
-- Eighty small tools across the four apps share two generic tables instead of
-- eighty bespoke ones:
--   tool_entries   one record in a tool (a gift, an expense, a ticket…)
--   tool_state     per-owner settings for a tool (targets, templates, flags)
-- plus broadcasts, the ops team's role-wide announcements.
--
-- Ownership mirrors the app:
--   owner_kind 'project'  → the couple's wedding project (shared with collaborators)
--   owner_kind 'user'     → a vendor or freelancer account
--   owner_kind 'platform' → the whole operations team (owner_id is null)
-- NOT DEPLOYED. Never apply without the owner's say-so (AGENTS.md §1).
-- =============================================================================

create type tool_owner_kind as enum ('project', 'user', 'platform');

create table tool_entries (
  id          uuid primary key default gen_random_uuid(),
  owner_kind  tool_owner_kind not null,
  owner_id    uuid,
  tool        text not null check (tool ~ '^(couple|vendor|freelancer|platform)\.[a-z]+$'),
  title       text not null check (length(trim(title)) > 0),
  note        text,
  amount      bigint check (amount is null or amount >= 0),          -- whole NPR
  qty         integer check (qty is null or qty >= 0),
  entry_date  date,
  entry_time  time,
  status      text,
  grp         text,
  done        boolean not null default false,
  ref_id      uuid,                                                   -- linked project / booking / assignment / lead
  fields      jsonb not null default '{}'::jsonb,
  created_by  uuid references profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint tool_entries_owner check ((owner_kind = 'platform') = (owner_id is null))
);
create index tool_entries_owner_idx on tool_entries (owner_kind, owner_id, tool);
create index tool_entries_date_idx on tool_entries (tool, entry_date);
create trigger tool_entries_updated before update on tool_entries for each row execute function set_updated_at();

create table tool_state (
  owner_kind  tool_owner_kind not null,
  owner_id    uuid,
  tool        text not null,
  state       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  unique nulls not distinct (owner_kind, owner_id, tool)
);
create trigger tool_state_updated before update on tool_state for each row execute function set_updated_at();

create table broadcasts (
  id          uuid primary key default gen_random_uuid(),
  audience    text not null check (audience in ('all', 'customer', 'vendor', 'freelancer')),
  title       text not null,
  body        text not null,
  sent_by     uuid references profiles (id) on delete set null,
  recipients  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Who may touch an owner's tools ---------------------------------------------------
create or replace function can_use_tools(p_kind tool_owner_kind, p_owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case p_kind
    when 'platform' then is_platform_staff()
    when 'user'     then p_owner = auth.uid()
    when 'project'  then is_project_customer(p_owner)
  end
$$;

alter table tool_entries enable row level security;
alter table tool_state enable row level security;
alter table broadcasts enable row level security;

-- Couples' collaborators with VIEWER permission read but do not write.
create or replace function can_write_tools(p_kind tool_owner_kind, p_owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case p_kind
    when 'project' then exists (select 1 from wedding_projects where id = p_owner and customer_id = auth.uid())
                     or exists (select 1 from project_collaborators where project_id = p_owner and user_id = auth.uid()
                                and accepted_at is not null and permission <> 'VIEWER')
    else can_use_tools(p_kind, p_owner)
  end
$$;

create policy "tool entries: owner read" on tool_entries for select using (can_use_tools(owner_kind, owner_id));
create policy "tool entries: owner insert" on tool_entries for insert with check (can_write_tools(owner_kind, owner_id));
create policy "tool entries: owner update" on tool_entries for update using (can_write_tools(owner_kind, owner_id)) with check (can_write_tools(owner_kind, owner_id));
create policy "tool entries: owner delete" on tool_entries for delete using (can_write_tools(owner_kind, owner_id));

create policy "tool state: owner read" on tool_state for select using (can_use_tools(owner_kind, owner_id));
create policy "tool state: owner write" on tool_state for all using (can_write_tools(owner_kind, owner_id)) with check (can_write_tools(owner_kind, owner_id));

create policy "broadcasts: staff read" on broadcasts for select using (is_platform_staff());
create policy "broadcasts: staff send" on broadcasts for insert with check (is_platform_staff() and sent_by = auth.uid());

-- Sending a broadcast fans out one notification per active account in the audience.
create or replace function fan_out_broadcast() returns trigger
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into notifications (user_id, kind, title, body, href)
  select distinct p.id, 'system', new.title, new.body,
         case r.role when 'CUSTOMER' then '/notifications' when 'SERVICE_PROVIDER' then '/business' else '/freelancer' end
  from profiles p
  join user_roles r on r.user_id = p.id
  where (new.audience = 'all' and r.role in ('CUSTOMER', 'SERVICE_PROVIDER', 'FREELANCER'))
     or (new.audience = 'customer' and r.role = 'CUSTOMER')
     or (new.audience = 'vendor' and r.role = 'SERVICE_PROVIDER')
     or (new.audience = 'freelancer' and r.role = 'FREELANCER');
  get diagnostics n = row_count;
  update broadcasts set recipients = n where id = new.id;
  return new;
end $$;
create trigger broadcasts_fan_out after insert on broadcasts for each row execute function fan_out_broadcast();

-- Money-relevant tools are audited like the rest of the ledger.
-- (A WHEN clause may not mix NEW and OLD across operations, hence two triggers.)
create trigger tool_entries_audit_write after insert or update on tool_entries
  for each row when (new.tool ~ '^(platform\.|vendor\.(expenses|vouchers|referrals|goals)|freelancer\.invoices)')
  execute function audit_row();
create trigger tool_entries_audit_delete after delete on tool_entries
  for each row when (old.tool ~ '^(platform\.|vendor\.(expenses|vouchers|referrals|goals)|freelancer\.invoices)')
  execute function audit_row();
