// A funnel definíciója adat, nem kód: új app vagy új funnel egy tömb, nem dashboard-fejlesztés.

export const APP_ID = "paladi-web"

export const CALCULATOR_FUNNEL = [
  { name: "calculator_started", label: "Elindította a kalkulátort" },
  { name: "calculator_questions_completed", label: "Végigért a kérdéseken" },
  { name: "calculator_email_submitted", label: "Megadta az e-mailt" },
] as const

// A záró lépés két, egymást kizáró kimenet — nem sorrend, hanem elágazás.
export const CALCULATOR_OUTCOMES = [
  { name: "calculator_callback_requested", label: "Visszahívást kért" },
  { name: "calculator_refine_requested", label: "Pontosabb árat kért" },
] as const

export type FunnelStep = (typeof CALCULATOR_FUNNEL)[number]
export type FunnelOutcome = (typeof CALCULATOR_OUTCOMES)[number]

// Whitelist: ismeretlen eseménynevet nem tárolunk, hogy ne szemetelődjön a tábla.
export const KNOWN_EVENT_NAMES: ReadonlySet<string> = new Set([
  ...CALCULATOR_FUNNEL.map((step) => step.name),
  ...CALCULATOR_OUTCOMES.map((outcome) => outcome.name),
])

// Soha ne kerüljön személyes adat a props-ba. A whitelist ezt szerkezetileg
// kényszeríti ki: minden más kulcsot eldobunk beszúrás előtt.
export const ALLOWED_PROP_KEYS: readonly string[] = ["projectType", "service"]
