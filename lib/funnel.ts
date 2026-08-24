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

// A levélmérés nem funnel-lépés, hanem annotáció a lépések alatt. A levél fajtáját
// a props.emailType hordozza, nem külön eseménynév — így új levéltípushoz nem kell
// sem migráció, sem új whitelist-bejegyzés.
export const EMAIL_EVENT_PREFIX = "email_"

export const EMAIL_EVENTS = [
  { name: "email_opened", label: "Megnyitotta a levelet" },
  { name: "email_link_clicked", label: "Kattintott a levélben" },
] as const

export const EMAIL_TYPES = ["quote", "refined_quote"] as const
export type EmailType = (typeof EMAIL_TYPES)[number]

export const EMAIL_TYPE_LABELS: Record<EmailType, string> = {
  quote: "Ajánlatlevél",
  refined_quote: "Pontosított ajánlat",
}

export function isEmailType(value: unknown): value is EmailType {
  return typeof value === "string" && EMAIL_TYPES.includes(value as EmailType)
}

export type FunnelStep = (typeof CALCULATOR_FUNNEL)[number]
export type FunnelOutcome = (typeof CALCULATOR_OUTCOMES)[number]

// Whitelist: ismeretlen eseménynevet nem tárolunk, hogy ne szemetelődjön a tábla.
export const KNOWN_EVENT_NAMES: ReadonlySet<string> = new Set([
  ...CALCULATOR_FUNNEL.map((step) => step.name),
  ...CALCULATOR_OUTCOMES.map((outcome) => outcome.name),
  ...EMAIL_EVENTS.map((event) => event.name),
])

// Soha ne kerüljön személyes adat a props-ba. A whitelist ezt szerkezetileg
// kényszeríti ki: minden más kulcsot eldobunk beszúrás előtt. A típus is
// számít — a prefetched boolean, a többi sztring.
export const ALLOWED_PROPS = {
  projectType: "string",
  service: "string",
  emailType: "string",
  target: "string",
  prefetched: "boolean",
} as const satisfies Record<string, "string" | "boolean">
