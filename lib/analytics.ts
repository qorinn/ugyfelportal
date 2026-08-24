import {
  CALCULATOR_FUNNEL,
  CALCULATOR_OUTCOMES,
  EMAIL_TYPES,
  type EmailType,
  type FunnelOutcome,
  type FunnelStep,
} from "@/lib/funnel"

export type AnalyticsEvent = {
  session_id: string
  name: string
  props: Record<string, unknown> | null
  created_at: string
}

export type FunnelRow = {
  name: string
  label: string
  sessions: number
  // Az előző lépéshez mért átmenet. Az első lépésnél nincs értelme.
  conversionFromPrevious: number | null
  // A funnel első lépéséhez mért arány — ez adja a sáv szélességét.
  shareOfEntry: number
}

export type ProjectTypeRow = {
  projectType: string
  started: number
  completed: number
  emailSubmitted: number
  conversion: number
}

function sessionsWithEvent(
  events: readonly AnalyticsEvent[],
  name: string
): Set<string> {
  const sessions = new Set<string>()
  for (const event of events) {
    if (event.name === name) {
      sessions.add(event.session_id)
    }
  }
  return sessions
}

function ratio(part: number, whole: number): number {
  return whole === 0 ? 0 : (part / whole) * 100
}

export function buildFunnel(
  events: readonly AnalyticsEvent[],
  steps: readonly FunnelStep[] = CALCULATOR_FUNNEL
): FunnelRow[] {
  let previous: number | null = null
  let entry = 0

  return steps.map((step, index) => {
    const sessions = sessionsWithEvent(events, step.name).size

    if (index === 0) {
      entry = sessions
    }

    const row: FunnelRow = {
      name: step.name,
      label: step.label,
      sessions,
      conversionFromPrevious:
        previous === null ? null : ratio(sessions, previous),
      shareOfEntry: ratio(sessions, entry),
    }

    previous = sessions
    return row
  })
}

// A kimenetek nem a funnel folytatásai, hanem elágazás az utolsó lépés után,
// ezért mindkettőt ugyanahhoz az alaphoz mérjük.
export function buildOutcomes(
  events: readonly AnalyticsEvent[],
  baseline: number,
  outcomes: readonly FunnelOutcome[] = CALCULATOR_OUTCOMES
): FunnelRow[] {
  return outcomes.map((outcome) => {
    const sessions = sessionsWithEvent(events, outcome.name).size
    return {
      name: outcome.name,
      label: outcome.label,
      sessions,
      conversionFromPrevious: ratio(sessions, baseline),
      shareOfEntry: ratio(sessions, baseline),
    }
  })
}

// Egy session projectType-ja: az első esemény, amiben szerepel. A kalkulátoron
// belül ez nem változik, de a legkorábbi érték a legvédhetőbb választás.
function projectTypeBySession(
  events: readonly AnalyticsEvent[]
): Map<string, string> {
  const bySession = new Map<string, string>()

  for (const event of events) {
    if (bySession.has(event.session_id)) {
      continue
    }
    const projectType = event.props?.projectType
    if (typeof projectType === "string" && projectType !== "") {
      bySession.set(event.session_id, projectType)
    }
  }

  return bySession
}

export function buildProjectTypeBreakdown(
  events: readonly AnalyticsEvent[]
): ProjectTypeRow[] {
  const types = projectTypeBySession(events)
  const [entryStep, middleStep, lastStep] = CALCULATOR_FUNNEL

  const counters = new Map<
    string,
    { started: Set<string>; completed: Set<string>; email: Set<string> }
  >()

  for (const event of events) {
    const projectType = types.get(event.session_id)
    if (!projectType) {
      continue
    }

    let counter = counters.get(projectType)
    if (!counter) {
      counter = { started: new Set(), completed: new Set(), email: new Set() }
      counters.set(projectType, counter)
    }

    if (event.name === entryStep.name) counter.started.add(event.session_id)
    if (event.name === middleStep.name) counter.completed.add(event.session_id)
    if (event.name === lastStep.name) counter.email.add(event.session_id)
  }

  return [...counters.entries()]
    .map(([projectType, counter]) => ({
      projectType,
      started: counter.started.size,
      completed: counter.completed.size,
      emailSubmitted: counter.email.size,
      conversion: ratio(counter.email.size, counter.started.size),
    }))
    .sort((a, b) => b.started - a.started)
}

// --- Futások (egy indítástól a kimenetig) -----------------------------------

export type RunStepStatus = "reached" | "skipped" | "missing"

export type RunStep = {
  key: string
  label: string
  fullLabel: string
  status: RunStepStatus
  at: string | null
  msFromStart: number | null
  msFromPrevious: number | null
}

export type RunOutcome = {
  name: string
  label: string
  short: string
  at: string
}

export type EmailActivity = {
  emailType: EmailType
  // Valódi megnyitás. A prefetched a levelező proxyja (Apple Mail), nem ember —
  // egy számban keverve félrevezető lenne, ezért külön mezőben tartjuk.
  opened: boolean
  prefetchedOnly: boolean
  openedAt: string | null
  phoneClicked: boolean
  websiteClicked: boolean
  clickedAt: string | null
}

export type SessionRun = {
  id: string
  sessionId: string
  startedAt: string
  steps: RunStep[]
  outcomes: RunOutcome[]
  emails: Record<EmailType, EmailActivity>
  // null = az indításon kívül nem történt semmi. Nem nulla és nem végtelen: nem fejezte be.
  totalMs: number | null
}

export const OUTCOME_SLOT_KEY = "outcome"

const ENTRY_STEP = CALCULATOR_FUNNEL[0]
const OUTCOME_NAMES = new Set<string>(CALCULATOR_OUTCOMES.map((o) => o.name))

function toTime(iso: string): number {
  return new Date(iso).getTime()
}

// Egy session eseményeit futásokra vágjuk: minden calculator_started új futást nyit.
// Ami az első indítás elé esik (mert a session az időszak előtt kezdődött), az is
// kap egy futást — ott az indítás lépés kimaradtként jelenik meg.
function splitIntoRuns(
  sessionEvents: readonly AnalyticsEvent[]
): AnalyticsEvent[][] {
  const runs: AnalyticsEvent[][] = []

  for (const event of sessionEvents) {
    if (event.name === ENTRY_STEP.name || runs.length === 0) {
      runs.push([])
    }
    runs[runs.length - 1].push(event)
  }

  return runs
}

function buildEmailActivity(
  runEvents: readonly AnalyticsEvent[],
  emailType: EmailType
): EmailActivity {
  const relevant = runEvents.filter(
    (event) => event.props?.emailType === emailType
  )

  const opens = relevant.filter((event) => event.name === "email_opened")
  const realOpen = opens.find((event) => event.props?.prefetched !== true)
  const anyOpen = opens[0]

  const clicks = relevant.filter((event) => event.name === "email_link_clicked")
  const phoneClick = clicks.find((event) => event.props?.target === "phone")
  const websiteClick = clicks.find((event) => event.props?.target === "website")

  return {
    emailType,
    opened: realOpen !== undefined,
    prefetchedOnly: realOpen === undefined && anyOpen !== undefined,
    openedAt: (realOpen ?? anyOpen)?.created_at ?? null,
    phoneClicked: phoneClick !== undefined,
    websiteClicked: websiteClick !== undefined,
    clickedAt: (phoneClick ?? websiteClick)?.created_at ?? null,
  }
}

function buildRun(
  sessionId: string,
  runEvents: readonly AnalyticsEvent[]
): SessionRun {
  // Ugyanaz az esemény kétszer nem külön lépés — az elsőt tartjuk meg.
  const firstByName = new Map<string, AnalyticsEvent>()
  for (const event of runEvents) {
    if (!firstByName.has(event.name)) {
      firstByName.set(event.name, event)
    }
  }

  // A terv szerint a két kimenet egymást kizárja, de az adat ezt nem garantálja.
  // Ha mindkettő megérkezett, mindkettőt megmutatjuk — a valóság fontosabb.
  const outcomes: RunOutcome[] = CALCULATOR_OUTCOMES.flatMap((outcome) => {
    const event = firstByName.get(outcome.name)
    return event
      ? [
          {
            name: outcome.name,
            label: outcome.label,
            short: outcome.short,
            at: event.created_at,
          },
        ]
      : []
  }).sort((a, b) => toTime(a.at) - toTime(b.at))

  const outcomeEvent =
    runEvents.find((event) => OUTCOME_NAMES.has(event.name)) ?? null

  const slots = [
    ...CALCULATOR_FUNNEL.map((step) => ({
      key: step.name,
      label: step.short,
      fullLabel: step.label,
      event: firstByName.get(step.name) ?? null,
    })),
    {
      key: OUTCOME_SLOT_KEY,
      label: outcomes.length === 1 ? outcomes[0].short : "Kimenet",
      fullLabel:
        outcomes.length > 0
          ? outcomes.map((outcome) => outcome.label).join(" és ")
          : "Nem lépett tovább",
      event: outcomeEvent,
    },
  ]

  // Az utolsó elért lépés után minden "missing" (nem jutott el odáig), előtte
  // viszont minden hiányzó lépés "skipped" — azt tényleg kihagyta.
  const lastReached = slots.reduce(
    (last, slot, index) => (slot.event ? index : last),
    -1
  )

  const base = toTime(runEvents[0].created_at)
  let previousTime: number | null = null

  const steps: RunStep[] = slots.map((slot, index) => {
    const status: RunStepStatus = slot.event
      ? "reached"
      : index < lastReached
        ? "skipped"
        : "missing"

    if (!slot.event) {
      return {
        key: slot.key,
        label: slot.label,
        fullLabel: slot.fullLabel,
        status,
        at: null,
        msFromStart: null,
        msFromPrevious: null,
      }
    }

    const at = toTime(slot.event.created_at)
    const fromPrevious = previousTime === null ? null : at - previousTime
    previousTime = at

    return {
      key: slot.key,
      label: slot.label,
      fullLabel: slot.fullLabel,
      status,
      at: slot.event.created_at,
      msFromStart: at - base,
      // Az órák elcsúszhatnak a kliens- és szerveroldali események között;
      // negatív különbséget nem mutatunk, inkább semmit.
      msFromPrevious:
        fromPrevious !== null && fromPrevious >= 0 ? fromPrevious : null,
    }
  })

  // Szándékosan csak a lépések idejéből számol: egy levélmegnyitás két nappal
  // később is érkezhet, és a "3,5 p"-ből "2 nap" lenne.
  const reachedTimes = steps
    .map((step) => step.at)
    .filter((at): at is string => at !== null)
    .map(toTime)

  const emails = Object.fromEntries(
    EMAIL_TYPES.map((emailType) => [
      emailType,
      buildEmailActivity(runEvents, emailType),
    ])
  ) as Record<EmailType, EmailActivity>

  return {
    id: `${sessionId}-${runEvents[0].created_at}`,
    sessionId,
    startedAt: runEvents[0].created_at,
    steps,
    outcomes,
    emails,
    totalMs:
      reachedTimes.length > 1
        ? reachedTimes[reachedTimes.length - 1] - reachedTimes[0]
        : null,
  }
}

export function buildSessionRuns(
  events: readonly AnalyticsEvent[],
  limit: number
): SessionRun[] {
  const sorted = [...events].sort(
    (a, b) => toTime(a.created_at) - toTime(b.created_at)
  )

  const bySession = new Map<string, AnalyticsEvent[]>()
  for (const event of sorted) {
    const list = bySession.get(event.session_id)
    if (list) {
      list.push(event)
    } else {
      bySession.set(event.session_id, [event])
    }
  }

  const runs: SessionRun[] = []
  for (const [sessionId, sessionEvents] of bySession) {
    for (const runEvents of splitIntoRuns(sessionEvents)) {
      runs.push(buildRun(sessionId, runEvents))
    }
  }

  return runs
    .sort((a, b) => toTime(b.startedAt) - toTime(a.startedAt))
    .slice(0, limit)
}
