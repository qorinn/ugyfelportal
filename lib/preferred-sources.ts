import type { AnalyticsEvent } from "@/lib/analytics"
import {
  PREFERRED_SOURCE_ALARM_STATUS,
  PREFERRED_SOURCE_EVENTS,
  PREFERRED_SOURCE_STATUS_LABELS,
} from "@/lib/funnel"

export type StatusRow = {
  status: string
  label: string
  sessions: number
  events: number
}

export type SlugRow = {
  slug: string
  clicks: number
  added: number
  rate: number
}

export type MonthRow = {
  month: string
  clicks: number
  added: number
}

export type PreferredSourceSummary = {
  totalEvents: number
  clickSessions: number
  sdkClickSessions: number
  deeplinkSessions: number
  deeplinkShare: number
  // A fő szám: hányan adták tényleg hozzá.
  successSessions: number
  // success + already_added — a befejezési arány számlálója, mert a Google
  // szemszögéből mindkettő azt jelenti, hogy a domain a kedvencek között van.
  addedSessions: number
  completionRate: number
  dismissSessions: number
  byStatus: StatusRow[]
  bySlug: SlugRow[]
  byMonth: MonthRow[]
  ineligibleEvents: number
  // A weboldal localStorage-ben megjegyzi a sikert, ezért sessiononként egy
  // success jöhet. Több = böngésző-tárolási hiba (privát mód), nem duplikátum.
  sessionsWithRepeatedSuccess: number
}

const monthParts = new Intl.DateTimeFormat("hu-HU", {
  timeZone: "Europe/Budapest",
  year: "numeric",
  month: "2-digit",
})

// A hónapot budapesti idő szerint képezzük, hogy egy éjfél körüli esemény ne
// csússzon át az előző hónapba — a dashboard mindenhol ezt az időzónát használja.
function monthKey(iso: string): string {
  const parts = monthParts.formatToParts(new Date(iso))
  const year = parts.find((part) => part.type === "year")?.value ?? "????"
  const month = parts.find((part) => part.type === "month")?.value ?? "??"
  return `${year}-${month}`
}

function text(value: unknown): string {
  return typeof value === "string" && value !== "" ? value : ""
}

export function buildPreferredSourceSummary(
  events: readonly AnalyticsEvent[]
): PreferredSourceSummary {
  const clicks = events.filter(
    (event) => event.name === PREFERRED_SOURCE_EVENTS.click
  )
  const results = events.filter(
    (event) => event.name === PREFERRED_SOURCE_EVENTS.result
  )
  const dismisses = events.filter(
    (event) => event.name === PREFERRED_SOURCE_EVENTS.dismiss
  )

  const sessionsOf = (rows: readonly AnalyticsEvent[]) =>
    new Set(rows.map((row) => row.session_id))

  const clickSessions = sessionsOf(clicks)
  const sdkClicks = clicks.filter((row) => row.props?.mode === "sdk")
  const deeplinkClicks = clicks.filter((row) => row.props?.mode === "deeplink")

  const successRows = results.filter((row) => row.props?.status === "success")
  const successSessions = sessionsOf(successRows)
  const addedSessions = sessionsOf(
    results.filter(
      (row) =>
        row.props?.status === "success" || row.props?.status === "already_added"
    )
  )

  const sdkClickSessions = sessionsOf(sdkClicks)
  const deeplinkSessions = sessionsOf(deeplinkClicks)

  const ratio = (part: number, whole: number) =>
    whole === 0 ? 0 : part / whole

  // Státusz-bontás
  const statusSessions = new Map<string, Set<string>>()
  const statusEvents = new Map<string, number>()
  for (const row of results) {
    const status = text(row.props?.status) || "unknown"
    let set = statusSessions.get(status)
    if (!set) {
      set = new Set<string>()
      statusSessions.set(status, set)
    }
    set.add(row.session_id)
    statusEvents.set(status, (statusEvents.get(status) ?? 0) + 1)
  }

  const byStatus: StatusRow[] = [...statusSessions.entries()]
    .map(([status, sessions]) => ({
      status,
      label: PREFERRED_SOURCE_STATUS_LABELS[status] ?? status,
      sessions: sessions.size,
      events: statusEvents.get(status) ?? 0,
    }))
    .sort((a, b) => b.sessions - a.sessions)

  // Cikk szerinti bontás. A slug nem azt jelenti, hogy a hozzáadás arra a cikkre
  // szól — a funkció domain-szintű; a slug csak azt mondja, melyik cikk hozta.
  const slugs = new Map<string, { clicks: Set<string>; added: Set<string> }>()
  for (const row of [...clicks, ...results]) {
    const slug = text(row.props?.slug) || "ismeretlen"
    let entry = slugs.get(slug)
    if (!entry) {
      entry = { clicks: new Set(), added: new Set() }
      slugs.set(slug, entry)
    }
    if (row.name === PREFERRED_SOURCE_EVENTS.click) {
      entry.clicks.add(row.session_id)
    } else if (row.props?.status === "success") {
      entry.added.add(row.session_id)
    }
  }

  const bySlug: SlugRow[] = [...slugs.entries()]
    .map(([slug, entry]) => ({
      slug,
      clicks: entry.clicks.size,
      added: entry.added.size,
      rate: ratio(entry.added.size, entry.clicks.size),
    }))
    .sort((a, b) => b.added - a.added || b.clicks - a.clicks)

  // Havi bontás: a szám monoton nő, ezért a delta a beszédes.
  const months = new Map<string, { clicks: Set<string>; added: Set<string> }>()
  const touchMonth = (key: string) => {
    let entry = months.get(key)
    if (!entry) {
      entry = { clicks: new Set(), added: new Set() }
      months.set(key, entry)
    }
    return entry
  }
  for (const row of clicks) {
    touchMonth(monthKey(row.created_at)).clicks.add(row.session_id)
  }
  for (const row of successRows) {
    touchMonth(monthKey(row.created_at)).added.add(row.session_id)
  }

  const byMonth: MonthRow[] = [...months.entries()]
    .map(([month, entry]) => ({
      month,
      clicks: entry.clicks.size,
      added: entry.added.size,
    }))
    .sort((a, b) => (a.month < b.month ? 1 : -1))

  const successPerSession = new Map<string, number>()
  for (const row of successRows) {
    successPerSession.set(
      row.session_id,
      (successPerSession.get(row.session_id) ?? 0) + 1
    )
  }

  return {
    totalEvents: clicks.length + results.length + dismisses.length,
    clickSessions: clickSessions.size,
    sdkClickSessions: sdkClickSessions.size,
    deeplinkSessions: deeplinkSessions.size,
    deeplinkShare: ratio(deeplinkSessions.size, clickSessions.size),
    successSessions: successSessions.size,
    addedSessions: addedSessions.size,
    // Csak az sdk-ágra értelmes: a deeplink-ágról soha nem jön result.
    completionRate: ratio(addedSessions.size, sdkClickSessions.size),
    dismissSessions: sessionsOf(dismisses).size,
    byStatus,
    bySlug,
    byMonth,
    ineligibleEvents: statusEvents.get(PREFERRED_SOURCE_ALARM_STATUS) ?? 0,
    sessionsWithRepeatedSuccess: [...successPerSession.values()].filter(
      (count) => count > 1
    ).length,
  }
}
