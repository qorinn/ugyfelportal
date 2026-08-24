import {
  ALLOWED_PROPS,
  EMAIL_EVENT_PREFIX,
  KNOWN_EVENT_NAMES,
  isEmailType,
} from "@/lib/funnel"
import { supabaseAdmin } from "@/lib/supabase"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Csak a whitelistelt kulcsok mennek be, a várt típussal. A props-ba soha nem
// kerülhet személyes adat — ezt itt szűrjük, nem a hívó jóindulatára bízzuk.
function sanitizeProps(input: unknown): Record<string, string | boolean> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {}
  }

  const source = input as Record<string, unknown>
  const props: Record<string, string | boolean> = {}

  for (const [key, expected] of Object.entries(ALLOWED_PROPS)) {
    const value = source[key]

    if (expected === "string" && typeof value === "string" && value !== "") {
      props[key] = value
    }

    if (expected === "boolean" && typeof value === "boolean") {
      props[key] = value
    }
  }

  return props
}

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

  if (typeof sessionId !== "string" || !UUID_PATTERN.test(sessionId)) {
    return new Response("Invalid sessionId", { status: 400 })
  }

  if (typeof name !== "string" || !KNOWN_EVENT_NAMES.has(name)) {
    return new Response("Unknown event", { status: 400 })
  }

  const sanitized = sanitizeProps(props)

  // A levélesemény emailType nélkül értelmezhetetlen: nem tudnánk megmondani,
  // melyik levélről szól. Inkább visszautasítjuk, mint hogy besorolhatatlan
  // sor kerüljön a táblába.
  if (
    name.startsWith(EMAIL_EVENT_PREFIX) &&
    !isEmailType(sanitized.emailType)
  ) {
    return new Response("Invalid emailType", { status: 400 })
  }

  const { error } = await supabaseAdmin().from("events").insert({
    app_id: appId,
    session_id: sessionId,
    name,
    props: sanitized,
  })

  if (error) {
    console.error("event insert failed", error)
    return new Response("Insert failed", { status: 500 })
  }

  return new Response(null, { status: 204 })
}
