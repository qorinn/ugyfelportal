import { supabaseAdmin } from "@/lib/supabase"

// Dashboard-művelet, NEM szerver-szerver hívás: a jelszókapu mögött marad,
// ezért nincs kivéve a proxy matcheréből.
export async function POST(request: Request) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return new Response("Invalid JSON", { status: 400 })
  }

  const { sessionId, undo } = (payload ?? {}) as {
    sessionId?: unknown
    undo?: unknown
  }

  if (typeof sessionId !== "string" || sessionId === "") {
    return new Response("Invalid sessionId", { status: 400 })
  }

  const { error } = await supabaseAdmin()
    .from("leads")
    .update({
      followed_up_at: undo === true ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId)

  if (error) {
    console.error("followup update failed", error)
    return new Response("Update failed", { status: 500 })
  }

  return new Response(null, { status: 204 })
}
