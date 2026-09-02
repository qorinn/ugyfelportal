-- Developer Link Hub CMS: public tartalom és anonim analitika.
--
-- Az admin felület szerveroldali service role kulccsal ír. Az anon/publishable
-- kulcs kizárólag a közzétett tartalmat olvashatja, az analitika pedig zárt.
-- Ha a Supabase projektben a Data API "exposed schemas" listája szűkített,
-- vedd fel ebbe a listába a public sémát is.

create table if not exists site_profile (
  id uuid primary key,
  singleton boolean not null default true unique check (singleton),
  name text not null,
  position text,
  description text,
  avatar_path text,
  location text,
  availability_text text,
  footer_text text,
  meta_title text,
  meta_description text,
  og_image_path text,
  expand_label text,
  collapse_label text,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A profil valóban egyetlen site setting: egy második draft sem jöhet létre
-- véletlenül, és a publikus buildnek ezért nem lehet kétértelmű a profilja.

create table if not exists sections (
  id uuid primary key,
  key text not null unique,
  title text,
  description text,
  section_type text not null
    check (section_type in ('primary_links', 'social_links', 'links', 'projects')),
  sort_order integer not null default 0,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sections_published_sort_idx
  on sections (sort_order asc)
  where status = 'published';

create table if not exists projects (
  id uuid primary key,
  title text not null,
  slug text not null unique,
  short_description text,
  expanded_description text,
  image_path text,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists section_projects (
  section_id uuid not null references sections (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (section_id, project_id)
);

create index if not exists section_projects_project_idx
  on section_projects (project_id, sort_order asc);

create table if not exists links (
  id uuid primary key,
  section_id uuid references sections (id) on delete cascade,
  project_id uuid references projects (id) on delete cascade,
  label text not null,
  description text,
  icon text,
  target_url text not null,
  redirect_slug text,
  trackable boolean not null default false,
  open_in_new_tab boolean not null default true,
  style text check (style is null or style in ('default', 'primary', 'subtle')),
  sort_order integer not null default 0,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint links_exactly_one_parent
    check (num_nonnulls(section_id, project_id) = 1),
  constraint links_redirect_slug_format
    check (redirect_slug is null or redirect_slug ~ '^[A-Za-z0-9_-]+$'),
  constraint links_allowed_icon
    check (icon is null or icon in (
      'github', 'linkedin', 'instagram', 'mail', 'file-text', 'globe',
      'external-link', 'youtube'
    )),
  constraint links_trackable_has_slug
    check (not trackable or redirect_slug is not null)
);

create unique index if not exists links_redirect_slug_unique_idx
  on links (redirect_slug)
  where redirect_slug is not null;
create index if not exists links_section_published_sort_idx
  on links (section_id, sort_order asc)
  where status = 'published';
create index if not exists links_project_published_sort_idx
  on links (project_id, sort_order asc)
  where status = 'published';

-- A hosszú távú modell része; a jelenlegi Link Hub csak session_id-t ír az
-- eseménybe, külön session sort még nem hoz létre.
create table if not exists analytics_sessions (
  id uuid primary key,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists analytics_events (
  id bigint generated always as identity primary key,
  session_id uuid not null,
  event_type text not null check (event_type in ('page_view', 'link_click')),
  -- A történeti click eseményhez a link azonosítója kötelező, ezért linket
  -- csak az analitika törlése után lehet törölni (nem nullázzuk ki csendben).
  link_id uuid references links (id),
  pathname text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  created_at timestamptz not null default now(),
  constraint analytics_events_shape check (
    (event_type = 'page_view' and link_id is null and pathname is not null)
    or (event_type = 'link_click' and link_id is not null and pathname is null)
  )
);

create index if not exists analytics_events_session_created_idx
  on analytics_events (session_id, created_at desc);
create index if not exists analytics_events_link_created_idx
  on analytics_events (link_id, created_at desc)
  where link_id is not null;

alter table site_profile enable row level security;
alter table sections enable row level security;
alter table projects enable row level security;
alter table section_projects enable row level security;
alter table links enable row level security;
alter table analytics_sessions enable row level security;
alter table analytics_events enable row level security;

-- A publikus build a publishable kulccsal olvas. Az RLS teszi lehetővé, hogy
-- admin mező később se szivárogjon ki egy draft vagy archivált rekordból.
grant usage on schema public to anon, authenticated;
grant select on site_profile, sections, projects, section_projects, links
  to anon, authenticated;

create policy "published profile is publicly readable"
  on site_profile for select to anon, authenticated
  using (status = 'published');

create policy "published sections are publicly readable"
  on sections for select to anon, authenticated
  using (status = 'published');

create policy "published projects are publicly readable"
  on projects for select to anon, authenticated
  using (status = 'published');

create policy "published project relations are publicly readable"
  on section_projects for select to anon, authenticated
  using (
    exists (
      select 1 from sections
      where sections.id = section_projects.section_id
        and sections.status = 'published'
    )
    and exists (
      select 1 from projects
      where projects.id = section_projects.project_id
        and projects.status = 'published'
    )
  );

create policy "published reachable links are publicly readable"
  on links for select to anon, authenticated
  using (
    status = 'published'
    and (
      exists (
        select 1 from sections
        where sections.id = links.section_id
          and sections.status = 'published'
      )
      or exists (
        select 1
        from projects
        join section_projects on section_projects.project_id = projects.id
        join sections on sections.id = section_projects.section_id
        where projects.id = links.project_id
          and projects.status = 'published'
          and sections.status = 'published'
      )
    )
  );
