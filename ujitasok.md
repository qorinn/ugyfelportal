Az `ugyfelportal` repóban dolgozunk (Next.js + Supabase + Vercel, shadcn komponensekkel).
Ez egy jelszóval védett belső dashboard, ami a `paladi-web.hu` kalkulátorát méri.

A `paladi-web` oldal **már kész és deployolva van** — az ő HTTP-hívásait kell
kiszolgálni. A szerződés fix, ne változtass rajta.

## Ami már működik ebben a repóban

- `events` tábla, `/api/event` végpont Bearer `INGEST_SECRET` hitelesítéssel
- öt kalkulátor-esemény: `calculator_started`, `calculator_questions_completed`,
  `calculator_email_submitted`, `calculator_callback_requested`,
  `calculator_refine_requested`
- jelszavas middleware, login/logout, funnel dashboard

## 1. feladat — időzóna-hiba javítása

Az `app/page.tsx`-ben a `dateTimeFormat` nem ad meg időzónát. A Supabase UTC-ben
tárol, a Vercel szerverei UTC-ben futnak, ezért nyáron két órával korábbi időpont
jelenik meg. Add hozzá:

```ts
const dateTimeFormat = new Intl.DateTimeFormat("hu-HU", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: "Europe/Budapest",
})
```

## 2. feladat — levélmérés

Két új eseménynevet kell elfogadni: `email_opened` és `email_link_clicked`.

A levél fajtáját **nem** külön eseménynév hordozza, hanem a `props.emailType`
(`"quote"` vagy `"refined_quote"`). Így új levéltípushoz nem kell új eseménynév.

Beérkező payloadok:

```json
{ "appId": "paladi-web", "sessionId": "<uuid>", "name": "email_opened",
  "props": { "prefetched": false, "emailType": "quote" } }

{ "appId": "paladi-web", "sessionId": "<uuid>", "name": "email_link_clicked",
  "props": { "target": "phone", "emailType": "quote" } }
```

- `target` értéke `"phone"` vagy `"website"`
- `prefetched: true` azt jelenti, hogy a levelező proxyja töltötte elő a képet
  (Apple Mail adatvédelmi funkciója), tehát **nem valódi megnyitás**
- az `/api/event` utasítsa el 400-zal az `email_` kezdetű eseményt, ha az
  `emailType` hiányzik vagy ismeretlen

A dashboardon a megnyitásoknál külön mutasd a valódi és az előtöltött számot —
egy számban keverve félrevezető lenne. A kattintás viszont megbízható jelzés.

## 3. feladat — `leads` tábla és `/api/lead` végpont

Futtasd le a `0002_leads.sql` migrációt (külön kapod).

Új `POST /api/lead` végpont, ugyanazzal a Bearer `INGEST_SECRET` hitelesítéssel,
mint az `/api/event`. Ezt a payloadot kapja:

```json
{
  "appId": "paladi-web",
  "sessionId": "<uuid>",
  "email": "teszt@pelda.hu",
  "name": "Teszt Elek",
  "phone": "+36301234567",
  "projectType": "business",
  "service": "ar-kalkulator-website",
  "estimateLow": "280 000 Ft",
  "estimateHigh": "480 000 Ft",
  "durationLabel": "1–2 hét",
  "projectBrief": "",
  "status": "callback_requested"
}
```

Upsert `session_id`-re. **Két szabály, amit könnyű elrontani:**

1. **Az állapot csak erősödhet.** Sorrend: `revealed` < `refine_requested` <
   `callback_requested`. Ha a meglévő sor erősebb állapotban van, mint ami
   érkezik, tartsd meg a meglévőt. Enélkül egy később érkező gyengébb kérés
   visszaminősítené a leadet.
2. **Üres mező ne írjon felül meglévőt.** A telefon és a `projectBrief` csak
   később érkezik — ha a beérkező érték üres, tartsd meg a régit.

## 4. feladat — middleware

Az `/api/lead` szerver-szerver hívás Bearer tokennel, **nem** jelszavas cookie-val.
Ki kell venni a jelszókapu alól, különben a middleware a login oldalra terelné, és
a lead mentés csendben elhasalna.

Vigyázz: ha lesz `/api/lead-followup` végpont (dashboard-művelet), az **maradjon
védve**. A `/api/lead` kizárása ne fogja ki azt is — használj pontos illesztést.

## 5. feladat — `/leadek` oldal

Lead-lista follow-uphoz, két csoportban: *utánkövetésre vár* (`followed_up_at`
null) és *elintézve*.

Leadenként: név, e-mail, telefon, projekttípus, ársáv, a `project_brief` szövege,
az állapot, és a levél-aktivitás — megnyitotta-e, rákattintott-e a telefonszámra.
A telefonszámra kattintás a legerősebb vételi jelzés, azt emeld ki.

Legyen egy gomb, ami beállítja a `followed_up_at`-ot, és **vissza is vonható** —
egy téves kattintás különben végleg elrejtené a leadet a teendők közül.

## Adatvédelmi megkötés — fontos

Eddig ebben az adatbázisban **nem volt személyes adat**. Mostantól lesz: e-mail,
név, telefonszám.

A látogatónak azt ígértük az űrlapon és a levélben, hogy *"az e-mail címedet
kizárólag ehhez az árajánlathoz használom, marketinglevelet nem küldök, más
ügyben nem kereslek meg"*. Egy utánkövetés erről a konkrét ajánlatról ezzel
összefér, egy hírlevél nem. Jelenítsd meg ezt a korlátot a `/leadek` oldalon is.

Ezért is fontos, hogy a `service_role` kulcs soha ne kerüljön kliensoldali kódba,
és hogy a `leads` táblán is be legyen kapcsolva az RLS.

## Amit a paladi-web oldal már csinál

Nem kell hozzányúlni, csak hogy értsd a képet:

- a `sessionId` a böngésző `sessionStorage`-ában él, és minden hívásban utazik —
  ez köti össze a kalkulátort, a leadet és a levélmérést
- a kliensesemények a `paladi-web.hu/api/track` proxyn mennek át (első fél, nem
  blokkolható), onnan szerver-szerver az `/api/event`-re
- a szerveresemények és a lead közvetlenül mennek, a böngésző kihagyásával
- a lead URL-jét a `paladi-web` úgy állítja elő, hogy az `ANALYTICS_INGEST_URL`
  végén az `/api/event`-et `/api/lead`-re cseréli — tehát **a két végpontnak
  ugyanazon a hoston kell lennie**
- a levél mérőlinkjei a `paladi-web.hu/api/email/open` és `/api/email/click`
  címekre mutatnak, `?s=<sessionId>&e=<emailType>` paraméterekkel

Előbb mondd el, hogyan állnál neki, és kérdezz rá, amit el kell dönteni.
