-- =============================================================================
-- Social hub, part 2: a business connects Facebook, Instagram, WhatsApp and
-- TikTok, answers every message and comment from one inbox, and publishes one
-- post to every network. Mirrors src/types/social.ts and src/store/db/social.ts.
--
--   social_accounts          the connected page / profile / number / account
--   social_account_secrets   access tokens; RLS on with no policies, so only
--                            the service role (Edge Functions) can read them
--   social_threads           one conversation (DM, or one person's comments
--                            on one post) in the unified inbox
--   social_messages          customer messages, replies and internal notes
--   social_posts             one post for several networks, draft → scheduled
--                            → publishing → published / partial / failed
--   social_post_targets      how each network took the post, with its numbers
--   social_settings          saved replies, keyword auto-replies, away message
--   social_contacts          WhatsApp customers who agreed to broadcasts
--
-- Edge Functions: social-oauth (connect), social-webhook (networks deliver
-- messages, comments and receipts), social-send (replies), social-publish
-- (posts, and the scheduled run below). They call the vivah_social_* helpers
-- here with the service role; the app calls the rpc_social_* functions and
-- reads the tables under RLS.
-- NOT DEPLOYED. Never apply without the owner's say-so (AGENTS.md §1).
-- =============================================================================

-- Who may use a business's social hub ----------------------------------------------

-- Every member of the business reads and answers the inbox and writes posts.
create or replace function can_use_social(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_org_member(p_org)
$$;

-- Owners and managers connect and remove networks and change the automation.
create or replace function can_manage_social(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from organization_members where org_id = p_org and user_id = auth.uid() and member_role in ('OWNER', 'MANAGER'))
$$;

-- "Facebook", "Instagram", "WhatsApp", "TikTok".
create or replace function social_network_label(p_network text) returns text
language sql immutable as $$
  select case p_network when 'whatsapp' then 'WhatsApp' when 'tiktok' then 'TikTok' else initcap(p_network) end
$$;

-- Tables ---------------------------------------------------------------------------

create table social_accounts (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations (id) on delete cascade,
  network       text not null check (network in ('facebook', 'instagram', 'whatsapp', 'tiktok')),
  -- Page id, Instagram user id, WhatsApp phone number id or TikTok open_id.
  external_id   text not null check (length(external_id) between 1 and 120),
  handle        text not null check (length(trim(handle)) between 1 and 120),
  name          text not null check (length(trim(name)) between 1 and 160),
  status        text not null default 'connected' check (status in ('connected', 'expired', 'disconnected')),
  followers     integer not null default 0 check (followers >= 0),
  scopes        text[] not null default '{}',
  connected_by  uuid references profiles (id) on delete set null,
  connected_at  timestamptz not null default now(),
  expires_at    timestamptz,
  last_sync_at  timestamptz
);
-- One live connection per network per business, and a network account belongs to one business.
create unique index social_accounts_one_live on social_accounts (org_id, network) where status <> 'disconnected';
create unique index social_accounts_external on social_accounts (network, external_id) where status <> 'disconnected';

create table social_account_secrets (
  account_id        uuid primary key references social_accounts (id) on delete cascade,
  access_token      text not null,
  refresh_token     text,
  token_expires_at  timestamptz,
  -- Page access token, WhatsApp business account id, and other per-network ids.
  meta              jsonb not null default '{}',
  updated_at        timestamptz not null default now()
);
create trigger social_account_secrets_updated before update on social_account_secrets for each row execute function set_updated_at();

create table social_posts (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations (id) on delete cascade,
  caption        text not null default '' check (length(caption) <= 63206),
  overrides      jsonb not null default '{}',
  media          jsonb not null default '[]' check (jsonb_typeof(media) = 'array' and jsonb_array_length(media) <= 35),
  networks       text[] not null check (cardinality(networks) between 1 and 4 and networks <@ array['facebook', 'instagram', 'whatsapp', 'tiktok']),
  link           text check (link is null or link ~ '^https?://'),
  first_comment  text check (first_comment is null or length(first_comment) <= 2200),
  campaign       text check (campaign is null or length(campaign) <= 80),
  status         text not null default 'draft' check (status in ('draft', 'scheduled', 'publishing', 'published', 'partial', 'failed')),
  scheduled_at   timestamptz,
  published_at   timestamptz,
  created_by     uuid references profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (status <> 'scheduled' or scheduled_at is not null)
);
create trigger social_posts_updated before update on social_posts for each row execute function set_updated_at();
create index social_posts_due on social_posts (scheduled_at) where status = 'scheduled';
create index social_posts_org on social_posts (org_id, created_at desc);

create table social_post_targets (
  post_id       uuid not null references social_posts (id) on delete cascade,
  network       text not null check (network in ('facebook', 'instagram', 'whatsapp', 'tiktok')),
  account_id    uuid references social_accounts (id) on delete set null,
  status        text not null default 'queued' check (status in ('queued', 'publishing', 'published', 'failed')),
  external_id   text,
  url           text,
  error         text,
  reach         integer check (reach is null or reach >= 0),
  likes         integer check (likes is null or likes >= 0),
  comments      integer check (comments is null or comments >= 0),
  shares        integer check (shares is null or shares >= 0),
  saves         integer check (saves is null or saves >= 0),
  published_at  timestamptz,
  updated_at    timestamptz not null default now(),
  primary key (post_id, network)
);
create trigger social_post_targets_updated before update on social_post_targets for each row execute function set_updated_at();

create table social_threads (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references organizations (id) on delete cascade,
  account_id           uuid not null references social_accounts (id) on delete cascade,
  network              text not null check (network in ('facebook', 'instagram', 'whatsapp', 'tiktok')),
  kind                 text not null check (kind in ('message', 'comment')),
  -- PSID / IGSID / wa_id / TikTok user of the customer.
  contact_external_id  text not null,
  contact_name         text not null,
  contact_handle       text,
  contact_phone        text check (contact_phone is null or contact_phone ~ '^[0-9+ ]{7,16}$'),
  -- For comments: the network's post id (and ours when we published it).
  post_external_id     text,
  post_id              uuid references social_posts (id) on delete set null,
  post_caption         text,
  -- For comments: the comment to reply under.
  comment_external_id  text,
  status               text not null default 'open' check (status in ('open', 'pending', 'done')),
  snoozed_until        timestamptz,
  starred              boolean not null default false,
  labels               text[] not null default '{}' check (cardinality(labels) <= 8),
  assignee_id          uuid references profiles (id) on delete set null,
  lead_id              uuid references leads (id) on delete set null,
  unread               integer not null default 0 check (unread >= 0),
  last_at              timestamptz not null default now(),
  last_inbound_at      timestamptz,
  first_response_mins  integer,
  created_at           timestamptz not null default now()
);
create unique index social_threads_contact on social_threads (account_id, kind, contact_external_id, (coalesce(post_external_id, '')));
create index social_threads_inbox on social_threads (org_id, status, last_at desc);

create table social_messages (
  id           uuid primary key default gen_random_uuid(),
  thread_id    uuid not null references social_threads (id) on delete cascade,
  org_id       uuid not null references organizations (id) on delete cascade,
  direction    text not null check (direction in ('in', 'out', 'note')),
  body         text not null check (length(body) <= 4096),
  media        jsonb not null default '[]',
  status       text check (status is null or status in ('sending', 'sent', 'delivered', 'read', 'failed')),
  -- The network's message or comment id (deduplicates webhook retries).
  external_id  text unique,
  auto         boolean not null default false,
  template     text,
  error        text,
  author_id    uuid references profiles (id) on delete set null,
  author_name  text,
  created_at   timestamptz not null default now()
);
create index social_messages_thread on social_messages (thread_id, created_at);

create table social_settings (
  org_id         uuid primary key references organizations (id) on delete cascade,
  saved_replies  jsonb not null default '[]' check (jsonb_typeof(saved_replies) = 'array' and jsonb_array_length(saved_replies) <= 50),
  rules          jsonb not null default '[]' check (jsonb_typeof(rules) = 'array' and jsonb_array_length(rules) <= 30),
  away           jsonb not null default '{"active": false, "from": "21:00", "to": "08:00", "text": ""}',
  signature      text check (signature is null or length(signature) <= 120),
  updated_at     timestamptz not null default now()
);
create trigger social_settings_updated before update on social_settings for each row execute function set_updated_at();

create table social_contacts (
  org_id        uuid not null references organizations (id) on delete cascade,
  network       text not null default 'whatsapp' check (network in ('facebook', 'instagram', 'whatsapp', 'tiktok')),
  external_id   text not null,
  name          text,
  opted_in_at   timestamptz,
  opted_out_at  timestamptz,
  primary key (org_id, network, external_id)
);

-- Row-level security -----------------------------------------------------------------

alter table social_accounts enable row level security;
alter table social_account_secrets enable row level security;
alter table social_posts enable row level security;
alter table social_post_targets enable row level security;
alter table social_threads enable row level security;
alter table social_messages enable row level security;
alter table social_settings enable row level security;
alter table social_contacts enable row level security;

create or replace function social_post_org(p_post uuid) returns uuid
language sql stable security definer set search_path = public as $$ select org_id from social_posts where id = p_post $$;

-- Accounts: members read; connecting and removing go through social-oauth and rpc_social_disconnect.
create policy "social accounts: members read" on social_accounts for select using (can_use_social(org_id) or is_platform_staff());
-- Secrets: no policies on purpose. Only the service role reads tokens.

-- Posts: members write drafts and schedules; only the publisher marks them published.
create policy "social posts: members read" on social_posts for select using (can_use_social(org_id));
create policy "social posts: members add drafts" on social_posts for insert with check (can_use_social(org_id) and status = 'draft' and created_by = auth.uid());
create policy "social posts: members edit unpublished" on social_posts for update using (can_use_social(org_id) and status in ('draft', 'scheduled', 'failed')) with check (can_use_social(org_id) and status in ('draft', 'scheduled'));
create policy "social posts: members delete" on social_posts for delete using (can_use_social(org_id) and status <> 'publishing');
create policy "social post targets: members read" on social_post_targets for select using (can_use_social(social_post_org(post_id)));

-- Inbox: members read and triage; messages arrive through the webhook and replies through social-send.
create policy "social threads: members read" on social_threads for select using (can_use_social(org_id));
create policy "social threads: members triage" on social_threads for update using (can_use_social(org_id)) with check (can_use_social(org_id));
create policy "social messages: members read" on social_messages for select using (can_use_social(org_id));
create policy "social messages: members add notes" on social_messages for insert with check (direction = 'note' and can_use_social(org_id) and author_id = auth.uid() and org_id = (select t.org_id from social_threads t where t.id = thread_id));

-- Settings: members read; owners and managers change them.
create policy "social settings: members read" on social_settings for select using (can_use_social(org_id));
create policy "social settings: managers insert" on social_settings for insert with check (can_manage_social(org_id));
create policy "social settings: managers update" on social_settings for update using (can_manage_social(org_id)) with check (can_manage_social(org_id));

create policy "social contacts: members read" on social_contacts for select using (can_use_social(org_id));

-- Column grants: the inbox can only change triage fields; accounts, targets and contacts are written by the server.
revoke update on social_threads from authenticated;
grant update (status, snoozed_until, starred, labels, assignee_id, unread) on social_threads to authenticated;
revoke insert, update, delete on social_accounts, social_post_targets, social_contacts from authenticated;
revoke all on social_account_secrets from anon, authenticated;
revoke all on social_accounts, social_posts, social_post_targets, social_threads, social_messages, social_settings, social_contacts from anon;

-- App-facing RPCs ----------------------------------------------------------------------

-- Disconnect a network: the account stays (its messages keep their thread), the token is deleted.
create or replace function rpc_social_disconnect(p_account uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  org uuid;
begin
  select org_id into org from social_accounts where id = p_account;
  if org is null then perform vivah_fail('Account not found', 'no_data_found'); end if;
  if not can_manage_social(org) then perform vivah_fail('Only an owner or manager can disconnect a network', 'insufficient_privilege'); end if;
  update social_accounts set status = 'disconnected', expires_at = null where id = p_account;
  delete from social_account_secrets where account_id = p_account;
  perform vivah_audit('social.disconnect', 'social_account', p_account, null);
end;
$$;

-- Schedule a draft: every chosen network must be connected, and the time in the future.
create or replace function rpc_social_schedule(p_post uuid, p_at timestamptz) returns void
language plpgsql security definer set search_path = public as $$
declare
  p social_posts%rowtype;
  missing text;
begin
  select * into p from social_posts where id = p_post for update;
  if p.id is null or not can_use_social(p.org_id) then perform vivah_fail('Post not found', 'no_data_found'); end if;
  if p.status not in ('draft', 'scheduled', 'failed') then perform vivah_fail('Only drafts can be scheduled'); end if;
  if p_at is null or p_at < now() then perform vivah_fail('Pick a time in the future'); end if;
  select string_agg(n, ', ') into missing from unnest(p.networks) n
  where not exists (select 1 from social_accounts a where a.org_id = p.org_id and a.network = n and a.status = 'connected');
  if missing is not null then perform vivah_fail('Connect these first: ' || missing); end if;
  update social_posts set status = 'scheduled', scheduled_at = p_at where id = p_post;
  delete from social_post_targets where post_id = p_post;
  insert into social_post_targets (post_id, network, account_id, status)
  select p_post, n, (select a.id from social_accounts a where a.org_id = p.org_id and a.network = n and a.status = 'connected'), 'queued' from unnest(p.networks) n;
  perform vivah_audit('social.schedule', 'social_post', p_post, jsonb_build_object('at', p_at, 'networks', p.networks));
end;
$$;

-- Turn a conversation into a CRM lead for the business's listing.
create or replace function rpc_social_lead(p_thread uuid, p_event_date date, p_guests integer, p_functions text[], p_budget bigint default null, p_phone text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  th social_threads%rowtype;
  provider uuid;
  lid uuid;
  last_text text;
begin
  select * into th from social_threads where id = p_thread for update;
  if th.id is null or not can_use_social(th.org_id) then perform vivah_fail('Conversation not found', 'no_data_found'); end if;
  if th.lead_id is not null then perform vivah_fail('This conversation is already a lead'); end if;
  if p_event_date is null then perform vivah_fail('Pick the event date'); end if;
  if coalesce(cardinality(p_functions), 0) = 0 then perform vivah_fail('Pick at least one function'); end if;
  select id into provider from providers where org_id = th.org_id limit 1;
  if provider is null then perform vivah_fail('Set up your listing first'); end if;
  select body into last_text from social_messages where thread_id = p_thread and direction = 'in' order by created_at desc limit 1;
  insert into leads (provider_id, source, status, value_estimate, labels, payload)
  values (provider, 'SOCIAL', 'NEW', nullif(greatest(coalesce(p_budget, 0), 0), 0), array[social_network_label(th.network)],
          jsonb_build_object('customerName', th.contact_name, 'phone', coalesce(p_phone, th.contact_phone), 'eventDate', p_event_date,
                             'guests', nullif(greatest(coalesce(p_guests, 0), 0), 0), 'functions', to_jsonb(p_functions), 'message', last_text,
                             'socialThreadId', th.id, 'network', th.network, 'handle', th.contact_handle))
  returning id into lid;
  update social_threads set lead_id = lid, labels = (select array_agg(distinct l) from unnest(labels || array['Hot lead']) l) where id = p_thread;
  perform vivah_audit('social.lead', 'lead', lid, jsonb_build_object('thread', p_thread, 'network', th.network));
  return lid;
end;
$$;

-- The caller's business (an owner's first, else the first they joined).
create or replace function social_my_org() returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from organization_members where user_id = auth.uid() order by (member_role = 'OWNER') desc, joined_at limit 1
$$;

-- Everything the hub shows, for the app's on-device mirror: accounts, the last 90 days of the inbox,
-- posts with each network's result, and the settings.
create or replace function rpc_social_inbox() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  org uuid := social_my_org();
begin
  if org is null then perform vivah_fail('Only a business can use the social hub', 'insufficient_privilege'); end if;
  return jsonb_build_object(
    'accounts', coalesce((select jsonb_agg(to_jsonb(a) order by a.network) from social_accounts a where a.org_id = org), '[]'),
    'threads', coalesce((select jsonb_agg(to_jsonb(t) order by t.last_at desc) from social_threads t where t.org_id = org and t.last_at > now() - interval '90 days'), '[]'),
    'messages', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from social_messages m join social_threads t on t.id = m.thread_id
                          where m.org_id = org and t.last_at > now() - interval '90 days'), '[]'),
    'posts', coalesce((select jsonb_agg(to_jsonb(p) || jsonb_build_object('targets', coalesce((select jsonb_agg(to_jsonb(x)) from social_post_targets x where x.post_id = p.id), '[]')) order by p.created_at desc)
                       from social_posts p where p.org_id = org), '[]'),
    'settings', (select to_jsonb(s) from social_settings s where s.org_id = org));
end;
$$;

-- Create or update a draft from the composer. Returns the post id.
create or replace function rpc_social_save_post(p_post jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  org uuid := social_my_org();
  pid uuid;
  cur text;
begin
  if org is null then perform vivah_fail('Only a business can use the social hub', 'insufficient_privilege'); end if;
  if (p_post->>'id') ~ '^[0-9a-f-]{36}$' then
    select id, status into pid, cur from social_posts where id = (p_post->>'id')::uuid and org_id = org for update;
  end if;
  if pid is not null and cur not in ('draft', 'scheduled', 'failed') then perform vivah_fail('A published post can’t be edited. Duplicate it instead.'); end if;
  if pid is null then
    insert into social_posts (org_id, caption, overrides, media, networks, link, first_comment, campaign, created_by)
    values (org, coalesce(p_post->>'caption', ''), coalesce(p_post->'overrides', '{}'), coalesce(p_post->'media', '[]'),
            array(select jsonb_array_elements_text(p_post->'networks')), nullif(p_post->>'link', ''), nullif(p_post->>'firstComment', ''), nullif(p_post->>'campaign', ''), auth.uid())
    returning id into pid;
  else
    update social_posts set caption = coalesce(p_post->>'caption', ''), overrides = coalesce(p_post->'overrides', '{}'), media = coalesce(p_post->'media', '[]'),
      networks = array(select jsonb_array_elements_text(p_post->'networks')), link = nullif(p_post->>'link', ''), first_comment = nullif(p_post->>'firstComment', ''),
      campaign = nullif(p_post->>'campaign', ''), status = 'draft', scheduled_at = null
    where id = pid;
    delete from social_post_targets where post_id = pid;
  end if;
  return pid;
end;
$$;

-- Inbox triage: status (with snooze), star, labels, read.
create or replace function rpc_social_triage(p_thread uuid, p_patch jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  org uuid;
begin
  select org_id into org from social_threads where id = p_thread;
  if org is null or not can_use_social(org) then perform vivah_fail('Conversation not found', 'no_data_found'); end if;
  update social_threads set
    status = coalesce(p_patch->>'status', status),
    snoozed_until = case when p_patch ? 'snoozedUntil' then nullif(p_patch->>'snoozedUntil', '')::timestamptz else snoozed_until end,
    starred = coalesce((p_patch->>'starred')::boolean, starred),
    labels = case when p_patch ? 'labels' then array(select jsonb_array_elements_text(p_patch->'labels')) else labels end,
    unread = case when coalesce((p_patch->>'read')::boolean, false) then 0 else unread end
  where id = p_thread;
end;
$$;

-- An internal note in a thread.
create or replace function rpc_social_note(p_thread uuid, p_text text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  org uuid;
  mid uuid;
begin
  select org_id into org from social_threads where id = p_thread;
  if org is null or not can_use_social(org) then perform vivah_fail('Conversation not found', 'no_data_found'); end if;
  if coalesce(trim(p_text), '') = '' then perform vivah_fail('Write the note first'); end if;
  insert into social_messages (thread_id, org_id, direction, body, author_id, author_name)
  values (p_thread, org, 'note', left(trim(p_text), 4096), auth.uid(), (select full_name from profiles where id = auth.uid()))
  returning id into mid;
  return mid;
end;
$$;

-- Saved replies, auto-replies, away message and signature (owners and managers).
create or replace function rpc_social_save_settings(p_settings jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  org uuid := social_my_org();
begin
  if org is null or not can_manage_social(org) then perform vivah_fail('Only an owner or manager can change the automation', 'insufficient_privilege'); end if;
  insert into social_settings (org_id, saved_replies, rules, away, signature)
  values (org, coalesce(p_settings->'savedReplies', '[]'), coalesce(p_settings->'rules', '[]'),
          coalesce(p_settings->'away', '{"active": false, "from": "21:00", "to": "08:00", "text": ""}'), nullif(p_settings->>'signature', ''))
  on conflict (org_id) do update set saved_replies = excluded.saved_replies, rules = excluded.rules, away = excluded.away, signature = excluded.signature;
  perform vivah_audit('social.settings', 'organization', org, null);
end;
$$;

-- Service-only helpers (Edge Functions, service role) ---------------------------------

-- social-oauth: save a connection after the network's consent. The caller must own or manage a business.
create or replace function vivah_social_save_account(p_user uuid, p_network text, p_external_id text, p_handle text, p_name text, p_followers integer,
  p_scopes text[], p_token text, p_refresh text default null, p_token_expires timestamptz default null, p_meta jsonb default '{}') returns uuid
language plpgsql security definer set search_path = public as $$
declare
  org uuid;
  aid uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then perform vivah_fail('Only the social service can do this', 'insufficient_privilege'); end if;
  select org_id into org from organization_members where user_id = p_user and member_role in ('OWNER', 'MANAGER') limit 1;
  if org is null then perform vivah_fail('Only a business owner or manager can connect a network', 'insufficient_privilege'); end if;
  if exists (select 1 from social_accounts where network = p_network and external_id = p_external_id and status <> 'disconnected' and org_id <> org) then
    perform vivah_fail('This account is already connected to another business');
  end if;
  select id into aid from social_accounts where org_id = org and network = p_network order by (status <> 'disconnected') desc, connected_at desc limit 1;
  if aid is null then
    insert into social_accounts (org_id, network, external_id, handle, name, followers, scopes, connected_by, expires_at, last_sync_at)
    values (org, p_network, p_external_id, p_handle, p_name, greatest(coalesce(p_followers, 0), 0), coalesce(p_scopes, '{}'), p_user, p_token_expires, now())
    returning id into aid;
  else
    update social_accounts set external_id = p_external_id, handle = p_handle, name = p_name, followers = greatest(coalesce(p_followers, 0), 0),
      scopes = coalesce(p_scopes, '{}'), status = 'connected', connected_by = p_user, connected_at = now(), expires_at = p_token_expires, last_sync_at = now()
    where id = aid;
  end if;
  insert into social_account_secrets (account_id, access_token, refresh_token, token_expires_at, meta)
  values (aid, p_token, p_refresh, p_token_expires, coalesce(p_meta, '{}'))
  on conflict (account_id) do update set access_token = excluded.access_token, refresh_token = excluded.refresh_token,
    token_expires_at = excluded.token_expires_at, meta = excluded.meta;
  insert into audit_logs (actor_id, action, entity, entity_id, after) values (p_user, 'social.connect', 'social_account', aid, jsonb_build_object('network', p_network, 'handle', p_handle));
  return aid;
end;
$$;

-- social-webhook: messages, comments and delivery receipts, already normalised. Retries are ignored by the
-- network's message id. Returns how many new messages were stored.
create or replace function vivah_social_ingest(p_events jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare
  e jsonb;
  acc social_accounts%rowtype;
  tid uuid;
  mid uuid;
  stored integer := 0;
  rank_of constant jsonb := '{"sending": 0, "sent": 1, "delivered": 2, "read": 3, "failed": 4}';
begin
  if coalesce(auth.role(), '') <> 'service_role' then perform vivah_fail('Only the social service can do this', 'insufficient_privilege'); end if;
  for e in select * from jsonb_array_elements(coalesce(p_events, '[]')) loop
    if e->>'type' = 'status' then
      update social_messages set status = e->>'status'
      where external_id = e->>'id' and direction = 'out'
        and coalesce((rank_of->>coalesce(status, 'sending'))::int, 0) < coalesce((rank_of->>(e->>'status'))::int, 0);
      continue;
    end if;
    if e->>'type' not in ('message', 'comment') or coalesce(trim(e->>'text'), '') = '' then continue; end if;
    select * into acc from social_accounts where network = e->>'network' and external_id = e->>'account' and status <> 'disconnected';
    if acc.id is null then continue; end if;

    insert into social_threads (org_id, account_id, network, kind, contact_external_id, contact_name, contact_handle, contact_phone,
                                post_external_id, post_id, post_caption, comment_external_id, last_at, last_inbound_at)
    values (acc.org_id, acc.id, acc.network, e->>'type', e->>'contact', coalesce(nullif(e->>'contactName', ''), e->>'contact'), e->>'contactHandle',
            nullif(e->>'contactPhone', ''), e->>'postId',
            (select t.post_id from social_post_targets t where t.network = acc.network and t.external_id = e->>'postId' limit 1),
            left(e->>'postCaption', 200), e->>'commentId', coalesce((e->>'at')::timestamptz, now()), coalesce((e->>'at')::timestamptz, now()))
    on conflict (account_id, kind, contact_external_id, (coalesce(post_external_id, ''))) do update
      set comment_external_id = coalesce(excluded.comment_external_id, social_threads.comment_external_id)
    returning id into tid;

    insert into social_messages (thread_id, org_id, direction, body, media, external_id, author_name, created_at)
    values (tid, acc.org_id, 'in', left(e->>'text', 4096), coalesce(e->'media', '[]'), e->>'id', e->>'contactName', coalesce((e->>'at')::timestamptz, now()))
    on conflict (external_id) do nothing
    returning id into mid;
    if mid is null then continue; end if;
    stored := stored + 1;

    update social_threads set unread = unread + 1, status = 'open', snoozed_until = null,
      last_at = greatest(last_at, coalesce((e->>'at')::timestamptz, now())), last_inbound_at = coalesce((e->>'at')::timestamptz, now())
    where id = tid;
    perform vivah_notify(m.user_id, 'message', social_network_label(acc.network) || ': ' || coalesce(nullif(e->>'contactName', ''), 'New message'), left(e->>'text', 140), '/business/social/thread/' || tid)
    from organization_members m
    where m.org_id = acc.org_id and (m.member_role in ('OWNER', 'MANAGER') or m.user_id = (select assignee_id from social_threads where id = tid));
  end loop;
  return stored;
end;
$$;

-- social-send: what a reply needs (account, token, the customer's id, the reply window). Refuses non-members.
create or replace function vivah_social_send_context(p_user uuid, p_thread uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'threadId', t.id, 'orgId', t.org_id, 'network', t.network, 'kind', t.kind, 'accountId', a.id, 'accountStatus', a.status,
    'accountExternalId', a.external_id, 'contact', t.contact_external_id, 'contactName', t.contact_name, 'commentId', t.comment_external_id, 'postId', t.post_external_id,
    'lastInboundAt', t.last_inbound_at, 'token', s.access_token, 'meta', s.meta)
  from social_threads t
  join social_accounts a on a.id = t.account_id
  left join social_account_secrets s on s.account_id = a.id
  where t.id = p_thread and exists (select 1 from organization_members m where m.org_id = t.org_id and m.user_id = p_user)
$$;

-- social-send: record a reply the network accepted (or refused).
create or replace function vivah_social_record_out(p_user uuid, p_thread uuid, p_text text, p_external_id text, p_template text default null, p_status text default 'sent', p_error text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  th social_threads%rowtype;
  mid uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then perform vivah_fail('Only the social service can do this', 'insufficient_privilege'); end if;
  select * into th from social_threads where id = p_thread for update;
  if th.id is null then perform vivah_fail('Conversation not found', 'no_data_found'); end if;
  insert into social_messages (thread_id, org_id, direction, body, status, external_id, template, error, author_id, author_name)
  values (p_thread, th.org_id, 'out', left(p_text, 4096), p_status, p_external_id, p_template, p_error, p_user, (select full_name from profiles where id = p_user))
  returning id into mid;
  if p_status <> 'failed' then
    update social_threads set unread = 0, status = 'pending', last_at = now(),
      first_response_mins = coalesce(first_response_mins, greatest(1, (extract(epoch from now() - last_inbound_at) / 60)::int))
    where id = p_thread;
  end if;
  return mid;
end;
$$;

-- social-publish: a post with each network's account and token. With p_user, refuses non-members.
create or replace function vivah_social_publish_context(p_post uuid, p_user uuid default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'post', to_jsonb(p) - 'created_by',
    'targets', coalesce((
      select jsonb_agg(jsonb_build_object('network', n, 'accountId', a.id, 'accountStatus', a.status, 'accountExternalId', a.external_id, 'handle', a.handle,
                                          'token', s.access_token, 'refreshToken', s.refresh_token, 'meta', s.meta, 'targetStatus', x.status))
      from unnest(p.networks) n
      left join social_accounts a on a.org_id = p.org_id and a.network = n and a.status <> 'disconnected'
      left join social_account_secrets s on s.account_id = a.id
      left join social_post_targets x on x.post_id = p.id and x.network = n), '[]'))
  from social_posts p
  where p.id = p_post and (p_user is null or exists (select 1 from organization_members m where m.org_id = p.org_id and m.user_id = p_user))
$$;

-- social-publish: mark a post and the networks still to do as publishing (networks already published are kept).
create or replace function vivah_social_begin(p_post uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then perform vivah_fail('Only the social service can do this', 'insufficient_privilege'); end if;
  insert into social_post_targets (post_id, network, account_id, status)
  select p.id, n, (select a.id from social_accounts a where a.org_id = p.org_id and a.network = n and a.status <> 'disconnected' limit 1), 'publishing'
  from social_posts p, unnest(p.networks) n where p.id = p_post
  on conflict (post_id, network) do update set status = 'publishing', error = null where social_post_targets.status <> 'published';
  update social_posts set status = 'publishing' where id = p_post;
end;
$$;

-- social-publish: the WhatsApp customers of a business who agreed to broadcasts.
create or replace function vivah_social_broadcast_list(p_org uuid) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(external_id order by opted_in_at), '{}') from social_contacts
  where org_id = p_org and network = 'whatsapp' and opted_in_at is not null and (opted_out_at is null or opted_out_at < opted_in_at)
$$;

-- social-publish: keep a refreshed access token (TikTok's last a day).
create or replace function vivah_social_update_token(p_account uuid, p_token text, p_meta jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then perform vivah_fail('Only the social service can do this', 'insufficient_privilege'); end if;
  update social_account_secrets set access_token = p_token, meta = meta || coalesce(p_meta, '{}') where account_id = p_account;
end;
$$;

-- social-publish: one network's outcome. The post's status follows its targets.
create or replace function vivah_social_target_result(p_post uuid, p_network text, p_status text, p_external_id text default null, p_url text default null, p_error text default null) returns text
language plpgsql security definer set search_path = public as $$
declare
  total integer;
  done integer;
  busy integer;
  next_status text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then perform vivah_fail('Only the social service can do this', 'insufficient_privilege'); end if;
  insert into social_post_targets (post_id, network, status, external_id, url, error, published_at)
  values (p_post, p_network, p_status, p_external_id, p_url, p_error, case when p_status = 'published' then now() end)
  on conflict (post_id, network) do update set status = excluded.status, external_id = coalesce(excluded.external_id, social_post_targets.external_id),
    url = coalesce(excluded.url, social_post_targets.url), error = excluded.error, published_at = coalesce(social_post_targets.published_at, excluded.published_at);
  select count(*), count(*) filter (where status = 'published'), count(*) filter (where status in ('queued', 'publishing'))
    into total, done, busy from social_post_targets where post_id = p_post;
  next_status := case when busy > 0 then 'publishing' when done = total then 'published' when done > 0 then 'partial' else 'failed' end;
  update social_posts set status = next_status, published_at = case when done > 0 then coalesce(published_at, now()) else published_at end where id = p_post;
  return next_status;
end;
$$;

-- social-webhook: TikTok says how a post it was pulling went (by its publish id).
create or replace function vivah_social_publish_update(p_network text, p_external_id text, p_status text, p_url text default null, p_error text default null) returns text
language plpgsql security definer set search_path = public as $$
declare
  pid uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then perform vivah_fail('Only the social service can do this', 'insufficient_privilege'); end if;
  select post_id into pid from social_post_targets where network = p_network and external_id = p_external_id;
  if pid is null then return null; end if;
  return vivah_social_target_result(pid, p_network, p_status, p_external_id, p_url, p_error);
end;
$$;

-- social-publish (scheduled run): claim the posts that are due, wake snoozed threads and mark expired tokens.
create or replace function vivah_social_claim_due(p_limit integer default 20) returns uuid[]
language plpgsql security definer set search_path = public as $$
declare
  ids uuid[];
begin
  if coalesce(auth.role(), '') <> 'service_role' then perform vivah_fail('Only the social service can do this', 'insufficient_privilege'); end if;
  update social_threads set status = 'open', snoozed_until = null where snoozed_until is not null and snoozed_until <= now();
  update social_accounts set status = 'expired' where status = 'connected' and expires_at is not null and expires_at < now();
  with due as (
    select id from social_posts where status = 'scheduled' and scheduled_at <= now() order by scheduled_at limit greatest(p_limit, 1) for update skip locked
  ), claimed as (
    update social_posts p set status = 'publishing' from due where p.id = due.id returning p.id
  )
  select array_agg(id) into ids from claimed;
  update social_post_targets set status = 'publishing' where post_id = any (coalesce(ids, '{}')) and status = 'queued';
  return coalesce(ids, '{}');
end;
$$;

-- pg_cron: every five minutes, ask social-publish to run the due posts (when pg_net and the Vault secrets exist).
create or replace function job_social_due() returns void
language plpgsql security definer set search_path = public as $$
declare
  url text;
  secret text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_net') or to_regclass('vault.decrypted_secrets') is null then return; end if;
  if not exists (select 1 from social_posts where status = 'scheduled' and scheduled_at <= now()) then return; end if;
  execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'functions_url'$q$ into url;
  execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'notify_webhook_secret'$q$ into secret;
  if url is null or secret is null then return; end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3)'
    using url || '/social-publish', jsonb_build_object('due', true), jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', secret);
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('vivah-social-due', '*/5 * * * *', 'select job_social_due()');
  end if;
end;
$$;

-- Grants ---------------------------------------------------------------------------------

revoke execute on function
  rpc_social_disconnect(uuid), rpc_social_schedule(uuid, timestamptz), rpc_social_lead(uuid, date, integer, text[], bigint, text),
  rpc_social_inbox(), rpc_social_save_post(jsonb), rpc_social_triage(uuid, jsonb), rpc_social_note(uuid, text), rpc_social_save_settings(jsonb),
  vivah_social_save_account(uuid, text, text, text, text, integer, text[], text, text, timestamptz, jsonb),
  vivah_social_ingest(jsonb), vivah_social_send_context(uuid, uuid), vivah_social_record_out(uuid, uuid, text, text, text, text, text),
  vivah_social_publish_context(uuid, uuid), vivah_social_target_result(uuid, text, text, text, text, text),
  vivah_social_publish_update(text, text, text, text, text), vivah_social_claim_due(integer), job_social_due(),
  vivah_social_begin(uuid), vivah_social_broadcast_list(uuid), vivah_social_update_token(uuid, text, jsonb)
  from public, anon;
revoke execute on function
  vivah_social_save_account(uuid, text, text, text, text, integer, text[], text, text, timestamptz, jsonb),
  vivah_social_ingest(jsonb), vivah_social_send_context(uuid, uuid), vivah_social_record_out(uuid, uuid, text, text, text, text, text),
  vivah_social_publish_context(uuid, uuid), vivah_social_target_result(uuid, text, text, text, text, text),
  vivah_social_publish_update(text, text, text, text, text), vivah_social_claim_due(integer), job_social_due(),
  vivah_social_begin(uuid), vivah_social_broadcast_list(uuid), vivah_social_update_token(uuid, text, jsonb)
  from authenticated;
grant execute on function
  rpc_social_disconnect(uuid), rpc_social_schedule(uuid, timestamptz), rpc_social_lead(uuid, date, integer, text[], bigint, text),
  rpc_social_inbox(), rpc_social_save_post(jsonb), rpc_social_triage(uuid, jsonb), rpc_social_note(uuid, text), rpc_social_save_settings(jsonb)
  to authenticated;
grant execute on function
  vivah_social_save_account(uuid, text, text, text, text, integer, text[], text, text, timestamptz, jsonb),
  vivah_social_ingest(jsonb), vivah_social_send_context(uuid, uuid), vivah_social_record_out(uuid, uuid, text, text, text, text, text),
  vivah_social_publish_context(uuid, uuid), vivah_social_target_result(uuid, text, text, text, text, text),
  vivah_social_publish_update(text, text, text, text, text), vivah_social_claim_due(integer),
  vivah_social_begin(uuid), vivah_social_broadcast_list(uuid), vivah_social_update_token(uuid, text, jsonb)
  to service_role;
