import { RiCheckLine, RiCloseLine, RiPhoneLine } from "@remixicon/react"

import {
  OUTCOME_SLOT_KEY,
  type RunStep,
  type SessionRun,
} from "@/lib/analytics"
import { CALCULATOR_FUNNEL } from "@/lib/funnel"
import type { ErrorSummary } from "@/lib/errors"
import { gmailComposeUrl, type DisplayLead } from "@/lib/leads"
import { cn } from "@/lib/utils"
import { DeleteSessionButton } from "@/components/delete-session-button"
import { FollowupButton } from "@/components/followup-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const EMAIL_STEP_KEY = CALCULATOR_FUNNEL[2].name
const CALLBACK_OUTCOME = "calculator_callback_requested"

// A Supabase UTC-ben tárol és a Vercel is UTC-ben fut — időzóna nélkül nyáron
// két órával korábbi időpont jelenne meg.
const dateTimeFormat = new Intl.DateTimeFormat("hu-HU", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: "Europe/Budapest",
})

const dateFormat = new Intl.DateTimeFormat("hu-HU", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Budapest",
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
        className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
      >
        <RiCheckLine className="size-3" />
      </span>
    )
  }

  if (step.status === "skipped") {
    return (
      <span
        title={title}
        className="flex size-5 items-center justify-center rounded-full border border-destructive/40 text-destructive/70"
      >
        <RiCloseLine className="size-3" />
      </span>
    )
  }

  return (
    <span
      title={title}
      className="block size-5 rounded-full border border-border bg-muted"
    />
  )
}

// Egy igen/nem jelzés a checkpoint alatt.
function Flag({
  ok,
  label,
  title,
}: {
  ok: boolean
  label: string
  title?: string
}) {
  const Icon = ok ? RiCheckLine : RiCloseLine

  return (
    <span
      title={title}
      className={cn(
        "flex items-center justify-center gap-1 text-center text-[10px] leading-tight",
        ok ? "text-foreground" : "text-muted-foreground"
      )}
    >
      <Icon className="size-2.5 shrink-0" />
      {label}
    </span>
  )
}

function StepAnnotations({ step, run }: { step: RunStep; run: SessionRun }) {
  if (step.key === OUTCOME_SLOT_KEY && run.outcomes.length > 0) {
    return (
      <>
        {run.outcomes.map((outcome) => (
          <Flag
            key={outcome.name}
            ok
            label={outcome.label}
            title={dateTimeFormat.format(new Date(outcome.at))}
          />
        ))}
      </>
    )
  }

  return null
}

function RunTimeline({ run }: { run: SessionRun }) {
  // Oszlopok: checkpoint, szakasz, checkpoint, … Minden sor ugyanezt a hét
  // oszlopot tölti ki, így az idő, a pont, a felirat és a jelzések magától
  // egymás alá kerülnek, kézi igazítás nélkül.
  const columns = run.steps.flatMap((step, index) =>
    index === 0
      ? [{ kind: "step" as const, step }]
      : [
          { kind: "segment" as const, step },
          { kind: "step" as const, step },
        ]
  )

  return (
    <div className="grid grid-cols-[auto_1fr_auto_1fr_auto_1fr_auto] items-center gap-x-2 gap-y-2.5">
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
              "text-center text-[11px] whitespace-nowrap",
              column.step.status === "reached" && "text-foreground",
              column.step.status === "skipped" && "text-destructive/70",
              column.step.status === "missing" && "text-muted-foreground"
            )}
          >
            {column.step.label}
          </span>
        )
      )}

      {columns.map((column, index) =>
        column.kind === "segment" ? (
          <span key={`flags-${index}`} />
        ) : (
          <span
            key={`flags-${index}`}
            className="mx-auto flex max-w-[7.5rem] flex-col items-center gap-1 self-start"
          >
            <StepAnnotations step={column.step} run={run} />
          </span>
        )
      )}
    </div>
  )
}

// A hiba a munkamenethez tartozik, nem a futáshoz — a jelzés ezért a sor
// egészére vonatkozik, és a legsúlyosabb esetet mutatja.
function errorBadge(sessionId: string, errors: ErrorSummary) {
  if (errors.manualFollowupSessions.has(sessionId)) {
    return { label: "Levél nem ment ki", variant: "destructive" as const }
  }
  if (errors.fatalSessionIds.has(sessionId)) {
    return { label: "Elakadt", variant: "destructive" as const }
  }
  if (errors.sessionsWithError.has(sessionId)) {
    return { label: "Hiba", variant: "outline" as const }
  }
  return null
}

function RunRow({
  run,
  lead,
  runCount,
  errors,
}: {
  run: SessionRun
  lead: DisplayLead | null
  runCount: number
  errors: ErrorSummary
}) {
  const error = errorBadge(run.sessionId, errors)
  // Név, ha van; különben e-mail; végül a munkamenet-azonosító eleje.
  const identity =
    lead?.name?.trim() || lead?.email?.trim() || run.sessionId.slice(0, 8)

  const skipped = run.steps.filter(
    (step) => step.status === "skipped" && step.key !== OUTCOME_SLOT_KEY
  )

  const wantsCallback = run.outcomes.some(
    (outcome) => outcome.name === CALLBACK_OUTCOME
  )

  // Az ársávot csak arra a futásra írjuk ki, amelyik tényleg eljutott a
  // becslésig. A lead a munkamenethez tartozik, nem a futáshoz — enélkül egy
  // korábbi, félbehagyott nekifutás alatt is ott lenne az ár.
  const reachedEstimate = run.steps.some(
    (step) => step.key === EMAIL_STEP_KEY && step.status === "reached"
  )
  const estimate =
    reachedEstimate && lead?.estimate_low && lead?.estimate_high
      ? `${lead.estimate_low} – ${lead.estimate_high}`
      : null

  return (
    <div className="flex flex-col gap-4 py-6 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-medium" title={run.sessionId}>
            {identity}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {dateTimeFormat.format(new Date(run.startedAt))}
          </span>
          {estimate && (
            <span
              className="font-mono text-xs"
              title={
                lead?.duration_label
                  ? `Becsült határidő: ${lead.duration_label}`
                  : undefined
              }
            >
              {estimate}
              {lead?.duration_label && (
                <span className="text-muted-foreground">
                  {" · "}
                  {lead.duration_label}
                </span>
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {error && <Badge variant={error.variant}>{error.label}</Badge>}
          {run.outcomes.map((outcome) => (
            <Badge key={outcome.name} variant="secondary">
              {outcome.label}
            </Badge>
          ))}
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
        <div className="min-w-[34rem] pb-1">
          <RunTimeline run={run} />
        </div>
      </div>

      {skipped.length > 0 && (
        <p className="text-[10px] text-destructive/70">
          Kimaradt: {skipped.map((step) => step.fullLabel).join(", ")}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {lead?.email && (
          <FollowupButton
            sessionId={lead.session_id}
            gmailUrl={gmailComposeUrl(lead)}
            followedUp={lead.followed_up_at !== null}
          />
        )}
        {wantsCallback && lead?.phone && (
          <Button
            size="xs"
            variant="outline"
            nativeButton={false}
            render={<a href={`tel:${lead.phone.replace(/\s/g, "")}`} />}
          >
            <RiPhoneLine data-icon="inline-start" />
            {lead.phone}
          </Button>
        )}
        {/* A törlés akkor is elérhető, ha nincs lead — az eseményeket akkor is viszi. */}
        <DeleteSessionButton
          sessionId={run.sessionId}
          identity={identity}
          runCount={runCount}
          hasLead={lead !== null}
        />
        {lead?.followed_up_at && (
          <span className="text-[10px] text-muted-foreground">
            Follow-up: {dateFormat.format(new Date(lead.followed_up_at))}
          </span>
        )}
      </div>
    </div>
  )
}

export function SessionRuns({
  runs,
  leads,
  errors,
}: {
  runs: SessionRun[]
  leads: Map<string, DisplayLead>
  errors: ErrorSummary
}) {
  // A törlés a teljes munkamenetet viszi, ezért a megerősítésnek tudnia kell,
  // hány futás tűnik el vele.
  const runsPerSession = new Map<string, number>()
  for (const run of runs) {
    runsPerSession.set(
      run.sessionId,
      (runsPerSession.get(run.sessionId) ?? 0) + 1
    )
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      {runs.map((run) => (
        <RunRow
          key={run.id}
          run={run}
          lead={leads.get(run.sessionId) ?? null}
          runCount={runsPerSession.get(run.sessionId) ?? 1}
          errors={errors}
        />
      ))}
    </div>
  )
}
