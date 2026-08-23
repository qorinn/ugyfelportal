import { createHmac, timingSafeEqual } from "node:crypto"

export const SESSION_COOKIE_NAME = "dashboard_session"
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

function dashboardPassword(): string {
  const password = process.env.DASHBOARD_PASSWORD
  if (!password) {
    // Fail closed: env nélkül inkább hibázzon, mint hogy nyitva maradjon.
    throw new Error("Hiányzó DASHBOARD_PASSWORD környezeti változó.")
  }
  return password
}

// A cookie nem a jelszót tárolja, hanem egy lejárati időt és annak aláírását.
function sign(expiresAt: number): string {
  return createHmac("sha256", dashboardPassword())
    .update(String(expiresAt))
    .digest("hex")
}

function equalsInConstantTime(a: string, b: string): boolean {
  // A hashelés kiegyenlíti a hosszt, így a timingSafeEqual nem dob hosszeltérésre.
  const hashed = (value: string) =>
    createHmac("sha256", "length-guard").update(value).digest()
  return timingSafeEqual(hashed(a), hashed(b))
}

export function isCorrectPassword(candidate: string): boolean {
  return equalsInConstantTime(candidate, dashboardPassword())
}

export function createSessionToken(): string {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS
  return `${expiresAt}.${sign(expiresAt)}`
}

export function isValidSessionToken(token: string | undefined): boolean {
  if (!token) {
    return false
  }

  const separator = token.indexOf(".")
  if (separator === -1) {
    return false
  }

  const expiresAt = Number(token.slice(0, separator))
  const signature = token.slice(separator + 1)

  if (!Number.isSafeInteger(expiresAt) || expiresAt * 1000 <= Date.now()) {
    return false
  }

  return equalsInConstantTime(signature, sign(expiresAt))
}
