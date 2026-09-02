import Link from "next/link"
import { connection } from "next/server"
import {
  RiAlarmWarningLine,
  RiBarChartBoxLine,
  RiLinksLine,
  RiLogoutBoxRLine,
} from "@remixicon/react"

import {
  CalculatorOverviewChart,
  LinkHubOverviewChart,
} from "@/components/overview-charts"
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
import { buildFunnel, buildOutcomes } from "@/lib/analytics"
import {
  analyticsPeriodLabel,
  loadCalculatorEvents,
  loadLinkHubEvents,
  loadLinkHubLinks,
  parseAnalyticsPeriod,
  SUMMARY_PERIODS,
} from "@/lib/analytics-data"
import { buildErrorSummary } from "@/lib/errors"
import { CALCULATOR_FUNNEL } from "@/lib/funnel"
import { buildLinkHubAnalytics } from "@/lib/link-hub-analytics"

const numberFormat = new Intl.NumberFormat("hu-HU")
const percentFormat = new Intl.NumberFormat("hu-HU", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
})

function errorMessage(result: PromiseRejectedResult) {
  return result.reason instanceof Error
    ? result.reason.message
    : String(result.reason)
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

function SourceError({ source, message }: { source: string; message: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nem sikerült betölteni: {source}</CardTitle>
        <CardDescription className="font-mono">{message}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        A másik termékterület adatai ettől függetlenül továbbra is láthatók.
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
  const period = parseAnalyticsPeriod(
    (await searchParams).period,
    SUMMARY_PERIODS
  )
  const now = new Date()

  const [calculatorResult, linkHubResult] = await Promise.allSettled([
    loadCalculatorEvents(period, now),
    Promise.all([loadLinkHubEvents(period, now), loadLinkHubLinks()]),
  ])

  const calculatorEvents =
    calculatorResult.status === "fulfilled"
      ? calculatorResult.value.events
      : null
  const funnel = calculatorEvents ? buildFunnel(calculatorEvents) : null
  const outcomes = calculatorEvents
    ? buildOutcomes(calculatorEvents, funnel?.at(-1)?.sessions ?? 0)
    : null
  const errors = calculatorEvents
    ? buildErrorSummary(calculatorEvents, CALCULATOR_FUNNEL[0].name, 10)
    : null

  const linkHubAnalytics = (() => {
    if (linkHubResult.status !== "fulfilled") return null
    const [{ events, since }, links] = linkHubResult.value
    return buildLinkHubAnalytics(events, links, {
      startAt:
        since ?? (events[0] ? new Date(events[0].created_at) : undefined),
      endAt: now,
    })
  })()

  const starts = funnel?.[0]?.sessions ?? null
  const emailLeads = funnel?.at(-1)?.sessions ?? null
  const leadConversion = funnel?.at(-1)?.shareOfEntry ?? null
  const detailPeriod = String(period)

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Ügyfélportál</p>
          <h1 className="text-lg font-medium">Központi analitika</h1>
          <p className="text-sm text-muted-foreground">
            {analyticsPeriodLabel(period)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/calculator?days=${detailPeriod}`} />}
          >
            <RiBarChartBoxLine data-icon="inline-start" />
            Kalkulátor részletek
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/link-hub?days=${detailPeriod}`} />}
          >
            <RiLinksLine data-icon="inline-start" />
            Link Hub részletek
          </Button>
          <nav className="flex flex-wrap gap-1" aria-label="Időszak">
            {[...SUMMARY_PERIODS, "all" as const].map((candidate) => (
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
          <Separator orientation="vertical" className="hidden h-6 sm:block" />
          <form method="post" action="/api/logout">
            <Button type="submit" variant="ghost">
              <RiLogoutBoxRLine data-icon="inline-start" />
              Kijelentkezés
            </Button>
          </form>
        </div>
      </header>

      <section
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Fő mutatók"
      >
        <MetricCard
          label="Link Hub munkamenetek"
          value={
            linkHubAnalytics
              ? numberFormat.format(linkHubAnalytics.viewSessions)
              : "—"
          }
          description="Page_view eseménnyel rendelkező sessionök."
        />
        <MetricCard
          label="Linkkattintások"
          value={
            linkHubAnalytics
              ? numberFormat.format(linkHubAnalytics.clicks)
              : "—"
          }
          description={
            linkHubAnalytics
              ? `${percentFormat.format(linkHubAnalytics.ctr)}% CTR`
              : "A Link Hub-adatforrás nem elérhető."
          }
        />
        <MetricCard
          label="Kalkulátorindítások"
          value={starts === null ? "—" : numberFormat.format(starts)}
          description="Egyedi munkamenetek az indítási esemény alapján."
        />
        <MetricCard
          label="E-mailes leadek"
          value={emailLeads === null ? "—" : numberFormat.format(emailLeads)}
          description={
            leadConversion === null
              ? "A kalkulátor-adatforrás nem elérhető."
              : `${percentFormat.format(leadConversion)}% indítás → lead konverzió`
          }
        />
      </section>

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="secondary">{analyticsPeriodLabel(period)}</Badge>
        <span>A nullás napok is szerepelnek a Link Hub trendben.</span>
      </div>

      {errors &&
      (errors.errorSessions > 0 || errors.manualFollowups.length > 0) ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RiAlarmWarningLine className="size-4 text-destructive" />
              Figyelmet igényel
            </CardTitle>
            <CardDescription>
              {numberFormat.format(errors.errorSessions)} hibás munkamenet
              {errors.manualFollowups.length > 0
                ? ` · ${numberFormat.format(errors.manualFollowups.length)} kézi utánkövetés`
                : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href={`/calculator?days=${detailPeriod}`} />}
            >
              Részletek megnyitása
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <section
        className="grid gap-6 lg:grid-cols-2"
        aria-label="Áttekintő grafikonok"
      >
        {funnel && outcomes ? (
          <CalculatorOverviewChart
            funnel={funnel.map((row, index) => ({
              label: CALCULATOR_FUNNEL[index].short,
              value: row.sessions,
              displayValue: numberFormat.format(row.sessions),
            }))}
            outcomes={outcomes.map((row) => ({
              label: row.label,
              sessions: row.sessions,
              conversion: row.conversionFromPrevious ?? 0,
            }))}
          />
        ) : calculatorResult.status === "rejected" ? (
          <SourceError
            source="Kalkulátor"
            message={errorMessage(calculatorResult)}
          />
        ) : null}

        {linkHubAnalytics ? (
          <LinkHubOverviewChart
            ctr={linkHubAnalytics.ctr}
            daily={[...linkHubAnalytics.daily].reverse().map((day) => ({
              date: day.date,
              visitors: day.visitors,
              clicks: day.clicks,
            }))}
            topLink={linkHubAnalytics.topLinks[0] ?? null}
          />
        ) : linkHubResult.status === "rejected" ? (
          <SourceError
            source="Link Hub"
            message={errorMessage(linkHubResult)}
          />
        ) : null}
      </section>
    </main>
  )
}
