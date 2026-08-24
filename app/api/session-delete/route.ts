import { APP_ID } from "@/lib/funnel"
import { supabaseAdmin } from "@/lib/supabase"

// Dashboard-művelet, a jelszókapu mögött — nincs kivéve a proxy matcheréből.
// A törlés a teljes munkamenetre vonatkozik: az események és a lead is a
// session_id-re épül, ezért egy futás önmagában nem törölhető értelmesen.
export async function POST(request: Request) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return new Response("Invalid JSON", { status: 400 })
  }

  const { sessionId } = (payload ?? {}) as { sessionId?: unknown }

  if (typeof sessionId !== "string" || sessionId === "") {
    return new Response("Invalid sessionId", { status: 400 })
  }

  const supabase = supabaseAdmin()

  const { error: eventsError } = await supabase
    .from("events")
    .delete()
    .eq("app_id", APP_ID)
    .eq("session_id", sessionId)

  if (eventsError) {
    console.error("event delete failed", eventsError)
    return new Response("Delete failed", { status: 500 })
  }

  // A lead törlése akkor is fusson le, ha nincs ilyen sor — a delete nem hibázik.
  const { error: leadError } = await supabase
    .from("leads")
    .delete()
    .eq("app_id", APP_ID)
    .eq("session_id", sessionId)

  if (leadError) {
    console.error("lead delete failed", leadError)
    return new Response("Delete failed", { status: 500 })
  }

  return new Response(null, { status: 204 })
}
