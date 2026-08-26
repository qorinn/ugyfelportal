// A paladi-web /api/track proxyja hitelesítés nélküli és nyilvános, tehát bárki
// küldhet ide tetszőleges props-t. A kliensoldali 200 karakteres vágás nem
// védelem, csak kényelem — a korlátot itt kell kikényszeríteni.
//
// Kulcs-whitelist helyett clamp: a hiba-props kulcsai stage-függők (filename,
// componentStack, intent, reason, questionId), és egy új mező nem igényelhet
// portál-deployt. Cserébe a props nem tekinthető megbízható adatnak.

export const MAX_KEYS = 24
export const MAX_KEY_LENGTH = 64
export const MAX_STRING = 300 // a kliens 200-at küld; a fejtér a jövőbeli mezőknek szól
export const MAX_PROPS_BYTES = 4096

export type ClampedProps = Record<string, string | number | boolean>

export function clampProps(raw: unknown): ClampedProps {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {}
  }

  const out: ClampedProps = {}

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Object.keys(out).length >= MAX_KEYS) {
      break
    }
    if (key.length > MAX_KEY_LENGTH) {
      continue
    }

    // Csak skalárt fogadunk: a beágyazott objektum se nem várt, se nem hasznos.
    if (typeof value === "string") {
      out[key] = value.slice(0, MAX_STRING)
    } else if (typeof value === "number" && Number.isFinite(value)) {
      out[key] = value
    } else if (typeof value === "boolean") {
      out[key] = value
    }
  }

  // Végső védőháló a jsonb oszlopnak. A stage és a source megmarad, hogy a
  // csonkolt sor is besorolható legyen.
  if (JSON.stringify(out).length > MAX_PROPS_BYTES) {
    return {
      _truncated: true,
      ...(typeof out.stage === "string" ? { stage: out.stage } : {}),
      ...(typeof out.source === "string" ? { source: out.source } : {}),
    }
  }

  return out
}
