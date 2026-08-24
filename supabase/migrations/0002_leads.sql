-- Leadek follow-uphoz. Szándékosan külön tábla, NEM az events.props-ban:
--   * az események append-only naplók, a lead viszont változik (státusz, telefon)
--   * egy GDPR-törlésnél egy sort kell törölni, nem események tucatjait
--   * az events tábla így személyes adat nélkül marad
--
-- A session_id az elsődleges kulcs: egy munkamenet = egy lead = egy follow-up,
-- akkor is, ha valaki előbb feloldotta az árat, majd pontosítást is kért.

create table if not exists leads (
	session_id      uuid        primary key,
	app_id          text        not null,
	email           text        not null,
	name            text,
	phone           text,
	project_type    text,
	service         text,
	estimate_low    text,
	estimate_high   text,
	duration_label  text,
	project_brief   text,
	status          text        not null default 'revealed',
	followed_up_at  timestamptz,
	created_at      timestamptz not null default now(),
	updated_at      timestamptz not null default now()
);

create index if not exists leads_app_created_idx
	on leads (app_id, created_at desc);
create index if not exists leads_followup_idx
	on leads (app_id, followed_up_at, created_at desc);

alter table leads enable row level security;
