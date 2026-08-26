import type { AnalyticsEvent } from "@/lib/analytics"
import {
  ERROR_EVENT_NAME,
  ERROR_STAGE_LABELS,
  MANUAL_FOLLOWUP_STAGE,
} from "@/lib/funnel"

// A hiba-props stage-függő kulcsai, amiket a fő mezőkön túl külön kiírunk.
const EXTRA_KEYS = [
  "filename",
  "componentStack",
  "intent",
  "reason",
  "questionId",
] as const

export type CalculatorError = {
  sessionId: string
  createdAt: string
  source: string
  stage: string
  stageLabel: string
  message: string
  fatal: boolean
  status: number | null
  extras: { key: string; value: string }[]
  truncated: boolean
}

export type StageRow = {
  stage: string
  label: string
  sessions: number
  events: number
  fatal: boolean
}

export type StageStatusRow = {
  key: string
  stage: string
  label: string
  status: string
  sessions: number
  events: number
}

export type ManualFollowupRow = {
  sessionId: string
  at: string
  message: string
}

export type ErrorSummary = {
  startedSessions: number
  errorSessions: number
  fatalSessions: number
  errorRate: number
  clientEvents: number
  serverEvents: number
  totalEvents: number
  byStage: StageRow[]
  byStageStatus: StageStatusRow[]
  manualFollowups: ManualFollowupRow[]
  recent: CalculatorError[]
  // Amelyik munkamenetben bármilyen hiba történt — a futás-kártya ebből teszi
  // ki a jelzést.
  sessionsWithError: Set<string>
  fatalSessionIds: Set<string>
  manualFollowupSessions: Set<string>
}

function text(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function stageLabel(stage: string): string {
  return ERROR_STAGE_LABELS[stage] ?? stage
}

export function parseErrors(
  events: readonly AnalyticsEvent[]
): CalculatorError[] {
  return events
    .filter((event) => event.name === ERROR_EVENT_NAME)
    .map((event) => {
      const props = event.props ?? {}
      const stage = text(props.stage) || "ismeretlen"
      const status = props.status

      return {
        sessionId: event.session_id,
        createdAt: event.created_at,
        source: text(props.source) || "ismeretlen",
        stage,
        stageLabel: stageLabel(stage),
        message: text(props.message),
        fatal: props.fatal === true,
        status: typeof status === "number" ? status : null,
        extras: EXTRA_KEYS.flatMap((key) => {
          const value = props[key]
          return typeof value === "string" && value !== ""
            ? [{ key, value }]
            : []
        }),
        truncated: props._truncated === true,
      }
    })
}

function groupBy(
  rows: readonly CalculatorError[],
  keyOf: (row: CalculatorError) => string
) {
  const sessions = new Map<string, Set<string>>()
  const events = new Map<string, number>()

  for (const row of rows) {
    const key = keyOf(row)
    let set = sessions.get(key)
    if (!set) {
      set = new Set<string>()
      sessions.set(key, set)
    }
    set.add(row.sessionId)
    events.set(key, (events.get(key) ?? 0) + 1)
  }

  return { sessions, events }
}

export function buildErrorSummary(
  events: readonly AnalyticsEvent[],
  startedEventName: string,
  recentLimit: number
): ErrorSummary {
  const rows = parseErrors(events)

  const startedSessions = new Set(
    events
      .filter((event) => event.name === startedEventName)
      .map((event) => event.session_id)
  )

  // Sorokat NE számolj: egy elhasalt ajánlatkérés a kliensről és a szerverről is
  // jelentkezik ugyanazzal a session_id-vel. Két nézőpont, nem két eset.
  const sessionsWithError = new Set(rows.map((row) => row.sessionId))
  const fatalSessionIds = new Set(
    rows.filter((row) => row.fatal).map((row) => row.sessionId)
  )

  const stages = groupBy(rows, (row) => row.stage)
  const byStage: StageRow[] = [...stages.sessions.entries()]
    .map(([stage, sessions]) => ({
      stage,
      label: stageLabel(stage),
      sessions: sessions.size,
      events: stages.events.get(stage) ?? 0,
      fatal: rows.some((row) => row.stage === stage && row.fatal),
    }))
    .sort((a, b) => b.sessions - a.sessions)

  const stageStatus = groupBy(rows, (row) => `${row.stage}|${row.status ?? ""}`)
  const byStageStatus: StageStatusRow[] = [...stageStatus.sessions.entries()]
    .map(([key, sessions]) => {
      const separator = key.lastIndexOf("|")
      const stage = key.slice(0, separator)
      const status = key.slice(separator + 1)

      return {
        key,
        stage,
        label: stageLabel(stage),
        status: status === "" ? "—" : status,
        sessions: sessions.size,
        events: stageStatus.events.get(key) ?? 0,
      }
    })
    .sort((a, b) => b.sessions - a.sessions)

  // Munkamenetenként egy teendő, a legkorábbi hibával — nem soronként.
  const manualBySession = new Map<string, ManualFollowupRow>()
  for (const row of rows) {
    if (row.stage !== MANUAL_FOLLOWUP_STAGE) {
      continue
    }
    const existing = manualBySession.get(row.sessionId)
    if (!existing || row.createdAt < existing.at) {
      manualBySession.set(row.sessionId, {
        sessionId: row.sessionId,
        at: row.createdAt,
        message: row.message,
      })
    }
  }

  const ratio = (part: number, whole: number) =>
    whole === 0 ? 0 : part / whole

  return {
    startedSessions: startedSessions.size,
    errorSessions: sessionsWithError.size,
    fatalSessions: fatalSessionIds.size,
    errorRate: ratio(sessionsWithError.size, startedSessions.size),
    clientEvents: rows.filter((row) => row.source === "client").length,
    serverEvents: rows.filter((row) => row.source === "server").length,
    totalEvents: rows.length,
    byStage,
    byStageStatus,
    manualFollowups: [...manualBySession.values()].sort((a, b) =>
      a.at < b.at ? 1 : -1
    ),
    recent: [...rows]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, recentLimit),
    sessionsWithError,
    fatalSessionIds,
    manualFollowupSessions: new Set(manualBySession.keys()),
  }
}
