import "server-only"

import type { AnalyticsEvent } from "@/lib/analytics"
import { APP_ID } from "@/lib/funnel"
import type { LinkHubEvent, LinkHubLink } from "@/lib/link-hub-analytics"
import { collectPaginated } from "@/lib/pagination"
import { supabaseAdmin } from "@/lib/supabase"

export const SUMMARY_PERIODS = [30, 60, 90, 180] as const
export const DETAIL_PERIODS = [7, 30, 60, 90, 180] as const

export type AnalyticsPeriod = (typeof DETAIL_PERIODS)[number] | "all"

export function parseAnalyticsPeriod(
  value: string | string[] | undefined,
  allowed: readonly number[] = DETAIL_PERIODS
): AnalyticsPeriod {
  const candidate = Array.isArray(value) ? value[0] : value
  if (candidate === "all") return "all"

  const days = Number(candidate)
  return allowed.includes(days) ? (days as AnalyticsPeriod) : 30
}

export function analyticsPeriodLabel(period: AnalyticsPeriod) {
  return period === "all" ? "Teljes időszak" : `Utolsó ${period} nap`
}

export function analyticsPeriodStart(period: AnalyticsPeriod, now: Date) {
  return period === "all"
    ? null
    : new Date(now.getTime() - period * 24 * 60 * 60 * 1_000)
}

export async function loadCalculatorEvents(
  period: AnalyticsPeriod,
  now: Date,
  names?: readonly string[]
) {
  const since = analyticsPeriodStart(period, now)
  const events = await collectPaginated<AnalyticsEvent>(async (from, to) => {
    let query = supabaseAdmin()
      .from("events")
      .select("id, session_id, name, props, created_at")
      .eq("app_id", APP_ID)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to)

    if (since) query = query.gte("created_at", since.toISOString())
    if (names?.length) query = query.in("name", [...names])

    const { data, error } = await query
    if (error) throw new Error(error.message)
    return (data ?? []) as AnalyticsEvent[]
  })

  return { events, since }
}

export async function loadLinkHubEvents(period: AnalyticsPeriod, now: Date) {
  const since = analyticsPeriodStart(period, now)
  const events = await collectPaginated<LinkHubEvent>(async (from, to) => {
    let query = supabaseAdmin()
      .from("analytics_events")
      .select("id, event_type, link_id, session_id, utm_source, created_at")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to)

    if (since) query = query.gte("created_at", since.toISOString())

    const { data, error } = await query
    if (error) throw new Error(error.message)
    return (data ?? []) as LinkHubEvent[]
  })

  return { events, since }
}

export async function loadLinkHubLinks() {
  const { data, error } = await supabaseAdmin()
    .from("links")
    .select("id, label, target_url")

  if (error) throw new Error(error.message)
  return (data ?? []) as LinkHubLink[]
}
