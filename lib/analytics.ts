import {
  CALCULATOR_FUNNEL,
  CALCULATOR_OUTCOMES,
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
