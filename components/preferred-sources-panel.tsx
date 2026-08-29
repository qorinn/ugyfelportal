import { RiAlertLine, RiStarLine } from "@remixicon/react"

import type { PreferredSourceSummary } from "@/lib/preferred-sources"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
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
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

// A gomb szövege ígér túl sokat, vagy a Google dialógusa lassan tölt.
const LOW_COMPLETION = 0.5

function Stat({
  label,
  value,
  hint,
  tone = "normal",
}: {
  label: string
  value: string
  hint?: string
  tone?: "normal" | "strong" | "alarm"
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono",
          tone === "strong" ? "text-2xl" : "text-lg",
          tone === "alarm" ? "text-destructive" : "text-foreground"
        )}
      >
        {value}
      </span>
      {hint && (
        <span className="text-[10px] text-muted-foreground">{hint}</span>
      )}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-medium text-muted-foreground">{children}</h3>
  )
}

export function PreferredSourcesPanel({
  summary,
}: {
  summary: PreferredSourceSummary
}) {
  const lowCompletion =
    summary.sdkClickSessions > 0 && summary.completionRate < LOW_COMPLETION

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RiStarLine className="size-4" />
          Google Preferred Sources
        </CardTitle>
        <CardDescription>
          A blogcikkek lebegő gombja. A funkció domain-szintű: egy hozzáadás az
          egész paladi-web.hu-ra szól, a cikk slugja csak azt mondja meg, melyik
          tartalom hozta a kattintást.
        </CardDescription>
        <CardAction>
          <Badge variant="outline">teljes időszak</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <p className="text-[10px] text-muted-foreground">
          Ez a blokk szándékosan nem követi a fenti időszakválasztót: a
          hozzáadások száma monoton nő, ezért a halmozott érték és a havi delta
          a beszédes.
        </p>

        {summary.totalEvents === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Még nincs adat</EmptyTitle>
              <EmptyDescription>
                Egyetlen preferred_source esemény sem érkezett. Ha a gomb már
                éles, ellenőrizd a paladi-web /api/track továbbítását.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat
                label="Hozzáadások"
                value={numberFormat.format(summary.successSessions)}
                hint="munkamenet, halmozott"
                tone="strong"
              />
              <Stat
                label="Befejezési arány"
                value={
                  summary.sdkClickSessions === 0
                    ? "—"
                    : percentFormat.format(summary.completionRate)
                }
                hint="az sdk-ágon kattintókból"
                tone={lowCompletion ? "alarm" : "normal"}
              />
              <Stat
                label="Kattintás"
                value={numberFormat.format(summary.clickSessions)}
                hint={`ebből deeplink: ${numberFormat.format(summary.deeplinkSessions)}`}
              />
              <Stat
                label="Elutasítás"
                value={numberFormat.format(summary.dismissSessions)}
                hint="X-szel bezárta"
              />
            </div>

            <p className="text-[10px] text-muted-foreground">
              A kattintás és az eredmény közti rés nem hiba: megszakított Google
              dialógus, plusz a deeplink-ág, ahonnan soha nem jön visszajelzés.
              A deeplink aránya (
              {summary.clickSessions === 0
                ? "—"
                : percentFormat.format(summary.deeplinkShare)}
              ) a mérésblokkolás mértékét mutatja.
            </p>

            {summary.ineligibleEvents > 0 && (
              <p className="flex items-start gap-1.5 text-xs text-destructive">
                <RiAlertLine className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  {numberFormat.format(summary.ineligibleEvents)} „nem jogosult
                  domain” válasz érkezett. Élesben ennek nullának kell lennie —
                  ha nem fejlesztői környezetből jött, a Google levette a
                  domaint a jogosultak közül.
                </span>
              </p>
            )}

            {summary.sessionsWithRepeatedSuccess > 0 && (
              <p className="text-[10px] text-muted-foreground">
                {numberFormat.format(summary.sessionsWithRepeatedSuccess)}{" "}
                munkamenetben egynél több sikeres hozzáadás van. Ez nem
                duplikátum: a weboldal localStorage-ben jegyzi meg a sikert,
                tehát privát módú böngészés vagy tiltott tárolás okozza.
              </p>
            )}

            <Separator />

            <div className="flex flex-col gap-2">
              <SectionTitle>Havi bontás</SectionTitle>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hónap</TableHead>
                      <TableHead className="text-right">Kattintás</TableHead>
                      <TableHead className="text-right">Hozzáadás</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.byMonth.map((row) => (
                      <TableRow key={row.month}>
                        <TableCell className="font-mono">{row.month}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {numberFormat.format(row.clicks)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {numberFormat.format(row.added)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-2">
              <SectionTitle>Cikk szerint</SectionTitle>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cikk</TableHead>
                      <TableHead className="text-right">Kattintás</TableHead>
                      <TableHead className="text-right">Hozzáadás</TableHead>
                      <TableHead className="text-right">Arány</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.bySlug.map((row) => (
                      <TableRow key={row.slug}>
                        <TableCell className="font-mono text-xs">
                          {row.slug}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {numberFormat.format(row.clicks)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {numberFormat.format(row.added)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {row.clicks === 0
                            ? "—"
                            : percentFormat.format(row.rate)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {summary.byStatus.length > 0 && (
              <>
                <Separator />
                <div className="flex flex-col gap-2">
                  <SectionTitle>Google válaszai</SectionTitle>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Státusz</TableHead>
                          <TableHead className="text-right">
                            Munkamenet
                          </TableHead>
                          <TableHead className="text-right">Esemény</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summary.byStatus.map((row) => (
                          <TableRow key={row.status}>
                            <TableCell>
                              {row.label}
                              <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                                {row.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {numberFormat.format(row.sessions)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">
                              {numberFormat.format(row.events)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
