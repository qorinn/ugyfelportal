# Ügyfélportál — architektúra terv

> Státusz: **terv, nincs megvalósítva.** Későbbi projekt, külön repóban.
> Készült: 2026-08-23

## Mi ez

Multi-tenant **ügyfélportál**, aminek az analitika az első modulja — nem analitika-app,
amihez később hozzácsapunk dolgokat. Elsősorban saját + ügyfél használatra, később
esetleg önálló termékként kiadva.

Az ügyfél egyszer lép be, és bal oldalt vált modult:

| Modul | Mit old meg | Prioritás |
|---|---|---|
| **Analitika** | event tracking, funnel-nézet több alkalmazáshoz | első |
| **Űrlap-beérkezések** | ajánlatkérések, kapcsolatfelvételek egy helyen | korai |
| **CMS-kezelés** | Sanity API-n át, saját felületen — az ügyfélnek ne kelljen Sanity-re regisztrálnia | később |
| **Fájlkezelés** | képfeltöltés/tárolás — ne kelljen Cloudinary-regisztráció | később |
| **Saját CMS** | Sanity kiváltása (nem skálázható úgy) | nyitott kérdés |

Mind ugyanazt az auth-ot, jogosultsági modellt és ügyfél-elszigetelést használja.

## Tech stack

| Réteg | Választás | Miért |
|---|---|---|
| App | **Next.js** | védett route-ok, middleware, alkalmazás-jellegű (nem tartalmi oldal) |
| DB + Auth | **Supabase** | RLS a multi-tenancyhez, beépített auth |
| Fájl | **Supabase Storage** | egy szolgáltatóval kevesebb, nincs ügyfél-regisztráció |
| Séma | **`jsonb` + definíció** | tetszőleges űrlap, mégis lekérdezhető |
| Hosting | **Vercel** | a paladi-web maradhat Netlify-on |

### Miért nem Astro
Az Astro a paladi-web-hez kiváló (tartalmi, statikus, gyors), de ez alkalmazás:
sok interaktív állapot, védett route-ok, szerver-oldali adatlekérés user-kontextussal.

### Miért Supabase és nem Turso
Az eredeti Turso-ajánlás arra épült, hogy csak a tulajdonos nézi az adatot. Az ügyfél-
hozzáféréssel ez megdőlt. A döntő az **RLS (Row Level Security)**: az elszigetelést az
adatbázis kényszeríti ki, nem az alkalmazáskód. Egy policy — "a user csak azokat a sorokat
látja, amelyek olyan apphoz tartoznak, amihez hozzáférése van" — és onnantól még egy hibás
lekérdezés sem szivárogtat ki más ügyfél adatát.

Multi-tenant rendszernél ez nem kényelmi kérdés: ha kézzel írt `WHERE` feltételekre bízod
az elszigetelést, egyetlen elfelejtett feltétel GDPR-incidens.

### NoSQL nem kell
A Postgres `jsonb` megadja a séma-rugalmasságot relációs garanciák mellett.

## Domain és tenant-feloldás

**Külön domain, semleges névvel, path-alapú tenantokkal:**

```
app.<uj-domain>.hu/rdghomes/analytics
app.<uj-domain>.hu/rdghomes/cms
app.<uj-domain>.hu/paladi-web/analytics
```

Az ügyfelek kapnak egy `rdghomes.paladi-web.hu` **redirectet** — a saját márkát látják a
linkben, a rendszer mégis semleges alapon áll.

### Miért path-alapú, nem subdomain
- **Az auth egyszerűbb** — subdomainek közt session-t megosztani macerás (cookie
  domain-scope, cross-subdomain SSO). Path-alapon egy origin, egy session.
- **Több app birtoklásánál** a váltás egy linkkattintás, nem újralogin.
- **Később ráteheted a subdomaint** is ugyanarra a rendszerre. Fordítva nehezebb.

A dinamikus subdomain egyébként **nem drága és nem nehéz** (Vercel/Netlify wildcard domain,
egy DNS rekord, middleware olvassa a `Host` fejlécet, wildcard SSL automatikus) — csak
path-alapon nincs rá szükség. White-label (ügyfél saját domainjén) lehet későbbi fizetős funkció.

### Névválasztás
Ne legyen benne sem a "paladi", sem az "analitika" — a portál több modult fed, és ha van
esély a kiadásra, a névhez kötés kétszeresen rossz.

## Jogosultsági modell

```
User ──< Membership >── App
             │
           role: owner | admin | viewer
```

- **owner** — minden appot lát, appokat hozhat létre, meghívhat
- **admin** — a saját appját látja, meghívhat kollégát
- **viewer** — csak néz

A `Membership` kapcsolótábla a lényeg: egy ügyfélnek lehet több appja (több weboldala),
és egy apphoz több embere.

## Analitika modul

### Adatmodell elve
**Sose aggregálj a mérés pillanatában** — a nyers eseményeket tárold, mert az aggregálás
visszafordíthatatlan. `COUNT(DISTINCT sessionId)` vagy `COUNT(DISTINCT visitorId)` lekérdezéskor
dől el, nem méréskor.

- **`sessionId`** — `crypto.randomUUID()`, `sessionStorage`-ban. Ez az "ahányszor elindítja".
- **`visitorId`** — ugyanígy, `localStorage`-ban. Ez az "1 user".

**Adatvédelmi megjegyzés:** a `visitorId` tartós azonosító, adatvédelmileg közelebb van a
cookie-hoz. Ajánlás: **csak `sessionId`** — consent nélkül is védhető, és a kérdések 95%-át
megválaszolja. A visszatérő-látogató nézet luxus, nem alapigény.

### Gyűjtő végpont
Önálló, az egyes appoktól független:

```
POST /event
{ appId, sessionId, event, props?, ts }
```

Publikus **write-only kulcs apponként** — csak írni tud, olvasni nem. Látszik a kliensben,
ez rendben van; spam ellen rate limit + domain-ellenőrzés.

Minden app ugyanazt a `track()` függvényt használja.

### Funnel-definíció
**Adat legyen, ne kód** — egy konfiguráció mondja meg, mely eseménynevek milyen sorrendben
alkotják a funnelt. Új app hozzáadásakor nem kell dashboardot fejleszteni.

Kezdésnek: a definíciót te írod configban. Az ügyfél-szerkeszthető funnel valódi termék-funkció,
csak akkor általánosítsd, ha tényleg jön rá igény.

## Űrlap-beérkezések modul

### NE HTML-t tárolj
A "generálj formázott HTML-t és tárold egészben" ötlet visszaütne: megjeleníthető, de
**feldolgozhatatlan** formába zárja az adatot. HTML-tárolással nem tudsz szűrni, exportálni,
statisztikát csinálni, sémát változtatni — és XSS-kockázat is, ha ügyfél-tartalmat renderelsz.

### Helyette: `jsonb` + séma-leírás

```
form_definitions          submissions
  app_id                    app_id
  form_key                  form_key
  schema (jsonb)  ←──────   data (jsonb)
  ui_config (jsonb)         created_at
```

- `data` — a nyers válaszok: `{ "projectType": "landing", "phone": "+36..." }`
- `schema` — hogyan kell megjeleníteni: mezőnevek, címkék, sorrend, típusok

A dashboard a kettőből rendereli a megjelenítést. Ugyanolyan rugalmas, mint a HTML-tárolás
(tetszőleges űrlap, előre nem ismert mezőkkel), de az adat strukturált marad, és a `jsonb`
indexelhető, lekérdezhető.

Az árkalkulátor és az RDGHomes képfeltöltős ajánlatkérője ebben ugyanúgy elfér, különböző
`schema`-val. A képek Storage-ba mennek, a `data`-ban csak referencia.

## Saját CMS — nyitott kérdés

Ha a fenti `jsonb` mintát elfogadjuk, **nem kell hozzá külön adatbázis**: séma + tartalom
`jsonb`-ben pont az, amit a headless CMS-ek csinálnak. A külön DB védhető, de valószínűleg
felesleges szétválasztás — a Postgres `jsonb` elbírja, és egy rendszerben marad az auth
meg a jogosultság.

Később eldöntendő. A Supabase egyik irányt sem zárja ki.

## Nyitott architekturális kérdések

1. **Adat élettartama** — meddig nyers adat, mikortól elég a napi aggregátum? Kis forgalomnál
   évekig nem probléma, de ügyfelekkel skálázódik.
2. **Adatfeldolgozói szerep** — ha az ügyfelek látogatóinak adatát tárolod, GDPR-értelemben
   **adatfeldolgozó** vagy, és adatfeldolgozói szerződés kell az ügyfelekkel. Nem blokkoló,
   de tervezni kell vele, és üzletileg is jobb előre tisztázni.

## Kapcsolat a paladi-web-bel

A paladi-web funnel-mérése **ne várjon erre a rendszerre**. Az eseménygyűjtés úgy is
megépíthető, hogy később ide illeszkedjen: a séma és a gyűjtő végpont ugyanaz lesz, csak
eleinte nincs fölötte dashboard. Így napok alatt látszanak a számok, és semmit nem dobunk el.
