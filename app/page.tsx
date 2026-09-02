import Link from "next/link"
import { connection } from "next/server"
import {
  RiBarChartBoxLine,
  RiFileList3Line,
  RiLogoutBoxRLine,
} from "@remixicon/react"

import { LinkHubTrendCharts } from "@/components/link-hub-trend-charts"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  buildLinkHubAnalytics,
  type LinkHubEvent,
} from "@/lib/link-hub-analytics"
import { supabaseAdmin } from "@/lib/supabase"

const PERIODS = [30, 60, 90, 180] as const
const PAGE_SIZE = 1_000
const numberFormat = new Intl.NumberFormat("hu-HU")
const percentFormat = new Intl.NumberFormat("hu-HU", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
})

type Period = (typeof PERIODS)[number] | "all"

function parsePeriod(value: string | string[] | undefined): Period {
  const candidate = Array.isArray(value) ? value[0] : value
  if (candidate === "all") return "all"

  const days = Number(candidate)
  return PERIODS.includes(days as (typeof PERIODS)[number])
    ? (days as Exclude<Period, "all">)
    : 30
}

function periodLabel(period: Period) {
  return period === "all" ? "Teljes időszak" : `Utolsó ${period} nap`
}

async function loadEvents(period: Period, now: Date) {
  const since =
    period === "all"
      ? null
      : new Date(now.getTime() - period * 24 * 60 * 60 * 1000)
  const events: LinkHubEvent[] = []
  let offset = 0

  while (true) {
    let query = supabaseAdmin()
      .from("analytics_events")
      .select("id, event_type, link_id, session_id, utm_source, created_at")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (since) query = query.gte("created_at", since.toISOString())

    const { data, error } = await query
    if (error) throw new Error(error.message)

    const batch = (data ?? []) as LinkHubEvent[]
    events.push(...batch)
    if (batch.length < PAGE_SIZE) return { events, since }

    offset += batch.length
  }
}

function MetricCard({
  label,
  value,
  description,
}: {
  label: string
  value: string
  description: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-mono text-2xl font-semibold tracking-tight">
          {value}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string | string[] }>
}) {
  await connection()
  const period = parsePeriod((await searchParams).period)
  const now = new Date()
  let analytics: ReturnType<typeof buildLinkHubAnalytics> | null = null
  let loadError: string | null = null

  try {
    const { events, since } = await loadEvents(period, now)
    analytics = buildLinkHubAnalytics(events, [], {
      startAt:
        since ?? (events[0] ? new Date(events[0].created_at) : undefined),
      endAt: now,
    })
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Developer Link Hub</p>
          <h1 className="text-lg font-medium">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{periodLabel(period)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/link-hub" />}
          >
            <RiBarChartBoxLine data-icon="inline-start" />
            Részletes analitika
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/cms" />}
          >
            <RiFileList3Line data-icon="inline-start" />
            CMS megnyitása
          </Button>
          <nav className="flex flex-wrap gap-1" aria-label="Időszak">
            {[...PERIODS, "all" as const].map((candidate) => (
              <Button
                key={candidate}
                variant={candidate === period ? "default" : "outline"}
                nativeButton={false}
                render={<Link href={`/?period=${candidate}`} />}
              >
                {candidate === "all" ? "Összes" : `${candidate} nap`}
              </Button>
            ))}
          </nav>
          <Separator orientation="vertical" className="h-6" />
          <form method="post" action="/api/logout">
            <Button type="submit" variant="ghost">
              <RiLogoutBoxRLine data-icon="inline-start" />
              Kijelentkezés
            </Button>
          </form>
        </div>
      </header>

      {loadError ? (
        <Card>
          <CardHeader>
            <CardTitle>Nem sikerült betölteni a Link Hub adatokat</CardTitle>
            <CardDescription className="font-mono">{loadError}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Ellenőrizd a Supabase-kapcsolatot és az `analytics_events` tábla
            elérhetőségét.
          </CardContent>
        </Card>
      ) : analytics ? (
        <>
          <section
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            aria-label="Fő mutatók"
          >
            <MetricCard
              label="Oldalmegtekintések"
              value={numberFormat.format(analytics.pageViews)}
              description="Összes mért Link Hub page_view esemény."
            />
            <MetricCard
              label="Egyedi látogatók"
              value={numberFormat.format(analytics.viewSessions)}
              description="Page_view események egyedi sessionjei."
            />
            <MetricCard
              label="Kattintások"
              value={numberFormat.format(analytics.clicks)}
              description="Szerveroldalon rögzített link_click események."
            />
            <MetricCard
              label="CTR"
              value={`${percentFormat.format(analytics.ctr)}%`}
              description="Egyedi kattintók / egyedi látogatók."
            />
          </section>

          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{periodLabel(period)}</Badge>
            <span>
              Az esemény nélküli napok is 0 értékkel szerepelnek a trendben.
            </span>
          </div>

          <LinkHubTrendCharts daily={[...analytics.daily].reverse()} />
        </>
      ) : null}
    </main>
  )
}
