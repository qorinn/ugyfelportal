# Developer Link Hub CMS

Jelszóval védett tartalomkezelő a Paládi Bálint-féle Developer Link Hubhoz. Itt
szerkeszthető a publikus profil, a szekciók, a projektkártyák és a külső linkek;
a látogatóknak szánt Link Hub külön, statikusan publikált alkalmazás.

## Mire való?

A projekt egy könnyen karbantartható fejlesztői névjegy- és portfólióoldal
háttérrendszere. A CMS-ben lehet például:

- bemutatkozást, elérhetőséget és SEO-metaadatokat kitölteni;
- kiemelt, közösségi és további linkszekciókat létrehozni;
- munkákat és open source projekteket felvenni;
- a projektekhez és szekciókhoz linkeket rendelni;
- egy linket trackelhetővé tenni stabil redirect sluggál;
- a kész tartalomhoz publikus buildet indítani.

## Hogyan épül fel?

```text
CMS (ez a Next.js app)
  └─ service role-lal kezeli a Supabase-tartalmat
       └─ publikus Link Hub statikus buildje olvassa a published rekordokat
            └─ /go/{slug} szerveroldali átirányítás méri a kattintást
```

A CMS sosem kerül a publikus Link Hub helyére. A publikus alkalmazás csak
`published` tartalmat kap a Supabase-ből. A trackelt külső linkek megtartják a
cél URL-t, de a publikus oldalon a stabil `/go/{slug}` útvonalon keresztül
nyílnak meg; ez teszi lehetővé a kattintásmérést.

## Link Hub analitika

A belépés után a `/link-hub` adminoldal mutatja alapértelmezetten a Link Hub
30 napos analitikáját. Innen megnyitható a hozzá tartozó CMS (`/cms`), a 7, 30
és 90 napos időszak között pedig az oldalon lehet váltani. A kimutatás a
`analytics_events` rekordjaiból számolja az oldalmegtekintéseket, egyedi
sessionöket, kattintásokat, CTR-t, a linkek teljesítményét, UTM-forrásokat,
napi bontást és az utolsó eseményeket.

## Tartalommodell

| Elem | Szerepe |
| --- | --- |
| `site_profile` | Egyetlen profil és SEO-beállításai |
| `sections` | Link-, közösségi- vagy projektszekciók |
| `projects` | Portfólió- és open source projektkártyák |
| `links` | Szekcióhoz vagy projekthez tartozó kattintható elemek |
| `analytics_sessions`, `analytics_events` | Anonim oldalmegtekintési és kattintási események |

Egy trackelt linkhez kötelező az egyedi, stabil `redirect_slug`. A slugot ne
változtasd meg utólag, mert az analitikai folytonosság és a korábban megosztott
URL-ek ezen alapulnak.

## Helyi indítás

```bash
npm install
cp .env.example .env.local
npm run dev
```

Az admin bejelentkezéshez állítsd be a `DASHBOARD_PASSWORD` értékét a
`.env.local` fájlban, majd nyisd meg a `http://localhost:3000/cms` oldalt.

## Környezeti változók

| Változó | Mire kell? |
| --- | --- |
| `SUPABASE_URL` | A Supabase projekt URL-je |
| `SUPABASE_SERVICE_ROLE_KEY` | Kizárólag szerveroldali CMS-műveletekhez |
| `DASHBOARD_PASSWORD` | Az admin felület belépési jelszava |
| `INGEST_SECRET` | A meglévő analitikai ingest végpont hitelesítéséhez |
| `NETLIFY_BUILD_HOOK_URL` | A publikus Link Hub újraépítésének indításához |

> A `SUPABASE_SERVICE_ROLE_KEY`, a jelszavak és a build hook URL-je titok. Ne
> kerüljön `NEXT_PUBLIC_` változóba, commitba vagy a publikus Link Hubba.

## Üzembe helyezés

1. Futtasd a [`supabase/migrations/0003_link_hub_cms.sql`](supabase/migrations/0003_link_hub_cms.sql) migrációt a Supabase SQL Editorban vagy a projekt szokásos migrációs folyamatával.
2. Ha a Data API-ban az exposed sémák listája korlátozott, engedélyezd a `public` sémát. Az RLS csak a `published` tartalmat teszi olvashatóvá az `anon`/publishable kulcs számára.
3. Állítsd be a fenti környezeti változókat a CMS hosztolt környezetében.
4. A publikus Link Hubhoz add meg a titkos `NETLIFY_BUILD_HOOK_URL` értékét.

A CMS-ben végzett mentés nem indít automatikusan publikus deployt. A tartalom
szerkesztése és ellenőrzése után a „Publikálás és build” művelet indítja el az
új statikus buildet.

## Ellenőrzés

```bash
npm run lint
npm run typecheck
npm run build
```
