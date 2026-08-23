# Kalkulátor-analitika — minimál verzió

> Státusz: **terv.** A [ügyfélportál-terv](ugyfelportal-terv.md) első, lecsupaszított szelete.
> Készült: 2026-08-23

## Cél

Lássam, hányan indítják el a kalkulátort, hányan érnek a végére, hányan oldják fel az árat,
és hányan lépnek tovább. Egyetlen alkalmazás (`paladi-web`), auth nélkül, saját dashboarddal.

**Amit most NEM építünk:** auth, jogosultságok, több tenant, űrlap-modul, CMS, fájlkezelés.
A stack viszont már a végleges, és az adatmodellben benne van az `app_id`, hogy a portálra
váltás ne igényeljen migrációt.

## Stack

| Réteg | Most | Miért ez már a végleges |
|---|---|---|
| App | **Next.js** (App Router) | a portál is ez lesz |
| DB | **Supabase** (Postgres) | RLS és auth már bent van, amikor kell |
| Hosting | **Vercel** (alap `*.vercel.app` domain) | a paladi-web marad Netlify-on |
| Stílus | **Tailwind v4** | ugyanaz, mint a paladi-web-en |

**Csomagok, semmi több:** `next`, `react`, `react-dom`, `@supabase/supabase-js`,
`typescript`, `@types/node`, `@types/react`, `tailwindcss`, `@tailwindcss/postcss`.

Nincs auth-lib, nincs ORM, nincs chart-lib. A funnel sávjai CSS-sel készülnek — egy
diagramkönyvtár ehhez az öt számhoz korai lenne.

## Adatmodell

Egyetlen tábla. A séma azonos azzal, ami a portálban is lesz.

```sql
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

-- Zárt alapállapot: a service_role megkerüli, az anon kulcs semmit nem lát.
alter table events enable row level security;
```

**Fontos: RLS bekapcsolva, policy nélkül.** Így az anon kulccsal senki nem tud olvasni,
a szerveroldali `service_role` kulcs viszont igen. Ez a biztonságos alapértelmezés, és
később a portál policy-jei erre épülnek rá.

### Az azonosítókról

- **`session_id`** — `crypto.randomUUID()`, `sessionStorage`-ban. Ez köti össze a lépéseket.
- **`visitor_id` nincs.** A portál-terv adatvédelmi jegyzete szerint a tartós azonosító
  consent-köteles lehet, és a kérdéseim 95%-át a session is megválaszolja.

**Soha ne kerüljön személyes adat a `props`-ba** — se e-mail, se telefonszám, se a
pontosító szöveg. Azok az ajánlatkérő e-mailben vannak, itt csak `projectType` és `service`.

## Adatút — miért nem közvetlen a böngészőből

A böngésző **nem** hívja közvetlenül a Vercel-appot. Helyette:

```
böngésző → POST https://www.paladi-web.hu/api/track   (első fél, Netlify function)
                          ↓ szerver-szerver, titkos kulccsal
           POST https://<app>.vercel.app/api/event
```

A szerveroldali események (árfeloldás, visszahívás, pontosítás) a `quote-estimate.ts`-ből
mennek egyenesen a második lépésre.

Három oka van, hogy proxyzunk:

1. **Reklámblokkolók.** Egy ismeretlen `*.vercel.app` domainre menő, `/api/event` nevű
   cross-origin kérés pont az a minta, amit a blokkolók szűrnek. Az eredeti probléma is
   az volt, hogy a mérés nem látszott — kár lenne új blokkolható végpontot építeni.
2. **Nincs CORS.** Az egész kérdés eltűnik, mert nincs cross-origin hívás.
3. **Valódi titok.** Mivel a Vercel-végpontot csak szerver hívja, az `INGEST_SECRET`
   nem látszik a kliensben — szemben a portál-tervben szereplő publikus write-key-jel,
   ami valójában csak azonosít, nem véd.

## Fájlszerkezet — analitika app

Külön repó, a paladi-web mellett:

```
paladi-analytics/
  app/
    layout.tsx           # noindex meta
    page.tsx             # a dashboard (server component)
    api/event/route.ts   # ingest
  lib/
    supabase.ts          # service_role kliens
    funnel.ts            # a funnel definíciója — adat, nem kód
  middleware.ts          # jelszavas kapu (lásd lentebb)
```

### `lib/funnel.ts` — a funnel definíciója adatként

```ts
export const CALCULATOR_FUNNEL = [
  { name: "calculator_started",            label: "Elindította a kalkulátort" },
  { name: "calculator_questions_completed", label: "Végigért a kérdéseken" },
  { name: "calculator_email_submitted",     label: "Megadta az e-mailt" },
] as const;

// A záró lépés két, egymást kizáró kimenet — nem sorrend, hanem elágazás.
export const CALCULATOR_OUTCOMES = [
  { name: "calculator_callback_requested", label: "Visszahívást kért" },
  { name: "calculator_refine_requested",   label: "Pontosabb árat kért" },
] as const;
```

Új app vagy új funnel = egy tömb, nem új dashboard-kód.

### `app/api/event/route.ts` — vázlat

```ts
export async function POST(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.INGEST_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { appId, sessionId, name, props } = await request.json();

  // Whitelist: ismeretlen eseménynevet nem tárolunk, hogy ne szemetelődjön a tábla.
  if (!KNOWN_EVENTS.has(name)) {
    return new Response("Unknown event", { status: 400 });
  }

  await supabase.from("events").insert({
    app_id: appId, session_id: sessionId, name, props: props ?? {},
  });

  return new Response(null, { status: 204 });
}
```

### Dashboard — nyers események, aggregálás TS-ben

Ne SQL-ben aggregálj. Töltsd le az időszak nyers eseményeit, és számold a funnelt a
definícióból. Napi néhány tucat eseménynél ez bőven elég gyors, cserébe a funnel
megváltoztatása egy tömb átírása, nem migráció.

```ts
const { data } = await supabase
  .from("events")
  .select("session_id, name, props, created_at")
  .eq("app_id", "paladi-web")
  .gte("created_at", since.toISOString());

// lépésenként: new Set(events.filter(e => e.name === step.name).map(e => e.session_id)).size
```

**Mit mutasson:**

- a funnel öt sora, session-számmal és az előző lépéshez mért átmenet-százalékkal
- bontás `projectType` szerint (a `props`-ból)
- időszakválasztó: 7 / 30 / 90 nap
- az utolsó 50 nyers esemény táblázatban — indulásnál ez a leghasznosabb hibakereséshez

## Változtatások a paladi-web-en

1. **`src/lib/track.ts`** — `sessionId` a `sessionStorage`-ból, `navigator.sendBeacon`
   a `/api/track`-re, `fetch` fallbackkel. Hiba esetén némán elnyeli: a mérés soha
   ne akadályozza a felhasználót.
2. **`src/pages/api/track.ts`** — Netlify function, továbbít a Vercel-appnak.
3. **`QuoteEstimator.jsx`** — a `sessionId` bekerül a `quote-estimate` kérés törzsébe,
   és két kliensesemény indul:
   - `calculator_started` az első válaszkattintásnál
   - `calculator_questions_completed` a `reachedResultStepRef` ágban (már létezik)
4. **`quote-estimate.ts`** — a három szerveresemény a meglévő `intent` ágakból:
   `reveal` → `calculator_email_submitted`, `callback` → `calculator_callback_requested`,
   `refine` → `calculator_refine_requested`.

A meglévő `trackDecisionEvent` (GA4) maradhat mellette — a kettő nem zárja ki egymást.

## Környezeti változók

**Vercel (analitika app)**

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=     # csak szerveroldalon, soha NEXT_PUBLIC_ előtaggal
INGEST_SECRET=
DASHBOARD_PASSWORD=
```

**Netlify (paladi-web)**

```
ANALYTICS_INGEST_URL=https://<app>.vercel.app/api/event
ANALYTICS_INGEST_SECRET=       # ugyanaz, mint az INGEST_SECRET
```

## Hozzáférés — a Vercel URL nyilvános

Az alap `*.vercel.app` cím kitalálható és bárki megnyithatja. A `noindex` csak a
keresőket tartja távol, a hozzáférést nem korlátozza.

Most ez alacsony kockázat, mert csak aggregált számok vannak benne. **Amint bekerül
az űrlap-modul** — beérkezett e-mail-címekkel és telefonszámokkal — már személyes adat
lenne egy nyílt URL-en.

Ezért javaslom már most a legolcsóbb védelmet: egy `middleware.ts`, ami egyetlen
jelszót ellenőriz cookie-ból, és átirányít egy belépőmezőre, ha nincs meg. Körülbelül
húsz sor, nulla függőség, és később szó nélkül lecserélhető Supabase Authra.

`noindex` három helyen: `robots.txt`, `<meta name="robots">` a layoutban, és
`X-Robots-Tag` fejléc a `next.config.ts`-ben.

## Lépések sorrendben

1. Supabase projekt, `events` tábla, RLS bekapcsolva
2. Next.js app scaffold + Tailwind, `noindex`, jelszavas middleware
3. `/api/event` ingest végpont + eseménynév-whitelist
4. Dashboard oldal a funnellel
5. paladi-web: `track.ts`, `/api/track` proxy, `sessionId`, öt esemény bekötése
6. Vercel deploy, env változók, végponttól végpontig teszt

Az 1–4. az analitika appban van, az 5. a paladi-web-en. A kettő független, párhuzamosan
is mehet, csak az `INGEST_SECRET`-nek kell egyeznie.

## Adatvédelem

Az adatkezelési tájékoztatóba kell egy mondat: saját, első feles méréstről van szó,
a munkamenet-azonosító csak a böngésző munkamenetéig él, és nem kötjük személyhez.
Mivel nincs tartós azonosító és nem megy harmadik félhez, ez a jogos érdek alá esik —
de attól még szerepelnie kell a tájékoztatóban.
