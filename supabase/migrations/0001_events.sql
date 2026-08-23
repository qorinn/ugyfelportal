-- Kalkulátor-analitika: egyetlen esemény-tábla.
-- Futtasd a Supabase SQL editorban. A séma azonos azzal, ami a portálban is lesz,
-- ezért van benne app_id már most.

create table events (
  id          bigint generated always as identity primary key,
  app_id      text        not null,
  session_id  uuid        not null,
  name        text        not null,
  props       jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index events_app_created_idx on events (app_id, created_at desc);
create index events_app_name_created_idx on events (app_id, name, created_at desc);
create index events_session_idx on events (session_id);

-- Zárt alapállapot: a service_role megkerüli az RLS-t, az anon kulcs semmit nem lát.
-- Szándékosan nincs policy — a portál policy-jei később erre épülnek rá.
alter table events enable row level security;
