"use client"

import { Area, AreaChart } from "@/components/charts/area-chart"
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

type DailyPoint = {
  date: string
  pageViews: number
  visitors: number
  clicks: number
  clickSessions: number
  ctr: number
}

const numberFormat = new Intl.NumberFormat("hu-HU")
const percentFormat = new Intl.NumberFormat("hu-HU", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
})

function value(point: Record<string, unknown>, key: string) {
  const candidate = point[key]
  return typeof candidate === "number" ? candidate : 0
}

function ChartFrame({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function LinkHubTrendCharts({ daily }: { daily: DailyPoint[] }) {
  return (
    <section
      className="grid gap-6 lg:grid-cols-2"
      aria-label="Link Hub trendek"
    >
      <ChartFrame
        title="Forgalom"
        description="Napi oldalmegtekintések és egyedi látogatók."
      >
        <AreaChart
          data={daily}
          aspectRatio="16 / 9"
          margin={{ bottom: 36, left: 24, right: 24, top: 24 }}
          revealSignature={`traffic-${daily.length}`}
        >
          <Grid horizontal hideHorizontalEdgeLines />
          <Area
            dataKey="pageViews"
            fill="var(--chart-2)"
            fillOpacity={0.35}
            stroke="var(--chart-2)"
          />
          <Area
            dataKey="visitors"
            fill="var(--chart-3)"
            fillOpacity={0.16}
            stroke="var(--chart-3)"
          />
          <XAxis numTicks={5} />
          <ChartTooltip
            rows={(point) => [
              {
                color: "var(--chart-2)",
                label: "Megtekintés",
                value: numberFormat.format(value(point, "pageViews")),
              },
              {
                color: "var(--chart-3)",
                label: "Egyedi látogató",
                value: numberFormat.format(value(point, "visitors")),
              },
            ]}
          />
        </AreaChart>
      </ChartFrame>

      <ChartFrame
        title="Linkteljesítmény"
        description="Napi kattintások és egyedi kattintó látogatók."
      >
        <AreaChart
          data={daily}
          aspectRatio="16 / 9"
          margin={{ bottom: 36, left: 24, right: 24, top: 24 }}
          revealSignature={`clicks-${daily.length}`}
        >
          <Grid horizontal hideHorizontalEdgeLines />
          <Area
            dataKey="clicks"
            fill="var(--chart-4)"
            fillOpacity={0.35}
            stroke="var(--chart-4)"
          />
          <Area
            dataKey="clickSessions"
            fill="var(--chart-5)"
            fillOpacity={0.16}
            stroke="var(--chart-5)"
          />
          <XAxis numTicks={5} />
          <ChartTooltip
            rows={(point) => [
              {
                color: "var(--chart-4)",
                label: "Kattintás",
                value: numberFormat.format(value(point, "clicks")),
              },
              {
                color: "var(--chart-5)",
                label: "Egyedi kattintó",
                value: numberFormat.format(value(point, "clickSessions")),
              },
            ]}
          />
        </AreaChart>
      </ChartFrame>

      <ChartFrame
        title="Napi CTR"
        description="Egyedi kattintó látogatók aránya az egyedi látogatókhoz képest."
      >
        <AreaChart
          data={daily}
          aspectRatio="16 / 9"
          margin={{ bottom: 36, left: 24, right: 24, top: 24 }}
          revealSignature={`ctr-${daily.length}`}
        >
          <Grid horizontal hideHorizontalEdgeLines />
          <Area
            dataKey="ctr"
            fill="var(--chart-2)"
            fillOpacity={0.3}
            stroke="var(--chart-2)"
          />
          <XAxis numTicks={5} />
          <ChartTooltip
            rows={(point) => [
              {
                color: "var(--chart-2)",
                label: "CTR",
                value: `${percentFormat.format(value(point, "ctr"))}%`,
              },
            ]}
          />
        </AreaChart>
      </ChartFrame>
    </section>
  )
}
