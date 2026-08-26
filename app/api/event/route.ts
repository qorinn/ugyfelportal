import { KNOWN_EVENT_NAMES } from "@/lib/funnel"
import { clampProps } from "@/lib/props"
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

  const { appId, sessionId, name, props } = (payload ?? {}) as {
    appId?: unknown
    sessionId?: unknown
    name?: unknown
    props?: unknown
  }

  if (typeof appId !== "string" || appId === "") {
    return new Response("Invalid appId", { status: 400 })
  }

  // Az insert ne az adatbázis szintjén haljon el: a session_id uuid not null.
  if (typeof sessionId !== "string" || !UUID_PATTERN.test(sessionId)) {
    return new Response("Invalid sessionId", { status: 400 })
  }

  if (typeof name !== "string" || !KNOWN_EVENT_NAMES.has(name)) {
    return new Response("Unknown event", { status: 400 })
  }

  const { error } = await supabaseAdmin()
    .from("events")
    .insert({
      app_id: appId,
      session_id: sessionId,
      name,
      props: clampProps(props),
    })

  if (error) {
    console.error("event insert failed", error)
    return new Response("Insert failed", { status: 500 })
  }

  return new Response(null, { status: 204 })
}
