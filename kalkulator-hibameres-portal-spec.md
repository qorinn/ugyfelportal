# Kalkulátor-hibamérés — implementációs spec a portálhoz

> Státusz: **a paladi-web oldal kész és élesíthető, a portál oldal még nincs meg.**
> Készült: 2026-08-26. Cél olvasó: az `admin.paladi-web.hu` (ügyfélportál) implementációja.
> Kapcsolódó: [kalkulator-analitika-terv.md](kalkulator-analitika-terv.md), [ugyfelportal-terv.md](ugyfelportal-terv.md)

## Miért van erre szükség

A paladi-web kalkulátora eddig csak a sikeres lépéseket mérte. Ha az ajánlatkérés
elhasalt — Resend kiesés, validációs hiba, JS-kivétel a hidratált komponensben —, az a
funnelben **egyszerű lemorzsolódásnak látszott**, és nem lehetett megkülönböztetni a
meggondolta-magát látogatót az elrontott kéréstől.

A paladi-web mostantól **`calculator_error` eseményt küld minden hibáról**, kliens- és
szerveroldalról egyaránt. Sentry vagy más hibafigyelő szolgáltatás nem került be: a hiba
ugyanaz az esemény, mint a többi, ugyanazon az adatúton.

**Blokkoló, amíg a portál nem lép:** az ingest eseménynév-whitelistet használ, és a
`calculator_error`-t jelenleg `400 Unknown event`-tel elutasítja. Ellenőrizve
2026-08-26-án, éles végponton. Amíg a név nem kerül fel a listára, **egyetlen
hibaesemény sem tárolódik** — és ez sehol nem látszik, mert a paladi-web oldali proxy
mindig `204`-et ad vissza a böngészőnek.

---

## 1. Az adatút — változatlan

```
böngésző ──POST /api/track──> paladi-web (Netlify)      [első fél, titok nélkül]
                                    │
                                    │ szerver-szerver, Bearer <ANALYTICS_INGEST_SECRET>
                                    ▼
                        POST https://admin.paladi-web.hu/api/event

szerveroldali események (quote-estimate.ts, email/open.ts, email/click.ts)
        ──────────────────────> ugyanaz a /api/event, közvetlenül
```

A paladi-web oldalon semmi nem változik ebben: a `/api/track` proxy és a
`trackServerEvent` ugyanaz maradt.

### Kérés formátuma az ingesten

```http
POST /api/event
Authorization: Bearer <INGEST_SECRET>
Content-Type: application/json

{
  "appId":     "paladi-web",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "name":      "calculator_error",
  "props":     { ... }
}
```

- `appId` fix: `"paladi-web"`.
- `sessionId` UUID v4, `sessionStorage`-ban él (`paladi-analytics-session` kulcs).
- A paladi-web `redirect: "manual"`-lal hív, tehát **ne adj 3xx választ** — a
  továbbítás azt hibaként naplózza, nem követi.
- A válasz teste nem érdekes; a paladi-web csak a `response.ok`-ot nézi, és
  elutasításkor `console.error`-t ír a Netlify logba.

---

## 2. Teljes eseménykatalógus

Ez a **teljes** lista, amit a paladi-web ma küld. A whitelistnek pontosan ezt kell
tartalmaznia.

| Esemény | Oldal | Mikor |
|---|---|---|
| `calculator_started` | kliens | első válaszkattintás a kalkulátorban |
| `calculator_questions_completed` | kliens | a látogató végigért a kérdéseken |
| `calculator_email_submitted` | szerver | megadta az e-mailt, feloldotta az ársávot |
| `calculator_callback_requested` | szerver | visszahívást kért |
| `calculator_refine_requested` | szerver | pontosabb ajánlatot kért |
| **`calculator_error`** | **kliens + szerver** | **ÚJ — bármilyen hiba** |
| `email_opened` | szerver | követőpixel az ajánlat-levélben |
| `email_link_clicked` | szerver | link kattintás az ajánlat-levélben |

### `props` mezők eseményenként

**`calculator_started`**
| kulcs | típus | értékek |
|---|---|---|
| `service` | string | `all` · `website` · `web-system` · `mobile-app` |
| `projectType` | string \| undefined | lásd lentebb — az első kattintáskor még hiányozhat |

**`calculator_questions_completed`**
| kulcs | típus | értékek |
|---|---|---|
| `projectType` | string | `landing` · `business` · `service` · `system` · `mobile` |

**`calculator_email_submitted` / `calculator_callback_requested` / `calculator_refine_requested`**
| kulcs | típus | értékek |
|---|---|---|
| `projectType` | string | `landing` · `business` · `service` · `system` · `mobile` |
| `service` | string | `ar-kalkulator-{all\|website\|web-system\|mobile-app}` vagy `ismeretlen` |

**`email_opened`**
| kulcs | típus | értékek |
|---|---|---|
| `prefetched` | boolean | `true`, ha levelező-proxy töltötte le (Apple Mail, Gmail image proxy) — **nem valódi megnyitás** |
| `emailType` | string | `quote` · `refined_quote` |

**`email_link_clicked`**
| kulcs | típus | értékek |
|---|---|---|
| `target` | string | `website` · `phone` |
| `emailType` | string | `quote` · `refined_quote` |

> Megjegyzés: a `service` mező **két különböző formátumban** érkezik — a
> `calculator_started` nyers szolgáltatásnevet küld (`website`), a szerveroldali
> események `ar-kalkulator-` előtaggal (`ar-kalkulator-website`). Ez a meglévő kód
> öröksége. A dashboardon normalizálni kell, ha egy dimenzióként akarod nézni.

---

## 3. `calculator_error` — a részletes séma

**Egyetlen eseménynév, az elágazás a `props`-ban van.** Ez szándékos: így a whitelistbe
egy sor kerül, és a „hány sessionben történt bármi hiba" kérdés egyetlen
`count(distinct session_id)`.

```jsonc
{
  "source":  "client" | "server",   // mindig jelen van
  "stage":   "reveal",              // mindig jelen van, lásd a táblát
  "message": "Az ársávot most...",  // mindig jelen van, tisztított, max 200 karakter
  "fatal":   true,                  // mindig jelen van — elakadt-e a látogató
  "status":  502,                   // opcionális, number — HTTP státusz, ha volt
  "projectType": "landing",         // opcionális
  "service": "website",             // opcionális
  // stage-függő extrák, lásd lentebb
}
```

### `stage` értékek

| `stage` | `source` | `fatal` | `status` | Mit jelent |
|---|---|---|---|---|
| `reveal` | client | `true` | 400/429/500/502 | Az ársáv feloldása elhasalt |
| `callback` | client | `true` | 400/429/500/502 | A visszahívás-kérés elhasalt |
| `refine` | client | `true` | 400/429/500/502 | A pontosítás-kérés elhasalt |
| `supporting_content` | client | `false` | — | A szolgáltatásváltáskor a kísérő tartalom nem frissült. Nem akasztja meg a látogatót |
| `render` | client | `true` | — | **React render-hiba** — a kalkulátor összeomlott, a látogató fallback UI-t lát |
| `uncaught` | client | `false` | — | Elkapatlan JS-kivétel a kalkulátor oldalon |
| `unhandled_rejection` | client | `false` | — | Elkapatlan promise-elutasítás |
| `validation` | server | `true` | 400 | Érvénytelen bemenet — 12 különböző ág, a `message` különbözteti meg |
| `rate_limit` | server | `true` | 429 | Rate limit életbe lépett |
| `email_send` | server | `true` | 502 | **A belső értesítő levél nem ment ki** — ez a legfontosabb riasztási jelölt |
| `quote_email` | server | `false` | — | **A látogatónak szóló összefoglaló nem ment ki.** A látogató sikeresnek látja a kérést, és vár egy levelet, ami nem érkezik meg |
| `honeypot` | server | `false` | — | Botgyanús kitöltés |

### Stage-függő extra `props`

| `stage` | extra kulcs | típus | értékek |
|---|---|---|---|
| `uncaught` | `filename` | string | a hibát dobó fájl URL-je, max 200 karakter |
| `render` | `componentStack` | string | React komponens-stack, max 200 karakter |
| `validation` | `intent` | string | `reveal` · `callback` · `refine` |
| `validation` | `reason` | string | `syntax` · `disposable` · `no-mx` (csak e-mail-validációnál) |
| `validation` | `questionId` | string | a hibás kérdés azonosítója |
| `email_send` | `intent` | string | `reveal` · `callback` · `refine` |

---

## 4. Amit a portálnak tudnia kell — hét fontos viselkedés

Ezek nélkül a dashboard hibás számokat mutatna. Mindegyik szándékos tervezési döntés
a paladi-web oldalon, nem hiba.

**1. Egy hiba két eseményt szülhet.** Egy elhasalt „ársáv feloldása" a **kliensről**
(`stage: "reveal"`, `source: "client"`) **és a szerverről** (`stage: "email_send"`,
`source: "server"`) is jelentkezik, azonos `session_id`-vel. Ez nem duplikáció, hanem
két nézőpont: a kliens tudja, hogy a látogató elakadt, a szerver tudja, hogy miért.
**A dashboardon `count(distinct session_id)`-t számolj, ne sorokat**, különben
kétszeresen számolod ugyanazt az esetet.

**2. A kliensoldali hibák sessiononként maximum ötször mennek ki.** Van egy
`MAX_ERRORS_PER_SESSION = 5` limit (`sessionStorage`, `paladi-error-count` kulcs), plusz
oldalbetöltésen belüli deduplikáció `stage|message` szignatúrára. Egy hibaciklusban
ragadt oldal enélkül teleírná a táblát. **Következmény: a hibaszám alsó becslés, nem
pontos érték.** A „hány session érintett" viszont pontos — ezt a metrikát mutasd.

**3. Két hibaág soha nem érkezik meg szerveroldalról.** A `trackServerEvent` kilép, ha
nincs `sessionId` (a séma `session_id uuid not null`). A hiányzó `RESEND_API_KEY` és a
hibás JSON ág a `sessionId` beolvasása **előtt** fut. Ez nem hézag: mindkettő non-OK
HTTP választ ad, amit a **kliens jelent** a saját sessionjével és státuszkódjával.

**4. A `honeypot` esemény ritkán fog megérkezni.** Ugyanaz az ok: a botok többsége nem
küld `sessionId`-t, ezért az esemény eldobódik a paladi-web oldalon. Ami mégis
átjön, az a valódi payloadot visszajátszó bot — épp az érdekesebb fajta.

**5. `stage: "quote_email"` esetén a lead sikeresnek látszik.** A látogató `200`-at
kapott, a lead elmentődött, a funnel szerint minden rendben — közben nem kapta meg az
ígért összefoglaló levelet. **Ez az egyetlen hibatípus, ami követendő teendőt jelent:
ilyenkor kézzel utána kell küldeni.** Érdemes a lead-nézetben megjelölni.

**6. A `props` nem megbízható adat.** A `/api/track` proxy **hitelesítés nélküli és
nyilvános** — bárki POST-olhat rá tetszőleges `name` és `props` tartalommal, és a proxy
vakon továbbítja a titkos kulccsal. Eddig ez alacsony kockázat volt (fix kulcsú
események), de a `message` az **első szabad szöveges mező**. Az ingesten kell clamp-elni,
lásd a 6. szakaszt.

**7. Nincs stack trace és nincs személyes adat.** A `message` átmegy egy
`sanitizeErrorMessage()`-en: e-mail- és telefonszám-minta `[redacted-email]` /
`[redacted-phone]`-ra cserélve, 200 karakternél levágva. A `props`-ban továbbra sem
szabad PII-nak lennie ([kalkulator-analitika-terv.md](kalkulator-analitika-terv.md)
szabálya). Ha valaha pontos stack trace kell, az külön döntés — ma nincs.

---

## 5. Lead végpont — változatlan, referenciaként

A `saveLead` a `/api/event` URL-jéből képzett `/api/lead`-re POST-ol, ugyanazzal a
Bearer kulccsal. **Ez tartalmaz személyes adatot**, ezért csak szerveroldalról hívható.

```jsonc
{
  "appId":        "paladi-web",
  "sessionId":    "uuid",
  "email":        "...",              // kötelező
  "name":         "...",              // opcionális
  "phone":        "...",              // opcionális
  "projectType":  "landing",
  "service":      "ar-kalkulator-website",
  "estimateLow":  "450 000 Ft",       // formázott string, nem szám
  "estimateHigh": "780 000 Ft",
  "durationLabel":"6-8 hét",
  "projectBrief": "...",              // a látogató szabad szövege
  "status":       "revealed"          // revealed | callback_requested | refine_requested
}
```

A lead a `sessionId`-re **felülíródik**: aki előbb feloldotta az árat, majd pontosítást
is kért, egyetlen follow-up célpont marad.

---

## 6. Portál oldali teendők

### 6.1 Whitelist — ez a blokkoló

```ts
const KNOWN_EVENTS = new Set([
  "calculator_started",
  "calculator_questions_completed",
  "calculator_email_submitted",
  "calculator_callback_requested",
  "calculator_refine_requested",
  "calculator_error",          // ÚJ
  "email_opened",
  "email_link_clicked",
]);
```

### 6.2 `props` clamp az ingesten — kötelező

A 4/6. pont miatt: a `message` szabad szöveg, és a `/api/track` proxy bárki előtt nyitva
áll. A kliensoldali 200 karakteres vágás **nem védelem**, csak kényelem — a szerveren
kell kikényszeríteni.

```ts
const MAX_KEYS = 24;
const MAX_STRING = 300;      // a kliens 200-at küld; a fejtér a jövőbeli mezőknek szól
const MAX_PROPS_BYTES = 4096;

const clampProps = (raw: unknown): Record<string, unknown> => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Object.keys(out).length >= MAX_KEYS) break;
    if (key.length > 64) continue;

    // Csak skalárt fogadunk: a beágyazott objektum se nem várt, se nem hasznos.
    if (typeof value === "string") out[key] = value.slice(0, MAX_STRING);
    else if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    else if (typeof value === "boolean") out[key] = value;
  }

  // Végső védőháló a jsonb oszlopnak.
  if (JSON.stringify(out).length > MAX_PROPS_BYTES) {
    return { _truncated: true, stage: out.stage, source: out.source };
  }

  return out;
};
```

Emellett ellenőrizd, hogy a `sessionId` valóban UUID — ha még nincs ilyen ellenőrzés,
tedd be. Érvénytelen UUID-re `400`, hogy az insert ne az adatbázis szintjén haljon el
(`session_id uuid not null`).

### 6.3 Adatbázis

**Migráció nem kell.** A `props` `jsonb`, az új kulcsok elférnek benne. A meglévő
`events_app_name_created_idx (app_id, name, created_at desc)` index kiszolgálja a
hibalekérdezéseket is.

Ha a hibaforgalom később megnő, opcionális részleges index:

```sql
create index concurrently if not exists events_errors_idx
  on events (app_id, created_at desc)
  where name = 'calculator_error';
```

Ezt **ne csináld meg előre** — napi néhány tucat eseménynél felesleges.

### 6.4 Dashboard — mit mutasson

A hiba **nem a funnel hatodik lépése**, hanem külön blokk mellette. A
[kalkulator-analitika-terv.md](kalkulator-analitika-terv.md) elve szerint a nyers
eseményeket töltsd le, és TS-ben aggregálj.

```ts
type EventRow = {
  session_id: string;
  name: string;
  props: Record<string, unknown>;
  created_at: string;
};

const errorRows = rows.filter((r) => r.name === "calculator_error");
const startedSessions = new Set(
  rows.filter((r) => r.name === "calculator_started").map((r) => r.session_id),
);
const errorSessions = new Set(errorRows.map((r) => r.session_id));

// 1. Fő szám: hibás sessionök aránya.
//    Sorokat NE számolj — egy hiba két eseményt is szülhet (kliens + szerver).
const errorRate = startedSessions.size
  ? errorSessions.size / startedSessions.size
  : 0;

// 2. Bontás stage szerint — ez mondja meg, mit kell javítani.
const byStage = new Map<string, Set<string>>();
for (const row of errorRows) {
  const stage = String(row.props.stage ?? "ismeretlen");
  let sessions = byStage.get(stage);
  if (!sessions) {
    sessions = new Set<string>();
    byStage.set(stage, sessions);
  }
  sessions.add(row.session_id);
}

// 3. Elakadt-e a látogató. A fatal:false (uncaught, supporting_content,
//    quote_email) érdekes, de nem sürgős; a fatal:true elvesztett lead.
const fatalSessions = new Set(
  errorRows.filter((r) => r.props.fatal === true).map((r) => r.session_id),
);

// 4. kliens vs szerver arány: ez méri, mekkora a mérésblokkolás.
//    A szerveroldali események akkor is megérkeznek, ha a kliens blokkolva van.
const clientCount = errorRows.filter((r) => r.props.source === "client").length;
const serverCount = errorRows.filter((r) => r.props.source === "server").length;
```

**Nézet-javaslat, fontossági sorrendben:**

1. **„Hibás sessionök"** — `errorSessions.size / startedSessions.size`, a funnel mellé.
   Ha ez 5% fölé megy, valami tényleg romlik.
2. **Teendő-lista** — a `stage: "quote_email"` sessionök külön kiemelve, a lead-adattal
   összekötve. Ez az egyetlen hibatípus, ami kézi utánküldést igényel (4/5. pont).
3. **`stage` × `status` táblázat** — egy pillantásból látszik, a validáció vagy a
   levélküldés esik-e szét.
4. **Utolsó 50 nyers hiba** — `created_at`, `stage`, `status`, `message`, `session_id`.
   Indulásnál ez a leghasznosabb hibakereséshez.

### 6.5 Riasztás — később, opcionális

Ez az egyetlen dolog, amiért máshol Sentryt vesznek. A portálban egy cron + egy
lekérdezés:

> Ha egy órán belül **3-nál több** `stage: "email_send"` érkezik, küldj e-mailt a
> `hello@paladi-web.hu` címre.

A küszöb szándékosan alacsony: ez az ág azt jelenti, hogy az ajánlatkérés egyáltalán nem
megy át, tehát minden érintett lead elveszett.

---

## 7. Tesztelés — másolható payloadok

A whitelist bővítése után ezekkel ellenőrizhető végponttól végpontig. Futtasd a
paladi-web repóból (`npm run dev`), hogy a titkos kulcs ne kerüljön parancssorba — a
proxy a `.env`-ből olvassa.

```bash
# 1. Kliensoldali hiba (a valódi payload alakja)
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:4321/api/track \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"00000000-0000-4000-8000-000000000001","name":"calculator_error",
       "props":{"source":"client","stage":"reveal","status":502,
                "message":"Az ajánlatkérést most nem sikerült elküldeni.",
                "fatal":true,"projectType":"landing","service":"website"}}'

# 2. Szerveroldali hiba, valódi ágon keresztül (érvénytelen intent -> stage: validation)
curl -s -X POST http://localhost:4321/api/quote-estimate \
  -H "Content-Type: application/json" \
  -d '{"answers":{"projectType":"landing"},"email":"teszt@example.com",
       "intent":"nonszensz","sessionId":"00000000-0000-4000-8000-000000000002"}'

# 3. Clamp-teszt: a portálnak vágnia kell, nem elutasítania
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:4321/api/track \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"00000000-0000-4000-8000-000000000003","name":"calculator_error",
       "props":{"source":"client","stage":"uncaught","fatal":false,
                "message":"'"$(printf 'x%.0s' {1..5000})"'"}}'
```

**Sikeres, ha:** a paladi-web dev szerver logjában **nem** jelenik meg
`Analytics forward rejected`, és a portál `events` táblájában megjelenik a három sor
(a harmadiknál levágott `message`-dzsel).

**Sikertelen, ha** a logban ez van — ilyenkor a whitelist még nem tartalmazza a nevet:

```
Analytics forward rejected: 400 Unknown event
```

---

## 8. Adatvédelem

Az adatkezelési tájékoztató **nem igényel módosítást**: nem jön új adatfeldolgozó, nem
jön új azonosító, az adatút ugyanaz az első feles út, ami már szerepel benne.

Amire figyelni kell a portál oldalán: a `message` az első szabad szöveges mező az
`events` táblában. A paladi-web tisztítja, de a `/api/track` nyilvános (4/6. pont), ezért
a portál ne tekintse megbízhatónak. Ha valaha a `message`-t megjeleníted egy HTML
dashboardon, **escape-eld** — tárolt XSS-vektor lenne.
