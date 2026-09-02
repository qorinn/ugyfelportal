export type LinkHubEvent = {
  event_type: "page_view" | "link_click"
  link_id: string | null
  session_id: string
  utm_source: string | null
  created_at: string
}

export type LinkHubLink = {
  id: string
  label: string
  target_url: string
}

export type LinkHubAnalytics = {
  pageViews: number
  viewSessions: number
  clicks: number
  clickSessions: number
  ctr: number
  topLinks: Array<{
    id: string
    label: string
    targetUrl: string
    clicks: number
    sessions: number
    ctr: number
  }>
  sources: Array<{
    source: string
    sessions: number
    pageViews: number
    clicks: number
  }>
  daily: Array<{ date: string; pageViews: number; clicks: number }>
  recentEvents: Array<LinkHubEvent & { label: string | null }>
}

function ratio(part: number, whole: number) {
  return whole === 0 ? 0 : (part / whole) * 100
}

function localDateKey(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Budapest",
  }).format(new Date(value))
}

export function buildLinkHubAnalytics(
  events: readonly LinkHubEvent[],
  links: readonly LinkHubLink[]
): LinkHubAnalytics {
  const linksById = new Map(links.map((link) => [link.id, link]))
  const viewSessions = new Set<string>()
  const clickSessions = new Set<string>()
  const byLink = new Map<string, { clicks: number; sessions: Set<string> }>()
  const sourceBySession = new Map<string, string>()
  const daily = new Map<string, { pageViews: number; clicks: number }>()

  let pageViews = 0
  let clicks = 0

  for (const event of events) {
    const day = localDateKey(event.created_at)
    const dayCounter = daily.get(day) ?? { pageViews: 0, clicks: 0 }

    if (event.utm_source && !sourceBySession.has(event.session_id)) {
      sourceBySession.set(event.session_id, event.utm_source)
    }

    if (event.event_type === "page_view") {
      pageViews += 1
      viewSessions.add(event.session_id)
      dayCounter.pageViews += 1
    }

    if (event.event_type === "link_click") {
      clicks += 1
      clickSessions.add(event.session_id)
      dayCounter.clicks += 1

      if (event.link_id) {
        const counter = byLink.get(event.link_id) ?? {
          clicks: 0,
          sessions: new Set<string>(),
        }
        counter.clicks += 1
        counter.sessions.add(event.session_id)
        byLink.set(event.link_id, counter)
      }
    }

    daily.set(day, dayCounter)
  }

  const sources = new Map<
    string,
    { sessions: Set<string>; pageViews: number; clicks: number }
  >()
  for (const event of events) {
    const source =
      sourceBySession.get(event.session_id) ?? "Közvetlen / ismeretlen"
    const counter = sources.get(source) ?? {
      sessions: new Set<string>(),
      pageViews: 0,
      clicks: 0,
    }
    counter.sessions.add(event.session_id)
    if (event.event_type === "page_view") counter.pageViews += 1
    if (event.event_type === "link_click") counter.clicks += 1
    sources.set(source, counter)
  }

  return {
    pageViews,
    viewSessions: viewSessions.size,
    clicks,
    clickSessions: clickSessions.size,
    ctr: ratio(clickSessions.size, viewSessions.size),
    topLinks: [...byLink.entries()]
      .map(([id, counter]) => {
        const link = linksById.get(id)
        return {
          id,
          label: link?.label ?? "Törölt link",
          targetUrl: link?.target_url ?? "—",
          clicks: counter.clicks,
          sessions: counter.sessions.size,
          ctr: ratio(counter.sessions.size, viewSessions.size),
        }
      })
      .sort(
        (a, b) => b.clicks - a.clicks || a.label.localeCompare(b.label, "hu")
      ),
    sources: [...sources.entries()]
      .map(([source, counter]) => ({
        source,
        sessions: counter.sessions.size,
        pageViews: counter.pageViews,
        clicks: counter.clicks,
      }))
      .sort(
        (a, b) =>
          b.sessions - a.sessions || a.source.localeCompare(b.source, "hu")
      ),
    daily: [...daily.entries()]
      .map(([date, counter]) => ({ date, ...counter }))
      .sort((a, b) => b.date.localeCompare(a.date)),
    recentEvents: events
      .slice(-20)
      .reverse()
      .map((event) => ({
        ...event,
        label: event.link_id
          ? (linksById.get(event.link_id)?.label ?? "Törölt link")
          : null,
      })),
  }
}
