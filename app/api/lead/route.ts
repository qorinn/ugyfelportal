import { isLeadStatus, mergeLead, type LeadRow } from "@/lib/leads"
import { supabaseAdmin } from "@/lib/supabase"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  const secret = process.env.INGEST_SECRET
  if (!secret) {
    return new Response("Server misconfigured", { status: 500 })
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return new Response("Invalid JSON", { status: 400 })
  }

  const body = (payload ?? {}) as Record<string, unknown>
  const { appId, sessionId, email, status } = body

  if (typeof appId !== "string" || appId === "") {
    return new Response("Invalid appId", { status: 400 })
  }

  if (typeof sessionId !== "string" || !UUID_PATTERN.test(sessionId)) {
    return new Response("Invalid sessionId", { status: 400 })
  }

  if (typeof email !== "string" || email.trim() === "") {
    return new Response("Invalid email", { status: 400 })
  }

  if (!isLeadStatus(status)) {
    return new Response("Invalid status", { status: 400 })
  }

  const supabase = supabaseAdmin()

  // Olvasás, majd írás: a két összeolvasztási szabályt (az állapot csak
  // erősödhet, üres mező nem ír felül) így lehet olvashatóan kifejezni.
  // A forgalom napi néhány tucat lead, itt a versenyhelyzet elhanyagolható.
  const { data: existing, error: readError } = await supabase
    .from("leads")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle()

  if (readError) {
    console.error("lead read failed", readError)
    return new Response("Read failed", { status: 500 })
  }

  const merged = mergeLead(
    {
      sessionId,
      appId,
      email,
      name: body.name,
      phone: body.phone,
      projectType: body.projectType,
      service: body.service,
      estimateLow: body.estimateLow,
      estimateHigh: body.estimateHigh,
      durationLabel: body.durationLabel,
      projectBrief: body.projectBrief,
      status,
    },
    (existing as LeadRow | null) ?? null
  )

  const { error: writeError } = await supabase
    .from("leads")
    .upsert(merged, { onConflict: "session_id" })

  if (writeError) {
    console.error("lead upsert failed", writeError)
    return new Response("Upsert failed", { status: 500 })
  }

  return new Response(null, { status: 204 })
}
