// A lead a session_id-re épül: egy munkamenet = egy lead = egy follow-up.

export const LEAD_STATUSES = [
  "revealed",
  "refine_requested",
  "callback_requested",
] as const

export type LeadStatus = (typeof LEAD_STATUSES)[number]

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  revealed: "Feloldotta az árat",
  refine_requested: "Pontosítást kért",
  callback_requested: "Visszahívást kért",
}

export function isLeadStatus(value: unknown): value is LeadStatus {
  return (
    typeof value === "string" && LEAD_STATUSES.includes(value as LeadStatus)
  )
}

// Az állapot csak erősödhet. Enélkül egy később érkező, gyengébb kérés
// visszaminősítené a leadet: aki visszahívást kért, az nem lesz újra "revealed".
export function strongerStatus(a: LeadStatus, b: LeadStatus): LeadStatus {
  return LEAD_STATUSES.indexOf(a) >= LEAD_STATUSES.indexOf(b) ? a : b
}

export type LeadRow = {
  session_id: string
  app_id: string
  email: string
  name: string | null
  phone: string | null
  project_type: string | null
  service: string | null
  estimate_low: string | null
  estimate_high: string | null
  duration_label: string | null
  project_brief: string | null
  status: LeadStatus
  followed_up_at: string | null
  created_at?: string
  updated_at?: string
}

export type IncomingLead = {
  sessionId: string
  appId: string
  email: string
  name?: unknown
  phone?: unknown
  projectType?: unknown
  service?: unknown
  estimateLow?: unknown
  estimateHigh?: unknown
  durationLabel?: unknown
  projectBrief?: unknown
  status: LeadStatus
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null
}

// Üres mező nem ír felül meglévőt: a telefon és a projectBrief csak később
// érkezik, és egy korábbi hívás üres értéke nem törölheti a már tudott adatot.
function keep(incoming: unknown, existing: string | null | undefined) {
  return text(incoming) ?? existing ?? null
}

export function mergeLead(
  incoming: IncomingLead,
  existing: LeadRow | null
): Omit<LeadRow, "created_at"> & { updated_at: string } {
  return {
    session_id: incoming.sessionId,
    app_id: incoming.appId,
    email: text(incoming.email) ?? existing?.email ?? "",
    name: keep(incoming.name, existing?.name),
    phone: keep(incoming.phone, existing?.phone),
    project_type: keep(incoming.projectType, existing?.project_type),
    service: keep(incoming.service, existing?.service),
    estimate_low: keep(incoming.estimateLow, existing?.estimate_low),
    estimate_high: keep(incoming.estimateHigh, existing?.estimate_high),
    duration_label: keep(incoming.durationLabel, existing?.duration_label),
    project_brief: keep(incoming.projectBrief, existing?.project_brief),
    status: existing
      ? strongerStatus(existing.status, incoming.status)
      : incoming.status,
    // A follow-up a dashboardon dől el, egy beérkező lead-frissítés nem nyúlhat hozzá.
    followed_up_at: existing?.followed_up_at ?? null,
    updated_at: new Date().toISOString(),
  }
}

export type DisplayLead = Pick<
  LeadRow,
  | "session_id"
  | "email"
  | "name"
  | "phone"
  | "project_type"
  | "estimate_low"
  | "estimate_high"
  | "duration_label"
  | "status"
  | "followed_up_at"
>

// A látogatónak azt ígértük, hogy az e-mail címét kizárólag ehhez az árajánlathoz
// használjuk. A sablon ezért kizárólag erről a konkrét ajánlatról szól — ez a
// szöveg a határ, amit egy utánkövetés nem léphet át.
export function followupSubject(): string {
  return "Az árajánlatodról — Paládi Web"
}

export function followupBody(lead: DisplayLead): string {
  const greeting = lead.name?.trim() ? `Szia ${lead.name.trim()}!` : "Szia!"

  const range =
    lead.estimate_low && lead.estimate_high
      ? `${lead.estimate_low} és ${lead.estimate_high} közötti sávot`
      : "egy becsült ársávot"

  const project = lead.project_type ? ` a ${lead.project_type} projektedre` : ""
  const duration = lead.duration_label
    ? `, ${lead.duration_label} körüli határidővel`
    : ""

  return [
    greeting,
    "",
    `nemrég kipróbáltad az árkalkulátoromat: ${range} adott${project}${duration}.`,
    "",
    "Ha szeretnéd, szívesen átbeszélem veled a részleteket, és pontosítom az árat a tényleges igényeid alapján. Ha időközben másképp döntöttél, arra sincs semmi gond — erre az ajánlatra nem foglak többször keresni.",
    "",
    "Üdv,",
    "Bálint",
  ].join("\n")
}

export function gmailComposeUrl(lead: DisplayLead): string {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: lead.email,
    su: followupSubject(),
    body: followupBody(lead),
  })

  return `https://mail.google.com/mail/?${params.toString()}`
}
