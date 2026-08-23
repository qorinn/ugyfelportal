import Link from "next/link"

import {
  buildFunnel,
  buildOutcomes,
  buildProjectTypeBreakdown,
  type AnalyticsEvent,
  type FunnelRow,
} from "@/lib/analytics"
import { APP_ID } from "@/lib/funnel"
import { supabaseAdmin } from "@/lib/supabase"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const PERIODS = [7, 30, 90] as const
const RAW_EVENT_LIMIT = 50

const numberFormat = new Intl.NumberFormat("hu-HU")
const percentFormat = new Intl.NumberFormat("hu-HU", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
const dateTimeFormat = new Intl.DateTimeFormat("hu-HU", {
  dateStyle: "short",
  timeStyle: "medium",
})

function parseDays(value: string | string[] | undefined): number {
  const candidate = Number(Array.isArray(value) ? value[0] : value)
  return PERIODS.includes(candidate as (typeof PERIODS)[number])
    ? candidate
    : 30
}

async function loadEvents(days: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  // Nyers eseményeket töltünk le és TS-ben aggregálunk: a funnel megváltoztatása
  // így egy tömb átírása, nem migráció. Napi néhány tucat eseménynél ez bőven elég.
  const { data, error } = await supabaseAdmin()
    .from("events")
    .select("session_id, name, props, created_at")
    .eq("app_id", APP_ID)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true })
    .limit(10000)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as AnalyticsEvent[]
}

function FunnelBar({ row }: { row: FunnelRow }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm">{row.label}</span>
        <span className="flex items-baseline gap-2 font-mono text-sm">
          {numberFormat.format(row.sessions)}
          {row.conversionFromPrevious !== null && (
            <Badge variant="secondary">
              {percentFormat.format(row.conversionFromPrevious)}%
            </Badge>
          )}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-sm bg-muted">
        <div
          className="h-full bg-primary"
          style={{ width: `${Math.min(row.shareOfEntry, 100)}%` }}
        />
      </div>
    </div>
  )
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ days?: string | string[] }>
}) {
  const days = parseDays((await searchParams).days)

  let events: AnalyticsEvent[] = []
  let loadError: string | null = null

  try {
    events = await loadEvents(days)
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }

  const funnel = buildFunnel(events)
  const outcomes = buildOutcomes(events, funnel.at(-1)?.sessions ?? 0)
  const breakdown = buildProjectTypeBreakdown(events)
  const rawEvents = events.slice(-RAW_EVENT_LIMIT).reverse()

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-lg font-medium">Kalkulátor-analitika</h1>
          <p className="text-sm text-muted-foreground">
            {APP_ID} · utolsó {days} nap
          </p>
        </div>
        <nav className="flex gap-1">
          {PERIODS.map((period) => (
            <Button
              key={period}
              variant={period === days ? "default" : "outline"}
              render={<Link href={`/?days=${period}`} />}
            >
              {period} nap
            </Button>
          ))}
        </nav>
      </header>

      {loadError && (
        <Card>
          <CardHeader>
            <CardTitle>Nem sikerült betölteni az eseményeket</CardTitle>
            <CardDescription className="font-mono">{loadError}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Ellenőrizd a SUPABASE_URL és SUPABASE_SERVICE_ROLE_KEY változókat,
            és hogy létrejött-e az events tábla.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Funnel</CardTitle>
          <CardDescription>
            Egyedi munkamenetek lépésenként. A százalék az előző lépéshez mért
            átmenet.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {funnel.map((row) => (
            <FunnelBar key={row.name} row={row} />
          ))}
          <Separator />
          <p className="text-xs text-muted-foreground">
            Kimenetek — egymást kizáró elágazás, mindkettő az e-mail megadásához
            mérve.
          </p>
          {outcomes.map((row) => (
            <FunnelBar key={row.name} row={row} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bontás projekttípus szerint</CardTitle>
          <CardDescription>
            A munkamenet első olyan eseményéből, amiben szerepel a projectType.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {breakdown.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Nincs adat</EmptyTitle>
                <EmptyDescription>
                  Ebben az időszakban egyetlen eseményben sem szerepelt
                  projectType.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projekttípus</TableHead>
                  <TableHead className="text-right">Indította</TableHead>
                  <TableHead className="text-right">Végigért</TableHead>
                  <TableHead className="text-right">E-mail</TableHead>
                  <TableHead className="text-right">Konverzió</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breakdown.map((row) => (
                  <TableRow key={row.projectType}>
                    <TableCell>{row.projectType}</TableCell>
                    <TableCell className="text-right font-mono">
                      {numberFormat.format(row.started)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {numberFormat.format(row.completed)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {numberFormat.format(row.emailSubmitted)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {percentFormat.format(row.conversion)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Legutóbbi események</CardTitle>
          <CardDescription>
            A legfrissebb {RAW_EVENT_LIMIT} nyers sor — indulásnál ez a
            leghasznosabb hibakereséshez.
          </CardDescription>
          <CardAction>
            <Badge variant="outline">
              {numberFormat.format(events.length)} esemény
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          {rawEvents.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Még nincs esemény</EmptyTitle>
                <EmptyDescription>
                  Ellenőrizd, hogy a paladi-web /api/track proxyja továbbít-e az
                  /api/event végpontra.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Időpont</TableHead>
                    <TableHead>Esemény</TableHead>
                    <TableHead>Munkamenet</TableHead>
                    <TableHead>Props</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rawEvents.map((event, index) => (
                    <TableRow
                      key={`${event.session_id}-${event.created_at}-${index}`}
                    >
                      <TableCell className="font-mono whitespace-nowrap">
                        {dateTimeFormat.format(new Date(event.created_at))}
                      </TableCell>
                      <TableCell className="font-mono">{event.name}</TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {event.session_id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {Object.entries(event.props ?? {})
                          .map(([key, value]) => `${key}=${String(value)}`)
                          .join(" ") || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
