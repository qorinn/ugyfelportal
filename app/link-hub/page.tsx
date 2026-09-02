import Link from "next/link"
import { connection } from "next/server"
import {
  RiFileList3Line,
  RiHomeOfficeLine,
  RiLogoutBoxRLine,
} from "@remixicon/react"

import { buildLinkHubAnalytics } from "@/lib/link-hub-analytics"
import {
  analyticsPeriodLabel,
  DETAIL_PERIODS,
  loadLinkHubEvents,
  loadLinkHubLinks,
  parseAnalyticsPeriod,
} from "@/lib/analytics-data"
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

const numberFormat = new Intl.NumberFormat("hu-HU")
const percentFormat = new Intl.NumberFormat("hu-HU", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
const dateFormat = new Intl.DateTimeFormat("hu-HU", {
  dateStyle: "medium",
  timeZone: "Europe/Budapest",
})
const dateTimeFormat = new Intl.DateTimeFormat("hu-HU", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: "Europe/Budapest",
})

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

export default async function LinkHubAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string | string[] }>
}) {
  await connection()
  const days = parseAnalyticsPeriod((await searchParams).days)
  let analytics: ReturnType<typeof buildLinkHubAnalytics> | null = null
  let loadError: string | null = null

  try {
    const now = new Date()
    const [{ events, since }, links] = await Promise.all([
      loadLinkHubEvents(days, now),
      loadLinkHubLinks(),
    ])
    analytics = buildLinkHubAnalytics(events, links, {
      startAt:
        since ?? (events[0] ? new Date(events[0].created_at) : undefined),
      endAt: now,
    })
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Developer Link Hub</p>
          <h1 className="text-lg font-medium">Analitika</h1>
          <p className="text-sm text-muted-foreground">
            {analyticsPeriodLabel(days)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/cms" />}
          >
            <RiFileList3Line data-icon="inline-start" />
            CMS megnyitása
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/" />}
          >
            <RiHomeOfficeLine data-icon="inline-start" />
            Központi analitika
          </Button>
          <nav className="flex flex-wrap gap-1" aria-label="Időszak">
            {[...DETAIL_PERIODS, "all" as const].map((period) => (
              <Button
                key={period}
                variant={period === days ? "default" : "outline"}
                nativeButton={false}
                render={<Link href={`/link-hub?days=${period}`} />}
              >
                {period === "all" ? "Összes" : `${period} nap`}
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

      {loadError ? (
        <Card>
          <CardHeader>
            <CardTitle>Nem sikerült betölteni a Link Hub analitikát</CardTitle>
            <CardDescription className="font-mono">{loadError}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Ellenőrizd a Supabase-kapcsolatot, valamint az `analytics_events` és
            `links` táblák elérhetőségét.
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
              description="Összes Link Hub page_view esemény."
            />
            <MetricCard
              label="Egyedi munkamenetek"
              value={numberFormat.format(analytics.viewSessions)}
              description="Page_view eseménnyel rendelkező sessionök."
            />
            <MetricCard
              label="Kattintások"
              value={numberFormat.format(analytics.clicks)}
              description="Page_view-val rendelkező munkamenetek kattintásai."
            />
            <MetricCard
              label="CTR"
              value={`${percentFormat.format(analytics.ctr)}%`}
              description="Kattintó munkamenetek / összes munkamenet."
            />
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Legnépszerűbb linkek</CardTitle>
              <CardDescription>
                Kattintások és egyedi kattintó sessionök az adott időszakban.
              </CardDescription>
              <CardAction>
                <Badge variant="outline">
                  {numberFormat.format(analytics.topLinks.length)} aktív
                  adatpont
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent>
              {analytics.topLinks.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>Még nincs mért kattintás</EmptyTitle>
                    <EmptyDescription>
                      A `/go/{"{slug}"}` átirányításon érkező első kattintás itt
                      jelenik meg.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Link</TableHead>
                      <TableHead className="text-right">Kattintás</TableHead>
                      <TableHead className="text-right">Egyedi</TableHead>
                      <TableHead className="text-right">CTR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.topLinks.map((link) => (
                      <TableRow key={link.id}>
                        <TableCell>
                          <div className="font-medium">{link.label}</div>
                          <div className="max-w-80 truncate text-xs text-muted-foreground">
                            {link.targetUrl}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {numberFormat.format(link.clicks)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {numberFormat.format(link.sessions)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {percentFormat.format(link.ctr)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <section className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Forgalmi források</CardTitle>
                <CardDescription>
                  Az első rögzített `utm_source` alapján, sessionönként.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.sources.length === 0 ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>Még nincs adat</EmptyTitle>
                      <EmptyDescription>
                        Az UTM-források az első látogatókkal jelennek meg.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Forrás</TableHead>
                        <TableHead className="text-right">Session</TableHead>
                        <TableHead className="text-right">Kattintás</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analytics.sources.map((source) => (
                        <TableRow key={source.source}>
                          <TableCell>{source.source}</TableCell>
                          <TableCell className="text-right font-mono">
                            {numberFormat.format(source.sessions)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {numberFormat.format(source.clicks)}
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
                <CardTitle>Napi aktivitás</CardTitle>
                <CardDescription>
                  Magyar időzóna szerinti oldalmegtekintések és kattintások.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.daily.length === 0 ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>Még nincs adat</EmptyTitle>
                      <EmptyDescription>
                        Az első oldalmegtekintés után itt napi bontás látszik.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nap</TableHead>
                        <TableHead className="text-right">
                          Megtekintés
                        </TableHead>
                        <TableHead className="text-right">Kattintás</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analytics.daily.map((day) => (
                        <TableRow key={day.date}>
                          <TableCell>
                            {dateFormat.format(
                              new Date(`${day.date}T12:00:00Z`)
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {numberFormat.format(day.pageViews)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {numberFormat.format(day.clicks)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Legutóbbi események</CardTitle>
              <CardDescription>
                Az utolsó 20 Link Hub-esemény, hibakereséshez és a mérés gyors
                ellenőrzéséhez.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.recentEvents.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>Még nincs esemény</EmptyTitle>
                    <EmptyDescription>
                      A publikus Link Hub első megnyitása után itt lesznek a
                      page_view események.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Időpont</TableHead>
                      <TableHead>Esemény</TableHead>
                      <TableHead>Link</TableHead>
                      <TableHead>UTM forrás</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.recentEvents.map((event, index) => (
                      <TableRow
                        key={`${event.created_at}-${event.session_id}-${index}`}
                      >
                        <TableCell className="font-mono text-xs whitespace-nowrap">
                          {dateTimeFormat.format(new Date(event.created_at))}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              event.event_type === "link_click"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {event.event_type === "link_click"
                              ? "Kattintás"
                              : "Oldalmegtekintés"}
                          </Badge>
                        </TableCell>
                        <TableCell>{event.label ?? "—"}</TableCell>
                        <TableCell>{event.utm_source ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </main>
  )
}
