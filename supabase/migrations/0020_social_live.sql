-- =============================================================================
-- Social hub, part 3: what the live networks need beyond 0018.
--
--   assignee_name     who on the team handles a conversation (team members
--                     are names in the business app, not always profiles)
--   WhatsApp consent  a customer who writes START / SUBSCRIBE (or सुरु) joins
--                     the broadcast list, STOP / UNSUBSCRIBE (or बन्द) leaves
--                     it; members can also record consent given another way
--                     (rpc_social_optin). The WhatsApp account's audience is
--                     the number of customers who agreed. Same words as
--                     optInKeyword() in src/services/social.ts.
--   insights          social-publish reads reach, likes, comments, shares and
--                     saves back from the networks every six hours for posts
--                     published in the last 30 days (job_social_metrics).
-- NOT DEPLOYED. Never apply without the owner's say-so (AGENTS.md §1).
-- =============================================================================

-- Assignment --------------------------------------------------------------------------

alter table social_threads add column assignee_name text check (assignee_name is null or length(trim(assignee_name)) between 1 and 80);
grant update (assignee_name) on social_threads to authenticated;

-- Inbox triage now also assigns.
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
    unread = case when coalesce((p_patch->>'read')::boolean, false) then 0 else unread end,
    assignee_name = case when p_patch ? 'assignee' then nullif(trim(p_patch->>'assignee'), '') else assignee_name end
  where id = p_thread;
end;
$$;

-- WhatsApp broadcast consent ------------------------------------------------------------

-- 'in', 'out' or null for an incoming message's text.
create or replace function social_optin_keyword(p_text text) returns text
language sql immutable as $$
  select case regexp_replace(lower(trim(coalesce(p_text, ''))), '[.!।]+$', '')
    when 'start' then 'in' when 'subscribe' then 'in' when 'सुरु' then 'in' when 'yes updates' then 'in'
    when 'stop' then 'out' when 'unsubscribe' then 'out' when 'बन्द' then 'out' when 'no more' then 'out'
  end
$$;

-- Records one customer's consent (or its withdrawal).
create or replace function social_set_consent(p_org uuid, p_contact text, p_name text, p_on boolean) returns void
language sql security definer set search_path = public as $$
  insert into social_contacts (org_id, network, external_id, name, opted_in_at, opted_out_at)
  values (p_org, 'whatsapp', p_contact, p_name, case when p_on then now() end, case when not p_on then now() end)
  on conflict (org_id, network, external_id) do update set
    name = coalesce(excluded.name, social_contacts.name),
    opted_in_at = case when p_on then now() else social_contacts.opted_in_at end,
    opted_out_at = case when p_on then null else now() end
$$;

-- An incoming WhatsApp message that says START or STOP.
create or replace function vivah_social_consent_keywords() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  th social_threads%rowtype;
  word text := social_optin_keyword(new.body);
begin
  if new.direction <> 'in' or word is null then return new; end if;
  select * into th from social_threads where id = new.thread_id;
  if th.network <> 'whatsapp' or th.kind <> 'message' then return new; end if;
  perform social_set_consent(th.org_id, th.contact_external_id, th.contact_name, word = 'in');
  return new;
end;
$$;
create trigger social_messages_consent after insert on social_messages for each row execute function vivah_social_consent_keywords();

-- The WhatsApp audience is the number of customers who agreed.
create or replace function vivah_social_count_audience() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  org uuid := coalesce(new.org_id, old.org_id);
begin
  update social_accounts a set followers = (
    select count(*) from social_contacts c
    where c.org_id = org and c.network = 'whatsapp' and c.opted_in_at is not null and c.opted_out_at is null)
  where a.org_id = org and a.network = 'whatsapp' and a.status <> 'disconnected';
  return null;
end;
$$;
create trigger social_contacts_audience after insert or update or delete on social_contacts for each row execute function vivah_social_count_audience();

-- A member records consent the customer gave another way (in person, on a form).
create or replace function rpc_social_optin(p_thread uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  th social_threads%rowtype;
begin
  select * into th from social_threads where id = p_thread;
  if th.id is null or not can_use_social(th.org_id) then perform vivah_fail('Conversation not found', 'no_data_found'); end if;
  if th.network <> 'whatsapp' then perform vivah_fail('Broadcast consent is for WhatsApp customers'); end if;
  perform social_set_consent(th.org_id, th.contact_external_id, th.contact_name, coalesce(p_on, false));
  perform vivah_audit(case when p_on then 'social.optin' else 'social.optout' end, 'social_thread', p_thread, null);
end;
$$;

-- The hub for the app now says who handles each thread and who agreed to updates.
create or replace function rpc_social_inbox() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  org uuid := social_my_org();
begin
  if org is null then perform vivah_fail('Only a business can use the social hub', 'insufficient_privilege'); end if;
  return jsonb_build_object(
    'accounts', coalesce((select jsonb_agg(to_jsonb(a) order by a.network) from social_accounts a where a.org_id = org), '[]'),
    'threads', coalesce((select jsonb_agg(to_jsonb(t) || jsonb_build_object('opted_in', exists (
                           select 1 from social_contacts c where c.org_id = t.org_id and c.network = 'whatsapp' and c.external_id = t.contact_external_id
                             and c.opted_in_at is not null and c.opted_out_at is null)) order by t.last_at desc)
                         from social_threads t where t.org_id = org and t.last_at > now() - interval '90 days'), '[]'),
    'messages', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from social_messages m join social_threads t on t.id = m.thread_id
                          where m.org_id = org and t.last_at > now() - interval '90 days'), '[]'),
    'posts', coalesce((select jsonb_agg(to_jsonb(p) || jsonb_build_object('targets', coalesce((select jsonb_agg(to_jsonb(x)) from social_post_targets x where x.post_id = p.id), '[]')) order by p.created_at desc)
                       from social_posts p where p.org_id = org), '[]'),
    'settings', (select to_jsonb(s) from social_settings s where s.org_id = org));
end;
$$;

-- Insights from the networks -------------------------------------------------------------

-- social-publish: published targets of the last 30 days whose numbers are older than five hours, with tokens.
create or replace function vivah_social_metric_targets(p_limit integer default 50) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then perform vivah_fail('Only the social service can do this', 'insufficient_privilege'); end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('postId', x.post_id, 'network', x.network, 'externalId', x.external_id, 'token', s.access_token,
                                        'refreshToken', s.refresh_token, 'accountId', a.id, 'meta', s.meta))
    from (
      select x.* from social_post_targets x
      where x.status = 'published' and x.external_id is not null and x.network in ('facebook', 'instagram', 'tiktok')
        and x.published_at > now() - interval '30 days' and x.updated_at < now() - interval '5 hours'
      order by x.updated_at limit greatest(p_limit, 1)
    ) x
    join social_posts p on p.id = x.post_id
    join social_accounts a on a.org_id = p.org_id and a.network = x.network and a.status = 'connected'
    join social_account_secrets s on s.account_id = a.id), '[]');
end;
$$;

-- social-publish: the numbers a network reported for one post.
create or replace function vivah_social_record_metrics(p_post uuid, p_network text, p_reach integer, p_likes integer, p_comments integer, p_shares integer, p_saves integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then perform vivah_fail('Only the social service can do this', 'insufficient_privilege'); end if;
  update social_post_targets set
    -- A number the network didn't report keeps the last one (greatest() alone would turn null into 0).
    reach = case when p_reach is null then reach else greatest(p_reach, 0) end,
    likes = case when p_likes is null then likes else greatest(p_likes, 0) end,
    comments = case when p_comments is null then comments else greatest(p_comments, 0) end,
    shares = case when p_shares is null then shares else greatest(p_shares, 0) end,
    saves = case when p_saves is null then saves else greatest(p_saves, 0) end
  where post_id = p_post and network = p_network;
end;
$$;

-- pg_cron: every six hours ask social-publish to read the numbers back (when pg_net and the Vault secrets exist).
create or replace function job_social_metrics() returns void
language plpgsql security definer set search_path = public as $$
declare
  url text;
  secret text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_net') or to_regclass('vault.decrypted_secrets') is null then return; end if;
  execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'functions_url'$q$ into url;
  execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'notify_webhook_secret'$q$ into secret;
  if url is null or secret is null then return; end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3)'
    using url || '/social-publish', jsonb_build_object('metrics', true), jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', secret);
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('vivah-social-metrics', '15 */6 * * *', 'select job_social_metrics()');
  end if;
end;
$$;

-- Grants ---------------------------------------------------------------------------------

revoke execute on function
  rpc_social_optin(uuid, boolean), social_set_consent(uuid, text, text, boolean), vivah_social_consent_keywords(), vivah_social_count_audience(),
  vivah_social_metric_targets(integer), vivah_social_record_metrics(uuid, text, integer, integer, integer, integer, integer), job_social_metrics()
  from public, anon;
revoke execute on function
  social_set_consent(uuid, text, text, boolean), vivah_social_consent_keywords(), vivah_social_count_audience(),
  vivah_social_metric_targets(integer), vivah_social_record_metrics(uuid, text, integer, integer, integer, integer, integer), job_social_metrics()
  from authenticated;
grant execute on function rpc_social_optin(uuid, boolean) to authenticated;
grant execute on function vivah_social_metric_targets(integer), vivah_social_record_metrics(uuid, text, integer, integer, integer, integer, integer) to service_role;
