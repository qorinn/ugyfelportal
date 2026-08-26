// A funnel definíciója adat, nem kód: új app vagy új funnel egy tömb, nem dashboard-fejlesztés.

export const APP_ID = "paladi-web"

// A short mező a szűk helyeken kell (idővonal-checkpointok), a label mindenhol máshol.
export const CALCULATOR_FUNNEL = [
  {
    name: "calculator_started",
    label: "Elindította a kalkulátort",
    short: "Indítás",
  },
  {
    name: "calculator_questions_completed",
    label: "Végigért a kérdéseken",
    short: "Kérdések",
  },
  {
    name: "calculator_email_submitted",
    label: "Megadta az e-mailt",
    short: "E-mail",
  },
] as const

// A záró lépés két, egymást kizáró kimenet — nem sorrend, hanem elágazás.
export const CALCULATOR_OUTCOMES = [
  {
    name: "calculator_callback_requested",
    label: "Visszahívást kért",
    short: "Visszahívás",
  },
  {
    name: "calculator_refine_requested",
    label: "Pontosabb árat kért",
    short: "Pontosítás",
  },
] as const

export type FunnelStep = (typeof CALCULATOR_FUNNEL)[number]
export type FunnelOutcome = (typeof CALCULATOR_OUTCOMES)[number]

// A hiba nem a funnel hatodik lépése, hanem külön dimenzió: egyetlen eseménynév,
// az elágazás a props.stage-ben. Így a "hány sessionben történt bármi hiba" egy
// count(distinct session_id), és a whitelistbe egy sor kerül.
export const ERROR_EVENT_NAME = "calculator_error"

export const ERROR_STAGE_LABELS: Record<string, string> = {
  reveal: "Ársáv feloldása",
  callback: "Visszahívás-kérés",
  refine: "Pontosítás-kérés",
  supporting_content: "Kísérő tartalom",
  render: "React render-hiba",
  uncaught: "Elkapatlan JS-kivétel",
  unhandled_rejection: "Elkapatlan promise",
  validation: "Validáció",
  rate_limit: "Rate limit",
  email_send: "Belső értesítő nem ment ki",
  quote_email: "Ajánlatlevél nem ment ki",
  honeypot: "Botgyanús kitöltés",
}

// Az egyetlen hibatípus, ami kézi teendőt jelent: a látogató sikeresnek látta a
// kérést, és vár egy levelet, ami nem érkezett meg.
export const MANUAL_FOLLOWUP_STAGE = "quote_email"

// Whitelist: ismeretlen eseménynevet nem tárolunk, hogy ne szemetelődjön a tábla.
export const KNOWN_EVENT_NAMES: ReadonlySet<string> = new Set([
  ...CALCULATOR_FUNNEL.map((step) => step.name),
  ...CALCULATOR_OUTCOMES.map((outcome) => outcome.name),
  ERROR_EVENT_NAME,
])
