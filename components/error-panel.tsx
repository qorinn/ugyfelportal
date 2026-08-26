import { RiAlertLine, RiMailCloseLine } from "@remixicon/react"

import type { CalculatorError, ErrorSummary } from "@/lib/errors"
import { gmailComposeUrl, type DisplayLead } from "@/lib/leads"
import { cn } from "@/lib/utils"
import { FollowupButton } from "@/components/followup-button"
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
const dateTimeFormat = new Intl.DateTimeFormat("hu-HU", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: "Europe/Budapest",
})

// A spec küszöbe: 5% fölött valami tényleg romlik.
const ALARM_RATE = 0.05

function Stat({
  label,
  value,
  hint,
  emphasis = false,
}: {
  label: string
  value: string
  hint?: string
  emphasis?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono text-lg",
          emphasis ? "text-destructive" : "text-foreground"
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

export function ErrorPanel({ summary }: { summary: ErrorSummary }) {
  const alarming = summary.errorRate >= ALARM_RATE

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hibák</CardTitle>
        <CardDescription>
          Munkamenetekben számolva, nem eseményekben — egy elhasalt kérés a
          kliensről és a szerverről is jelentkezik, ugyanazzal az azonosítóval.
        </CardDescription>
        <CardAction>
          <Badge variant={alarming ? "destructive" : "outline"}>
            {percentFormat.format(summary.errorRate)}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat
            label="Hibás munkamenet"
            value={`${numberFormat.format(summary.errorSessions)} / ${numberFormat.format(summary.startedSessions)}`}
            hint="az indításokból"
            emphasis={alarming}
          />
          <Stat
            label="Elakadt látogató"
            value={numberFormat.format(summary.fatalSessions)}
            hint="fatal: true"
            emphasis={summary.fatalSessions > 0}
          />
          <Stat
            label="Kliens / szerver"
            value={`${numberFormat.format(summary.clientEvents)} / ${numberFormat.format(summary.serverEvents)}`}
            hint="esemény, nem munkamenet"
          />
          <Stat
            label="Összes hibaesemény"
            value={numberFormat.format(summary.totalEvents)}
            hint="alsó becslés"
          />
        </div>

        <p className="text-[10px] text-muted-foreground">
          A kliensoldali hibák munkamenetenként legfeljebb ötször mennek ki,
          ezért az eseményszám alsó becslés. A hibás munkamenetek aránya viszont
          pontos.
        </p>

        {summary.byStageStatus.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Nincs hiba</EmptyTitle>
              <EmptyDescription>
                Ebben az időszakban egyetlen calculator_error sem érkezett.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hibatípus</TableHead>
                  <TableHead>Státusz</TableHead>
                  <TableHead className="text-right">Munkamenet</TableHead>
                  <TableHead className="text-right">Esemény</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.byStageStatus.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell>
                      {row.label}
                      <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                        {row.stage}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono">{row.status}</TableCell>
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
        )}
      </CardContent>
    </Card>
  )
}

export function ManualFollowupPanel({
  summary,
  leads,
}: {
  summary: ErrorSummary
  leads: Map<string, DisplayLead>
}) {
  if (summary.manualFollowups.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RiMailCloseLine className="size-4 text-destructive" />
          Teendő: elmaradt ajánlatlevelek
        </CardTitle>
        <CardDescription>
          Ezek a látogatók sikeresnek látták a kérésüket, és várnak egy levelet,
          ami nem ment ki. Ez az egyetlen hibatípus, ami kézi utánküldést
          igényel.
        </CardDescription>
        <CardAction>
          <Badge variant="destructive">
            {numberFormat.format(summary.manualFollowups.length)}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border">
        {summary.manualFollowups.map((row) => {
          const lead = leads.get(row.sessionId) ?? null
          const identity =
            lead?.name?.trim() ||
            lead?.email?.trim() ||
            row.sessionId.slice(0, 8)

          return (
            <div
              key={row.sessionId}
              className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium" title={row.sessionId}>
                  {identity}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {dateTimeFormat.format(new Date(row.at))}
                </span>
              </div>
              {lead?.email ? (
                <div className="flex items-center gap-2">
                  {lead.followed_up_at && (
                    <span className="text-[10px] text-muted-foreground">
                      Elintézve
                    </span>
                  )}
                  <FollowupButton
                    sessionId={lead.session_id}
                    gmailUrl={gmailComposeUrl(lead)}
                    followedUp={lead.followed_up_at !== null}
                  />
                </div>
              ) : (
                <span className="text-[10px] text-muted-foreground">
                  Nincs mentett lead ehhez a munkamenethez — nem tudjuk, kinek
                  kellene utánaküldeni.
                </span>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function ErrorRow({ error }: { error: CalculatorError }) {
  return (
    <TableRow>
      <TableCell className="font-mono whitespace-nowrap">
        {dateTimeFormat.format(new Date(error.createdAt))}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          {error.fatal && (
            <RiAlertLine
              className="size-3 shrink-0 text-destructive"
              aria-label="Elakadt a látogató"
            />
          )}
          <span className="font-mono text-xs">{error.stage}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {error.source}
        </span>
      </TableCell>
      <TableCell className="font-mono">{error.status ?? "—"}</TableCell>
      <TableCell>
        {/* A message szabad szöveg egy nyilvános végpontról. A React alapból
            escape-eli, ezért nem használunk dangerouslySetInnerHTML-t. */}
        <span className="text-xs">{error.message || "—"}</span>
        {error.extras.length > 0 && (
          <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
            {error.extras.map((extra) => (
              <div key={extra.key} className="truncate">
                {extra.key}: {extra.value}
              </div>
            ))}
          </div>
        )}
        {error.truncated && (
          <span className="text-[10px] text-muted-foreground">
            (a props túllépte a méretkorlátot, csonkolva)
          </span>
        )}
      </TableCell>
      <TableCell className="font-mono text-muted-foreground">
        {error.sessionId.slice(0, 8)}
      </TableCell>
    </TableRow>
  )
}

export function RecentErrors({
  summary,
  limit,
}: {
  summary: ErrorSummary
  limit: number
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Legutóbbi hibák</CardTitle>
        <CardDescription>
          A legfrissebb {limit} nyers hibaesemény — indulásnál ez a
          leghasznosabb hibakereséshez.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {summary.recent.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Nincs hiba</EmptyTitle>
              <EmptyDescription>
                Ebben az időszakban nem érkezett hibaesemény.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Időpont</TableHead>
                  <TableHead>Típus</TableHead>
                  <TableHead>Státusz</TableHead>
                  <TableHead>Üzenet</TableHead>
                  <TableHead>Munkamenet</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.recent.map((error, index) => (
                  <ErrorRow
                    key={`${error.sessionId}-${error.createdAt}-${index}`}
                    error={error}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
