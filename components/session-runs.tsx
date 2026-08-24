import { RiCheckLine, RiCloseLine } from "@remixicon/react"

import {
  OUTCOME_SLOT_KEY,
  type RunStep,
  type SessionRun,
} from "@/lib/analytics"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

const dateTimeFormat = new Intl.DateTimeFormat("hu-HU", {
  dateStyle: "short",
  timeStyle: "medium",
})

// Másodperc egy percig, tizedesjegy tíz percig, utána kerek perc. Egy kalkulátornál
// a "42 mp" és a "2,4 p" is valódi információ, a "0 p" nem lenne az.
function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) {
    return `${seconds} mp`
  }

  const minutes = ms / 60000
  if (minutes < 10) {
    return `${minutes.toFixed(1).replace(".", ",")} p`
  }
  if (minutes < 60) {
    return `${Math.round(minutes)} p`
  }

  const hours = Math.floor(minutes / 60)
  const rest = Math.round(minutes % 60)
  return rest === 0 ? `${hours} ó` : `${hours} ó ${rest} p`
}

function Checkpoint({ step }: { step: RunStep }) {
  const title = step.at
    ? `${step.fullLabel} — ${dateTimeFormat.format(new Date(step.at))}`
    : step.status === "skipped"
      ? `${step.fullLabel} — kimaradt`
      : `${step.fullLabel} — nem jutott el idáig`

  if (step.status === "reached") {
    return (
      <span
        title={title}
        className="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground"
      >
        <RiCheckLine className="size-2.5" />
      </span>
    )
  }

  if (step.status === "skipped") {
    return (
      <span
        title={title}
        className="flex size-4 items-center justify-center rounded-full border border-destructive/40 text-destructive/70"
      >
        <RiCloseLine className="size-2.5" />
      </span>
    )
  }

  return (
    <span
      title={title}
      className="block size-4 rounded-full border border-border bg-muted"
    />
  )
}

function RunTimeline({ steps }: { steps: RunStep[] }) {
  // Oszlopok: checkpoint, szakasz, checkpoint, … Így a három sor (idő, vonal,
  // felirat) magától egymás alá kerül, nincs kézi igazítás.
  const columns = steps.flatMap((step, index) =>
    index === 0
      ? [{ kind: "step" as const, step }]
      : [
          { kind: "segment" as const, step },
          { kind: "step" as const, step },
        ]
  )

  return (
    <div className="grid grid-cols-[auto_1fr_auto_1fr_auto_1fr_auto] items-center gap-x-1.5">
      {columns.map((column, index) =>
        column.kind === "segment" ? (
          <span
            key={`time-${index}`}
            className="text-center font-mono text-[10px] text-muted-foreground"
          >
            {column.step.msFromPrevious === null
              ? ""
              : formatDuration(column.step.msFromPrevious)}
          </span>
        ) : (
          <span key={`time-${index}`} />
        )
      )}

      {columns.map((column, index) =>
        column.kind === "segment" ? (
          <span
            key={`line-${index}`}
            className={cn(
              "w-full border-t",
              column.step.status === "reached"
                ? "border-primary"
                : "border-dashed border-border"
            )}
          />
        ) : (
          <Checkpoint key={`line-${index}`} step={column.step} />
        )
      )}

      {columns.map((column, index) =>
        column.kind === "segment" ? (
          <span key={`label-${index}`} />
        ) : (
          <span
            key={`label-${index}`}
            className={cn(
              "text-center text-[10px] whitespace-nowrap",
              column.step.status === "reached" && "text-foreground",
              column.step.status === "skipped" && "text-destructive/70",
              column.step.status === "missing" && "text-muted-foreground"
            )}
          >
            {column.step.label}
          </span>
        )
      )}
    </div>
  )
}

function RunRow({ run }: { run: SessionRun }) {
  const skipped = run.steps.filter(
    (step) => step.status === "skipped" && step.key !== OUTCOME_SLOT_KEY
  )

  return (
    <div className="flex flex-col gap-2.5 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-mono text-xs text-muted-foreground">
          {dateTimeFormat.format(new Date(run.startedAt))} ·{" "}
          {run.sessionId.slice(0, 8)}
        </span>
        <div className="flex items-center gap-2">
          {run.outcomeLabel && (
            <Badge variant="secondary">{run.outcomeLabel}</Badge>
          )}
          <span className="font-mono text-xs">
            {run.totalMs === null ? (
              <span className="text-muted-foreground">Nem fejezte be</span>
            ) : (
              formatDuration(run.totalMs)
            )}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[22rem]">
          <RunTimeline steps={run.steps} />
        </div>
      </div>

      {skipped.length > 0 && (
        <p className="text-[10px] text-destructive/70">
          Kimaradt: {skipped.map((step) => step.fullLabel).join(", ")}
        </p>
      )}
    </div>
  )
}

export function SessionRuns({ runs }: { runs: SessionRun[] }) {
  return (
    <div className="flex flex-col divide-y divide-border">
      {runs.map((run) => (
        <RunRow key={run.id} run={run} />
      ))}
    </div>
  )
}
