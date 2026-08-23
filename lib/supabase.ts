import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// service_role kliens — kizárólag szerveroldalon. Megkerüli az RLS-t, ezért
// soha nem kerülhet kliens bundle-be.
import "server-only"

let cached: SupabaseClient | null = null

export function supabaseAdmin(): SupabaseClient {
  if (cached) {
    return cached
  }

  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Hiányzó SUPABASE_URL vagy SUPABASE_SERVICE_ROLE_KEY környezeti változó."
    )
  }

  // Lusta példányosítás: build közben nincs env, és nem is kell.
  cached = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return cached
}
