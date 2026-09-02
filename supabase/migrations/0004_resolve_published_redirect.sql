-- A publikus Link Hub redirect Function egyetlen RPC-hívással oldja fel a
-- ténylegesen elérhető célt. A Function service_role kulccsal hívja ezt;
-- anon vagy authenticated kliens nem kérheti le a redirect célokat.
create or replace function public.resolve_published_redirect(p_slug text)
returns table (link_id uuid, target_url text)
language sql
stable
security invoker
set search_path = ''
as $$
  select l.id as link_id, l.target_url
  from public.links as l
  where l.redirect_slug = p_slug
    and l.status = 'published'
    and (
      (
        l.section_id is not null
        and exists (
          select 1
          from public.sections as s
          where s.id = l.section_id
            and s.status = 'published'
        )
      )
      or (
        l.project_id is not null
        and exists (
          select 1
          from public.projects as p
          where p.id = l.project_id
            and p.status = 'published'
        )
        and exists (
          select 1
          from public.section_projects as sp
          join public.sections as s on s.id = sp.section_id
          where sp.project_id = l.project_id
            and s.status = 'published'
        )
      )
    )
  limit 1;
$$;

revoke all on function public.resolve_published_redirect(text)
  from public, anon, authenticated;
grant execute on function public.resolve_published_redirect(text) to service_role;
