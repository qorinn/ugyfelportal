"use client"

import { Area, AreaChart } from "@/components/charts/area-chart"
import { FunnelChart, type FunnelStage } from "@/components/charts/funnel-chart"
import { Grid } from "@/components/charts/grid"
import { ChartTooltip } from "@/components/charts/tooltip/chart-tooltip"
import { XAxis } from "@/components/charts/x-axis"
import {
  Card,
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

type Outcome = {
  label: string
  sessions: number
  conversion: number
}

type DailyPoint = {
  date: string
  visitors: number
  clicks: number
}

const numberFormat = new Intl.NumberFormat("hu-HU")
const percentFormat = new Intl.NumberFormat("hu-HU", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
})

function numericValue(point: Record<string, unknown>, key: string) {
  const candidate = point[key]
  return typeof candidate === "number" ? candidate : 0
}

export function CalculatorOverviewChart({
  funnel,
  outcomes,
}: {
  funnel: FunnelStage[]
  outcomes: Outcome[]
}) {
  const hasData = (funnel[0]?.value ?? 0) > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kalkulátor tölcsér</CardTitle>
        <CardDescription>
          Egyedi munkamenetek a három valódi lépésben. A százalék az
          indításokhoz viszonyít.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {hasData ? (
          <FunnelChart
            color="var(--chart-3)"
            data={funnel}
            edges="straight"
            formatPercentage={(value) => `${percentFormat.format(value)}%`}
            gap={2}
            grid
            labelAlign="center"
            labelLayout="grouped"
            labelOrientation="vertical"
            layers={3}
            style={{ minHeight: 240 }}
          />
        ) : (
          <Empty className="min-h-60">
            <EmptyHeader>
              <EmptyTitle>Még nincs kalkulátorindítás</EmptyTitle>
              <EmptyDescription>
                Az első kalkulátor-esemény után itt jelenik meg a tölcsér.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        <div className="grid gap-3 sm:grid-cols-2" aria-label="Kimenetek">
          {outcomes.map((outcome) => (
            <div
              className="rounded-md bg-muted/60 p-3 ring-1 ring-foreground/10"
              key={outcome.label}
            >
              <p className="text-xs text-muted-foreground">{outcome.label}</p>
              <div className="mt-1 flex items-baseline justify-between gap-3">
                <span className="font-mono text-xl font-semibold">
                  {numberFormat.format(outcome.sessions)}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {percentFormat.format(outcome.conversion)}% az e-mailekből
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function LinkHubOverviewChart({
  daily,
  ctr,
  topLink,
}: {
  daily: DailyPoint[]
  ctr: number
  topLink: { label: string; clicks: number } | null
}) {
  const hasData = daily.some((day) => day.visitors > 0 || day.clicks > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Link Hub trend</CardTitle>
        <CardDescription>
          Napi egyedi látogatók és szerveroldalon mért kattintások.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {hasData ? (
          <AreaChart
            aspectRatio="16 / 9"
            data={daily}
            margin={{ bottom: 36, left: 24, right: 24, top: 24 }}
            revealSignature={`link-hub-${daily.length}`}
          >
            <Grid horizontal hideHorizontalEdgeLines />
            <Area
              dataKey="visitors"
              fill="var(--chart-3)"
              fillOpacity={0.28}
              stroke="var(--chart-3)"
            />
            <Area
              dataKey="clicks"
              fill="var(--chart-5)"
              fillOpacity={0.12}
              stroke="var(--chart-5)"
            />
            <XAxis numTicks={5} />
            <ChartTooltip
              rows={(point) => [
                {
                  color: "var(--chart-3)",
                  label: "Egyedi látogató",
                  value: numberFormat.format(numericValue(point, "visitors")),
                },
                {
                  color: "var(--chart-5)",
                  label: "Kattintás",
                  value: numberFormat.format(numericValue(point, "clicks")),
                },
              ]}
            />
          </AreaChart>
        ) : (
          <Empty className="min-h-60">
            <EmptyHeader>
              <EmptyTitle>Még nincs Link Hub-adat</EmptyTitle>
              <EmptyDescription>
                Az első látogató vagy kattintás után itt jelenik meg a trend.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md bg-muted/60 p-3 ring-1 ring-foreground/10">
            <p className="text-xs text-muted-foreground">CTR</p>
            <p className="mt-1 font-mono text-xl font-semibold">
              {percentFormat.format(ctr)}%
            </p>
          </div>
          <div className="rounded-md bg-muted/60 p-3 ring-1 ring-foreground/10">
            <p className="text-xs text-muted-foreground">Legnépszerűbb link</p>
            <div className="mt-1 flex items-baseline justify-between gap-3">
              <span className="truncate text-sm font-medium">
                {topLink?.label ?? "Még nincs kattintás"}
              </span>
              {topLink ? (
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {numberFormat.format(topLink.clicks)} kattintás
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
