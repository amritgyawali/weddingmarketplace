-- =============================================================================
-- Customer occasions (P3), part 2 (mirrors src/data/occasions.ts and the
-- occasion flow in src/store/db/projects.ts).
--
-- A customer can hold several celebrations; each project records its occasion
-- and who it honours (0005). The built-in newborn occasion offers the nwaran
-- as well as the pasni. Marketplace filtering reads occasions.services, and the
-- planner's module gating reads occasions.modules through project_has_module().
-- NOT DEPLOYED. Never apply without the owner's say-so (AGENTS.md §1).
-- =============================================================================

update occasions
set event_types = array['PASNI', 'NWARAN', 'RELIGIOUS_CEREMONY']::event_type[], updated_at = now()
where id = 'newborn' and built_in and not ('NWARAN' = any (event_types));

-- Marketplace: the service categories shown for a project's occasion. Runs as the
-- caller, so RLS on wedding_projects decides whose projects can be asked about.
create or replace function occasion_services(p_project uuid) returns setof text
language sql stable security invoker set search_path = public as $$
  select unnest(coalesce(o.services, (select array_agg(id) from service_categories)))
  from wedding_projects p left join occasions o on o.id = coalesce(p.occasion, 'wedding')
  where p.id = p_project
$$;
